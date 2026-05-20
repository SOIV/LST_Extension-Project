/**
 * 채널 영상 목록 Supabase 캐시 레이어
 *
 * 캐시 키: (channel_id, tab, page_token)
 * TTL: 1시간 — 만료 시 YouTube API 재호출 후 갱신
 *
 * Quota 절감 효과:
 *   캐시 히트  → 0 quota pt
 *   캐시 미스  → search.list 100pt + videos.list 1pt (기존과 동일)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getChannelRegularVideos,
  getChannelShorts,
  getChannelLiveVideos,
  type ChannelVideosResult,
  type ChannelTab,
  type YoutubeVideo,
} from "@/lib/youtube";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

/**
 * 채널 탭 영상 목록 조회 (캐시 우선)
 *
 * 1. Supabase에 유효한 캐시가 있으면 즉시 반환 (YouTube API 미호출)
 * 2. 캐시 없거나 만료 → YouTube API 호출 → Supabase에 저장 → 반환
 */
export async function getChannelVideosCached(
  channelId: string,
  tab: ChannelTab,
  maxResults = 24,
  pageToken?: string,
  /** 캐시를 무시하고 YouTube API 직접 호출 (디버깅용) */
  bypassCache = false,
): Promise<ChannelVideosResult> {
  // page_token이 없는 첫 페이지는 빈 문자열 키로 저장
  const cachePageToken = pageToken ?? "";

  // ── 1. Supabase 캐시 조회 ────────────────────────────────────────────────
  if (!bypassCache) try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("channel_video_cache")
      .select("videos, next_page_token, fetched_at")
      .eq("channel_id", channelId)
      .eq("tab", tab)
      .eq("page_token", cachePageToken)
      .single();

    if (data) {
      const ageMs = Date.now() - new Date(data.fetched_at).getTime();
      if (ageMs < CACHE_TTL_MS) {
        // 캐시 히트 ✓ — YouTube API 무호출
        return {
          videos: data.videos as unknown as YoutubeVideo[],
          nextPageToken: data.next_page_token ?? null,
        };
      }
      // 만료된 캐시 → fall-through하여 YouTube API 재호출
    }
  } catch {
    // Supabase 오류 → YouTube API로 fallback (캐시 없어도 서비스 유지)
  }

  // ── 2. YouTube API 호출 ──────────────────────────────────────────────────
  let result: ChannelVideosResult;
  if (tab === "shorts") {
    result = await getChannelShorts(channelId, maxResults, pageToken);
  } else if (tab === "live") {
    result = await getChannelLiveVideos(channelId, maxResults, pageToken);
  } else {
    result = await getChannelRegularVideos(channelId, maxResults, pageToken);
  }

  // ── 3. Supabase 캐시 저장 ────────────────────────────────────────────────
  // 실패해도 서비스에 영향 없음 — 다음 요청에서 재시도
  try {
    const supabase = createAdminClient();
    await supabase.from("channel_video_cache").upsert(
      {
        channel_id: channelId,
        tab,
        page_token: cachePageToken,
        videos: result.videos,
        next_page_token: result.nextPageToken,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "channel_id,tab,page_token" }
    );
  } catch {
    // 캐시 저장 실패는 치명적이지 않음
  }

  return result;
}
