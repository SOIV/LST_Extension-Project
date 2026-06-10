import { createClient } from "@/lib/supabase/server";
import { getVideoById } from "@/lib/youtube";
import { type NextRequest } from "next/server";

/** PATCH /api/tracks/[trackId] — 자막 트랙 상태 변경 (승인/거절) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = (await request.json()) as { status?: string };
  if (status !== "approved" && status !== "rejected") {
    return Response.json({ error: "status는 'approved' 또는 'rejected'여야 합니다." }, { status: 400 });
  }

  // 플랫폼 어드민 여부 확인
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  // 어드민은 채널 소유권 검증 없이 바로 업데이트
  if (isAdmin) {
    const { error: updateError } = await supabase
      .from("subtitle_tracks")
      .update({ status })
      .eq("id", trackId);

    if (updateError) {
      return Response.json({ error: "상태 업데이트 실패" }, { status: 500 });
    }
    return Response.json({ success: true, status });
  }

  // 트랙 조회 (영상 정보 포함)
  const { data: track } = await supabase
    .from("subtitle_tracks")
    .select("id, video_id, language_code, videos(id, youtube_video_id, youtube_channel_id)")
    .eq("id", trackId)
    .single();

  if (!track) {
    return Response.json({ error: "자막 트랙을 찾을 수 없습니다." }, { status: 404 });
  }

  const video = Array.isArray(track.videos) ? track.videos[0] : track.videos;
  if (!video) {
    return Response.json({ error: "영상 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  // youtube_channel_id 없으면 YouTube API로 보조 조회 후 저장
  let channelId = (video as { youtube_channel_id?: string }).youtube_channel_id ?? null;
  if (!channelId) {
    if (!process.env.YOUTUBE_API_KEY) {
      return Response.json(
        { error: "채널 정보가 없어 권한을 확인할 수 없습니다. YouTube API 키를 설정하거나 영상을 다시 업로드해주세요." },
        { status: 422 }
      );
    }
    try {
      const ytVideo = await getVideoById((video as { youtube_video_id: string }).youtube_video_id);
      if (ytVideo) {
        channelId = ytVideo.channelId;
        await supabase
          .from("videos")
          .update({ youtube_channel_id: channelId })
          .eq("id", video.id);
      }
    } catch {
      // YouTube API 실패 시 권한 확인 불가
    }
  }

  if (!channelId) {
    return Response.json({ error: "채널 정보를 확인할 수 없습니다." }, { status: 422 });
  }

  // 연동된 크리에이터인지 확인
  const { data: creator } = await supabase
    .from("connected_creators")
    .select("id")
    .eq("youtube_channel_id", channelId)
    .eq("user_id", user.id)
    .single();

  if (!creator) {
    return Response.json({ error: "이 채널의 자막을 승인/거절할 권한이 없습니다." }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from("subtitle_tracks")
    .update({ status })
    .eq("id", trackId);

  if (updateError) {
    return Response.json({ error: "상태 업데이트 실패" }, { status: 500 });
  }

  // 승인 시 YouTube 업로드 대기열에 추가 (non-fatal)
  if (status === "approved") {
    try {
      const youtubeVideoId = (video as { youtube_video_id: string }).youtube_video_id;

      // 현재 리비전의 storage_path, format 조회
      const { data: currentRevision } = await supabase
        .from("subtitle_revisions")
        .select("storage_path, format")
        .eq("track_id", trackId)
        .eq("is_current", true)
        .single();

      if (currentRevision) {
        // 같은 track_id가 이미 있으면 upsert (재승인 시 최신 리비전으로 갱신)
        await supabase.from("youtube_upload_queue").upsert(
          {
            track_id: trackId,
            youtube_video_id: youtubeVideoId,
            youtube_channel_id: channelId,
            user_id: user.id,
            language_code: track.language_code,
            storage_path: currentRevision.storage_path,
            format: currentRevision.format,
            status: "pending",
            error_message: null,
            processed_at: null,
          },
          { onConflict: "track_id" }
        );
      }
    } catch {
      // 대기열 추가 실패는 승인 결과에 영향 없음
    }
  }

  return Response.json({ success: true, status });
}
