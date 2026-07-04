import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getVideoById } from "@/lib/youtube";
import BackButton from "@/components/BackButton";
import LocalizationPanel from "@/components/LocalizationPanel";
import RevisionHistoryModal from "@/components/RevisionHistoryModal";

function getLanguageName(locale: string, languageCode: string): string {
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: "language" });
    return displayNames.of(languageCode) ?? languageCode;
  } catch {
    return languageCode;
  }
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

  const { data: { user } } = await supabase.auth.getUser();

  // YouTube API로 영상 원본 정보 조회 (크리에이터 연동 여부와 무관하게 항상 시도)
  let ytVideo: { title: string; description: string; channelTitle?: string } | null = null;
  if (process.env.YOUTUBE_API_KEY) {
    try {
      const yt = await getVideoById(videoId);
      if (yt) ytVideo = { title: yt.title, description: yt.description, channelTitle: yt.channelTitle };
    } catch {
      // 실패해도 계속 진행
    }
  }

  // DB에서 영상 조회
  const { data: video } = await supabase
    .from("videos")
    .select("id, youtube_video_id, youtube_channel_id, title, channel_name")
    .eq("youtube_video_id", videoId)
    .single();

  // YouTube API도 없고 DB에도 없으면 → 진짜 404
  if (!video && !ytVideo && process.env.YOUTUBE_API_KEY) {
    notFound();
  }

  // 자막 트랙 조회 (연동된 채널만)
  const { data: tracks } = video
    ? await supabase
        .from("subtitle_tracks")
        .select(`
          id,
          language_code,
          status,
          creator_id,
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
        .order("language_code")
    : { data: null };

  // 번역 추가 건수 조회
  const { count: localizationCount } = video
    ? await supabase
        .from("video_localizations")
        .select("id", { count: "exact", head: true })
        .eq("video_id", video.id)
    : { count: 0 };

  const displayTitle = ytVideo?.title ?? video?.title;
  const displayChannel = ytVideo?.channelTitle ?? video?.channel_name;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4">

      {/* 뒤로가기 — 컨텐츠 컨테이너 밖, 상단 좌측 */}
      <div className="max-w-3xl mx-auto mb-4">
        <BackButton label={t("back")} />
      </div>

      <div className="max-w-3xl mx-auto flex flex-col gap-8">

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
          {displayTitle && (
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 line-clamp-2">
                {displayTitle}
              </h1>
              {displayChannel && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {displayChannel}
                </p>
              )}
            </div>
          )}
        </div>

{/* 커뮤니티 자막 섹션 */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {t("communitySubtitles")}
            </h2>
            <div className="flex items-center gap-2">
              <Link
                href={`/create?v=${videoId}`}
                className="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {t("createSubtitle")}
              </Link>
              <Link
                href={`/upload?v=${videoId}`}
                className="text-sm px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
              >
                {t("uploadSubtitle")}
              </Link>
            </div>
          </div>

          {!tracks || tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 gap-3">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {t("noSubtitles")}
              </p>
              <div className="flex items-center gap-3">
                <Link
                  href={`/create?v=${videoId}`}
                  className="text-sm text-zinc-900 dark:text-zinc-100 underline underline-offset-2"
                >
                  {t("createFirst")}
                </Link>
                <span className="text-zinc-300 dark:text-zinc-600">|</span>
                <Link
                  href={`/upload?v=${videoId}`}
                  className="text-sm text-zinc-900 dark:text-zinc-100 underline underline-offset-2"
                >
                  {t("uploadFirst")}
                </Link>
              </div>
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
                        {revisions.length > 0 && (
                          <RevisionHistoryModal
                            trackId={track.id}
                            languageName={getLanguageName(locale, track.language_code)}
                            revisions={revisions}
                            canRestore={user !== null && user.id === track.creator_id}
                          />
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 커뮤니티 제목/설명란 */}
        <LocalizationPanel
          videoId={videoId}
          originalTitle={ytVideo?.title ?? video?.title}
          originalDescription={ytVideo?.description}
          isLoggedIn={!!user}
          localizationCount={localizationCount ?? 0}
        />

      </div>
    </div>
  );
}
