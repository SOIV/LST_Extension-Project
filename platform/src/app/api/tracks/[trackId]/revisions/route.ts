import { createClient } from "@/lib/supabase/server";
import { uploadToR2 } from "@/lib/r2";
import { type NextRequest } from "next/server";

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

  // Track + video info
  const { data: track } = await supabase
    .from("subtitle_tracks")
    .select("id, language_code, videos(youtube_video_id)")
    .eq("id", trackId)
    .single();

  if (!track) {
    return Response.json(
      { error: "자막 트랙을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const videos = track.videos as
    | { youtube_video_id: string }
    | { youtube_video_id: string }[]
    | null;
  const ytId = Array.isArray(videos)
    ? videos[0]?.youtube_video_id
    : videos?.youtube_video_id;
  if (!ytId) {
    return Response.json(
      { error: "영상 정보를 찾을 수 없습니다." },
      { status: 500 }
    );
  }

  // Count existing revisions for next revision number
  const { count } = await supabase
    .from("subtitle_revisions")
    .select("*", { count: "exact", head: true })
    .eq("track_id", trackId);

  const revisionNumber = (count ?? 0) + 1;

  // Upload to R2
  const storagePath = `subtitles/${ytId}/${track.language_code}/${revisionNumber}.${format}`;
  const contentType = format === "vtt" ? "text/vtt" : "text/plain";

  try {
    await uploadToR2(storagePath, content, contentType);
  } catch {
    return Response.json({ error: "파일 업로드 실패" }, { status: 500 });
  }

  // Unset current flag on previous revisions
  await supabase
    .from("subtitle_revisions")
    .update({ is_current: false })
    .eq("track_id", trackId);

  // Insert new revision
  const { error: revError } = await supabase
    .from("subtitle_revisions")
    .insert({
      track_id: trackId,
      contributor_id: user.id,
      storage_path: storagePath,
      format,
      revision_number: revisionNumber,
      message,
      is_current: true,
    });

  if (revError) {
    return Response.json({ error: "리비전 저장 실패" }, { status: 500 });
  }

  return Response.json({ success: true, revisionNumber });
}
