"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

const LANGUAGE_NAMES: Record<string, string> = {
  ko: "한국어", en: "English", ja: "日本語",
  "zh-CN": "中文 (简体)", "zh-TW": "中文 (繁體)",
  es: "Español", fr: "Français", de: "Deutsch", ru: "Русский",
};

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
  const t = useTranslations("DashboardPage");

  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<ConnectedChannel[]>([]);
  const [pendingTracks, setPendingTracks] = useState<PendingTrack[]>([]);

  // 채널 연동 폼
  const [channelInput, setChannelInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  // 승인/거절 처리 중인 trackId
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

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
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      fetchData().finally(() => setLoading(false));
    });
  }, [router, fetchData]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setConnectError("");

    const res = await fetch("/api/creator/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelInput }),
    });
    const data = await res.json();

    if (!res.ok) {
      setConnectError(data.error ?? t("errorConnect"));
    } else {
      setChannelInput("");
      await fetchData();
    }
    setConnecting(false);
  }

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
                      YouTube에서 보기
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

          {channels.length === 0 && (
            <p className="text-sm text-zinc-400 dark:text-zinc-500">{t("noChannels")}</p>
          )}

          {/* 채널 연동 폼 */}
          <form onSubmit={handleConnect} className="flex flex-col gap-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("connectChannel")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                placeholder={t("channelIdPlaceholder")}
                required
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
              />
              <button
                type="submit"
                disabled={connecting}
                className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {connecting ? t("connecting") : t("connect")}
              </button>
            </div>
            {connectError && (
              <p className="text-xs text-red-600 dark:text-red-400">{connectError}</p>
            )}
            <p className="text-xs text-zinc-400 dark:text-zinc-500">{t("channelIdHint")}</p>
          </form>
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
                          <span>{LANGUAGE_NAMES[track.language_code] ?? track.language_code}</span>
                          <span>·</span>
                          <span>{new Date(track.created_at).toLocaleDateString()}</span>
                          {video?.youtube_video_id && (
                            <>
                              <span>·</span>
                              <a
                                href={`/subtitles/${video.youtube_video_id}`}
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
