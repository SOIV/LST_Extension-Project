"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type LangEntry = { lang: string; title: string; description: string };

export default function LocalizationPanel({ videoId }: { videoId: string }) {
  const t = useTranslations("SubtitlePage");

  const [entries, setEntries] = useState<LangEntry[]>([{ lang: "", title: "", description: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  function updateEntry(idx: number, patch: Partial<LangEntry>) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  async function handleSubmit() {
    setSuccess("");
    setError("");

    const valid = entries.filter((e) => e.lang.trim() && e.title.trim());
    if (valid.length === 0) {
      setError(t("localizationErrorNoLang"));
      return;
    }

    const localizations: Record<string, { title: string; description: string }> = {};
    for (const e of valid) {
      localizations[e.lang.trim()] = { title: e.title.trim(), description: e.description.trim() };
    }

    setSubmitting(true);
    const res = await fetch("/api/creator/video-localizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, localizations }),
    });

    const data = await res.json();
    if (res.ok) {
      setSuccess(t("localizationSuccess"));
      setEntries([{ lang: "", title: "", description: "" }]);
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
          {entries.map((entry, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-2 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={entry.lang}
                  onChange={(e) => updateEntry(idx, { lang: e.target.value })}
                  placeholder={t("localizationLanguagePlaceholder")}
                  className="w-24 px-2.5 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 font-mono"
                />
                <span className="text-xs text-zinc-400">{t("localizationLanguage")}</span>
                {entries.length > 1 && (
                  <button
                    onClick={() => setEntries(entries.filter((_, i) => i !== idx))}
                    className="ml-auto text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300"
                  >
                    {t("localizationRemove")}
                  </button>
                )}
              </div>
              <input
                type="text"
                value={entry.title}
                onChange={(e) => updateEntry(idx, { title: e.target.value })}
                placeholder={t("localizationTitle")}
                className="w-full px-2.5 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
              />
              <textarea
                value={entry.description}
                onChange={(e) => updateEntry(idx, { description: e.target.value })}
                placeholder={t("localizationDescription")}
                rows={3}
                className="w-full px-2.5 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-y"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setEntries([...entries, { lang: "", title: "", description: "" }])}
            className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            + {t("localizationAddLanguage")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="text-sm px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-40 transition-colors"
          >
            {submitting ? t("localizationSubmitting") : t("localizationSubmit")}
          </button>
        </div>
      </div>
    </div>
  );
}
