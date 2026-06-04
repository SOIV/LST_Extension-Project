"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function ProfilePage() {
  const router = useRouter();
  const t = useTranslations("ProfilePage");
  const [username, setUsername] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      setEmail(user.email ?? "");
      setMemberSince(user.created_at ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, handle")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUsername(profile.username ?? null);
        setHandle(profile.handle ?? null);
      }
      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
      </div>
    );
  }

  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();

  const formattedDate = memberSince
    ? new Date(memberSince).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <div className="max-w-md mx-auto">

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{t("title")}</h1>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            {t("editSettings")}
          </Link>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-semibold text-zinc-600 dark:text-zinc-300 select-none">
                {initials}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                {username ?? email.split("@")[0]}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                {handle ? `@${handle}` : t("noHandle")}
              </p>
            </div>
          </div>

          <dl className="flex flex-col gap-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <div className="flex items-center justify-between text-sm">
              <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
              <dd className="text-zinc-900 dark:text-zinc-100 truncate max-w-[60%] text-right">{email}</dd>
            </div>
            {formattedDate && (
              <div className="flex items-center justify-between text-sm">
                <dt className="text-zinc-500 dark:text-zinc-400">{t("memberSince")}</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">{formattedDate}</dd>
              </div>
            )}
          </dl>
        </div>

      </div>
    </div>
  );
}
