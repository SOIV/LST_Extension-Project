import { createClient } from "@/lib/supabase/server";

/** POST /api/creator/connect — 채널 연동 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  return Response.json(
    { error: "채널 연동은 YouTube OAuth 인증으로만 가능합니다." },
    { status: 405 }
  );
}

/** DELETE /api/creator/connect — 채널 연동 해제 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId } = (await request.json()) as { channelId?: string };
  if (!channelId) {
    return Response.json({ error: "channelId가 필요합니다." }, { status: 400 });
  }

  const { error } = await supabase
    .from("connected_creators")
    .delete()
    .eq("youtube_channel_id", channelId)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: "연동 해제 실패" }, { status: 500 });
  }

  return Response.json({ success: true });
}

/** GET /api/creator/connect — 내 연동 채널 목록 */
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("connected_creators")
    .select("id, youtube_channel_id")
    .eq("user_id", user.id)
    .order("id", { ascending: true });

  if (error) {
    return Response.json({ error: "채널 목록 조회 실패" }, { status: 500 });
  }

  return Response.json({ channels: data ?? [] });
}
