import { createClient } from "@/lib/supabase/server";
import { uploadToR2 } from "@/lib/r2";
import { getVideoById } from "@/lib/youtube";
import { type NextRequest } from "next/server";

const MAX_SUBTITLE_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB

/** YouTube URL에서 videoId 추출 */
function extractVideoId(input: string): string | null {
  try {
    // 이미 videoId만 입력한 경우
    if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) {
      return input.trim();
    }
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

/** 파일 확장자로 포맷 판별 */
function detectFormat(filename: string, content: string): "srt" | "vtt" | "smi" | "ttml" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".vtt")) return "vtt";
  if (lower.endsWith(".smi") || lower.endsWith(".sami")) return "smi";
  if (lower.endsWith(".ttml") || lower.endsWith(".xml")) return "ttml";
  if (content.trimStart().startsWith("WEBVTT")) return "vtt";
  if (/<SAMI/i.test(content.trimStart().slice(0, 300))) return "smi";
  if (/<tt[\s>]/i.test(content.trimStart().slice(0, 500))) return "ttml";
  return "srt";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 로그인 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // FormData 파싱
  const formData = await request.formData();
  const youtubeUrl = formData.get("youtubeUrl") as string;
  const languageCode = formData.get("languageCode") as string;
  const file = formData.get("file") as File;
  const message = (formData.get("message") as string) || "";

  if (!youtubeUrl || !languageCode || !file) {
    return Response.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "잘못된 파일 요청입니다." }, { status: 400 });
  }
  if (file.size > MAX_SUBTITLE_FILE_SIZE_BYTES) {
    return Response.json(
      { error: "자막 파일은 4MB 이하만 업로드할 수 있습니다." },
      { status: 413 }
    );
  }

  // videoId 추출
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    return Response.json({ error: "올바른 YouTube URL이 아닙니다." }, { status: 400 });
  }

  // 파일 내용 읽기
  const content = await file.text();
  if (!content.trim()) {
    return Response.json({ error: "자막 파일이 비어 있습니다." }, { status: 400 });
  }

  const format = detectFormat(file.name, content);

  // 1. videos 테이블에 영상 없으면 추가
  let videoRow: { id: string };
  const { data: existingVideo } = await supabase
    .from("videos")
    .select("id")
    .eq("youtube_video_id", videoId)
    .single();

  if (existingVideo) {
    videoRow = existingVideo;
  } else {
    // 새 영상 생성 시 YouTube API로 채널 ID 보조 조회 (있으면 저장)
    let youtubeChannelId: string | null = null;
    if (process.env.YOUTUBE_API_KEY) {
      try {
        const ytVideo = await getVideoById(videoId);
        if (ytVideo) youtubeChannelId = ytVideo.channelId;
      } catch {
        // YouTube API 실패 시 무시 (채널 ID 없이 업로드 허용)
      }
    }

    const { data: newVideo, error: videoError } = await supabase
      .from("videos")
      .insert({ youtube_video_id: videoId, youtube_channel_id: youtubeChannelId })
      .select("id")
      .single();

    if (videoError || !newVideo) {
      return Response.json({ error: "영상 정보 저장 실패" }, { status: 500 });
    }
    videoRow = newVideo;
  }

  // 2. subtitle_tracks 조회 또는 생성
  let trackRow: { id: string };
  const { data: existingTrack } = await supabase
    .from("subtitle_tracks")
    .select("id")
    .eq("video_id", videoRow.id)
    .eq("language_code", languageCode)
    .single();

  if (existingTrack) {
    trackRow = existingTrack;
  } else {
    const { data: newTrack, error: trackError } = await supabase
      .from("subtitle_tracks")
      .insert({
        video_id: videoRow.id,
        language_code: languageCode,
        creator_id: user.id,
        status: "pending",
      })
      .select("id")
      .single();

    if (trackError || !newTrack) {
      return Response.json({ error: "자막 트랙 생성 실패" }, { status: 500 });
    }
    trackRow = newTrack;
  }

  // 3. R2에 파일 업로드 (동시 요청 충돌 방지를 위해 경로에 고유 suffix 사용)
  const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
  const storagePath = `subtitles/${videoId}/${languageCode}/${uniqueSuffix}.${format}`;
  const contentType =
    format === "vtt"  ? "text/vtt" :
    format === "smi"  ? "text/x-sami" :
    format === "ttml" ? "application/ttml+xml" :
    "text/plain";

  try {
    await uploadToR2(storagePath, content, contentType);
  } catch {
    return Response.json({ error: "파일 업로드 실패" }, { status: 500 });
  }

  // 4. subtitle_revisions 저장 (동시성 충돌 시 재시도)
  let revisionNumber = 0;
  let newRevision: { id: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: latestRevision } = await supabase
      .from("subtitle_revisions")
      .select("revision_number")
      .eq("track_id", trackRow.id)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    revisionNumber = (latestRevision?.revision_number ?? 0) + 1;

    const { data, error: revisionError } = await supabase
      .from("subtitle_revisions")
      .insert({
        track_id: trackRow.id,
        contributor_id: user.id,
        storage_path: storagePath,
        format,
        revision_number: revisionNumber,
        message,
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

  // 5. is_current 원자적 업데이트 (SECURITY DEFINER 함수로 RLS 우회)
  const { error: rpcError } = await supabase.rpc("update_current_revision", {
    p_track_id: trackRow.id,
    p_new_revision_id: newRevision.id,
  });

  if (rpcError) {
    return Response.json({ error: "리비전 업데이트 실패" }, { status: 500 });
  }

  return Response.json({
    success: true,
    videoId,
    language: languageCode,
    revisionNumber,
  });
}
