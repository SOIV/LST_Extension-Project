"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

type Revision = {
  id: string;
  revision_number: number;
  format: string;
  message: string | null;
  is_current: boolean;
  created_at: string;
};

type Props = {
  languageName: string;
  revisions: Revision[];
};

export default function RevisionHistoryModal({ languageName, revisions }: Props) {
  const t = useTranslations("SubtitlePage");
  const [open, setOpen] = useState(false);

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // body 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const sorted = [...revisions].sort((a, b) => b.revision_number - a.revision_number);

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
          {/* 백드롭 */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* 모달 본체 */}
          <div className="relative z-10 w-full max-w-lg max-h-[80vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">

            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {t("revisionHistory")}
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
                  <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* 리비전 목록 */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
              {sorted.map((rev) => (
                <div
                  key={rev.id}
                  className="flex items-start gap-3 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                >
                  {/* 버전 번호 */}
                  <span className={`flex-shrink-0 text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                    rev.is_current
                      ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                  }`}>
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
                      <p className="text-xs text-zinc-300 dark:text-zinc-600 italic">—</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}
    </>
  );
}
