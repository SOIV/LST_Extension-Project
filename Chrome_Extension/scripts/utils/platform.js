/**
 * Platform Detection Utility
 * 스트리밍 플랫폼 자동 감지 및 설정
 */

export const PLATFORMS = {
  YOUTUBE: 'youtube',
  YOUTUBE_LIVE: 'youtube_live',
  TWITCH: 'twitch',
  SOOP: 'soop',
  CHZZK: 'chzzk',
  NICONICO: 'niconico',
  UNKNOWN: 'unknown'
};

/**
 * 플랫폼별 설정
 */
const platformConfigs = {
  [PLATFORMS.YOUTUBE]: {
    name: 'YouTube',
    urlPattern: /^https?:\/\/(www\.)?youtube\.com\/watch/,
    videoSelector: 'video.html5-main-video',
    liveSelector: '.ytp-live-badge',
    subtitlePosition: { bottom: '100px', left: '50%', transform: 'translateX(-50%)' },
    defaultLang: 'auto',
    bufferSize: 1024,
    useYouTubeAPI: true
  },
  [PLATFORMS.YOUTUBE_LIVE]: {
    name: 'YouTube Live',
    urlPattern: /^https?:\/\/(www\.)?youtube\.com\/(watch|live)/,
    videoSelector: 'video.html5-main-video',
    liveSelector: '.ytp-live-badge',
    subtitlePosition: { bottom: '100px', left: '50%', transform: 'translateX(-50%)' },
    defaultLang: 'auto',
    bufferSize: 1024,
    useYouTubeAPI: true
  },
  [PLATFORMS.TWITCH]: {
    name: 'Twitch',
    urlPattern: /^https?:\/\/(www\.)?twitch\.tv\/\w+/,
    videoSelector: 'video[class*="video-player"]',
    liveSelector: '[data-a-target="player-overlay-click-handler"]',
    subtitlePosition: { bottom: '80px', left: '50%', transform: 'translateX(-50%)' },
    defaultLang: 'en',
    bufferSize: 512,
    slangDict: {
      'Kappa': '냉소',
      'PogChamp': '대박',
      'LUL': 'ㅋㅋㅋ',
      'monkaS': '불안',
      'KEKW': 'ㅋㅋㅋㅋ'
    }
  },
  [PLATFORMS.SOOP]: {
    name: 'SOOP (구 아프리카TV)',
    urlPattern: /^https?:\/\/play\.sooplive\.co\.kr\//,
    videoSelector: 'video',
    liveSelector: '.live_badge',
    subtitlePosition: { bottom: '90px', left: '50%', transform: 'translateX(-50%)' },
    defaultLang: 'ko',
    bufferSize: 1024,
    slangDict: {
      '컨텐츠': '방송',
      'ㄱㄱ': '고고',
      'ㄷㄷ': '덜덜',
      'ㅇㅇ': '응응'
    }
  },
  [PLATFORMS.CHZZK]: {
    name: '치지직',
    urlPattern: /^https?:\/\/chzzk\.naver\.com\/live\//,
    videoSelector: 'video',
    liveSelector: '.live_state',
    subtitlePosition: { bottom: '90px', left: '50%', transform: 'translateX(-50%)' },
    defaultLang: 'ko',
    bufferSize: 1024,
    slangDict: {
      'ㄱㄱ': '고고',
      'ㄷㄷ': '덜덜',
      'ㅇㅇ': '응응'
    }
  },
  [PLATFORMS.NICONICO]: {
    name: 'ニコニコ動画',
    urlPattern: /^https?:\/\/(www\.|live\.)?nicovideo\.jp\//,
    videoSelector: 'video',
    liveSelector: '.PlayerStatusContainer',
    subtitlePosition: { bottom: '120px', left: '50%', transform: 'translateX(-50%)' },
    defaultLang: 'ja',
    bufferSize: 2048,
    slangDict: {
      'www': 'ㅋㅋㅋ',
      'wwww': 'ㅋㅋㅋㅋ',
      '草': 'ㅋㅋ',
      '888': '박수',
      'うぽつ': '업로드 감사'
    }
  }
};

/**
 * 현재 페이지의 플랫폼 감지
 */
export function detectPlatform() {
  const url = window.location.href;

  // YouTube Live 먼저 체크
  if (platformConfigs[PLATFORMS.YOUTUBE].urlPattern.test(url)) {
    const liveBadge = document.querySelector(platformConfigs[PLATFORMS.YOUTUBE].liveSelector);
    if (liveBadge) {
      return PLATFORMS.YOUTUBE_LIVE;
    }
    return PLATFORMS.YOUTUBE;
  }

  // 다른 플랫폼 체크
  for (const [platformId, config] of Object.entries(platformConfigs)) {
    if (platformId === PLATFORMS.YOUTUBE || platformId === PLATFORMS.YOUTUBE_LIVE) {
      continue;
    }
    if (config.urlPattern.test(url)) {
      return platformId;
    }
  }

  return PLATFORMS.UNKNOWN;
}

/**
 * 플랫폼 설정 가져오기
 */
export function getPlatformConfig(platformId) {
  return platformConfigs[platformId] || null;
}

/**
 * 비디오 엘리먼트 찾기
 */
export function findVideoElement(platformId) {
  const config = getPlatformConfig(platformId);
  if (!config) return null;

  return document.querySelector(config.videoSelector);
}

/**
 * 라이브 스트리밍 여부 확인
 */
export function isLiveStreaming(platformId) {
  const config = getPlatformConfig(platformId);
  if (!config || !config.liveSelector) return false;

  const liveIndicator = document.querySelector(config.liveSelector);
  return !!liveIndicator;
}

/**
 * 자막 위치 계산
 */
export function getSubtitlePosition(platformId) {
  const config = getPlatformConfig(platformId);
  if (!config) {
    return { bottom: '100px', left: '50%', transform: 'translateX(-50%)' };
  }
  return config.subtitlePosition;
}

/**
 * 플랫폼 속어 번역
 */
export function translateSlang(text, platformId) {
  const config = getPlatformConfig(platformId);
  if (!config || !config.slangDict) return text;

  let translatedText = text;
  for (const [slang, translation] of Object.entries(config.slangDict)) {
    const regex = new RegExp(slang, 'gi');
    translatedText = translatedText.replace(regex, translation);
  }

  return translatedText;
}

/**
 * 플랫폼 정보 로깅
 */
export function logPlatformInfo() {
  const platformId = detectPlatform();
  const config = getPlatformConfig(platformId);

  console.log('=== Live Stream Translator - Platform Info ===');
  console.log('Platform:', config?.name || 'Unknown');
  console.log('URL:', window.location.href);
  console.log('Is Live:', isLiveStreaming(platformId));
  console.log('Video Element:', findVideoElement(platformId));
  console.log('Config:', config);
  console.log('=============================================');

  return { platformId, config };
}
