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
