/**
 * Vercel Cron Job — YouTube 자막 업로드 대기열 처리
 *
 * vercel.json 설정 예시:
 *   { "path": "/api/cron/process-youtube-queue", "schedule": "0 2 * * *" }
 *   → 매일 UTC 02:00 (한국 시간 11:00) 실행
 *   (YouTube API 할당량은 UTC 00:00 에 초기화됨)
 *
 * Hobby 플랜 제약:
 *   - 최대 실행 시간: 10초 → 배치 크기를 작게 유지 (YOUTUBE_QUEUE_BATCH_SIZE=3)
 *   - 최소 주기: 하루 1회
 *
 * Pro 플랜 이상:
 *   - maxDuration = 60, YOUTUBE_QUEUE_BATCH_SIZE=15 정도로 늘릴 수 있음
 *
 * 할당량 단위 (YouTube Data API v3):
 *   - captions.list  : 50pt
 *   - captions.insert: 400pt
 *   - captions.update: 400pt
 *   → 자막 1개 upsert = 최대 450pt
 *   → 기본 일일 할당량 10,000pt 기준 최대 22개/일
 *   → YOUTUBE_DAILY_QUOTA_CAPTION_LIMIT (기본 8,000pt) 로 버퍼 확보
 */

import { createClient } from "@/lib/supabase/server";
import { getFromR2 } from "@/lib/r2";
import { getValidAccessToken, uploadCaptionTrack } from "@/lib/youtubeCreatorApi";

// Hobby 플랜: 10초 / Pro 플랜: 60초
export const maxDuration = 60;

/** 자막 1개 upsert 시 소비되는 최대 YouTube API 유닛 */
const CAPTION_UPSERT_COST = 450;

/** 하루에 자막 업로드에 사용할 최대 유닛 (기본 8,000 — 22개 처리 가능) */
const MAX_DAILY_UNITS = parseInt(
  process.env.YOUTUBE_DAILY_QUOTA_CAPTION_LIMIT ?? "8000"
);

/** 한 번의 크론 실행에서 처리할 최대 항목 수 (Hobby: 3, Pro: 15 권장) */
const BATCH_SIZE = parseInt(process.env.YOUTUBE_QUEUE_BATCH_SIZE ?? "3");

/** 이 시간(ms) 이상 processing 상태인 항목은 stale로 간주해 pending으로 초기화 */
const STALE_PROCESSING_MS = 10 * 60 * 1000; // 10분

type QueueItem = {
  id: string;
  track_id: string;
  youtube_video_id: string;
  youtube_channel_id: string;
  user_id: string;
  language_code: string;
  storage_path: string;
  format: string;
  retry_count: number;
};

export async function GET(request: Request) {
  // ── 보안: CRON_SECRET 검증 ─────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/process-youtube-queue] CRON_SECRET is not configured");
    return Response.json({ error: "CRON secret is not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0]; // UTC 날짜 (YYYY-MM-DD)

  // ── 1. Stale processing 항목 초기화 ────────────────────────────────────────
  // 크론이 중간에 강제 종료됐을 때 "processing"에 묶인 항목을 복구한다
  const staleThreshold = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  await supabase
    .from("youtube_upload_queue")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("status", "processing")
    .lt("updated_at", staleThreshold);

  // ── 2. 오늘 소비한 할당량 조회 ─────────────────────────────────────────────
  const { data: quotaRow } = await supabase
    .from("youtube_quota_usage")
    .select("units_used")
    .eq("date", today)
    .maybeSingle();

  const unitsUsed = quotaRow?.units_used ?? 0;
  const unitsRemaining = MAX_DAILY_UNITS - unitsUsed;
  const maxItems = Math.min(
    Math.floor(unitsRemaining / CAPTION_UPSERT_COST),
    BATCH_SIZE
  );

  if (maxItems <= 0) {
    console.log(
      `[cron/process-youtube-queue] Daily quota exhausted. used=${unitsUsed}/${MAX_DAILY_UNITS}`
    );
    return Response.json({
      message: "Daily quota exhausted",
      unitsUsed,
      maxDailyUnits: MAX_DAILY_UNITS,
      processed: 0,
      failed: 0,
    });
  }

  // ── 3. 처리할 항목 조회 (오래된 순) ────────────────────────────────────────
  const { data: items, error: fetchError } = await supabase
    .from("youtube_upload_queue")
    .select(
      "id, track_id, youtube_video_id, youtube_channel_id, user_id, language_code, storage_path, format, retry_count"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(maxItems);

  if (fetchError) {
    console.error("[cron/process-youtube-queue] Queue fetch error:", fetchError);
    return Response.json({ error: "Queue fetch failed" }, { status: 500 });
  }

  if (!items?.length) {
    return Response.json({
      message: "No pending items",
      unitsUsed,
      processed: 0,
      failed: 0,
    });
  }

  // ── 4. 각 항목 순차 처리 ────────────────────────────────────────────────────
  let processed = 0;
  let failed = 0;
  let unitsConsumed = 0;

  for (const item of items as QueueItem[]) {
    // processing 상태로 변경
    await supabase
      .from("youtube_upload_queue")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", item.id);

    try {
      // R2에서 자막 파일 읽기
      const content = await getFromR2(item.storage_path);

      // 유효한 access token 조회 (필요 시 자동 갱신)
      const accessToken = await getValidAccessToken(
        item.youtube_channel_id,
        item.user_id
      );
      if (!accessToken) {
        throw new Error("Access token unavailable — channel may be disconnected");
      }

      // YouTube Captions API 업로드
      const result = await uploadCaptionTrack(
        accessToken,
        item.youtube_video_id,
        item.language_code,
        content,
        item.format
      );

      if (!result.ok) {
        throw new Error(result.error ?? "YouTube upload failed");
      }

      // 성공
      await supabase
        .from("youtube_upload_queue")
        .update({
          status: "completed",
          error_message: null,
          updated_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      processed++;
      console.log(
        `[cron/process-youtube-queue] Uploaded: track=${item.track_id} lang=${item.language_code}`
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";

      await supabase
        .from("youtube_upload_queue")
        .update({
          status: "failed",
          error_message: errorMsg,
          retry_count: item.retry_count + 1,
          updated_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      failed++;
      console.error(
        `[cron/process-youtube-queue] Failed: track=${item.track_id}`,
        errorMsg
      );
    }

    unitsConsumed += CAPTION_UPSERT_COST;
  }

  // ── 5. 할당량 사용량 누적 기록 ─────────────────────────────────────────────
  if (unitsConsumed > 0) {
    await supabase.from("youtube_quota_usage").upsert(
      {
        date: today,
        units_used: unitsUsed + unitsConsumed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "date" }
    );
  }

  console.log(
    `[cron/process-youtube-queue] done. processed=${processed} failed=${failed} units=${unitsConsumed} remaining=${unitsRemaining - unitsConsumed}`
  );

  return Response.json({
    processed,
    failed,
    unitsConsumed,
    unitsRemaining: unitsRemaining - unitsConsumed,
    totalUnitsUsed: unitsUsed + unitsConsumed,
    maxDailyUnits: MAX_DAILY_UNITS,
  });
}
