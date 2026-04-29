"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { YoutubeVideo } from "@/lib/youtube";

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
      className:
        "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    },
    pending: {
      label: labels.pending,
      className:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    },
    draft: {
      label: labels.draft,
      className:
        "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    },
  };
  const cfg = configs[status] ?? configs.draft;
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}
    >
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
  labels: {
    viewSubtitles: string;
    available: string;
    pending: string;
    draft: string;
  };
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
  const [subtitleStatuses, setSubtitleStatuses] =
    useState<Record<string, string>>(initialSubtitleStatuses);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialNextPageToken !== null);

  // ─ Refs: observer 콜백 내부에서 최신 값 참조 (stale closure 방지)
  const nextPageTokenRef = useRef<string | null>(initialNextPageToken);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const labels = {
    viewSubtitles: t("viewSubtitles"),
    available: t("subtitleAvailable"),
    pending: t("subtitlePending"),
    draft: t("subtitleDraft"),
  };

  // loadMore: channelId / tab 이 바뀔 때만 새로 생성 (Observer 재연결 최소화)
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !nextPageTokenRef.current) return;

    loadingRef.current = true;
    setLoading(true);

    try {
      const params = new URLSearchParams({ channelId, tab });
      params.set("pageToken", nextPageTokenRef.current);
      const res = await fetch(`/api/youtube/channel-videos?${params}`);
      if (!res.ok) return;

      const data = (await res.json()) as {
        videos: YoutubeVideo[];
        nextPageToken: string | null;
        subtitleStatuses: Record<string, string>;
      };

      // ref 먼저 업데이트 (다음 Observer 발동 시 즉시 반영)
      nextPageTokenRef.current = data.nextPageToken ?? null;
      setHasMore(data.nextPageToken !== null);

      setVideos((prev) => {
        const seen = new Set(prev.map((v) => v.videoId));
        return [...prev, ...data.videos.filter((v) => !seen.has(v.videoId))];
      });
      setSubtitleStatuses((prev) => ({ ...prev, ...data.subtitleStatuses }));
    } catch {
      // 조용히 실패 — 다음 스크롤 시 재시도 가능
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [channelId, tab]);

  // IntersectionObserver: loadMore가 안정적이므로 한 번만 연결됨
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "400px" } // 하단 400px 진입 시 미리 로딩
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

      {/* 센티넬: 스크롤 감지 + 상태 표시 */}
      <div ref={sentinelRef} className="py-8 flex justify-center">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500">
            {/* 스피너 */}
            <svg
              className="animate-spin w-4 h-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            {t("loadingMore")}
          </div>
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
