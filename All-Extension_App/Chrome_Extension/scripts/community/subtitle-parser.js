/**
 * LST - Subtitle Parser
 * SRT / VTT → { start: ms, end: ms, text: string }[]
 */

const SubtitleParser = (() => {

  /**
   * 타임스탬프 문자열 → 밀리초
   * SRT: 00:01:23,456  /  VTT: 00:01:23.456 or 01:23.456
   */
  function timeToMs(str) {
    const s = str.trim().replace(',', '.');
    const parts = s.split(':');
    let ms = 0;
    if (parts.length === 3) {
      ms += parseFloat(parts[0]) * 3600000;
      ms += parseFloat(parts[1]) * 60000;
      ms += parseFloat(parts[2]) * 1000;
    } else if (parts.length === 2) {
      ms += parseFloat(parts[0]) * 60000;
      ms += parseFloat(parts[1]) * 1000;
    }
    return Math.round(ms);
  }

  /**
   * SRT 파싱
   */
  function parseSRT(content) {
    const cues = [];
    const blocks = content.trim().split(/\r?\n\s*\r?\n/);

    for (const block of blocks) {
      const lines = block.trim().split(/\r?\n/);
      if (lines.length < 2) continue;

      // 타이밍 라인 찾기 (인덱스 번호 줄 건너뜀)
      let ti = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-->')) { ti = i; break; }
      }
      if (ti === -1) continue;

      const match = lines[ti].match(/(\S+)\s*-->\s*(\S+)/);
      if (!match) continue;

      const start = timeToMs(match[1]);
      const end   = timeToMs(match[2]);
      const text  = lines.slice(ti + 1).join('\n').trim();

      if (text) cues.push({ start, end, text });
    }

    return cues;
  }

  /**
   * VTT 파싱
   */
  function parseVTT(content) {
    const cues = [];
    // WEBVTT 헤더 및 NOTE 블록 제거
    const cleaned = content
      .replace(/^WEBVTT[^\n]*\n/, '')
      .replace(/NOTE[^\n]*(\n[^\n]+)*/g, '');
    const blocks = cleaned.trim().split(/\r?\n\s*\r?\n/);

    for (const block of blocks) {
      const lines = block.trim().split(/\r?\n/);
      if (lines.length < 2) continue;

      let ti = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-->')) { ti = i; break; }
      }
      if (ti === -1) continue;

      const match = lines[ti].match(/(\S+)\s*-->\s*(\S+)/);
      if (!match) continue;

      const start = timeToMs(match[1]);
      const end   = timeToMs(match[2]);
      // VTT 태그 제거 (<b>, <i>, <c.color>, <00:00:00.000> 등)
      const text  = lines.slice(ti + 1).join('\n')
        .replace(/<[^>]+>/g, '')
        .trim();

      if (text) cues.push({ start, end, text });
    }

    return cues;
  }

  /**
   * 포맷 자동 감지 후 파싱
   * @param {string} content - 자막 파일 내용
   * @param {string} [format] - 'srt' | 'vtt' (생략 시 자동 감지)
   * @returns {{ start: number, end: number, text: string }[]}
   */
  function parse(content, format) {
    if (!content) return [];
    const fmt = (format || '').toLowerCase();
    if (fmt === 'vtt' || content.trimStart().startsWith('WEBVTT')) {
      return parseVTT(content);
    }
    return parseSRT(content);
  }

  return { parse };
})();
