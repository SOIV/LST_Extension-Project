"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────────────────
type SubtitleFormat = "srt" | "vtt" | "smi" | "sami" | "ttml";

interface Cue {
  id: string;
  start: number; // ms
  end: number;   // ms
  text: string;
}

// ── Time utilities ────────────────────────────────────────────────────────────
function msToTime(ms: number, fmt: SubtitleFormat): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  const r = ms % 1_000;
  const sep = fmt === "srt" ? "," : ".";
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

function parseSMI(content: string): Cue[] {
  const syncs: Array<{ start: number; text: string }> = [];
  const syncRe =
    /<SYNC[^>]+Start\s*=\s*["']?(\d+)["']?[^>]*>([\s\S]*?)(?=<SYNC|<\/BODY>|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = syncRe.exec(content)) !== null) {
    const startMs = parseInt(m[1], 10);
    const pMatch =
      m[2].match(/<P[^>]*>([\s\S]*?)<\/P>/i) ||
      m[2].match(/<P[^>]*>([\s\S]*)/i);
    let text = "";
    if (pMatch) {
      text = pMatch[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, "")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .trim();
    }
    syncs.push({ start: startMs, text });
  }
  const cues: Cue[] = [];
  for (let i = 0; i < syncs.length; i++) {
    const { start, text } = syncs[i];
    if (!text) continue;
    const end = i + 1 < syncs.length ? syncs[i + 1].start : start + 3000;
    if (end > start) cues.push({ id: genId(), start, end, text });
  }
  return cues;
}

function parseTTMLCues(content: string): Cue[] {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(content, "application/xml");
    if (doc.querySelector("parsererror")) return [];
  } catch {
    return [];
  }

  function ttmlTimeToMs(str: string): number {
    const s = str.trim();
    const cm = s.match(/^(\d+):(\d+):(\d+)(?:[.,](\d+))?$/);
    if (cm) {
      const frac = cm[4] ? Math.round(parseFloat("0." + cm[4]) * 1000) : 0;
      return (
        parseInt(cm[1], 10) * 3_600_000 +
        parseInt(cm[2], 10) * 60_000 +
        parseInt(cm[3], 10) * 1_000 +
        frac
      );
    }
    const um = s.match(/^(\d+(?:\.\d+)?)(h|m|s|ms)$/);
    if (um) {
      const val = parseFloat(um[1]);
      switch (um[2]) {
        case "h":  return Math.round(val * 3_600_000);
        case "m":  return Math.round(val * 60_000);
        case "s":  return Math.round(val * 1_000);
        case "ms": return Math.round(val);
      }
    }
    return NaN;
  }

  function extractText(el: Element): string {
    let result = "";
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3) {
        result += node.textContent ?? "";
      } else if (node.nodeType === 1) {
        const child = node as Element;
        if (child.localName === "br") result += "\n";
        else result += extractText(child);
      }
    }
    return result.replace(/[ \t]+/g, " ").trim();
  }

  const pEls = Array.from(doc.getElementsByTagName("*")).filter(
    (el) => el.localName === "p"
  );
  const cues: Cue[] = [];
  for (const p of pEls) {
    const beginStr = p.getAttribute("begin");
    const endStr = p.getAttribute("end");
    if (!beginStr || !endStr) continue;
    const start = ttmlTimeToMs(beginStr);
    const end = ttmlTimeToMs(endStr);
    if (isNaN(start) || isNaN(end) || end <= start) continue;
    const text = extractText(p);
    if (text) cues.push({ id: genId(), start, end, text });
  }
  return cues;
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

function parseContent(content: string, fmt: SubtitleFormat): Cue[] {
  if (!content.trim()) return [];
  if (fmt === "smi" || fmt === "sami") return parseSMI(content);
  if (fmt === "ttml") return parseTTMLCues(content);
  const body =
    fmt === "vtt" ? content.replace(/^WEBVTT[^\n]*\n+/, "") : content;
  return parseBlocks(body);
}

