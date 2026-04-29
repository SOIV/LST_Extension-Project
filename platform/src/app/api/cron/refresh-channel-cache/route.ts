/**
 * Vercel Cron Job — 연동된 채널 영상 캐시 일일 갱신
 *
 * vercel.json 설정:
 *   { "path": "/api/cron/refresh-channel-cache", "schedule": "0 0 * * *" }
 *   → 매일 UTC 00:00 (한국 시간 09:00) 실행
 *
 * Hobby 플랜 제약:
 *   - 최대 실행 시간: 10초
 *   - 최소 주기: 하루 1회
 *
 * 전략:
 *   - connected_creators 테이블의 연동 채널을 우선 갱신
 *   - 채널당 videos 탭 첫 페이지만 갱신 (가장 중요한 데이터)
 *   - 최대 5개 채널 × 3탭 = 15 API 호출 → 약 8~10초
 *
 * 할당량 예측 (최대):
 *   15개 × 101pt = 1,515pt / 일 (10,000pt 기본 할당량의 15%)
 *
 * 나머지는 Reactive TTL로 처리:
 *   캐시 만료(1시간) 후 첫 방문자가 갱신을 트리거
 */

import { createClient } from "@/lib/supabase/server";
import { getChannelVideosCached } from "@/lib/channelCache";
import { type ChannelTab } from "@/lib/youtube";

// Hobby 플랜 최대 실행 시간: 10초
export const maxDuration = 10;

export async function GET(request: Request) {
  // ── 보안: CRON_SECRET 검증 ────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // ── 연동된 채널 목록 조회 (connected_creators) ───────────────────────────
  // 일반 채널보다 연동 채널을 우선 갱신 — 자막 작업 대상이므로 freshness 중요
  const { data: creators, error } = await supabase
    .from("connected_creators")
    .select("youtube_channel_id")
    .limit(5); // 10초 제한: 채널 5개 × 3탭 = 최대 15 API 호출

  if (error) {
    console.error("[cron/refresh-channel-cache] Supabase query error:", error);
    return Response.json({ error: "DB query failed" }, { status: 500 });
  }

  if (!creators?.length) {
    return Response.json({ refreshed: 0, message: "No connected creators" });
  }

  // ── 각 채널의 3개 탭 첫 페이지 순차 갱신 ────────────────────────────────
  // 병렬 처리 시 quota 동시 폭발 방지를 위해 순차 실행
  const tabs: ChannelTab[] = ["videos", "shorts", "live"];
  let refreshed = 0;
  const failed: string[] = [];

  for (const creator of creators) {
    for (const tab of tabs) {
      try {
        await getChannelVideosCached(creator.youtube_channel_id, tab, 24);
        refreshed++;
      } catch (err) {
        const key = `${creator.youtube_channel_id}/${tab}`;
        failed.push(key);
        console.error(`[cron] Failed to refresh: ${key}`, err);
      }
    }
  }

  console.log(
    `[cron/refresh-channel-cache] refreshed=${refreshed}, failed=${failed.length}`
  );

  return Response.json({
    refreshed,
    failed: failed.length,
    total: creators.length * tabs.length,
  });
}
