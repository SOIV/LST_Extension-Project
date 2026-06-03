import { createClient } from "@/lib/supabase/server";
import { uploadToR2 } from "@/lib/r2";
import { type NextRequest } from "next/server";

const MAX_SUBTITLE_CONTENT_LENGTH = 4 * 1024 * 1024; // 4MB
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function canManageApprovedTrack(
  supabase: SupabaseServerClient,
  userId: string,
  youtubeChannelId: string | null
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") return true;
  if (!youtubeChannelId) return false;

  const { data: creator } = await supabase
    .from("connected_creators")
    .select("id")
    .eq("youtube_channel_id", youtubeChannelId)
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(creator);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { content, format, message = "" } = (await request.json()) as {
    content: string;
    format: "srt" | "vtt";
    message?: string;
  };

  if (!content?.trim() || !["srt", "vtt"].includes(format)) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (content.length > MAX_SUBTITLE_CONTENT_LENGTH) {
    return Response.json(
      { error: "자막 내용은 4MB 이하만 저장할 수 있습니다." },
      { status: 413 }
    );
  }

  // Track + video info
  const { data: track } = await supabase
    .from("subtitle_tracks")
    .select("id, language_code, status, videos(youtube_video_id, youtube_channel_id)")
    .eq("id", trackId)
    .single();

  if (!track) {
    return Response.json(
      { error: "자막 트랙을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const videos = track.videos as
    | { youtube_video_id: string; youtube_channel_id: string | null }
    | { youtube_video_id: string; youtube_channel_id: string | null }[]
    | null;
  const video = Array.isArray(videos) ? videos[0] : videos;
  const ytId = video?.youtube_video_id;
  if (!ytId) {
    return Response.json(
      { error: "영상 정보를 찾을 수 없습니다." },
      { status: 500 }
    );
  }
  if (
    track.status === "approved" &&
    !(await canManageApprovedTrack(
      supabase,
      user.id,
      video.youtube_channel_id ?? null
    ))
  ) {
    return Response.json(
      { error: "승인된 자막은 채널 소유자 또는 관리자만 수정할 수 있습니다." },
      { status: 403 }
    );
  }

  // Upload to R2 (동시 요청 충돌 방지를 위해 경로에 고유 suffix 사용)
  const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
  const storagePath = `subtitles/${ytId}/${track.language_code}/${uniqueSuffix}.${format}`;
  const contentType = format === "vtt" ? "text/vtt" : "text/plain";

  try {
    await uploadToR2(storagePath, content, contentType);
  } catch {
    return Response.json({ error: "파일 업로드 실패" }, { status: 500 });
  }

  // Insert new revision (동시성 충돌 시 재시도, is_current는 RPC로 원자적 처리)
  let revisionNumber = 0;
  let newRevision: { id: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: latestRevision } = await supabase
      .from("subtitle_revisions")
      .select("revision_number")
      .eq("track_id", trackId)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    revisionNumber = (latestRevision?.revision_number ?? 0) + 1;

    const { data, error: revError } = await supabase
      .from("subtitle_revisions")
      .insert({
        track_id: trackId,
        contributor_id: user.id,
        storage_path: storagePath,
        format,
        revision_number: revisionNumber,
        message,
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

  // is_current 원자적 업데이트 (SECURITY DEFINER 함수로 RLS 우회)
  const { error: rpcError } = await supabase.rpc("update_current_revision", {
    p_track_id: trackId,
    p_new_revision_id: newRevision.id,
  });

  if (rpcError) {
    return Response.json({ error: "리비전 업데이트 실패" }, { status: 500 });
  }

  return Response.json({ success: true, revisionNumber });
}