function stringifyContent(cues: Cue[], fmt: SubtitleFormat): string {
  if (fmt === "smi" || fmt === "sami") {
    const bodyLines: string[] = [];
    for (let i = 0; i < cues.length; i++) {
      const { start, end, text } = cues[i];
      const encoded = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<BR>");
      bodyLines.push(
        `<SYNC Start=${start}><P Class=UNKN>${encoded}</P></SYNC>`
      );
      const nextStart = cues[i + 1]?.start;
      if (nextStart === undefined || nextStart !== end) {
        bodyLines.push(`<SYNC Start=${end}><P Class=UNKN>&nbsp;</P></SYNC>`);
      }
    }
    return [
      "<SAMI>",
      "<HEAD>",
      '<STYLE TYPE="text/css">',
      "P { margin-left: 8pt; margin-right: 8pt; margin-bottom: 2pt; text-align: center; font-size: 10pt; font-family: Arial; color: white; }",
      ".UNKN { Name: Unknown; lang: und; SAMI_Type: CC; }",
      "</STYLE>",
      "</HEAD>",
      "<BODY>",
      ...bodyLines,
      "</BODY>",
      "</SAMI>",
    ].join("\n");
  }

  if (fmt === "ttml") {
    const pLines = cues.map(({ start, end, text }) => {
      const encoded = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");
      return `      <p begin="${msToTime(start, "ttml")}" end="${msToTime(end, "ttml")}">${encoded}</p>`;
    });
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<tt xml:lang="und" xmlns="http://www.w3.org/ns/ttml">',
      "  <body>",
      "    <div>",
      ...pLines,
      "    </div>",
      "  </body>",
      "</tt>",
    ].join("\n");
  }

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
  format: SubtitleFormat;
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

  const [view, setView] = useState<"timeline" | "script">("timeline");
  const [cues, setCues] = useState<Cue[]>(() =>
    parseContent(initialContent, format)
  );
  const [rawText, setRawText] = useState(initialContent);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

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

  function insertCueAt(index: number) {
    setCues((prev) => {
      const updated = [...prev];
      const cur = updated[index];
      const nextCue = updated[index + 1];
      const start = cur.end;
      const end = nextCue ? nextCue.start : cur.end + 2000;
      updated.splice(index + 1, 0, {
        id: genId(),
        start,
        end: end > start ? end : start + 2000,
        text: "",
      });
      return updated;
    });
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
        setError(data.error ?? "저장 중 오류가 발생했습니다.");
        setSaving(false);
        return;
      }

      setSaved(true);
      setSaving(false);
      setTimeout(() => router.back(), 1400);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sub-header */}
      <div className="sticky top-14 z-40 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 h-12 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.back()}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors shrink-0"
          >
            ← 뒤로
          </button>
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
            {languageName} 편집
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="변경 메시지..."
            className="hidden sm:block w-44 px-3 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs placeholder-zinc-400 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {saving ? "저장 중..." : saved ? "저장됨 ✓" : "저장"}
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
              저장됐습니다. 자막 목록으로 이동합니다...
            </div>
          )}
        </div>
      )}

      {/* Main layout */}
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col lg:flex-row gap-4">
        {/* Video panel */}
        <div className="lg:w-[420px] xl:w-[480px] shrink-0">
          <div className="sticky top-28 aspect-video rounded-xl overflow-hidden bg-black">
            <div id="yt-editor-player" className="w-full h-full" />
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
              placeholder="변경 메시지 (선택)..."
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
                {v === "timeline" ? "타임라인" : "스크립트"}
              </button>
            ))}
          </div>

          {/* Timeline view */}
          {view === "timeline" && (
            <div className="flex flex-col gap-2">
              {cues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                    자막 줄이 없습니다.
                  </p>
                  <button
                    onClick={addCue}
                    className="text-sm font-medium px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    + 첫 번째 자막 줄 추가
                  </button>
                </div>
              ) : (
                <>
                  {cues.flatMap((cue, i) => [
                    <CueRow
                      key={cue.id}
                      index={i}
                      cue={cue}
                      format={format}
                      onUpdate={updateCue}
                      onDelete={deleteCue}
                      onSeek={seekTo}
                    />,
                    <button
                      key={`ins-${cue.id}`}
                      onClick={() => insertCueAt(i)}
                      className="group flex w-full items-center gap-2 py-0.5"
                      aria-label={`${i + 1}번 줄 아래에 자막 추가`}
                    >
                      <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800 group-hover:bg-zinc-300 dark:group-hover:bg-zinc-600 transition-colors" />
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                        + 자막 줄 추가
                      </span>
                      <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800 group-hover:bg-zinc-300 dark:group-hover:bg-zinc-600 transition-colors" />
                    </button>,
                  ])}
                  <button
                    onClick={addCue}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-sm text-zinc-400 dark:text-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                  >
                    + 자막 줄 추가
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
              style={{ minHeight: "calc(100vh - 20rem)" }}
              spellCheck={false}
              placeholder={
                format === "vtt"
                  ? "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello world"
                  : format === "smi" || format === "sami"
                  ? "<SAMI>\n<HEAD></HEAD>\n<BODY>\n<SYNC Start=1000><P Class=UNKN>Hello world</P></SYNC>\n<SYNC Start=3000><P Class=UNKN>&nbsp;</P></SYNC>\n</BODY>\n</SAMI>"
                  : format === "ttml"
                  ? '<?xml version="1.0" encoding="UTF-8"?>\n<tt xml:lang="und" xmlns="http://www.w3.org/ns/ttml">\n  <body>\n    <div>\n      <p begin="00:00:01.000" end="00:00:03.000">Hello world</p>\n    </div>\n  </body>\n</tt>'
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
  format: SubtitleFormat;
  onUpdate: (
    index: number,
    field: "start" | "end" | "text",
    value: string | number
  ) => void;
  onDelete: (index: number) => void;
  onSeek: (ms: number) => void;
}

function CueRow({ index, cue, format, onUpdate, onDelete, onSeek }: CueRowProps) {
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
      {/* Seek button */}
      <button
        onClick={() => onSeek(cue.start)}
        title="이 시간으로 이동"
        className="shrink-0 mt-1 w-6 h-6 flex items-center justify-center rounded text-zinc-300 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-[10px]"
      >
        ▶
      </button>

      {/* Time inputs */}
      <div className="flex flex-col gap-1 shrink-0">
        <input
          type="text"
          value={startStr}
          onChange={(e) => setStartStr(e.target.value)}
          onBlur={(e) => commitStart(e.target.value)}
          aria-label="시작 시간"
          className="w-[7.5rem] px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400"
        />
        <input
          type="text"
          value={endStr}
          onChange={(e) => setEndStr(e.target.value)}
          onBlur={(e) => commitEnd(e.target.value)}
          aria-label="종료 시간"
          className="w-[7.5rem] px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400"
        />
      </div>

      {/* Text */}
      <textarea
        value={cue.text}
        onChange={(e) => onUpdate(index, "text", e.target.value)}
        rows={2}
        aria-label="자막 텍스트"
        className="flex-1 min-w-0 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400"
      />

      {/* Delete */}
      <button
        onClick={() => onDelete(index)}
        aria-label="큐 삭제"
        className="shrink-0 mt-1 w-6 h-6 flex items-center justify-center rounded text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors opacity-0 group-hover:opacity-100 text-sm"
      >
        ✕
      </button>
    </div>
  );
}
