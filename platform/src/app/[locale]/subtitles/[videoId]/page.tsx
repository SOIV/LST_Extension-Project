import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getVideoById, type YoutubeVideo } from "@/lib/youtube";
import CopyLinkButton from "@/components/CopyLinkButton";

function getLanguageName(locale: string, languageCode: string): string {
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: "language" });
    return displayNames.of(languageCode) ?? languageCode;
  } catch {
    return languageCode;
  }
}

// ─── 크리에이터 미연동 페이지 ──────────────────────────────────────────────────

function CreatorNotConnected({
  videoId,
  ytVideo,
  t,
  shareUrl,
}: {
  videoId: string;
  ytVideo: YoutubeVideo | null;
  t: Awaited<ReturnType<typeof getTranslations<"SubtitlePage">>>;
  shareUrl: string;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">

        {/* 영상 플레이어 */}
        <div className="flex flex-col gap-3">
          <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          {ytVideo && (
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 line-clamp-2">
                {ytVideo.title}
              </h1>
              {ytVideo.channelTitle && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {ytVideo.channelTitle}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 크리에이터 미연동 안내 */}
        <div className="flex flex-col items-center gap-4 py-10 px-6 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">

          {/* 아이콘 */}
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-400 dark:text-zinc-500"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {t("creatorNotConnected")}
            </p>
          </div>

          {/* 공유 링크 복사 */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {t("requestConnection")}
            </p>
            <CopyLinkButton
              url={shareUrl}
              labelCopy={t("copyShareLink")}
              labelCopied={t("copied")}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────────

export default async function SubtitlePage({
  params,
}: {
  params: Promise<{ locale: string; videoId: string }>;
}) {
  const { videoId, locale } = await params;
  const supabase = await createClient();
  const t = await getTranslations("SubtitlePage");

  const statusColors: Record<string, string> = {
    draft:    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    pending:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };

  const statusLabels: Record<string, string> = {
    draft:    t("statusDraft"),
    pending:  t("statusPending"),
    approved: t("statusApproved"),
    rejected: t("statusRejected"),
  };

  const { data: video } = await supabase
    .from("videos")
    .select("id, youtube_video_id, title, channel_name")
    .eq("youtube_video_id", videoId)
    .single();

  // DB에 없는 영상 → 크리에이터 미연동 페이지
  if (!video) {
    // YouTube API로 영상 정보 보조 조회 (선택적)
    let ytVideo: YoutubeVideo | null = null;
    if (process.env.YOUTUBE_API_KEY) {
      try {
        ytVideo = await getVideoById(videoId);
      } catch {
        // API 실패해도 페이지는 보여줌
      }
    }

    // YouTube에도 없는 videoId → 진짜 404
    if (!ytVideo && !process.env.YOUTUBE_API_KEY) {
      // API 키가 없으면 판별 불가 → 미연동 페이지로 fallback
    } else if (!ytVideo) {
      notFound();
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${locale}/subtitles/${videoId}`;

    return (
      <CreatorNotConnected
        videoId={videoId}
        ytVideo={ytVideo}
        t={t}
        shareUrl={shareUrl}
      />
    );
  }

  const { data: tracks } = await supabase
    .from("subtitle_tracks")
    .select(`
      id,
      language_code,
      status,
      created_at,
      subtitle_revisions (
        id,
        revision_number,
        format,
        message,
        is_current,
        created_at,
        contributor_id
      )
    `)
    .eq("video_id", video.id)
    .order("language_code");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">

        <div className="flex flex-col gap-3">
          <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          {video.title && (
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 line-clamp-2">
                {video.title}
              </h1>
              {video.channel_name && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {video.channel_name}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {t("communitySubtitles")}
            </h2>
            <Link
              href={`/upload?v=${videoId}`}
              className="text-sm px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
            >
              {t("uploadSubtitle")}
            </Link>
          </div>

          {!tracks || tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {t("noSubtitles")}
              </p>
              <Link
                href={`/upload?v=${videoId}`}
                className="mt-3 text-sm text-zinc-900 dark:text-zinc-100 underline underline-offset-2"
              >
                {t("uploadFirst")}
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tracks.map((track) => {
                const statusColor = statusColors[track.status] ?? statusColors.draft;
                const statusLabel = statusLabels[track.status] ?? statusLabels.draft;
                const currentRevision = track.subtitle_revisions?.find(
                  (r: { is_current: boolean }) => r.is_current
                );
                const revisions = track.subtitle_revisions ?? [];

                return (
                  <div
                    key={track.id}
                    className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {getLanguageName(locale, track.language_code)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {currentRevision && (
                          <span className="text-xs text-zinc-400">
                            v{currentRevision.revision_number} · {currentRevision.format.toUpperCase()}
                          </span>
                        )}
                        <Link
                          href={`/subtitles/${videoId}/edit/${track.id}`}
                          className="text-xs px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          {t("edit")}
                        </Link>
                      </div>
                    </div>

                    {currentRevision?.message && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {currentRevision.message}
                      </p>
                    )}

                    {revisions.length > 1 && (
                      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
                        <p className="text-xs text-zinc-400 mb-2">{t("revisionHistory")}</p>
                        <div className="flex flex-col gap-1.5">
                          {[...revisions]
                            .sort((a: { revision_number: number }, b: { revision_number: number }) => b.revision_number - a.revision_number)
                            .map((rev: {
                              id: string;
                              revision_number: number;
                              message: string;
                              is_current: boolean;
                              created_at: string;
                            }) => (
                              <div key={rev.id} className="flex items-center gap-2 text-xs text-zinc-500">
                                <span className={`font-mono ${rev.is_current ? "text-zinc-900 dark:text-zinc-100 font-semibold" : ""}`}>
                                  v{rev.revision_number}
                                </span>
                                {rev.is_current && (
                                  <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400">
                                    {t("current")}
                                  </span>
                                )}
                                <span className="flex-1 truncate">{rev.message || "—"}</span>
                                <span className="text-zinc-400">
                                  {new Date(rev.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
