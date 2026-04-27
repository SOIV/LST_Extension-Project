import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

const LANGUAGE_NAMES: Record<string, string> = {
  ko: "한국어", en: "English", ja: "日本語",
  "zh-CN": "中文 (简体)", "zh-TW": "中文 (繁體)",
  es: "Español", fr: "Français", de: "Deutsch", ru: "Русский",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:    { label: "초안",   color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  pending:  { label: "검토 중", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  approved: { label: "승인됨", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  rejected: { label: "거절됨", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

export default async function SubtitlePage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  const supabase = await createClient();

  // 영상 조회
  const { data: video } = await supabase
    .from("videos")
    .select("id, youtube_video_id, title, channel_name")
    .eq("youtube_video_id", videoId)
    .single();

  if (!video) notFound();

  // 자막 트랙 + 최신 리비전 조회
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

        {/* 영상 임베드 */}
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

        {/* 자막 목록 */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              커뮤니티 자막
            </h2>
            <Link
              href={`/upload?v=${videoId}`}
              className="text-sm px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
            >
              + 자막 업로드
            </Link>
          </div>

          {!tracks || tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                아직 등록된 자막이 없습니다.
              </p>
              <Link
                href={`/upload?v=${videoId}`}
                className="mt-3 text-sm text-zinc-900 dark:text-zinc-100 underline underline-offset-2"
              >
                첫 번째 자막을 업로드해보세요
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tracks.map((track) => {
                const statusInfo = STATUS_LABELS[track.status] ?? STATUS_LABELS.draft;
                const currentRevision = track.subtitle_revisions?.find(
                  (r: { is_current: boolean }) => r.is_current
                );
                const revisions = track.subtitle_revisions ?? [];

                return (
                  <div
                    key={track.id}
                    className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-3"
                  >
                    {/* 헤더 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {LANGUAGE_NAMES[track.language_code] ?? track.language_code}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
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
                          편집
                        </Link>
                      </div>
                    </div>

                    {/* 최신 리비전 메시지 */}
                    {currentRevision?.message && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {currentRevision.message}
                      </p>
                    )}

                    {/* 리비전 히스토리 */}
                    {revisions.length > 1 && (
                      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
                        <p className="text-xs text-zinc-400 mb-2">리비전 히스토리</p>
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
                                    현재
                                  </span>
                                )}
                                <span className="flex-1 truncate">{rev.message || "—"}</span>
                                <span className="text-zinc-400">
                                  {new Date(rev.created_at).toLocaleDateString("ko-KR")}
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
