"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { YoutubeVideo } from "@/lib/youtube";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiResponse {
  videos: YoutubeVideo[];
  nextPageToken: string | null;
  subtitleStatuses: Record<string, string>;
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  labels,
}: {
  status: string | undefined;
  labels: { available: string; pending: string; draft: string };
}) {
  if (!status) return null;
  const configs: Record<string, { label: string; className: string }> = {
    approved: {
      label: labels.available,
      className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    },
    pending: {
      label: labels.pending,
      className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    },
    draft: {
      label: labels.draft,
      className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    },
  };
  const cfg = configs[status] ?? configs.draft;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ─── VideoCard ────────────────────────────────────────────────────────────────

function VideoCard({
  video,
  subtitleStatus,
  labels,
}: {
  video: YoutubeVideo;
  subtitleStatus: string | undefined;
  labels: { viewSubtitles: string; available: string; pending: string; draft: string };
}) {
  return (
    <Link
      href={`/subtitles/${video.videoId}`}
      className="group flex flex-col rounded-xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
    >
      <div className="relative w-full aspect-video bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        {video.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">
            No image
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 line-clamp-2 group-hover:underline underline-offset-2">
          {video.title}
        </p>
        <div className="flex items-center gap-2 mt-auto pt-1">
          <StatusBadge status={subtitleStatus} labels={labels} />
          {!subtitleStatus && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {labels.viewSubtitles} →
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── ChannelVideoGrid ─────────────────────────────────────────────────────────

interface ChannelVideoGridProps {
  channelId: string;
  tab: string;
  initialVideos: YoutubeVideo[];
  initialNextPageToken: string | null;
  initialSubtitleStatuses: Record<string, string>;
}

export function ChannelVideoGrid({
  channelId,
  tab,
  initialVideos,
  initialNextPageToken,
  initialSubtitleStatuses,
}: ChannelVideoGridProps) {
  const t = useTranslations("ChannelPage");

  const [videos, setVideos] = useState<YoutubeVideo[]>(initialVideos);
  const [subtitleStatuses, setSubtitleStatuses] = useState<Record<string, string>>(initialSubtitleStatuses);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialNextPageToken !== null);

  // ─ 스테일 클로저 방지용 ref
  const nextPageTokenRef = useRef<string | null>(initialNextPageToken);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ─ 프리페치: 다음 페이지를 미리 받아두는 Promise
  const prefetchRef = useRef<Promise<ApiResponse | null> | null>(null);

  const labels = {
    viewSubtitles: t("viewSubtitles"),
    available: t("subtitleAvailable"),
    pending: t("subtitlePending"),
    draft: t("subtitleDraft"),
  };

  // ── 다음 페이지 프리페치 ───────────────────────────────────────────────────
  const prefetchNext = useCallback(
    (pageToken: string) => {
      const params = new URLSearchParams({ channelId, tab, pageToken });
      prefetchRef.current = fetch(`/api/youtube/channel-videos?${params}`)
        .then((res) => (res.ok ? (res.json() as Promise<ApiResponse>) : null))
        .catch(() => null);
    },
    [channelId, tab]
  );

  // ── 컴포넌트 마운트 시 다음 페이지 즉시 프리페치 ─────────────────────────
  useEffect(() => {
    if (initialNextPageToken) {
      prefetchNext(initialNextPageToken);
    }
  }, [initialNextPageToken, prefetchNext]);

  // ── 페이지 로드 ───────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !nextPageTokenRef.current) return;

    loadingRef.current = true;
    setLoading(true);

    try {
      // 프리페치된 데이터가 있으면 즉시 사용, 없으면 직접 요청
      let data: ApiResponse | null = null;

      if (prefetchRef.current) {
        data = await prefetchRef.current;
        prefetchRef.current = null;
      }

      if (!data) {
        const params = new URLSearchParams({
          channelId,
          tab,
          pageToken: nextPageTokenRef.current,
        });
        const res = await fetch(`/api/youtube/channel-videos?${params}`);
        data = res.ok ? await res.json() : null;
      }

      if (!data) return;

      // ref 먼저 업데이트
      nextPageTokenRef.current = data.nextPageToken ?? null;
      setHasMore(data.nextPageToken !== null);

      // 다음 다음 페이지 즉시 프리페치
      if (data.nextPageToken) {
        prefetchNext(data.nextPageToken);
      }

      setVideos((prev) => {
        const seen = new Set(prev.map((v) => v.videoId));
        return [...prev, ...data!.videos.filter((v) => !seen.has(v.videoId))];
      });
      setSubtitleStatuses((prev) => ({ ...prev, ...data!.subtitleStatuses }));
    } catch {
      // 프리페치 실패 → 다음 스크롤에서 직접 요청으로 재시도
      prefetchRef.current = null;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [channelId, tab, prefetchNext]);

  // ── IntersectionObserver — 하단 600px 전에 미리 발동 ─────────────────────
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "600px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div>
      {/* 영상 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {videos.map((v) => (
          <VideoCard
            key={v.videoId}
            video={v}
            subtitleStatus={subtitleStatuses[v.videoId]}
            labels={labels}
          />
        ))}
      </div>

      {/* 센티넬 + 상태 표시 */}
      <div ref={sentinelRef} className="py-8 flex flex-col items-center gap-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500">
            <svg
              className="animate-spin w-4 h-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {t("loadingMore")}
          </div>
        )}

        {/* 항상 표시되는 더 보기 버튼 (Observer 보조 / 수동 트리거) */}
        {!loading && hasMore && (
          <button
            onClick={loadMore}
            className="px-4 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            {t("loadMoreBtn")}
          </button>
        )}

        {!loading && !hasMore && videos.length > 0 && (
          <span className="text-xs text-zinc-300 dark:text-zinc-700">
            — {t("allLoaded")} —
          </span>
        )}
      </div>
    </div>
  );
}
