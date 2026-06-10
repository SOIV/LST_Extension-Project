import { createClient } from "@/lib/supabase/server";
import { decryptYoutubeToken, encryptYoutubeToken } from "@/lib/youtubeTokenCrypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const YT_BASE = "https://www.googleapis.com/youtube/v3";

export type VideoLocalization = {
  title: string;
  description: string;
};

type TokenRow = {
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: string | null;
};

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
} | null> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data.access_token) return null;
  return { access_token: data.access_token, expires_in: data.expires_in ?? 3600 };
}

/**
 * DB에서 토큰을 꺼내 유효한 access token을 반환한다.
 * 만료됐으면 refresh_token으로 갱신 후 DB 업데이트.
 */
export async function getValidAccessToken(
  youtubeChannelId: string,
  userId: string
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("creator_youtube_tokens")
    .select("access_token_encrypted, refresh_token_encrypted, expires_at")
    .eq("youtube_channel_id", youtubeChannelId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  const row = data as TokenRow;

  // 만료까지 60초 이상 남았으면 현재 access token 사용
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 60_000) {
    return decryptYoutubeToken(row.access_token_encrypted);
  }

  // 갱신 필요
  const refreshToken = decryptYoutubeToken(row.refresh_token_encrypted);
  const refreshed = await refreshAccessToken(refreshToken);
  if (!refreshed) return null;

  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase
    .from("creator_youtube_tokens")
    .update({
      access_token_encrypted: encryptYoutubeToken(refreshed.access_token),
      expires_at: newExpiresAt,
    })
    .eq("youtube_channel_id", youtubeChannelId)
    .eq("user_id", userId);

  return refreshed.access_token;
}

/** multipart/related 요청 바디 생성 */
function buildMultipartBody(
  boundary: string,
  metadata: object,
  content: string,
  contentType: string
): string {
  return (
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${contentType}; charset=UTF-8\r\n\r\n` +
    content + `\r\n` +
    `--${boundary}--`
  );
}

/**
 * YouTube Captions API — 자막 트랙 업로드 (upsert)
 * - 이미 "LST Project" 이름의 캡션이 있으면 UPDATE, 없으면 INSERT
 * - 필요 스코프: youtube.force-ssl
 */
export async function uploadCaptionTrack(
  accessToken: string,
  youtubeVideoId: string,
  languageCode: string,
  content: string,
  format: string
): Promise<{ ok: boolean; error?: string }> {
  const CAPTION_NAME = "LST Project";
  const UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3/captions";

  // 1. 기존 캡션 목록 조회 → "LST Project" 이름의 캡션 ID 탐색
  let existingCaptionId: string | null = null;
  try {
    const listRes = await fetch(
      `${YT_BASE}/captions?part=snippet&videoId=${youtubeVideoId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (listRes.ok) {
      const listData = await listRes.json() as { items?: Array<{ id: string; snippet: { language: string; name: string } }> };
      for (const item of listData.items ?? []) {
        if (item.snippet?.language === languageCode && item.snippet?.name === CAPTION_NAME) {
          existingCaptionId = item.id;
          break;
        }
      }
    }
  } catch {
    // 목록 조회 실패 시 insert로 fallback
  }

  const contentType = format === "vtt" ? "text/vtt" : "text/plain";
  const boundary = `lst_boundary_${Date.now()}`;

  if (existingCaptionId) {
    // 2a. 기존 캡션 업데이트
    const body = buildMultipartBody(
      boundary,
      { id: existingCaptionId, snippet: { videoId: youtubeVideoId, language: languageCode, name: CAPTION_NAME, isDraft: false } },
      content,
      contentType
    );
    const res = await fetch(`${UPLOAD_BASE}?part=snippet&uploadType=multipart`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      return { ok: false, error: err.error?.message ?? res.statusText };
    }
    return { ok: true };
  } else {
    // 2b. 새 캡션 삽입
    const body = buildMultipartBody(
      boundary,
      { snippet: { videoId: youtubeVideoId, language: languageCode, name: CAPTION_NAME, isDraft: false } },
      content,
      contentType
    );
    const res = await fetch(`${UPLOAD_BASE}?part=snippet&uploadType=multipart`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      return { ok: false, error: err.error?.message ?? res.statusText };
    }
    return { ok: true };
  }
}

/**
 * YouTube videos.update — localizations 필드 업데이트
 * part=localizations 만 전송하므로 snippet 변경 없음
 */
export async function updateVideoLocalizations(
  accessToken: string,
  videoId: string,
  localizations: Record<string, VideoLocalization>
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${YT_BASE}/videos?part=localizations`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: videoId, localizations }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { error?: { message?: string } }).error?.message ?? res.statusText;
    return { ok: false, error: message };
  }

  return { ok: true };
}
