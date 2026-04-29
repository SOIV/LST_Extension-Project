import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getChannelById,
  formatCountLocale,
  formatExact,
} from "@/lib/youtube";
import { getChannelVideosCached } from "@/lib/channelCache";
import { ChannelVideoGrid } from "@/components/ChannelVideoGrid";

// ─── DB ──────────────────────────────────────────────────────────────────────

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
    return {};
  }
}

/** 크리에이터 연동 여부 확인 */
async function isCreatorConnected(channelId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("connected_creators")
      .select("id")
      .eq("youtube_channel_id", channelId)
      .single();
    return !!data;
  } catch {
    return false;
  }
}

// ─── Tab helper ───────────────────────────────────────────────────────────────

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-zinc-900 dark:border-zinc-50 text-zinc-900 dark:text-zinc-50"
          : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
      }`}
    >
      {children}
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; channelId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { channelId, locale } = await params;
  const { tab = "videos" } = await searchParams;

  const t = await getTranslations("ChannelPage");

  if (!process.env.YOUTUBE_API_KEY) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-red-500 text-sm">{t("apiNotConfigured")}</p>
      </div>
    );
  }

  // 채널 정보 + 연동 상태 병렬 조회
  const [channel, connected] = await Promise.all([
    getChannelById(channelId),
    isCreatorConnected(channelId),
  ]);

  if (!channel) notFound();

  // 탭별 초기 영상 목록 조회 (Supabase 캐시 우선)
  const result = await getChannelVideosCached(
    channelId,
    tab as "videos" | "shorts" | "live",
    24
  );

  // 자막 상태 enrichment (client 컴포넌트에 직렬화 가능한 plain object로 전달)
  const subtitleStatuses = await getSubtitleStatuses(
    result.videos.map((v) => v.videoId)
  );

  // 탭별 빈 목록 메시지 키
  const emptyKey =
    tab === "shorts" ? "noShorts" : tab === "live" ? "noLive" : "noVideos";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">

        {/* 채널 헤더 */}
        <div className="flex items-start gap-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
          {channel.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={channel.thumbnail}
              alt={channel.title}
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            />
          )}
          <div className="flex flex-col gap-2 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                {channel.title}
              </h1>
              {/* 연동 상태 뱃지 */}
              {connected ? (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t("connectedBadge")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {t("notConnectedBadge")}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
              {channel.subscriberCount && (
                <span>
                  {t("subscribers", {
                    count: formatCountLocale(channel.subscriberCount, locale),
                  })}
                </span>
              )}
              {channel.videoCount && (
                <span>
                  {t("videoCount", {
                    count: formatExact(channel.videoCount, locale),
                  })}
                </span>
              )}
            </div>

            {/* 미연동 안내 */}
            {!connected && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                {t("notConnectedDesc")}
              </p>
            )}

            {channel.description && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 line-clamp-2">
                {channel.description}
              </p>
            )}
          </div>
        </div>

        {/* 탭 바 */}
        <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800">
          <TabLink href={`/channel/${channelId}?tab=videos`} active={tab === "videos"}>
            {t("tabVideos")}
          </TabLink>
          <TabLink href={`/channel/${channelId}?tab=shorts`} active={tab === "shorts"}>
            {t("tabShorts")}
          </TabLink>
          <TabLink href={`/channel/${channelId}?tab=live`} active={tab === "live"}>
            {t("tabLive")}
          </TabLink>
        </div>

        {/* 동영상 탭 상시 공지 */}
        {tab === "videos" && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 text-xs text-zinc-500 dark:text-zinc-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="8" />
              <line x1="12" y1="12" x2="12" y2="16" />
            </svg>
            {t("liveVodNotice")}
          </div>
        )}

        {/* 영상 그리드 */}
        {result.videos.length === 0 ? (
          <div className="flex items-center justify-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              {t(emptyKey)}
            </p>
          </div>
        ) : (
          <ChannelVideoGrid
            key={tab}
            channelId={channelId}
            tab={tab}
            initialVideos={result.videos}
            initialNextPageToken={result.nextPageToken}
            initialSubtitleStatuses={subtitleStatuses}
          />
        )}

      </div>
    </div>
  );
}
