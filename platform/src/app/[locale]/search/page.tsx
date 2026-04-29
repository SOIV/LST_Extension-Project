import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  parseYouTubeUrl,
  searchYouTube,
  getVideoById,
  resolveHandle,
  resolveCustomUrl,
  formatCountLocale,
  type YoutubeVideo,
  type YoutubeChannel,
} from "@/lib/youtube";

// ─── DB Enrichment ─────────────────────────────────────────────────────────────

/** 영상 ID 목록에 대한 자막 상태를 Supabase에서 일괄 조회 */
async function getSubtitleStatuses(
  videoIds: string[]
): Promise<Map<string, string>> {
  if (videoIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("videos")
    .select("youtube_video_id, subtitle_tracks(status)")
    .in("youtube_video_id", videoIds);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const tracks = (row.subtitle_tracks ?? []) as { status: string }[];
    const statuses = tracks.map((t) => t.status);
    if (statuses.includes("approved")) map.set(row.youtube_video_id, "approved");
    else if (statuses.includes("pending")) map.set(row.youtube_video_id, "pending");
    else if (statuses.length > 0) map.set(row.youtube_video_id, statuses[0]);
  }
  return map;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

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
      className="group flex gap-3 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
    >
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-40 aspect-video rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-800">
        {video.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">
            No image
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 min-w-0 flex-1 py-0.5">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 line-clamp-2 group-hover:underline underline-offset-2">
          {video.title}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{video.channelTitle}</p>
        <div className="flex items-center gap-2 mt-auto">
          <StatusBadge
            status={subtitleStatus}
            labels={labels}
          />
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {labels.viewSubtitles} →
          </span>
        </div>
      </div>
    </Link>
  );
}

function ChannelCard({
  channel,
  labels,
  locale,
}: {
  channel: YoutubeChannel;
  labels: { viewChannel: string; subscribers: string };
  locale: string;
}) {
  return (
    <Link
      href={`/channel/${channel.channelId}`}
      className="group flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
        {channel.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.thumbnail}
            alt={channel.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">
            CH
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 group-hover:underline underline-offset-2">
          {channel.title}
        </p>
        {channel.subscriberCount && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {labels.subscribers.replace("{count}", formatCountLocale(channel.subscriberCount, locale))}
          </p>
        )}
        {channel.description && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 line-clamp-1 mt-0.5">
            {channel.description}
          </p>
        )}
      </div>

      <span className="text-xs text-zinc-400 flex-shrink-0">{labels.viewChannel} →</span>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const t = await getTranslations("SearchPage");
  const { locale } = await params;
  const { q = "" } = await searchParams;
  const query = q.trim();

  const statusLabels = {
    available: t("subtitleAvailable"),
    pending: t("subtitlePending"),
    draft: t("subtitleDraft"),
    viewSubtitles: t("viewSubtitles"),
    viewChannel: t("viewChannel"),
    subscribers: t("subscribers"),
  };

  // 검색어 없음
  if (!query) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400 dark:text-zinc-500 text-sm">{t("noQuery")}</p>
      </div>
    );
  }

  // YouTube API 키 미설정
  if (!process.env.YOUTUBE_API_KEY) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-red-500 text-sm">{t("apiNotConfigured")}</p>
      </div>
    );
  }

  // URL 파싱
  const parsed = parseYouTubeUrl(query);

  // 채널 URL → /channel/[channelId] 로 리다이렉트
  if (parsed?.type === "channel") {
    redirect({ href: `/channel/${parsed.channelId}`, locale });
  }
  if (parsed?.type === "handle") {
    const channelId = await resolveHandle(parsed.handle);
    if (channelId) redirect({ href: `/channel/${channelId}`, locale });
  }
  if (parsed?.type === "customUrl") {
    const channelId = await resolveCustomUrl(parsed.customUrl);
    if (channelId) redirect({ href: `/channel/${channelId}`, locale });
  }

  // 결과 fetch
  let videos: YoutubeVideo[] = [];
  let channels: YoutubeChannel[] = [];
  let fetchError = false;

  try {
    if (parsed?.type === "video") {
      // URL에서 특정 영상 조회
      const video = await getVideoById(parsed.videoId);
      if (video) videos = [video];
    } else {
      // 텍스트 검색
      const results = await searchYouTube(query);
      videos = results.videos;
      channels = results.channels;
    }
  } catch {
    fetchError = true;
  }

  // Supabase로 자막 상태 enrichment
  const subtitleStatuses = await getSubtitleStatuses(videos.map((v) => v.videoId));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">

        {/* 헤더 */}
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {t("resultsFor", { query })}
          </h1>
        </div>

        {/* 에러 */}
        {fetchError && (
          <p className="text-red-500 text-sm">{t("errorFetch")}</p>
        )}

        {/* 채널 섹션 */}
        {channels.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              {t("channels")}
            </h2>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
              {channels.map((ch) => (
                <ChannelCard key={ch.channelId} channel={ch} labels={statusLabels} locale={locale} />
              ))}
            </div>
          </section>
        )}

        {/* 영상 섹션 */}
        {videos.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              {t("videos")}
            </h2>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
              {videos.map((v) => (
                <VideoCard
                  key={v.videoId}
                  video={v}
                  subtitleStatus={subtitleStatuses.get(v.videoId)}
                  labels={statusLabels}
                />
              ))}
            </div>
          </section>
        )}

        {/* 결과 없음 */}
        {!fetchError && videos.length === 0 && channels.length === 0 && (
          <div className="flex items-center justify-center py-24">
            <p className="text-zinc-400 dark:text-zinc-500 text-sm">{t("noResults")}</p>
          </div>
        )}

      </div>
    </div>
  );
}
