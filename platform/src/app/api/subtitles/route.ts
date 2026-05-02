import { createClient } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const videoId = searchParams.get("videoId");
  const lang = searchParams.get("lang"); // optional

  if (!videoId) {
    return Response.json(
      { error: "videoId is required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const supabase = await createClient();

  // 1. 영상 조회
  const { data: video, error: videoError } = await supabase
    .from("videos")
    .select("id")
    .eq("youtube_video_id", videoId)
    .single();

  if (videoError || !video) {
    return Response.json(
      { error: "Video not found" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  // 2. 해당 영상의 approved 자막 트랙 목록 조회
  const tracksQuery = supabase
    .from("subtitle_tracks")
    .select("id, language_code")
    .eq("video_id", video.id)
    .eq("status", "approved")
    .order("language_code", { ascending: true });

  if (lang) tracksQuery.eq("language_code", lang);

  const { data: tracks, error: tracksError } = await tracksQuery;

  if (tracksError || !tracks || tracks.length === 0) {
    return Response.json(
      { error: "No subtitles available" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  // 언어 미지정 시 우선순위(ko/en/ja) 기반 + 이름순 fallback으로 결정
  const preferredOrder = ["ko", "en", "ja"];
  const sortedTracks = [...tracks].sort((a, b) => {
    const ai = preferredOrder.indexOf(a.language_code);
    const bi = preferredOrder.indexOf(b.language_code);
    const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a.language_code.localeCompare(b.language_code);
  });
  const track = sortedTracks[0];
  const allLanguages = tracks.map((t) => t.language_code);

  // 3. 현재 리비전 조회 (is_current 불일치 방어: revision_number 내림차순으로 최신 우선)
  const { data: revisions, error: revisionError } = await supabase
    .from("subtitle_revisions")
    .select("storage_path, format")
    .eq("track_id", track.id)
    .eq("is_current", true)
    .order("revision_number", { ascending: false })
    .limit(1);

  const revision = revisions?.[0];

  if (revisionError || !revision) {
    return Response.json(
      { error: "Subtitle revision not found" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  // 4. R2에서 자막 파일 내용 가져오기
  const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!r2PublicUrl) {
    return Response.json(
      { error: "Storage not configured" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const fileUrl = `${r2PublicUrl}/${revision.storage_path}`;

  let content: string;
  try {
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) throw new Error(`R2 fetch failed: ${fileRes.status}`);
    content = await fileRes.text();
  } catch {
    return Response.json(
      { error: "Failed to fetch subtitle file" },
      { status: 502, headers: CORS_HEADERS }
    );
  }

  return Response.json(
    {
      videoId,
      language: track.language_code,
      format: revision.format,
      content,
      languages: allLanguages,
    },
    { status: 200, headers: CORS_HEADERS }
  );
}
