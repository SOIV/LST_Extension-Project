import { type NextRequest } from "next/server";
import { getChannelVideosCached } from "@/lib/channelCache";
import { type ChannelTab } from "@/lib/youtube";
import { createClient } from "@/lib/supabase/server";

// ─── DB Enrichment ────────────────────────────────────────────────────────────

async function getSubtitleStatuses(
  videoIds: string[]
): Promise<Record<string, string>> {
  if (videoIds.length === 0) return {};
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("videos")
      .select("youtube_video_id, subtitle_tracks(status)")
      .in("youtube_video_id", videoIds);

    const result: Record<string, string> = {};
    for (const row of data ?? []) {
      const tracks = (row.subtitle_tracks ?? []) as { status: string }[];
      const statuses = tracks.map((t) => t.status);
      if (statuses.includes("approved")) result[row.youtube_video_id] = "approved";
      else if (statuses.includes("pending")) result[row.youtube_video_id] = "pending";
      else if (statuses.length > 0) result[row.youtube_video_id] = statuses[0];
    }
    return result;
  } catch {
    // Supabase 오류 시 빈 객체 반환 (자막 상태 없음으로 처리)
    return {};
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * GET /api/youtube/channel-videos
 * 쿼리 파라미터:
 *   channelId  — YouTube 채널 ID (필수)
 *   tab        — "videos" | "shorts" | "live" (기본값: "videos")
 *   pageToken  — YouTube API 페이지 토큰 (없으면 첫 페이지)
 *
 * 응답:
 *   { videos, nextPageToken, subtitleStatuses }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");
  const tab = searchParams.get("tab") ?? "videos";
  const pageToken = searchParams.get("pageToken") ?? undefined;

  if (!channelId) {
    return Response.json({ error: "channelId is required" }, { status: 400 });
  }

  if (!process.env.YOUTUBE_API_KEY) {
    return Response.json(
      { error: "YouTube API key is not configured" },
      { status: 503 }
    );
  }

  try {
    const result = await getChannelVideosCached(
      channelId,
      tab as ChannelTab,
      24,
      pageToken
    );

    const subtitleStatuses = await getSubtitleStatuses(
      result.videos.map((v) => v.videoId)
    );

    return Response.json({
      videos: result.videos,
      nextPageToken: result.nextPageToken,
      subtitleStatuses,
    });
  } catch (err) {
    console.error("[channel-videos API]", err);
    return Response.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}
