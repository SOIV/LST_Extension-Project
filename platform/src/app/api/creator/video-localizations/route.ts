import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getVideoById } from "@/lib/youtube";

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ── 제출: 로그인 유저면 누구든 가능 ──────────────────────────────────────────
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

  const { videoId, languageCode, title, description } = body as {
    videoId?: string;
    languageCode?: string;
    title?: string;
    description?: string;
  };

  if (!videoId || typeof videoId !== "string") return err("videoId is required");
  if (!languageCode || typeof languageCode !== "string" || languageCode.trim().length < 2) {
    return err("languageCode is required");
  }
  if (!title || typeof title !== "string" || !title.trim()) return err("title is required");

  // videos 테이블에서 video_id 조회
  let { data: video } = await supabase
    .from("videos")
    .select("id")
    .eq("youtube_video_id", videoId)
    .single();

  // 크리에이터 미연동 영상 → YouTube API로 정보 가져와서 자동 생성
  if (!video) {
    try {
      const yt = await getVideoById(videoId);
      if (!yt) return err("Video not found", 404);

      const { data: newVideo } = await supabase
        .from("videos")
        .insert({
          youtube_video_id: videoId,
          youtube_channel_id: yt.channelId,
          title: yt.title,
          channel_name: yt.channelTitle,
        })
        .select("id")
        .single();

      if (!newVideo) return err("Failed to create video record", 500);
      video = newVideo;
    } catch {
      return err("Video not found", 404);
    }
  }

  const { error } = await supabase
    .from("video_localizations")
    .insert({
      video_id: video.id,
      language_code: languageCode.trim(),
      title: title.trim(),
      description: (description ?? "").trim(),
      contributor_id: user.id,
      status: "pending",
    });

  if (error) return err(error.message, 500);

  return NextResponse.json({ ok: true });
}
