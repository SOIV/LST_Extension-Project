/**
 * YouTube Data API v3 utility
 * 서버 사이드 전용 — YOUTUBE_API_KEY 는 클라이언트에 노출되지 않음
 *
 * Quota 참고 (하루 기본 10,000점):
 *   search.list  = 100점/호출
 *   videos.list  =   1점/호출 (최대 50개 ID)
 *   channels.list =  1점/호출
 */

const BASE = "https://www.googleapis.com/youtube/v3";

function apiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not configured");
  return key;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type YoutubeVideo = {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
  description: string;
  liveBroadcastContent?: "none" | "live" | "upcoming";
  viewCount?: string;
  duration?: string; // ISO 8601 e.g. "PT1H2M3S"
  hasCaption?: boolean; // contentDetails.caption
};

export type YoutubeChannel = {
  channelId: string;
  title: string;
  thumbnail: string;
  description: string;
  customUrl?: string;
  subscriberCount?: string;
  videoCount?: string;
};

export type ParsedYouTubeUrl =
  | { type: "video"; videoId: string }
  | { type: "channel"; channelId: string }
  | { type: "handle"; handle: string }
  | { type: "customUrl"; customUrl: string };

/** 채널 동영상 탭 종류 */
export type ChannelTab = "videos" | "shorts" | "live";

/** 채널 영상 목록 응답 (페이지네이션 포함) */
export type ChannelVideosResult = {
  videos: YoutubeVideo[];
  nextPageToken: string | null;
};

// ─── URL Parser ───────────────────────────────────────────────────────────────

/**
 * 입력이 YouTube URL이면 파싱 결과 반환, 아니면 null
 * 지원 형식:
 *  - https://www.youtube.com/watch?v=VIDEO_ID
 *  - https://youtu.be/VIDEO_ID
 *  - https://www.youtube.com/shorts/VIDEO_ID
 *  - https://www.youtube.com/live/VIDEO_ID
 *  - https://www.youtube.com/embed/VIDEO_ID
 *  - https://www.youtube.com/channel/CHANNEL_ID
 *  - https://www.youtube.com/@HANDLE
 *  - https://www.youtube.com/c/CUSTOM_URL
 *  - https://www.youtube.com/user/USERNAME
 *  - 11자리 videoId 단독 입력
 */
export function parseYouTubeUrl(input: string): ParsedYouTubeUrl | null {
  const trimmed = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { type: "video", videoId: trimmed };
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      const videoId = url.pathname.slice(1).split("?")[0];
      if (videoId) return { type: "video", videoId };
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      const v = url.searchParams.get("v");
      if (v) return { type: "video", videoId: v };

      const path = url.pathname;

      const videoPathMatch = path.match(/^\/(shorts|live|embed)\/([a-zA-Z0-9_-]{11})/);
      if (videoPathMatch) return { type: "video", videoId: videoPathMatch[2] };

      const channelMatch = path.match(/^\/channel\/(UC[a-zA-Z0-9_-]+)/);
      if (channelMatch) return { type: "channel", channelId: channelMatch[1] };

      const handleMatch = path.match(/^\/@([^/?]+)/);
      if (handleMatch) return { type: "handle", handle: handleMatch[1] };

      const customMatch = path.match(/^\/(c|user)\/([^/?]+)/);
      if (customMatch) return { type: "customUrl", customUrl: customMatch[2] };
    }
  } catch {
    // URL 파싱 실패 → 일반 텍스트 검색으로 처리
  }

  return null;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/** search.list snippet 아이템 → YoutubeVideo 변환 */
function snippetToVideo(item: Record<string, unknown>): YoutubeVideo | null {
  const id = item.id as Record<string, string>;
  const videoId = id?.videoId;
  if (!videoId) return null;

  const s = item.snippet as Record<string, unknown>;
  const thumbs = (s?.thumbnails as Record<string, { url: string }>) ?? {};

  return {
    videoId,
    title: (s?.title as string) ?? "",
    channelId: (s?.channelId as string) ?? "",
    channelTitle: (s?.channelTitle as string) ?? "",
    thumbnail: thumbs.medium?.url ?? thumbs.default?.url ?? "",
    publishedAt: (s?.publishedAt as string) ?? "",
    description: (s?.description as string) ?? "",
    liveBroadcastContent:
      ((s?.liveBroadcastContent as string) === "live" ||
      (s?.liveBroadcastContent as string) === "upcoming" ||
      (s?.liveBroadcastContent as string) === "none")
        ? (s?.liveBroadcastContent as "none" | "live" | "upcoming")
        : undefined,
  };
}

