import { createClient } from "@/lib/supabase/server";
import { getChannelById, parseYouTubeUrl, resolveHandle } from "@/lib/youtube";
import { type NextRequest } from "next/server";

/** YouTube 채널 ID 정규화 (URL / ID / @핸들 → channelId) */
async function resolveChannelId(input: string): Promise<string | null> {
  const trimmed = input.trim();

  // UC로 시작하는 채널 ID 직접 입력
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) return trimmed;

  // @handle 단독 입력
  if (/^@[^/?]+$/.test(trimmed)) {
    return resolveHandle(trimmed.slice(1));
  }

  // URL 파싱 시도
  const parsed = parseYouTubeUrl(trimmed);
  if (!parsed) return null;
  if (parsed.type === "channel") return parsed.channelId;
  if (parsed.type === "handle") return resolveHandle(parsed.handle);

  return null;
}

/** POST /api/creator/connect — 채널 연동 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { channelInput } = (await request.json()) as { channelInput?: string };
  if (!channelInput?.trim()) {
    return Response.json({ error: "채널 ID 또는 URL을 입력해주세요." }, { status: 400 });
  }

  if (!process.env.YOUTUBE_API_KEY) {
    return Response.json({ error: "YouTube API가 설정되지 않았습니다." }, { status: 503 });
  }

  const channelId = await resolveChannelId(channelInput);
  if (!channelId) {
    return Response.json({ error: "올바른 YouTube 채널 ID 또는 URL이 아닙니다." }, { status: 400 });
  }

  // YouTube API로 채널 존재 확인
  let channel;
  try {
    channel = await getChannelById(channelId);
  } catch {
    return Response.json({ error: "YouTube API 오류가 발생했습니다." }, { status: 502 });
  }
  if (!channel) {
    return Response.json({ error: "채널을 찾을 수 없습니다." }, { status: 404 });
  }

  // 중복 연동 확인
  const { data: existing } = await supabase
    .from("connected_creators")
    .select("id, user_id")
    .eq("youtube_channel_id", channelId)
    .single();

  if (existing) {
    if (existing.user_id === user.id) {
      return Response.json({ error: "이미 연동된 채널입니다." }, { status: 409 });
    }
    return Response.json({ error: "이 채널은 다른 계정에 연동되어 있습니다." }, { status: 409 });
  }

  const { error: insertError } = await supabase
    .from("connected_creators")
    .insert({ youtube_channel_id: channelId, user_id: user.id });

  if (insertError) {
    return Response.json({ error: "채널 연동 실패" }, { status: 500 });
  }

  return Response.json({
    success: true,
    channel: {
      channelId: channel.channelId,
      title: channel.title,
      thumbnail: channel.thumbnail,
      subscriberCount: channel.subscriberCount,
    },
  });
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
