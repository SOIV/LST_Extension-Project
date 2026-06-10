"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";

const LANG_GROUPS = [
  { groupKey: "localizationLangGroupMain" as const, codes: ["ko", "en", "ja", "zh-Hans", "zh-Hant"] },
  { groupKey: "localizationLangGroupOther" as const, codes: ["es", "fr", "de", "pt", "it", "ru", "ar", "hi", "th", "vi", "id", "tr"] },
];

type Props = {
  videoId: string;
  originalTitle?: string | null;
  originalDescription?: string | null;
  isLoggedIn?: boolean;
  localizationCount?: number;
};

export default function LocalizationPanel({ videoId, originalTitle, originalDescription, isLoggedIn = false, localizationCount = 0 }: Props) {
  const t = useTranslations("SubtitlePage");
  const locale = useLocale();
  const router = useRouter();

  function getLangDisplayName(code: string): string {
    try {
      const names = new Intl.DisplayNames([locale], { type: "language" });
      return names.of(code) ?? code;
    } catch {
      return code;
    }
  }

  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // 모달 열릴 때 body 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function handleClose() {
    setOpen(false);
    setLang("");
    setTitle("");
    setDescription("");
    setSuccess("");
    setError("");
  }

  async function handleSubmit() {
    setSuccess("");
    setError("");

    if (!lang.trim()) { setError(t("localizationErrorNoLang")); return; }
    if (!title.trim()) { setError(t("localizationErrorTitle")); return; }

    setSubmitting(true);
    const res = await fetch("/api/creator/video-localizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId,
        languageCode: lang.trim(),
        title: title.trim(),
        description: description.trim(),
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setSuccess(t("localizationSuccess"));
      setLang("");
      setTitle("");
      setDescription("");
    } else {
      setError(data.error ?? t("localizationErrorApi"));
    }
    setSubmitting(false);
  }

  return (
    <>
      {/* ── 섹션 헤더 ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {t("localizationSection")}
        </h2>
        <button
          onClick={() => isLoggedIn ? setOpen(true) : router.push("/login")}
          className="text-sm px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
        >
          {t("localizationAddButton")}
        </button>
      </div>

      {/* ── 빈 상태 ── */}
      {localizationCount === 0 && (
        <div className="flex items-center justify-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("localizationNoData")}
          </p>
        </div>
      )}

      {/* ── 모달 ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 백드롭 */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* 모달 본체 */}
          <div className="relative z-10 w-full min-w-[720px] max-w-5xl h-[85vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">

            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {t("localizationSection")}
                </h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  {t("localizationDesc")}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0 ml-4"
                aria-label="닫기"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* 언어 선택 */}
            <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0 flex items-center gap-3">
              <span className="text-sm text-zinc-500 dark:text-zinc-400 flex-shrink-0">{t("localizationLanguage")}</span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-56 px-2.5 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
              >
                <option value="">{t("localizationLanguagePlaceholder")}</option>
                {LANG_GROUPS.map(({ groupKey, codes }) => (
                  <optgroup key={groupKey} label={t(groupKey)}>
                    {codes.map((code) => (
                      <option key={code} value={code}>
                        {getLangDisplayName(code)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* 2컬럼 콘텐츠 */}
            <div className="flex-1 overflow-hidden grid grid-cols-2 divide-x divide-zinc-200 dark:divide-zinc-800 min-h-0">

              {/* 왼쪽: 원본 */}
              <div className="flex flex-col overflow-hidden">
                <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
                  <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
                    {t("localizationOriginal")}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("localizationOriginalTitle")}</p>
                    <input
                      type="text"
                      readOnly
                      value={originalTitle ?? ""}
                      placeholder="—"
                      className="w-full px-3 py-2 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 cursor-text select-all focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("localizationOriginalDescription")}</p>
                    <textarea
                      readOnly
                      value={originalDescription ?? ""}
                      placeholder="—"
                      className="flex-1 w-full px-3 py-2 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 placeholder:text-zinc-400 cursor-text resize-none min-h-[120px] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 오른쪽: 번역 입력 */}
              <div className="flex flex-col overflow-hidden">
                <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
                  <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
                    {t("localizationTranslation")}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {t("localizationTitle")}
                      <span className="ml-1 text-zinc-400 dark:text-zinc-500 font-normal">{t("localizationRequired")}</span>
                    </p>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t("localizationTitlePlaceholder")}
                      className="w-full px-3 py-2 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("localizationDescription")}</p>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t("localizationDescription")}
                      className="flex-1 w-full px-3 py-2 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-none min-h-[120px]"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* 푸터 */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0">
              <div>
                {success && (
                  <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
                )}
                {error && (
                  <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={handleClose}
                  className="text-sm px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  {t("localizationCancel")}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="text-sm px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-40 transition-colors"
                >
                  {submitting ? t("localizationSubmitting") : t("localizationSubmit")}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
