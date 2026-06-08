"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  videoId: string;
  originalTitle?: string | null;
  originalDescription?: string | null;
};

export default function LocalizationPanel({ videoId, originalTitle, originalDescription }: Props) {
  const t = useTranslations("SubtitlePage");

  const [lang, setLang] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

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
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        {t("localizationSection")}
      </h2>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("localizationDesc")}</p>

        {/* 원본 참고 */}
        {(originalTitle || originalDescription) && (
          <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
            <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">{t("localizationOriginal")}</p>
            {originalTitle && (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{originalTitle}</p>
            )}
            {originalDescription && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-pre-line line-clamp-3">{originalDescription}</p>
            )}
          </div>
        )}

        {success && (
          <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2">
            {success}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              placeholder={t("localizationLanguagePlaceholder")}
              className="w-28 px-2.5 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 font-mono"
            />
            <span className="text-xs text-zinc-400">{t("localizationLanguage")}</span>
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("localizationTitle")}
            className="w-full px-3 py-2 text-sm rounded-md border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("localizationDescription")}
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-md border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-y"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="self-start text-sm px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-40 transition-colors"
        >
          {submitting ? t("localizationSubmitting") : t("localizationSubmit")}
        </button>
      </div>
    </div>
  );
}
