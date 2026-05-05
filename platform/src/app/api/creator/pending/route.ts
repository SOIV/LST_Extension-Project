import { createClient } from "@/lib/supabase/server";

/** GET /api/creator/pending — 내 채널에 대한 승인 대기 자막 트랙 */
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // 내 연동 채널 목록
  const { data: myChannels } = await supabase
    .from("connected_creators")
    .select("youtube_channel_id")
    .eq("user_id", user.id);

  if (!myChannels || myChannels.length === 0) {
    return Response.json({ tracks: [] });
  }

  const channelIds = myChannels.map((c) => c.youtube_channel_id);

  // 해당 채널의 영상에 달린 pending 트랙 조회
  const { data: tracks, error } = await supabase
    .from("subtitle_tracks")
    .select(`
      id,
      language_code,
      status,
      created_at,
      videos!inner(id, youtube_video_id, youtube_channel_id, title)
    `)
    .eq("status", "pending")
    .in("videos.youtube_channel_id", channelIds)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: "조회 실패" }, { status: 500 });
  }

  return Response.json({ tracks: tracks ?? [] });
}
