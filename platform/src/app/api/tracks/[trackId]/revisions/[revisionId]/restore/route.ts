import { createClient } from "@/lib/supabase/server";
import { getFromR2, uploadToR2 } from "@/lib/r2";
import { type NextRequest } from "next/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function canManageTrack(
  supabase: SupabaseServerClient,
  userId: string,
  trackId: string
): Promise<boolean> {
  const { data: track } = await supabase
    .from("subtitle_tracks")
    .select("creator_id, status, videos(youtube_channel_id)")
    .eq("id", trackId)
    .single();

  if (!track) return false;
  if (track.creator_id === userId) return true;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") return true;

  if (track.status === "approved") {
    const videos = track.videos as
      | { youtube_channel_id: string | null }
      | { youtube_channel_id: string | null }[]
      | null;
    const video = Array.isArray(videos) ? videos[0] : videos;
    const channelId = video?.youtube_channel_id;
    if (!channelId) return false;

    const { data: creator } = await supabase
      .from("connected_creators")
      .select("id")
      .eq("youtube_channel_id", channelId)
      .eq("user_id", userId)
      .maybeSingle();

    return Boolean(creator);
  }

  return false;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ trackId: string; revisionId: string }> }
) {
  const { trackId, revisionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await canManageTrack(supabase, user.id, trackId))) {
    return Response.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // 복원 대상 리비전 + 트랙 정보 조회
  const { data: revision } = await supabase
    .from("subtitle_revisions")
    .select("id, is_current, revision_number, storage_path, format")
    .eq("id", revisionId)
    .eq("track_id", trackId)
    .single();

  if (!revision) {
    return Response.json({ error: "리비전을 찾을 수 없습니다." }, { status: 404 });
  }

  if (revision.is_current) {
    return Response.json({ error: "이미 현재 버전입니다." }, { status: 400 });
  }

  const { data: track } = await supabase
    .from("subtitle_tracks")
    .select("language_code, videos(youtube_video_id)")
    .eq("id", trackId)
    .single();

  if (!track) {
    return Response.json({ error: "트랙을 찾을 수 없습니다." }, { status: 404 });
  }

  const videos = track.videos as
    | { youtube_video_id: string }
    | { youtube_video_id: string }[]
    | null;
  const video = Array.isArray(videos) ? videos[0] : videos;
  const ytId = video?.youtube_video_id;
  if (!ytId) {
    return Response.json({ error: "영상 정보를 찾을 수 없습니다." }, { status: 500 });
  }

  // 복원 대상 리비전의 파일 내용 읽기
  let content: string;
  try {
    content = await getFromR2(revision.storage_path);
  } catch {
    return Response.json({ error: "파일을 불러올 수 없습니다." }, { status: 500 });
  }

  // 새 리비전으로 저장 (복원 이력 남기기)
  const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
  const storagePath = `subtitles/${ytId}/${track.language_code}/${uniqueSuffix}.${revision.format}`;
  const contentType = revision.format === "vtt" ? "text/vtt" : "text/plain";
  const restoreMessage = `v${revision.revision_number}으로 되돌림`;

  try {
    await uploadToR2(storagePath, content, contentType);
  } catch {
    return Response.json({ error: "파일 업로드 실패" }, { status: 500 });
  }

  // 새 리비전 번호 결정 (동시성 충돌 시 재시도)
  let newRevisionNumber = 0;
  let newRevision: { id: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: latestRevision } = await supabase
      .from("subtitle_revisions")
      .select("revision_number")
      .eq("track_id", trackId)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    newRevisionNumber = (latestRevision?.revision_number ?? 0) + 1;

    const { data, error: revError } = await supabase
      .from("subtitle_revisions")
      .insert({
        track_id: trackId,
        contributor_id: user.id,
        storage_path: storagePath,
        format: revision.format,
        revision_number: newRevisionNumber,
        message: restoreMessage,
        is_current: false,
      })
      .select("id")
      .single();

    if (!revError && data) {
      newRevision = data;
      break;
    }

    if (revError?.code !== "23505" || attempt === 4) {
      return Response.json({ error: "리비전 저장 실패" }, { status: 500 });
    }
  }

  if (!newRevision) {
    return Response.json({ error: "리비전 저장 실패" }, { status: 500 });
  }

  // 새 리비전을 current로 설정
  const { error: rpcError } = await supabase.rpc("update_current_revision", {
    p_track_id: trackId,
    p_new_revision_id: newRevision.id,
  });

  if (rpcError) {
    return Response.json({ error: "리비전 업데이트 실패" }, { status: 500 });
  }

  return Response.json({ success: true, revisionNumber: newRevisionNumber });
}