/**
 * 채널 업로드 플레이리스트에서 영상 목록 조회
 * - playlistItems.list — 1 quota point / 호출 (search.list 대비 100배 저렴)
 * - 채널 업로드 플레이리스트 ID: channelId UC... → UU...
 * - 현재 방송 중인 라이브는 업로드 완료 전이므로 목록에 없거나 제한적으로 포함
 */
async function fetchUploadsPlaylist(
  channelId: string,
  maxResults: number,
  pageToken?: string
): Promise<{ items: YoutubeVideo[]; nextPageToken: string | null }> {
  const playlistId = "UU" + channelId.slice(2);
  const params = new URLSearchParams({
    part: "snippet",
    playlistId,
    maxResults: String(Math.min(maxResults, 50)),
    key: apiKey(),
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(`${BASE}/playlistItems?${params}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return { items: [], nextPageToken: null };

  const data = await res.json();
  const items: YoutubeVideo[] = (data.items ?? [])
    .map((item: Record<string, unknown>) => {
      const s = item.snippet as Record<string, unknown>;
      const ri = s?.resourceId as Record<string, string>;
      const videoId = ri?.videoId;
      if (!videoId) return null;

      const thumbs = (s?.thumbnails as Record<string, { url: string }>) ?? {};
      const title = (s?.title as string) ?? "";
      // 삭제/비공개 영상 제거
      if (title === "Deleted video" || title === "Private video") return null;

      return {
        videoId,
        title,
        channelId: (s?.videoOwnerChannelId as string) ?? channelId,
        channelTitle: (s?.videoOwnerChannelTitle as string) ?? "",
        thumbnail:
          thumbs.medium?.url ??
          thumbs.high?.url ??
          thumbs.default?.url ??
          "",
        publishedAt: (s?.publishedAt as string) ?? "",
        description: (s?.description as string) ?? "",
      } satisfies YoutubeVideo;
    })
    .filter(Boolean) as YoutubeVideo[];

  return {
    items,
    nextPageToken: (data.nextPageToken as string) ?? null,
  };
}

/**
 * 채널 영상 search.list 내부 헬퍼 (nextPageToken 포함 반환)
 * - 100 quota points / 호출
 * - Shorts 탭 · 라이브 탭에서 사용 (eventType / videoDuration 필터 필요)
 */
async function fetchChannelRaw(
  channelId: string,
  maxResults: number,
  options: {
    eventType?: "completed" | "live" | "upcoming";
    videoDuration?: "short" | "medium" | "long";
    pageToken?: string;
  } = {}
): Promise<{ items: YoutubeVideo[]; nextPageToken: string | null }> {
  const params = new URLSearchParams({
    part: "snippet",
    channelId,
    type: "video",
    order: "date",
    maxResults: String(Math.min(maxResults, 50)),
    key: apiKey(),
  });

  if (options.eventType) params.set("eventType", options.eventType);
  if (options.videoDuration) params.set("videoDuration", options.videoDuration);
  if (options.pageToken) params.set("pageToken", options.pageToken);

  const res = await fetch(`${BASE}/search?${params}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return { items: [], nextPageToken: null };

  const data = await res.json();
  const items = (data.items ?? [])
    .map(snippetToVideo)
    .filter(Boolean) as YoutubeVideo[];

  return {
    items,
    nextPageToken: (data.nextPageToken as string) ?? null,
  };
}

/** ISO 8601 duration → 초 */
function isoDurationToSec(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (
    parseInt(m[1] ?? "0") * 3600 +
    parseInt(m[2] ?? "0") * 60 +
    parseInt(m[3] ?? "0")
  );
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

/** 텍스트 쿼리로 영상 + 채널 검색 (100 quota points) */
export async function searchYouTube(query: string): Promise<{
  videos: YoutubeVideo[];
  channels: YoutubeChannel[];
}> {
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video,channel",
    maxResults: "25",
    key: apiKey(),
  });

  const res = await fetch(`${BASE}/search?${params}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`);
  const data = await res.json();

  const videos: YoutubeVideo[] = [];
  const channels: YoutubeChannel[] = [];

  for (const item of data.items ?? []) {
    const s = item.snippet;
    if (item.id.kind === "youtube#video") {
      videos.push({
        videoId: item.id.videoId,
        title: s.title,
        channelId: s.channelId,
        channelTitle: s.channelTitle,
        thumbnail: s.thumbnails?.medium?.url ?? "",
        publishedAt: s.publishedAt,
        description: s.description,
      });
    } else if (item.id.kind === "youtube#channel") {
      channels.push({
        channelId: item.id.channelId,
        title: s.title,
        thumbnail: s.thumbnails?.medium?.url ?? "",
        description: s.description,
      });
    }
  }

  return { videos, channels };
}

/** 단일 영상 상세 조회 (snippet + statistics + contentDetails) */
export async function getVideoById(videoId: string): Promise<YoutubeVideo | null> {
  const params = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    id: videoId,
    key: apiKey(),
  });

  const res = await fetch(`${BASE}/videos?${params}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;

  return {
    videoId: item.id,
    title: item.snippet.title,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url ?? "",
    publishedAt: item.snippet.publishedAt,
    description: item.snippet.description,
    viewCount: item.statistics?.viewCount,
    duration: item.contentDetails?.duration,
    hasCaption: item.contentDetails?.caption === "true",
  };
}

/**
 * oEmbed API로 Shorts 세로 비율 일괄 검증
 * - API 키 불필요, 할당량 소모 없음
 * - /shorts/VIDEO_ID URL 형식으로 요청 → height > width면 진짜 Shorts
 * - 요청 실패 또는 타임아웃 시 null 반환 → 호출부에서 fallback 처리
 * - 모든 ID를 병렬 요청 + 1.5초 타임아웃으로 Vercel 10초 제한 방어
 */
async function checkShortsAspectRatio(
  videoIds: string[]
): Promise<Map<string, boolean | null>> {
  if (videoIds.length === 0) return new Map();

  const results = await Promise.allSettled(
    videoIds.map(async (id) => {
      const oembed = `https://www.youtube.com/oembed?url=https://www.youtube.com/shorts/${id}&format=json`;

      // 1.5초 타임아웃 — 느린 응답이 함수 전체를 죽이지 않도록
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);

      try {
        const res = await fetch(oembed, {
          signal: controller.signal,
          next: { revalidate: 3600 },
        });
        if (!res.ok) return { id, isVertical: null };
        const data = (await res.json()) as { width: number; height: number };
        return { id, isVertical: data.height > data.width };
      } catch {
        return { id, isVertical: null };
      } finally {
        clearTimeout(timer);
      }
    })
  );

  const map = new Map<string, boolean | null>();
  for (const r of results) {
    if (r.status === "fulfilled") {
      map.set(r.value.id, r.value.isVertical);
    }
  }
  return map;
}

