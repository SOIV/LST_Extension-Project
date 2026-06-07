import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import HomeSearch from "./HomeSearch";
import type { ReactNode } from "react";

async function fetchStats(): Promise<{ tracks: number; videos: number } | null> {
  try {
    const supabase = await createClient();
    const [{ count: tracks }, { count: videos }] = await Promise.all([
      supabase
        .from("subtitle_tracks")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved"),
      supabase
        .from("videos")
        .select("*", { count: "exact", head: true }),
    ]);
    return { tracks: tracks ?? 0, videos: videos ?? 0 };
  } catch {
    return null;
  }
}

export default async function HomeLanding({ locale }: { locale: string }) {
  const t = await getTranslations("HomePage");
  const stats = await fetchStats();

  return (
    <main className="min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-100 dark:border-zinc-800/60">
        {/* Decorative glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-red-500/[0.07] blur-3xl dark:bg-red-500/[0.05]"
        />

        <div className="relative mx-auto flex max-w-2xl flex-col items-center px-4 pb-16 pt-20 text-center sm:pb-20 sm:pt-24">
          {/* Eyebrow */}
          <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            {t("eyebrow")}
          </span>

          {/* Title */}
          <h1 className="mb-4 text-[2.75rem] font-bold leading-tight tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-6xl">
            {t("title")}
          </h1>

          {/* Description */}
          <p className="mb-8 max-w-lg text-base leading-7 text-zinc-500 dark:text-zinc-400">
            {t("description")}
          </p>

          {/* Search */}
          <HomeSearch
            placeholder={t("searchPlaceholder")}
            buttonText={t("searchButton")}
          />

          {/* Quick links */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-zinc-400 dark:text-zinc-500">
            <Link
              href="/upload"
              className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              {t("linkUpload")}
            </Link>
            <span aria-hidden className="text-zinc-200 dark:text-zinc-800">
              ·
            </span>
            <Link
              href="/dashboard"
              className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              {t("linkDashboard")}
            </Link>
            <span aria-hidden className="text-zinc-200 dark:text-zinc-800">
              ·
            </span>
            <a
              href="https://docs.lst-pj.soiv-studio.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              {t("linkDocs")}
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      {stats !== null && (
        <div className="border-b border-zinc-100 dark:border-zinc-800/60">
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-6 px-4 py-6 sm:gap-14">
            <StatItem
              value={stats.tracks.toLocaleString(locale)}
              label={t("statSubtitlesLabel")}
            />
            <span aria-hidden className="text-zinc-200 dark:text-zinc-800">
              ·
            </span>
            <StatItem
              value={stats.videos.toLocaleString(locale)}
              label={t("statVideosLabel")}
            />
            <span aria-hidden className="text-zinc-200 dark:text-zinc-800">
              ·
            </span>
            <StatItem value="3" label={t("statLanguagesLabel")} />
          </div>
        </div>
      )}

      {/* Feature grid */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:py-16">
        <div className="grid gap-4 sm:grid-cols-3">
          <FeatureCard
            icon={<PlayIcon />}
            title={t("feature1Title")}
            description={t("feature1Desc")}
          />
          <FeatureCard
            icon={<PuzzleIcon />}
            title={t("feature2Title")}
            description={t("feature2Desc")}
          />
          <FeatureCard
            icon={<BadgeCheckIcon />}
            title={t("feature3Title")}
            description={t("feature3Desc")}
          />
        </div>
      </section>

      {/* Context: YouTube community captions history */}
      <section className="border-t border-zinc-100 dark:border-zinc-800/60">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:py-16">
          <div className="flex flex-col gap-5 sm:flex-row sm:gap-10">
            <div className="shrink-0">
              <span className="inline-block rounded-xl bg-zinc-100 px-3 py-1.5 text-2xl font-bold tabular-nums text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                {t("contextBadge")}
              </span>
            </div>
            <div>
              <h2 className="mb-3 text-base font-semibold text-zinc-950 dark:text-zinc-50">
                {t("contextTitle")}
              </h2>
              <p className="text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                {t("contextDesc")}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-2xl font-bold tabular-nums text-zinc-950 dark:text-zinc-50">
        {value}
      </span>
      <span className="text-xs text-zinc-400 dark:text-zinc-500">{label}</span>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-400">
        {icon}
      </div>
      <h3 className="mb-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </h3>
      <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="4" />
      <path
        d="M10 8l6 4-6 4V8z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

function PuzzleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4a2 2 0 1 1 4 0v1a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1a2 2 0 1 0 0 4h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-1a2 2 0 1 0-4 0v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H4a2 2 0 1 1 0-4h1a1 1 0 0 0 1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 0 1-1V4z" />
    </svg>
  );
}

function BadgeCheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 12l2 2 4-4" />
      <path d="M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138z" />
    </svg>
  );
}
