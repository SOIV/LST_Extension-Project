"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type Revision = {
  id: string;
  revision_number: number;
  format: string;
  message: string | null;
  is_current: boolean;
  created_at: string;
};

type DiffLine =
  | { type: "equal"; content: string }
  | { type: "added"; content: string }
  | { type: "removed"; content: string };

type DiffResult = {
  from: { id: string; revision_number: number; format: string };
  to: { id: string; revision_number: number; format: string };
  diff: DiffLine[];
};

type Props = {
  trackId: string;
  languageName: string;
  revisions: Revision[];
  canRestore?: boolean;
};

export default function RevisionHistoryModal({
  trackId,
  languageName,
  revisions,
  canRestore = false,
}: Props) {
  const t = useTranslations("SubtitlePage");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (diffResult) {
          setDiffResult(null);
        } else {
          setOpen(false);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, diffResult]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const sorted = [...revisions].sort(
    (a, b) => b.revision_number - a.revision_number
  );
  const currentRevision = revisions.find((r) => r.is_current);

  const handleDiff = useCallback(
    async (revisionId: string) => {
      if (!currentRevision) return;
      setDiffLoading(true);
      setDiffError(null);
      setDiffResult(null);
      try {
        const res = await fetch(
          `/api/tracks/${trackId}/revisions/diff?from=${revisionId}&to=${currentRevision.id}`
        );
        if (!res.ok) {
          const { error } = await res.json();
          setDiffError(error ?? t("diffError"));
          return;
        }
        setDiffResult(await res.json());
      } catch {
        setDiffError(t("diffError"));
      } finally {
        setDiffLoading(false);
      }
    },
    [trackId, currentRevision, t]
  );

  const handleRestore = useCallback(
    async (revisionId: string) => {
      setRestoring(revisionId);
      try {
        const res = await fetch(
          `/api/tracks/${trackId}/revisions/${revisionId}/restore`,
          { method: "POST" }
        );
        if (!res.ok) {
          const { error } = await res.json();
          alert(error ?? t("restoreError"));
          return;
        }
        setOpen(false);
        router.refresh();
      } catch {
        alert(t("restoreError"));
      } finally {
        setRestoring(null);
      }
    },
    [trackId, t, router]
  );

  const hasDiffableRevisions = sorted.some((r) => !r.is_current);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        {t("revisionHistory")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (diffResult) {
                setDiffResult(null);
              } else {
                setOpen(false);
              }
            }}
          />

          <div
            className={`relative z-10 w-full flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden transition-all ${
              diffResult ? "max-w-3xl max-h-[90vh]" : "max-w-lg max-h-[80vh]"
            }`}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                  {diffResult ? (
                    <>
                      <button
                        onClick={() => setDiffResult(null)}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                        aria-label={t("back")}
                      >
                        ←
                      </button>
                      <span>
                        v{diffResult.from.revision_number} → v
                        {diffResult.to.revision_number}
                      </span>
                    </>
                  ) : (
                    t("revisionHistory")
                  )}
                </h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {languageName}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
                aria-label="닫기"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M12 4L4 12M4 4l8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Diff 뷰 */}
            {diffResult ? (
              <div className="flex-1 overflow-auto">
                {diffResult.diff.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-zinc-400 text-center">
                    {t("diffNoChanges")}
                  </p>
                ) : (
                  <table className="w-full text-xs font-mono border-collapse">
                    <tbody>
                      {diffResult.diff.map((line, idx) => (
                        <tr
                          key={idx}
                          className={
                            line.type === "added"
                              ? "bg-green-50 dark:bg-green-950/40"
                              : line.type === "removed"
                              ? "bg-red-50 dark:bg-red-950/40"
                              : ""
                          }
                        >
                          <td className="w-6 select-none text-center text-zinc-300 dark:text-zinc-600 pr-2 pl-3 py-0.5">
                            {line.type === "added"
                              ? "+"
                              : line.type === "removed"
                              ? "−"
                              : " "}
                          </td>
                          <td
                            className={`pl-2 pr-4 py-0.5 whitespace-pre-wrap break-all ${
                              line.type === "added"
                                ? "text-green-700 dark:text-green-400"
                                : line.type === "removed"
                                ? "text-red-600 dark:text-red-400"
                                : "text-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            {line.content}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              /* 리비전 목록 */
              <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
                {diffLoading && (
                  <div className="text-center py-4 text-sm text-zinc-400">
                    {t("diffLoading")}
                  </div>
                )}
                {diffError && (
                  <div className="text-center py-2 text-sm text-red-500">
                    {diffError}
                  </div>
                )}
                {sorted.map((rev) => (
                  <div
                    key={rev.id}
                    className="flex items-start gap-3 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                  >
                    {/* 버전 번호 */}
                    <span
                      className={`flex-shrink-0 text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                        rev.is_current
                          ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      v{rev.revision_number}
                    </span>

                    {/* 내용 */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {rev.is_current && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 font-medium">
                            {t("current")}
                          </span>
                        )}
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 uppercase font-mono">
                          {rev.format}
                        </span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">
                          {new Date(rev.created_at).toLocaleString()}
                        </span>
                      </div>
                      {rev.message ? (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 break-words">
                          {rev.message}
                        </p>
                      ) : (
                        <p className="text-xs text-zinc-300 dark:text-zinc-600 italic">
                          —
                        </p>
                      )}
                    </div>

                    {/* 액션 버튼 */}
                    {!rev.is_current && (
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {currentRevision && hasDiffableRevisions && (
                          <button
                            onClick={() => handleDiff(rev.id)}
                            disabled={diffLoading}
                            className="text-xs px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
                          >
                            {t("diffCompare")}
                          </button>
                        )}
                        {canRestore && (
                          <button
                            onClick={() => {
                              if (window.confirm(t("restoreConfirm", { version: rev.revision_number }))) {
                                handleRestore(rev.id);
                              }
                            }}
                            disabled={restoring === rev.id}
                            className="text-xs px-2 py-1 rounded border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors disabled:opacity-40"
                          >
                            {restoring === rev.id ? t("restoring") : t("restore")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