/**
 * 영상 ID 목록의 재생 시간 · 자막 유무 · 방송 상태를 일괄 조회
 * videos.list 사용 — 50개당 1 quota point (search보다 100배 저렴)
 * snippet 포함: liveBroadcastContent ("none" | "live" | "upcoming") 획득
 */
export async function getVideosDetail(
  videoIds: string[]
): Promise<
  Map<string, {
    durationSec: number;
    hasCaption: boolean;
    isLiveStream: boolean;
    durationIso: string;
    liveBroadcastContent: "none" | "live" | "upcoming";
  }>
> {
  if (videoIds.length === 0) return new Map();

  const map = new Map<string, {
    durationSec: number;
    hasCaption: boolean;
    isLiveStream: boolean;
    durationIso: string;
    liveBroadcastContent: "none" | "live" | "upcoming";
  }>();
  const CHUNK = 50;

  for (let i = 0; i < videoIds.length; i += CHUNK) {
    const chunk = videoIds.slice(i, i + CHUNK);
    const params = new URLSearchParams({
      part: "snippet,contentDetails,liveStreamingDetails",
      id: chunk.join(","),
      key: apiKey(),
    });

    const res = await fetch(`${BASE}/videos?${params}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) continue;

    const data = await res.json();
    for (const item of data.items ?? []) {
      const iso = (item.contentDetails?.duration as string) ?? "";
      const live = item.liveStreamingDetails as Record<string, unknown> | undefined;
      const lbc = (item.snippet?.liveBroadcastContent as string) ?? "none";
      map.set(item.id as string, {
        durationSec: isoDurationToSec(iso),
        hasCaption: item.contentDetails?.caption === "true",
        isLiveStream: !!live?.actualStartTime,
        durationIso: iso,
        liveBroadcastContent: (lbc === "live" || lbc === "upcoming")
          ? lbc
          : "none",
      });
    }
  }

  return map;
}

/** 채널 정보 조회 (ID 기반, 1 quota point) */
export async function getChannelById(
  channelId: string
): Promise<YoutubeChannel | null> {
  const params = new URLSearchParams({
    part: "snippet,statistics",
    id: channelId,
    key: apiKey(),
  });

  const res = await fetch(`${BASE}/channels?${params}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const ch = data.items?.[0];
  if (!ch) return null;

  return {
    channelId: ch.id,
    title: ch.snippet.title,
    thumbnail: ch.snippet.thumbnails?.medium?.url ?? "",
    description: ch.snippet.description,
    customUrl: ch.snippet.customUrl,
    subscriberCount: ch.statistics?.subscriberCount,
    videoCount: ch.statistics?.videoCount,
  };
}

// ─── 채널 탭별 동영상 목록 ────────────────────────────────────────────────────

/**
 * 동영상 탭 — 채널 업로드 플레이리스트 기반, Shorts(세로 9:16) 제외
 *
 * playlistItems.list(1pt) 사용 — search.list(100pt) 대비 100배 절약.
 * 업로드 플레이리스트(UU...)는 크리에이터가 업로드한 모든 영상을 날짜 역순으로 반환.
 *
 * liveBroadcastContent 기준 (videos.list snippet으로 확인):
 *   "live"     → 현재 스트리밍 중 → 제외
 *   "upcoming" → 프리미어 대기 중 → 포함 (YouTube 동영상 탭과 동일)
 *   "none"     → 일반 / 완료된 라이브&프리미어 → 포함
 *
 * playlistItems.list(1pt) + videos.list(1pt) + oEmbed(무료)
 */
export async function getChannelRegularVideos(
  channelId: string,
  maxResults = 30,
  pageToken?: string
): Promise<ChannelVideosResult> {
  // 1단계: 업로드 플레이리스트 조회 (1pt) — 필터 대비 여유분 확보
  const { items, nextPageToken } = await fetchUploadsPlaylist(
    channelId,
    maxResults + 15,
    pageToken
  );

  // 2단계: videos.list로 duration · liveBroadcastContent · 자막 일괄 조회 (1pt)
  const detail = await getVideosDetail(items.map((v) => v.videoId));

  // 3단계: 현재 스트리밍 중인 라이브만 제외
  //   "live"     → 현재 방송 중 → 제외
  //   "upcoming" → 프리미어 대기 중 → 포함
  //   "none"     → 일반 / 완료된 라이브 VOD / 완료된 프리미어 → 포함
  type Candidate = YoutubeVideo & { _sec: number };
  const candidates: Candidate[] = items
    .map((v) => {
      const d = detail.get(v.videoId);
      return {
        ...v,
        duration: formatDuration(d?.durationIso ?? ""),
        hasCaption: d?.hasCaption ?? false,
        _sec: d?.durationSec ?? 0,
        _lbc: d?.liveBroadcastContent ?? "none",
      };
    })
    .filter((v) => {
      if (v._lbc === "live") return false;
      return true;
    })
    .map(({ _lbc, ...rest }) => {
      void _lbc;
      return rest as Candidate;
    });

  // 4단계: 180초 이하 → oEmbed 세로 비율 확인 (Shorts 제외)
  const shortCandidates = candidates.filter((v) => v._sec <= 180);
  const aspectRatio = await checkShortsAspectRatio(shortCandidates.map((v) => v.videoId));

  const videos: YoutubeVideo[] = candidates
    .filter((v) => {
      if (v._sec <= 180) {
        const isVertical = aspectRatio.get(v.videoId);
        if (isVertical === true) return false;
      }
      return true;
    })
    .slice(0, maxResults)
    .map(({ _sec, ...rest }) => {
      void _sec;
      return rest as YoutubeVideo;
    });

  return { videos, nextPageToken };
}

/**
 * Shorts 탭 — oEmbed 세로 비율 기반 판별
 *
 * YouTube Shorts는 현재 최대 3분(180초)까지 허용.
 * 길이만으로 판별하면 60~180초 Shorts가 누락되므로
 * 180초 이하 전체를 oEmbed로 확인.
 *
 * 1단계: search.list + videoDuration=short  → 4분 미만 후보 수집  (100 quota pt)
 * 2단계: videos.list contentDetails         → duration + caption 조회  (1 quota pt)
 * 3단계: oEmbed /shorts/ URL               → 180초 이하 전체 세로 비율 확인 (무료)
 *   · 세로(true) 또는 판별 불가(null) → Shorts로 포함
 *   · 가로(false) 확실 → 제외 (동영상 탭 영상)
 */
export async function getChannelShorts(
  channelId: string,
  maxResults = 30,
  pageToken?: string
): Promise<ChannelVideosResult> {
  // 1단계: search.list (100pt) — 필터 후 여유분 확보
  const { items, nextPageToken } = await fetchChannelRaw(
    channelId,
    maxResults + 15,
    { videoDuration: "short", pageToken }
  );

  // 2단계: videos.list로 duration + caption 조회 (1pt)
  const detail = await getVideosDetail(items.map((v) => v.videoId));

  // 180초 이하 후보 (Shorts 최대 길이)
  const candidates = items
    .map((v) => {
      const d = detail.get(v.videoId);
      return {
        ...v,
        duration: formatDuration(d?.durationIso ?? ""),
        hasCaption: d?.hasCaption ?? false,
        _sec: d?.durationSec ?? 0,
      };
    })
    .filter((v) => v._sec <= 180);

  // 3단계: oEmbed — 180초 이하 전체 세로 비율 확인 (병렬 요청)
  const aspectRatio = await checkShortsAspectRatio(candidates.map((v) => v.videoId));

  const videos: YoutubeVideo[] = candidates
    .filter((v) => {
      const isVertical = aspectRatio.get(v.videoId);
      return isVertical !== false;
    })
    .slice(0, maxResults)
    .map((v) => {
      const { _sec, ...rest } = v;
      void _sec;
      return rest as YoutubeVideo;
    });

  return { videos, nextPageToken };
}

/**
 * 라이브 탭 — 완료된 라이브 VOD + 예정된 스트림
 *
 * - completed : 종료된 라이브 방송 (페이지네이션 적용)
 * - upcoming  : 예정된 스트림 — 첫 페이지에서만 조회 (보통 0~3개)
 *
 * search.list(100pt) × 최대 2회 + videos.list(1pt)
 */
export async function getChannelLiveVideos(
  channelId: string,
  maxResults = 30,
  pageToken?: string
): Promise<ChannelVideosResult> {
  // 완료된 라이브 + 예정 스트림 병렬 조회
  // 예정 스트림은 첫 페이지에서만 조회 (pageToken 없을 때)
  const [completedResult, upcomingResult] = await Promise.all([
    fetchChannelRaw(channelId, maxResults, { eventType: "completed", pageToken }),
    pageToken
      ? Promise.resolve({ items: [] as YoutubeVideo[], nextPageToken: null })
      : fetchChannelRaw(channelId, 10, { eventType: "upcoming" }),
  ]);

  // upcoming을 앞에, completed를 뒤에 배치 + 중복 제거
  const seen = new Set<string>();
  const merged: YoutubeVideo[] = [];
  for (const v of [...upcomingResult.items, ...completedResult.items]) {
    if (!seen.has(v.videoId)) {
      seen.add(v.videoId);
      merged.push(v);
    }
  }

  const detail = await getVideosDetail(merged.map((v) => v.videoId));

  const videos: YoutubeVideo[] = merged
    .slice(0, maxResults)
    .map((v) => {
      const d = detail.get(v.videoId);
      return {
        ...v,
        duration: formatDuration(d?.durationIso ?? ""),
        hasCaption: d?.hasCaption ?? false,
      };
    });

  // nextPageToken은 completed 기준 (upcoming은 항상 소수라 별도 페이지 불필요)
  return { videos, nextPageToken: completedResult.nextPageToken };
}

/** @ 핸들로 채널 ID 조회 (1 quota point) */
export async function resolveHandle(handle: string): Promise<string | null> {
  const params = new URLSearchParams({
    part: "snippet",
    forHandle: handle,
    key: apiKey(),
  });

  const res = await fetch(`${BASE}/channels?${params}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.items?.[0]?.id as string) ?? null;
}

/** 커스텀 URL / 유저명으로 채널 ID 조회 — search fallback (100 quota points) */
export async function resolveCustomUrl(customUrl: string): Promise<string | null> {
  const params = new URLSearchParams({
    part: "snippet",
    q: customUrl,
    type: "channel",
    maxResults: "1",
    key: apiKey(),
  });

  const res = await fetch(`${BASE}/search?${params}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  return (item?.id as Record<string, string>)?.channelId ?? null;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/** ISO 8601 duration → "1:02:03" 또는 "2:03" */
export function formatDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "";
  const h = parseInt(m[1] ?? "0");
  const min = parseInt(m[2] ?? "0");
  const s = parseInt(m[3] ?? "0");
  if (h > 0) {
    return `${h}:${String(min).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${min}:${String(s).padStart(2, "0")}`;
}

/**
 * 구독자 수 등 큰 수 → locale별 약식 표기
 * ko: 만/억  ja: 万/億  en: K/M
 */
export function formatCountLocale(
  count: string | undefined,
  locale: string
): string {
  if (!count) return "";
  const n = parseInt(count);
  if (isNaN(n)) return count;

  if (locale === "ko") {
    if (n >= 100_000_000) {
      const v = n / 100_000_000;
      return `${v >= 10 || Number.isInteger(v) ? Math.floor(v) : v.toFixed(1)}억`;
    }
    if (n >= 10_000) {
      const v = n / 10_000;
      return `${v >= 100 || Number.isInteger(v) ? Math.floor(v) : v.toFixed(1)}만`;
    }
    return n.toLocaleString("ko-KR");
  }

  if (locale === "ja") {
    if (n >= 100_000_000) {
      const v = n / 100_000_000;
      return `${v >= 10 || Number.isInteger(v) ? Math.floor(v) : v.toFixed(1)}億`;
    }
    if (n >= 10_000) {
      const v = n / 10_000;
      return `${v >= 100 || Number.isInteger(v) ? Math.floor(v) : v.toFixed(1)}万`;
    }
    return n.toLocaleString("ja-JP");
  }

  // en (default)
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * 동영상 수 등 → 천 단위 구분자 (정확한 숫자 표시)
 */
export function formatExact(count: string | undefined, locale: string): string {
  if (!count) return "";
  const n = parseInt(count);
  if (isNaN(n)) return count;
  const localeMap: Record<string, string> = {
    ko: "ko-KR",
    ja: "ja-JP",
    en: "en-US",
  };
  return n.toLocaleString(localeMap[locale] ?? "en-US");
}

/** @deprecated 영어 전용 — 신규 코드는 formatCountLocale 사용 */
export function formatCount(count: string | undefined): string {
  return formatCountLocale(count, "en");
}
