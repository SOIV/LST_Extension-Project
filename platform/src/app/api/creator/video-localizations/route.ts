import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken, updateVideoLocalizations, VideoLocalization } from "@/lib/youtubeCreatorApi";
import { NextRequest, NextResponse } from "next/server";

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON");
  }

  const { videoId, localizations } = body as {
    videoId?: string;
    localizations?: Record<string, VideoLocalization>;
  };

  if (!videoId || typeof videoId !== "string") {
    return err("videoId is required");
  }
  if (!localizations || typeof localizations !== "object" || Object.keys(localizations).length === 0) {
    return err("localizations is required");
  }

  // localizations 유효성 검사
  for (const [lang, entry] of Object.entries(localizations)) {
    if (typeof lang !== "string" || lang.length < 2) {
      return err(`Invalid language code: ${lang}`);
    }
    if (!entry?.title || typeof entry.title !== "string") {
      return err(`title is required for language: ${lang}`);
    }
  }

  // 이 영상의 채널 소유권 확인 (YouTube API로 채널 ID 조회)
  const ytApiKey = process.env.YOUTUBE_API_KEY;
  if (!ytApiKey) return err("YouTube API not configured", 500);

  const videoRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${ytApiKey}`
  );
  if (!videoRes.ok) return err("Failed to fetch video info", 502);

  const videoData = await videoRes.json();
  const videoItem = videoData.items?.[0];
  if (!videoItem) return err("Video not found", 404);

  const youtubeChannelId: string = videoItem.snippet?.channelId;
  if (!youtubeChannelId) return err("Could not determine channel ID", 502);

  // 사용자가 이 채널을 연동했는지 확인
  const { data: connection } = await supabase
    .from("connected_creators")
    .select("youtube_channel_id")
    .eq("youtube_channel_id", youtubeChannelId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) return err("You don't own this video's channel", 403);

  // 유효한 access token 획득
  const accessToken = await getValidAccessToken(youtubeChannelId, user.id);
  if (!accessToken) return err("Failed to get YouTube access token. Please reconnect your channel.", 401);

  // YouTube videos.update 호출
  const result = await updateVideoLocalizations(accessToken, videoId, localizations);
  if (!result.ok) {
    return err(result.error ?? "Failed to update video localizations", 502);
  }

  return NextResponse.json({ ok: true });
}
