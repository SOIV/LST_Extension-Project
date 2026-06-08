import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken, updateVideoLocalizations } from "@/lib/youtubeCreatorApi";
import { NextRequest, NextResponse } from "next/server";

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ── 승인/거절: 채널 소유자만 가능 ────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ localizationId: string }> }
) {
  const { localizationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON");
  }

  const { status } = body as { status?: string };
  if (status !== "approved" && status !== "rejected") {
    return err("status must be 'approved' or 'rejected'");
  }

  // localization + video + 채널 소유권 한번에 조회
  const { data: loc } = await supabase
    .from("video_localizations")
    .select(`
      id,
      language_code,
      title,
      description,
      videos (
        id,
        youtube_video_id,
        youtube_channel_id
      )
    `)
    .eq("id", localizationId)
    .single();

  if (!loc) return err("Localization not found", 404);

  const video = (Array.isArray(loc.videos) ? loc.videos[0] : loc.videos) as {
    id: string;
    youtube_video_id: string;
    youtube_channel_id: string | null;
  } | null;

  if (!video?.youtube_channel_id) return err("Channel not linked to this video", 400);

  // 채널 소유자인지 확인
  const { data: connection } = await supabase
    .from("connected_creators")
    .select("youtube_channel_id")
    .eq("youtube_channel_id", video.youtube_channel_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) return err("Forbidden", 403);

  // status 업데이트
  const { error: updateError } = await supabase
    .from("video_localizations")
    .update({ status })
    .eq("id", localizationId);

  if (updateError) return err(updateError.message, 500);

  // 승인 시 YouTube videos.update 호출
  if (status === "approved") {
    const accessToken = await getValidAccessToken(video.youtube_channel_id, user.id);
    if (accessToken) {
      await updateVideoLocalizations(accessToken, video.youtube_video_id, {
        [loc.language_code]: { title: loc.title, description: loc.description },
      });
      // YouTube API 실패해도 승인 자체는 성공 처리 (비동기 재시도 여지)
    }
  }

  return NextResponse.json({ ok: true });
}
