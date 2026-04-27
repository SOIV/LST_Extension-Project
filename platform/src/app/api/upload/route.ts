import { createClient } from "@/lib/supabase/server";
import { uploadToR2 } from "@/lib/r2";
import { type NextRequest } from "next/server";

/** YouTube URL에서 videoId 추출 */
function extractVideoId(input: string): string | null {
  try {
    // 이미 videoId만 입력한 경우
    if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) {
      return input.trim();
    }
    const url = new URL(input);
    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v");
    }
    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1).split("?")[0];
    }
    return null;
  } catch {
    return null;
  }
}

/** 파일 확장자로 포맷 판별 */
function detectFormat(filename: string, content: string): "srt" | "vtt" {
  if (filename.endsWith(".vtt")) return "vtt";
  if (content.trimStart().startsWith("WEBVTT")) return "vtt";
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
    const { data: newVideo, error: videoError } = await supabase
      .from("videos")
      .insert({ youtube_video_id: videoId })
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

  // 3. 현재 리비전 번호 조회
  const { count } = await supabase
    .from("subtitle_revisions")
    .select("*", { count: "exact", head: true })
    .eq("track_id", trackRow.id);

  const revisionNumber = (count ?? 0) + 1;

  // 4. R2에 파일 업로드
  const storagePath = `subtitles/${videoId}/${languageCode}/${revisionNumber}.${format}`;
  const contentType = format === "vtt" ? "text/vtt" : "text/plain";

  try {
    await uploadToR2(storagePath, content, contentType);
  } catch {
    return Response.json({ error: "파일 업로드 실패" }, { status: 500 });
  }

  // 5. 기존 is_current 해제
  await supabase
    .from("subtitle_revisions")
    .update({ is_current: false })
    .eq("track_id", trackRow.id);

  // 6. subtitle_revisions 저장
  const { error: revisionError } = await supabase
    .from("subtitle_revisions")
    .insert({
      track_id: trackRow.id,
      contributor_id: user.id,
      storage_path: storagePath,
      format,
      revision_number: revisionNumber,
      message,
      is_current: true,
    });

  if (revisionError) {
    return Response.json({ error: "리비전 저장 실패" }, { status: 500 });
  }

  return Response.json({
    success: true,
    videoId,
    language: languageCode,
    revisionNumber,
  });
}
