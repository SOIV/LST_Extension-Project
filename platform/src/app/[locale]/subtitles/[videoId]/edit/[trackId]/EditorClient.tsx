"use client";

import { useState, useEffect, useRef } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

// ── Types ────────────────────────────────────────────────────────────────────
interface Cue {
  id: string;
  start: number; // ms
  end: number;   // ms
  text: string;
}

// ── Time utilities ────────────────────────────────────────────────────────────
function msToTime(ms: number, fmt: "srt" | "vtt"): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  const r = ms % 1_000;
  const sep = fmt === "vtt" ? "." : ",";
  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0") +
    sep +
    String(r).padStart(3, "0")
  );
}

function timeToMs(time: string): number | null {
  try {
    const t = time.trim().replace(",", ".");
    const dotIdx = t.lastIndexOf(".");
    const hms = dotIdx >= 0 ? t.slice(0, dotIdx) : t;
    const msStr = dotIdx >= 0 ? t.slice(dotIdx + 1) : "0";
    const parts = hms.split(":");
    if (parts.length < 2 || parts.length > 3) return null;
    const [h, m, s] = (
      parts.length === 3 ? parts : ["0", ...parts]
    ).map(Number);
    if ([h, m, s].some(isNaN)) return null;
    const ms = Number(msStr.padEnd(3, "0").slice(0, 3));
    if (isNaN(ms)) return null;
    return h * 3_600_000 + m * 60_000 + s * 1_000 + ms;
  } catch {
    return null;
  }
}

// ── Parser / serialiser ───────────────────────────────────────────────────────
let _uid = 0;
function genId(): string {
  return String(++_uid);
}

function parseBlocks(content: string): Cue[] {
  const blocks = content.trim().split(/\n[ \t]*\n/);
  const result: Cue[] = [];
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const ai = lines.findIndex((l) => l.includes("-->"));
    if (ai === -1) continue;
    const [startStr, , endStr] = lines[ai].split(/\s+/);
    const start = timeToMs(startStr);
    const end = timeToMs(endStr);
    if (start === null || end === null) continue;
    const text = lines.slice(ai + 1).join("\n").trim();
    result.push({ id: genId(), start, end, text });
  }
  return result;
}

function parseContent(content: string, fmt: "srt" | "vtt"): Cue[] {
  if (!content.trim()) return [];
  const body =
    fmt === "vtt" ? content.replace(/^WEBVTT[^\n]*\n+/, "") : content;
  return parseBlocks(body);
}

function stringifyContent(cues: Cue[], fmt: "srt" | "vtt"): string {
  const lines = cues.map(
    (c, i) =>
      `${i + 1}\n${msToTime(c.start, fmt)} --> ${msToTime(c.end, fmt)}\n${c.text}`
  );
  return fmt === "vtt" ? "WEBVTT\n\n" + lines.join("\n\n") : lines.join("\n\n");
}

// ── EditorClient ──────────────────────────────────────────────────────────────
interface EditorClientProps {
  videoId: string;
  trackId: string;
  languageName: string;
  format: "srt" | "vtt";
  initialContent: string;
}

