/**
 * LST - Subtitle Parser
 * SRT / VTT / SMI / TTML → { start: ms, end: ms, text: string }[]
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
   * SMI/SAMI 파싱
   * <SYNC Start=ms> 기반, 다음 SYNC 시작이 end
   */
  function parseSMI(content) {
    const cues  = [];
    const syncs = [];

    // <SYNC Start=N> ... 다음 <SYNC 또는 </BODY> 까지 캡처
    const syncRe = /<SYNC[^>]+Start\s*=\s*["']?(\d+)["']?[^>]*>([\s\S]*?)(?=<SYNC|<\/BODY>|$)/gi;
    let m;

    while ((m = syncRe.exec(content)) !== null) {
      const startMs = parseInt(m[1], 10);

      // 첫 번째 <P> 내용 추출 (닫힘 태그 없어도 허용)
      const pMatch = m[2].match(/<P[^>]*>([\s\S]*?)<\/P>/i)
                  || m[2].match(/<P[^>]*>([\s\S]*)/i);

      let text = '';
      if (pMatch) {
        text = pMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')  // <BR> → 줄바꿈
          .replace(/<[^>]+>/g, '')         // 나머지 HTML 태그 제거
          .replace(/&nbsp;/gi, '')         // 공백(종료) 마커 제거
          .replace(/&amp;/gi,  '&')
          .replace(/&lt;/gi,   '<')
          .replace(/&gt;/gi,   '>')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi,  "'")
          .trim();
      }

      syncs.push({ startMs, text });
    }

    // 연속 SYNC에서 start/end 쌍 생성
    // 빈 text = &nbsp; 종료 마커 → 스킵
    for (let i = 0; i < syncs.length; i++) {
      const { startMs, text } = syncs[i];
      if (!text) continue;

      const end = (i + 1 < syncs.length) ? syncs[i + 1].startMs : startMs + 3000;
      if (end > startMs) {
        cues.push({ start: startMs, end, text });
      }
    }

    return cues;
  }

  /**
   * TTML 타임스탬프 → 밀리초
   * HH:MM:SS.mmm / HH:MM:SS,mmm / 단위 접미사(s, ms, h, m, f, t)
   */
  function ttmlTimeToMs(str) {
    str = str.trim();

    // HH:MM:SS.mmm or HH:MM:SS,mmm or HH:MM:SS
    const cm = str.match(/^(\d+):(\d+):(\d+)(?:[.,](\d+))?$/);
    if (cm) {
      const h   = parseInt(cm[1], 10);
      const min = parseInt(cm[2], 10);
      const sec = parseInt(cm[3], 10);
      const ms  = cm[4] ? Math.round(parseFloat('0.' + cm[4]) * 1000) : 0;
      return h * 3600000 + min * 60000 + sec * 1000 + ms;
    }

    // 단위 접미사: 12.345s, 12345ms, 12345t(tick) 등
    const um = str.match(/^(\d+(?:\.\d+)?)(h|m|s|ms|f|t)$/);
    if (um) {
      const val = parseFloat(um[1]);
      switch (um[2]) {
        case 'h':  return Math.round(val * 3600000);
        case 'm':  return Math.round(val * 60000);
        case 's':  return Math.round(val * 1000);
        case 'ms': return Math.round(val);
        case 'f':  return Math.round(val / 30 * 1000);       // 30fps 가정
        case 't':  return Math.round(val / 10000000 * 1000); // 10MHz tick 가정
      }
    }

    return NaN;
  }

  /**
   * TTML <p> 요소에서 텍스트 추출
   * <br/> → \n, <span> 재귀, 나머지 태그 텍스트만 수집
   */
  function extractTtmlText(el) {
    let result = '';
    for (const node of el.childNodes) {
      if (node.nodeType === 3) {           // TEXT_NODE
        result += node.textContent;
      } else if (node.nodeType === 1) {    // ELEMENT_NODE
        if (node.localName === 'br') {
          result += '\n';
        } else {
          result += extractTtmlText(node); // span 등 재귀
        }
      }
    }
    // 연속 공백 정리, 앞뒤 트림
    return result.replace(/[ \t]+/g, ' ').trim();
  }

  /**
   * TTML/XML 파싱
   * namespace prefix 무관하게 localName === 'p' 인 요소를 수집
   */
  function parseTTML(content) {
    const cues = [];

    let doc;
    try {
      doc = new DOMParser().parseFromString(content, 'application/xml');
      if (doc.querySelector('parsererror')) return [];
    } catch {
      return [];
    }

    // getElementsByTagName('*') → localName 필터로 namespace 무관 탐색
    const pEls = Array.from(doc.getElementsByTagName('*'))
      .filter(el => el.localName === 'p');

    for (const p of pEls) {
      const beginStr = p.getAttribute('begin');
      const endStr   = p.getAttribute('end');
      if (!beginStr || !endStr) continue;

      const start = ttmlTimeToMs(beginStr);
      const end   = ttmlTimeToMs(endStr);
      if (isNaN(start) || isNaN(end) || end <= start) continue;

      const text = extractTtmlText(p);
      if (text) cues.push({ start, end, text });
    }

    return cues;
  }

  /**
   * 포맷 자동 감지 후 파싱
   * @param {string} content - 자막 파일 내용
   * @param {string} [format] - 'srt' | 'vtt' | 'smi' | 'sami' | 'ttml' | 'xml' (생략 시 자동 감지)
   * @returns {{ start: number, end: number, text: string }[]}
   */
  function parse(content, format) {
    if (!content) return [];
    const fmt = (format || '').toLowerCase();

    if (fmt === 'vtt' || content.trimStart().startsWith('WEBVTT')) {
      return parseVTT(content);
    }
    if (fmt === 'smi' || fmt === 'sami' || /<SAMI/i.test(content.trimStart().slice(0, 300))) {
      return parseSMI(content);
    }
    if (fmt === 'ttml' || fmt === 'xml' || /<tt[\s>]/i.test(content.trimStart().slice(0, 500))) {
      return parseTTML(content);
    }
    return parseSRT(content);
  }

  return { parse };
})();
