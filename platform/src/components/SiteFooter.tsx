"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function SiteFooter() {
  const t = useTranslations("Footer");

  return (
    <footer className="mt-auto border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
          <Link
            href="/terms"
            className="hover:text-zinc-700 dark:hover:text-zinc-200 underline underline-offset-2"
          >
            {t("terms")}
          </Link>
          <Link
            href="/privacy"
            className="hover:text-zinc-700 dark:hover:text-zinc-200 underline underline-offset-2"
          >
            {t("privacy")}
          </Link>
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{t("copyright")}</p>
      </div>
    </footer>
  );
}
