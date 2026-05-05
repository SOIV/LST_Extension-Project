import { createClient } from "@/lib/supabase/server";

/** GET /api/creator/pending — 승인 대기 자막 트랙 */
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // 플랫폼 어드민 여부 확인
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  // 어드민은 전체 pending 트랙 조회
  if (isAdmin) {
    const { data: tracks, error } = await supabase
      .from("subtitle_tracks")
      .select(`
        id,
        language_code,
        status,
        created_at,
        videos(id, youtube_video_id, youtube_channel_id, title)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json({ error: "조회 실패" }, { status: 500 });
    }
    return Response.json({ tracks: tracks ?? [], isAdmin: true });
  }

  // 일반 유저: 내 연동 채널의 pending 트랙만
  const { data: myChannels } = await supabase
    .from("connected_creators")
    .select("youtube_channel_id")
    .eq("user_id", user.id);

  if (!myChannels || myChannels.length === 0) {
    return Response.json({ tracks: [], isAdmin: false });
  }

  const channelIds = myChannels.map((c) => c.youtube_channel_id);

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

  return Response.json({ tracks: tracks ?? [], isAdmin: false });
}