export default function EditorClient({
  videoId,
  trackId,
  languageName,
  format,
  initialContent,
}: EditorClientProps) {
  const router = useRouter();
  const t = useTranslations("EditorPage");

  const [view, setView] = useState<"timeline" | "script">("timeline");
  const [cues, setCues] = useState<Cue[]>(() =>
    parseContent(initialContent, format)
  );
  const [rawText, setRawText] = useState(initialContent);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [videoExpanded, setVideoExpanded] = useState(false);
  const [currentSubtitleText, setCurrentSubtitleText] = useState("");

  const playerRef = useRef<Record<string, (...args: unknown[]) => unknown>>(null);

  // ── YouTube IFrame API ─────────────────────────────────────────────────────
  useEffect(() => {
    const win = window as Window &
      typeof globalThis & {
        YT?: { Player: new (...args: unknown[]) => Record<string, (...args: unknown[]) => unknown> };
        onYouTubeIframeAPIReady?: () => void;
      };

    function init() {
      if (!win.YT?.Player) return;
      playerRef.current = new win.YT.Player("yt-editor-player", {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
      });
    }

    if (win.YT?.Player) {
      init();
    } else {
      win.onYouTubeIframeAPIReady = init;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    }
    return () => {
      if (win.onYouTubeIframeAPIReady === init) {
        win.onYouTubeIframeAPIReady = undefined;
      }
    };
  }, [videoId]);

  // ── 자막 미리보기 폴링 (상시 활성) ────────────────────────────────────────────
  useEffect(() => {
    const activeCues = view === "timeline" ? cues : parseContent(rawText, format);
    const id = setInterval(() => {
      try {
        const timeSec = playerRef.current?.getCurrentTime() as number;
        if (typeof timeSec !== "number") return;
        const timeMs = timeSec * 1000;
        const active = activeCues.find((c) => c.start <= timeMs && c.end >= timeMs);
        setCurrentSubtitleText(active?.text ?? "");
      } catch { /* ignore */ }
    }, 200);
    return () => clearInterval(id);
  }, [cues, rawText, view, format]);

  function seekTo(ms: number) {
    try {
      playerRef.current?.seekTo(ms / 1000, true);
      playerRef.current?.playVideo();
    } catch {
      /* ignore */
    }
  }

  // ── View switching ─────────────────────────────────────────────────────────
  function handleViewSwitch(next: "timeline" | "script") {
    if (next === view) return;
    if (next === "script") {
      setRawText(stringifyContent(cues, format));
    } else {
      setCues(parseContent(rawText, format));
    }
    setView(next);
  }

  // ── Cue operations ─────────────────────────────────────────────────────────
  function updateCue(
    index: number,
    field: "start" | "end" | "text",
    value: string | number
  ) {
    setCues((prev) => {
      const next = [...prev];
      if (field === "text" && typeof value === "string") {
        next[index] = { ...next[index], text: value };
      } else if (
        (field === "start" || field === "end") &&
        typeof value === "number"
      ) {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  }

  function addCue() {
    const last = cues[cues.length - 1];
    const start = last ? last.end : 0;
    setCues((prev) => [
      ...prev,
      { id: genId(), start, end: start + 2000, text: "" },
    ]);
  }

  function deleteCue(index: number) {
    setCues((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    const content =
      view === "timeline" ? stringifyContent(cues, format) : rawText;

    try {
      const res = await fetch(`/api/tracks/${trackId}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, format, message }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? t("errorSave"));
        setSaving(false);
        return;
      }

      setSaved(true);
      setSaving(false);
      setTimeout(() => router.push(`/subtitles/${videoId}`), 1400);
    } catch {
      setError(t("errorNetwork"));
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sub-header */}
      <div className="sticky top-14 z-40 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 h-12 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/subtitles/${videoId}`}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors shrink-0"
          >
            {t("back")}
          </Link>
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
            {t("editTitle", { language: languageName })}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("messagePlaceholder")}
            className="hidden sm:block w-44 px-3 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs placeholder-zinc-400 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {saving ? t("saving") : saved ? t("saved") : t("save")}
          </button>
        </div>
      </div>

      {/* Feedback */}
      {(error || saved) && (
        <div className="max-w-7xl mx-auto px-4 pt-3">
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}
          {saved && (
            <div className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2.5">
              {t("successSaved")}
            </div>
          )}
        </div>
      )}

      {/* Main layout */}
      <div className={`mx-auto px-4 py-4 flex flex-col lg:flex-row gap-4 transition-all duration-200 ${videoExpanded ? "max-w-screen-2xl" : "max-w-7xl"}`}>
        {/* Video panel */}
        <div className={`shrink-0 transition-all duration-200 ${videoExpanded ? "lg:w-[600px] xl:w-[680px]" : "lg:w-[420px] xl:w-[480px]"}`}>
          <div className="sticky top-28 flex flex-col gap-1.5">
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
              <div id="yt-editor-player" className="w-full h-full" />
              {currentSubtitleText && (
                <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none px-6">
                  <span className="bg-black/80 text-white text-sm leading-snug px-3 py-1.5 rounded text-center whitespace-pre-line max-w-[85%]">
                    {currentSubtitleText}
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setVideoExpanded((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title={videoExpanded ? t("collapseVideo") : t("expandVideo")}
                aria-label={videoExpanded ? t("collapseVideo") : t("expandVideo")}
              >
                {videoExpanded ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                      <polyline points="9 18 3 12 9 6" />
                    </svg>
                    {t("collapseVideo")}
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                      <polyline points="15 18 21 12 15 6" />
                    </svg>
                    {t("expandVideo")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Editor panel */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Mobile message input */}
          <div className="sm:hidden">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messagePlaceholderMobile")}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm placeholder-zinc-400 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          {/* View tabs */}
          <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-fit">
            {(["timeline", "script"] as const).map((v) => (
              <button
                key={v}
                onClick={() => handleViewSwitch(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  view === v
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                {v === "timeline" ? t("tabTimeline") : t("tabScript")}
              </button>
            ))}
          </div>

          {/* Timeline view */}
          {view === "timeline" && (
            <div className="flex flex-col gap-2">
              {cues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                    {t("noCues")}
                  </p>
                  <button
                    onClick={addCue}
                    className="text-sm font-medium px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {t("addFirstCue")}
                  </button>
                </div>
              ) : (
                <>
                  {cues.map((cue, i) => (
                    <CueRow
                      key={cue.id}
                      index={i}
                      cue={cue}
                      format={format}
                      onUpdate={updateCue}
                      onDelete={deleteCue}
                      onSeek={seekTo}
                      seekLabel={t("seekToTime")}
                      ariaStartTime={t("ariaStartTime")}
                      ariaEndTime={t("ariaEndTime")}
                      ariaSubtitleText={t("ariaSubtitleText")}
                      ariaDeleteCue={t("ariaDeleteCue")}
                    />
                  ))}
                  <button
                    onClick={addCue}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-sm text-zinc-400 dark:text-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                  >
                    {t("addCue")}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Script view */}
          {view === "script" && (
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full font-mono text-xs leading-relaxed text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
              style={{ minHeight: "calc(100vh - 12rem)" }}
              spellCheck={false}
              placeholder={
                format === "vtt"
                  ? "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello world"
                  : "1\n00:00:01,000 --> 00:00:03,000\nHello world"
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── CueRow ────────────────────────────────────────────────────────────────────
interface CueRowProps {
  index: number;
  cue: Cue;
  format: "srt" | "vtt";
  onUpdate: (
    index: number,
    field: "start" | "end" | "text",
    value: string | number
  ) => void;
  onDelete: (index: number) => void;
  onSeek: (ms: number) => void;
  seekLabel: string;
  ariaStartTime: string;
  ariaEndTime: string;
  ariaSubtitleText: string;
  ariaDeleteCue: string;
}

function CueRow({
  index, cue, format, onUpdate, onDelete, onSeek,
  seekLabel, ariaStartTime, ariaEndTime, ariaSubtitleText, ariaDeleteCue,
}: CueRowProps) {
  const [startStr, setStartStr] = useState(() => msToTime(cue.start, format));
  const [endStr, setEndStr] = useState(() => msToTime(cue.end, format));

  function commitStart(val: string) {
    const ms = timeToMs(val);
    if (ms !== null) onUpdate(index, "start", ms);
    else setStartStr(msToTime(cue.start, format));
  }

  function commitEnd(val: string) {
    const ms = timeToMs(val);
    if (ms !== null) onUpdate(index, "end", ms);
    else setEndStr(msToTime(cue.end, format));
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex gap-2 items-start group">
      <button
        onClick={() => onSeek(cue.start)}
        title={seekLabel}
        className="shrink-0 mt-1 w-6 h-6 flex items-center justify-center rounded text-zinc-300 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-[10px]"
      >
        ▶
      </button>

      <div className="flex flex-col gap-1 shrink-0">
        <input
          type="text"
          value={startStr}
          onChange={(e) => setStartStr(e.target.value)}
          onBlur={(e) => commitStart(e.target.value)}
          aria-label={ariaStartTime}
          className="w-[7.5rem] px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400"
        />
        <input
          type="text"
          value={endStr}
          onChange={(e) => setEndStr(e.target.value)}
          onBlur={(e) => commitEnd(e.target.value)}
          aria-label={ariaEndTime}
          className="w-[7.5rem] px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400"
        />
      </div>

      <textarea
        value={cue.text}
        onChange={(e) => onUpdate(index, "text", e.target.value)}
        rows={2}
        aria-label={ariaSubtitleText}
        className="flex-1 min-w-0 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 resize-y focus:outline-none focus:ring-1 focus:ring-zinc-400"
      />

      <button
        onClick={() => onDelete(index)}
        aria-label={ariaDeleteCue}
        className="shrink-0 mt-1 w-6 h-6 flex items-center justify-center rounded text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors opacity-0 group-hover:opacity-100 text-sm"
      >
        ✕
      </button>
    </div>
  );
}
