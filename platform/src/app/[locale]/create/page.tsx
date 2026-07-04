"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslations, useLocale } from "next-intl";

const LANG_GROUPS = [
  { groupKey: "langGroupMain", codes: ["ko", "en", "ja", "zh-Hans", "zh-Hant"] },
  { groupKey: "langGroupOther", codes: ["es", "fr", "de", "pt", "it", "ru", "ar", "hi", "th", "vi", "id", "tr"] },
];

const FORMATS = [
  {
    value: "srt",
    label: "SRT",
    desc: "subtitleFormatSrtDesc",
  },
  {
    value: "vtt",
    label: "VTT",
    desc: "subtitleFormatVttDesc",
  },
  {
    value: "smi",
    label: "SMI/SAMI",
    desc: "subtitleFormatSmiDesc",
  },
  {
    value: "ttml",
    label: "TTML",
    desc: "subtitleFormatTtmlDesc",
  },
] as const;

function CreateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("CreatePage");
  const locale = useLocale();

  function getLangDisplayName(code: string): string {
    try {
      return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
    } catch {
      return code;
    }
  }

  const [youtubeUrl, setYoutubeUrl] = useState(searchParams.get("v") ?? "");
  const [languageCode, setLanguageCode] = useState("ko");
  const [format, setFormat] = useState<"srt" | "vtt" | "smi" | "ttml">("srt");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasHandle, setHasHandle] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", data.user.id)
        .single();
      setHasHandle(!!profile?.handle);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/create-subtitle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtubeUrl, languageCode, format }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || t("errorCreate"));
      return;
    }

    router.push(`/subtitles/${data.videoId}/edit/${data.trackId}`);
  }

  if (hasHandle === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasHandle) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
        <div className="max-w-lg mx-auto flex flex-col items-center gap-4 py-16 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-8">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{t("handleRequired")}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("handleRequiredDesc")}</p>
          </div>
          <Link
            href="/settings"
            className="mt-1 px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
          >
            {t("goToProfile")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t("description")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-5"
        >
          {/* YouTube URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("labelYoutubeUrl")}
            </label>
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              required
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
            />
          </div>

          {/* 언어 선택 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("labelLanguage")}
            </label>
            <select
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
            >
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

          {/* 포맷 선택 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("labelFormat")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value)}
                  className={`flex flex-col gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    format === f.value
                      ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                  }`}
                >
                  <span className={`text-sm font-semibold ${
                    format === f.value
                      ? "text-zinc-900 dark:text-zinc-50"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}>
                    {f.label}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 leading-snug">
                    {t(f.desc)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? t("creating") : t("create")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense>
      <CreateForm />
    </Suspense>
  );
}
