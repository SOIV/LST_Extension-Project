"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { parseYouTubeUrl } from "@/lib/youtube";

function getLanguageName(locale: string, languageCode: string): string {
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: "language" });
    return displayNames.of(languageCode) ?? languageCode;
  } catch {
    return languageCode;
  }
}

interface ConnectedChannel {
  id: string;
  youtube_channel_id: string;
}

interface PendingTrack {
  id: string;
  language_code: string;
  status: string;
  created_at: string;
  videos: {
    id: string;
    youtube_video_id: string;
    youtube_channel_id: string | null;
    title: string | null;
  } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("DashboardPage");

  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<ConnectedChannel[]>([]);
  const [pendingTracks, setPendingTracks] = useState<PendingTrack[]>([]);

  // OAuth result messages
  const [{ connectSuccess, connectError }] = useState(() => {
    if (typeof window === "undefined") {
      return { connectSuccess: "", connectError: "" };
    }

    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");

    if (connected === "1") {
      return { connectSuccess: t("connectedSuccess"), connectError: "" };
    }
    if (error === "channel_taken") {
      return { connectSuccess: "", connectError: t("errorChannelTaken") };
    }
    if (error) {
      return { connectSuccess: "", connectError: t("errorConnect") };
    }
    return { connectSuccess: "", connectError: "" };
  });

  // Approve/reject state
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  // Localization state
  type LangEntry = { lang: string; title: string; description: string };
  const [locVideoInput, setLocVideoInput] = useState("");
  const [locEntries, setLocEntries] = useState<LangEntry[]>([{ lang: "", title: "", description: "" }]);
  const [locSubmitting, setLocSubmitting] = useState(false);
  const [locSuccess, setLocSuccess] = useState("");
  const [locError, setLocError] = useState("");

