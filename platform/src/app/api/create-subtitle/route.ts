import { createClient } from "@/lib/supabase/server";
import { uploadToR2 } from "@/lib/r2";
import { getVideoById } from "@/lib/youtube";
import { type NextRequest } from "next/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const EMPTY_CONTENT: Record<string, string> = {
  srt: "",
  vtt: "WEBVTT\n",
  smi: "<SAMI>\n<HEAD></HEAD>\n<BODY>\n</BODY>\n</SAMI>",
  ttml: `<?xml version="1.0" encoding="UTF-8"?>\n<tt xmlns="http://www.w3.org/ns/ttml">\n  <body>\n    <div>\n    </div>\n  </body>\n</tt>`,
};

const CONTENT_TYPES: Record<string, string> = {
  srt: "text/plain",
  vtt: "text/vtt",
  smi: "text/x-sami",
  ttml: "application/ttml+xml",
};

function extractVideoId(input: string): string | null {
  try {
    if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      const v = url.searchParams.get("v");
      return v && /^[a-zA-Z0-9_-]{11}$/.test(v) ? v : null;
    }
    if (hostname === "youtu.be") {
      const shortId = url.pathname.slice(1).split("?")[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(shortId) ? shortId : null;
    }
    return null;
  } catch {
    return null;
  }
}

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

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { youtubeUrl, languageCode, format } = body as {
    youtubeUrl: string;
    languageCode: string;
    format: string;
  };

  if (!youtubeUrl || !languageCode || !format) {
    return Response.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
  }

  const validFormats = ["srt", "vtt", "smi", "ttml"];
  if (!validFormats.includes(format)) {
    return Response.json({ error: "지원하지 않는 형식입니다." }, { status: 400 });
  }

  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    return Response.json({ error: "올바른 YouTube URL이 아닙니다." }, { status: 400 });
  }

  // 1. videos 테이블 upsert
  let videoRow: { id: string; youtube_channel_id: string | null };
  const { data: existingVideo } = await supabase
    .from("videos")
    .select("id, youtube_channel_id")
    .eq("youtube_video_id", videoId)
    .single();

  if (existingVideo) {
    videoRow = existingVideo;
  } else {
    let youtubeChannelId: string | null = null;
    if (process.env.YOUTUBE_API_KEY) {
      try {
        const ytVideo = await getVideoById(videoId);
        if (ytVideo) youtubeChannelId = ytVideo.channelId;
      } catch {
        // YouTube API 실패 시 무시
      }
    }

    const { data: newVideo, error: videoError } = await supabase
      .from("videos")
      .insert({ youtube_video_id: videoId, youtube_channel_id: youtubeChannelId })
      .select("id, youtube_channel_id")
      .single();

    if (videoError || !newVideo) {
      return Response.json({ error: "영상 정보 저장 실패" }, { status: 500 });
    }
    videoRow = newVideo;
  }

  // 2. subtitle_tracks 조회 또는 생성
  let trackRow: { id: string; status: string };
  const { data: existingTrack } = await supabase
    .from("subtitle_tracks")
    .select("id, status")
    .eq("video_id", videoRow.id)
    .eq("language_code", languageCode)
    .single();

  if (existingTrack) {
    if (
      existingTrack.status === "approved" &&
      !(await canManageApprovedTrack(supabase, user.id, videoRow.youtube_channel_id))
    ) {
      return Response.json(
        { error: "승인된 자막은 채널 소유자 또는 관리자만 수정할 수 있습니다." },
        { status: 403 }
      );
    }
    trackRow = existingTrack;
  } else {
    const { data: newTrack, error: trackError } = await supabase
      .from("subtitle_tracks")
      .insert({
        video_id: videoRow.id,
        language_code: languageCode,
        creator_id: user.id,
        status: "draft",
      })
      .select("id, status")
      .single();

    if (trackError || !newTrack) {
      return Response.json({ error: "자막 트랙 생성 실패" }, { status: 500 });
    }
    trackRow = newTrack;
  }

  // 3. 빈 자막 파일을 R2에 업로드
  const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
  const storagePath = `subtitles/${videoId}/${languageCode}/${uniqueSuffix}.${format}`;
  const content = EMPTY_CONTENT[format] ?? "";

  try {
    await uploadToR2(storagePath, content, CONTENT_TYPES[format] ?? "text/plain");
  } catch {
    return Response.json({ error: "파일 생성 실패" }, { status: 500 });
  }

  // 4. subtitle_revisions 저장
  let newRevision: { id: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: latestRevision } = await supabase
      .from("subtitle_revisions")
      .select("revision_number")
      .eq("track_id", trackRow.id)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const revisionNumber = (latestRevision?.revision_number ?? 0) + 1;

    const { data, error: revisionError } = await supabase
      .from("subtitle_revisions")
      .insert({
        track_id: trackRow.id,
        contributor_id: user.id,
        storage_path: storagePath,
        format,
        revision_number: revisionNumber,
        message: "",
        is_current: false,
      })
      .select("id")
      .single();

    if (!revisionError && data) {
      newRevision = data;
      break;
    }

    if (revisionError?.code !== "23505" || attempt === 4) {
      return Response.json({ error: "리비전 저장 실패" }, { status: 500 });
    }
  }

  if (!newRevision) {
    return Response.json({ error: "리비전 저장 실패" }, { status: 500 });
  }

  // 5. is_current 원자적 업데이트
  const { error: rpcError } = await supabase.rpc("update_current_revision", {
    p_track_id: trackRow.id,
    p_new_revision_id: newRevision.id,
  });

  if (rpcError) {
    return Response.json({ error: "리비전 업데이트 실패" }, { status: 500 });
  }

  return Response.json({ success: true, videoId, trackId: trackRow.id });
}
