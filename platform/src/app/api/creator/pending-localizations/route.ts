import { createClient } from "@/lib/supabase/server";

/** GET /api/creator/pending-localizations — 승인 대기 제목/설명 번역 */
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  if (isAdmin) {
    const { data: localizations, error } = await supabase
      .from("video_localizations")
      .select(`
        id,
        language_code,
        title,
        description,
        status,
        created_at,
        videos(id, youtube_video_id, youtube_channel_id, title)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) return Response.json({ error: "조회 실패" }, { status: 500 });
    return Response.json({ localizations: localizations ?? [], isAdmin: true });
  }

  const { data: myChannels } = await supabase
    .from("connected_creators")
    .select("youtube_channel_id")
    .eq("user_id", user.id);

  if (!myChannels || myChannels.length === 0) {
    return Response.json({ localizations: [], isAdmin: false });
  }

  const channelIds = myChannels.map((c) => c.youtube_channel_id);

  const { data: localizations, error } = await supabase
    .from("video_localizations")
    .select(`
      id,
      language_code,
      title,
      description,
      status,
      created_at,
      videos!inner(id, youtube_video_id, youtube_channel_id, title)
    `)
    .eq("status", "pending")
    .in("videos.youtube_channel_id", channelIds)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: "조회 실패" }, { status: 500 });

  return Response.json({ localizations: localizations ?? [], isAdmin: false });
}