  const fetchData = useCallback(async () => {
    const [chRes, pendRes] = await Promise.all([
      fetch("/api/creator/connect"),
      fetch("/api/creator/pending"),
    ]);

    if (chRes.ok) {
      const data = await chRes.json();
      setChannels(data.channels ?? []);
    }
    if (pendRes.ok) {
      const data = await pendRes.json();
      setPendingTracks(data.tracks ?? []);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      await fetchData();
      setLoading(false);
    });
  }, [router, fetchData]);

  // Read OAuth result from URL and clear it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("connected") || params.has("error")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function handleDisconnect(channelId: string) {
    if (!confirm(t("confirmDisconnect"))) return;

    const res = await fetch("/api/creator/connect", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId }),
    });

    if (res.ok) {
      await fetchData();
    } else {
      const data = await res.json();
      alert(data.error ?? t("errorDisconnect"));
    }
  }

  async function handleLocalizationSubmit() {
    setLocSuccess("");
    setLocError("");

    const parsed = parseYouTubeUrl(locVideoInput.trim());
    if (!parsed || parsed.type !== "video") {
      setLocError(t("localizationErrorVideoId"));
      return;
    }

    const validEntries = locEntries.filter((e) => e.lang.trim() && e.title.trim());
    if (validEntries.length === 0) {
      setLocError(t("localizationErrorNoLang"));
      return;
    }

    const localizations: Record<string, { title: string; description: string }> = {};
    for (const e of validEntries) {
      localizations[e.lang.trim()] = {
        title: e.title.trim(),
        description: e.description.trim(),
      };
    }

    setLocSubmitting(true);
    const res = await fetch("/api/creator/video-localizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: parsed.videoId, localizations }),
    });

    const data = await res.json();
    if (res.ok) {
      setLocSuccess(t("localizationSuccess"));
      setLocVideoInput("");
      setLocEntries([{ lang: "", title: "", description: "" }]);
    } else {
      setLocError(data.error ?? t("localizationErrorApi"));
    }
    setLocSubmitting(false);
  }

  async function handleAction(trackId: string, status: "approved" | "rejected") {
    setActioningId(trackId);
    setActionError("");

    const res = await fetch(`/api/tracks/${trackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      setPendingTracks((prev) => prev.filter((t) => t.id !== trackId));
    } else {
      const data = await res.json();
      setActionError(data.error ?? t("errorAction"));
    }
    setActioningId(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">

        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{t("title")}</h1>

        {/* ── 연동된 채널 ── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{t("channelSection")}</h2>

          {connectSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2">
              {connectSuccess}
            </p>
          )}
          {connectError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
              {connectError}
            </p>
          )}

          {channels.length > 0 && (
            <div className="flex flex-col gap-2">
              {channels.map((ch) => (
                <div
                  key={ch.id}
                  className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300">
                      {ch.youtube_channel_id}
                    </span>
                    <a
                      href={`https://youtube.com/channel/${ch.youtube_channel_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline underline-offset-2 mt-0.5"
                    >
                      {t("viewOnYouTube")}
                    </a>
                  </div>
                  <button
                    onClick={() => handleDisconnect(ch.youtube_channel_id)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  >
                    {t("disconnect")}
                  </button>
                </div>
              ))}
            </div>
          )}

          {channels.length === 0 && !connectSuccess && (
            <p className="text-sm text-zinc-400 dark:text-zinc-500">{t("noChannels")}</p>
          )}

          {/* YouTube OAuth 연동 버튼 */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("connectYouTubeDesc")}</p>
            <a
              href={`/api/creator/oauth/start?locale=${locale}`}
              className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              {t("connectYouTube")}
            </a>
          </div>
        </section>

        {/* ── 영상 제목/설명 다국어 ── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{t("localizationSection")}</h2>

          {channels.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500">{t("localizationNoChannel")}</p>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("localizationDesc")}</p>

              {locSuccess && (
                <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2">
                  {locSuccess}
                </p>
              )}
              {locError && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
                  {locError}
                </p>
              )}

              {/* 영상 URL/ID 입력 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {t("localizationVideoId")}
                </label>
                <input
                  type="text"
                  value={locVideoInput}
                  onChange={(e) => setLocVideoInput(e.target.value)}
                  placeholder={t("localizationVideoIdPlaceholder")}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                />
              </div>

              {/* 언어별 입력 */}
              <div className="flex flex-col gap-3">
                {locEntries.map((entry, idx) => (
                  <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={entry.lang}
                        onChange={(e) => {
                          const next = [...locEntries];
                          next[idx] = { ...next[idx], lang: e.target.value };
                          setLocEntries(next);
                        }}
                        placeholder={t("localizationLanguagePlaceholder")}
                        className="w-24 px-2.5 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 font-mono"
                      />
                      <span className="text-xs text-zinc-400">{t("localizationLanguage")}</span>
                      {locEntries.length > 1 && (
                        <button
                          onClick={() => setLocEntries(locEntries.filter((_, i) => i !== idx))}
                          className="ml-auto text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300"
                        >
                          {t("localizationRemove")}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={entry.title}
                      onChange={(e) => {
                        const next = [...locEntries];
                        next[idx] = { ...next[idx], title: e.target.value };
                        setLocEntries(next);
                      }}
                      placeholder={t("localizationTitle")}
                      className="w-full px-2.5 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                    />
                    <textarea
                      value={entry.description}
                      onChange={(e) => {
                        const next = [...locEntries];
                        next[idx] = { ...next[idx], description: e.target.value };
                        setLocEntries(next);
                      }}
                      placeholder={t("localizationDescription")}
                      rows={3}
                      className="w-full px-2.5 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-y"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setLocEntries([...locEntries, { lang: "", title: "", description: "" }])}
                  className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  + {t("localizationAddLanguage")}
                </button>
                <button
                  onClick={handleLocalizationSubmit}
                  disabled={locSubmitting}
                  className="text-sm px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-40 transition-colors"
                >
                  {locSubmitting ? t("localizationSubmitting") : t("localizationSubmit")}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── 승인 대기 자막 ── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{t("pendingSection")}</h2>

          {actionError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
              {actionError}
            </p>
          )}

          {pendingTracks.length === 0 ? (
            <div className="flex items-center justify-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <p className="text-sm text-zinc-400 dark:text-zinc-500">{t("noPending")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingTracks.map((track) => {
                const video = track.videos;
                const isActioning = actioningId === track.id;
                return (
                  <div
                    key={track.id}
                    className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1 min-w-0">
                        {video?.title ? (
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 line-clamp-1">
                            {video.title}
                          </p>
                        ) : (
                          <p className="text-sm text-zinc-400 font-mono">
                            {video?.youtube_video_id ?? "—"}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>{getLanguageName(locale, track.language_code)}</span>
                          <span>·</span>
                          <span>{new Date(track.created_at).toLocaleDateString()}</span>
                          {video?.youtube_video_id && (
                            <>
                              <span>·</span>
                              <a
                                href={`/${locale}/subtitles/${video.youtube_video_id}`}
                                className="underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-200"
                              >
                                {t("viewSubtitle")}
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleAction(track.id, "rejected")}
                          disabled={isActioning}
                          className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-red-300 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40 transition-colors"
                        >
                          {isActioning ? "…" : t("reject")}
                        </button>
                        <button
                          onClick={() => handleAction(track.id, "approved")}
                          disabled={isActioning}
                          className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-40 transition-colors"
                        >
                          {isActioning ? "…" : t("approve")}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
