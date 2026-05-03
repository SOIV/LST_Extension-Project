/**
 * LST - Subtitle Parser
 * SRT / VTT / SMI / TTML → { cues: [{start,end,text}], hasExplicitPosition: bool }
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
   * 위치 정보 없음 → hasExplicitPosition: false 고정
   */
  function parseSRT(content) {
    const cues = [];
    const blocks = content.trim().split(/\r?\n\s*\r?\n/);

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
      const text  = lines.slice(ti + 1).join('\n').trim();

      if (text) cues.push({ start, end, text });
    }

    return { cues, hasExplicitPosition: false };
  }

  /**
   * VTT 파싱
   * 큐 타이밍 라인에 position / line / align / size / vertical 키워드가 있으면
   * 화면 좌표가 고정된 자막으로 판단 → hasExplicitPosition: true
   */
  function parseVTT(content) {
    const cues = [];
    let hasExplicitPosition = false;

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

      // --> 뒤쪽에 큐 설정(위치 지정) 키워드 감지
      const afterArrow = lines[ti].slice(lines[ti].indexOf('-->') + 3);
      if (/\b(position|line|align|size|vertical)\s*:/i.test(afterArrow)) {
        hasExplicitPosition = true;
      }

      const start = timeToMs(match[1]);
      const end   = timeToMs(match[2]);
      const text  = lines.slice(ti + 1).join('\n')
        .replace(/<[^>]+>/g, '')
        .trim();

      if (text) cues.push({ start, end, text });
    }

    return { cues, hasExplicitPosition };
  }

  /**
   * SMI/SAMI 파싱
   * <SYNC Start=ms> 기반, 다음 SYNC 시작이 end
   * <STYLE> 블록에 position:absolute/fixed 또는 top+left 좌표가 있으면
   * 고정 위치 자막으로 판단 → hasExplicitPosition: true
   */
  function parseSMI(content) {
    const cues  = [];
    const syncs = [];

    // 고정 위치 감지: <STYLE> 블록에 absolute/fixed 포지셔닝 또는 top+left 좌표
    let hasExplicitPosition = false;
    const styleMatch = content.match(/<STYLE[^>]*>([\s\S]*?)<\/STYLE>/i);
    if (styleMatch) {
      const styleText = styleMatch[1];
      hasExplicitPosition =
        /position\s*:\s*(absolute|fixed)/i.test(styleText) ||
        (/\btop\s*:/i.test(styleText) && /\bleft\s*:/i.test(styleText));
    }

    const syncRe = /<SYNC[^>]+Start\s*=\s*["']?(\d+)["']?[^>]*>([\s\S]*?)(?=<SYNC|<\/BODY>|$)/gi;
    let m;

    while ((m = syncRe.exec(content)) !== null) {
      const startMs = parseInt(m[1], 10);

      const pMatch = m[2].match(/<P[^>]*>([\s\S]*?)<\/P>/i)
                  || m[2].match(/<P[^>]*>([\s\S]*)/i);

      let text = '';
      if (pMatch) {
        text = pMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/gi, '')
          .replace(/&amp;/gi,  '&')
          .replace(/&lt;/gi,   '<')
          .replace(/&gt;/gi,   '>')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi,  "'")
          .trim();
      }

      syncs.push({ startMs, text });
    }

    for (let i = 0; i < syncs.length; i++) {
      const { startMs, text } = syncs[i];
      if (!text) continue;

      const end = (i + 1 < syncs.length) ? syncs[i + 1].startMs : startMs + 3000;
      if (end > startMs) {
        cues.push({ start: startMs, end, text });
      }
    }

    return { cues, hasExplicitPosition };
  }

  /**
   * TTML 타임스탬프 → 밀리초
   * HH:MM:SS.mmm / HH:MM:SS,mmm / 단위 접미사(s, ms, h, m, f, t)
   */
  function ttmlTimeToMs(str) {
    str = str.trim();

    const cm = str.match(/^(\d+):(\d+):(\d+)(?:[.,](\d+))?$/);
    if (cm) {
      const h   = parseInt(cm[1], 10);
      const min = parseInt(cm[2], 10);
      const sec = parseInt(cm[3], 10);
      const ms  = cm[4] ? Math.round(parseFloat('0.' + cm[4]) * 1000) : 0;
      return h * 3600000 + min * 60000 + sec * 1000 + ms;
    }

    const um = str.match(/^(\d+(?:\.\d+)?)(h|m|s|ms|f|t)$/);
    if (um) {
      const val = parseFloat(um[1]);
      switch (um[2]) {
        case 'h':  return Math.round(val * 3600000);
        case 'm':  return Math.round(val * 60000);
        case 's':  return Math.round(val * 1000);
        case 'ms': return Math.round(val);
        case 'f':  return Math.round(val / 30 * 1000);
        case 't':  return Math.round(val / 10000000 * 1000);
      }
    }

    return NaN;
  }

  /**
   * TTML <p> 요소에서 텍스트 추출
   */
  function extractTtmlText(el) {
    let result = '';
    for (const node of el.childNodes) {
      if (node.nodeType === 3) {
        result += node.textContent;
      } else if (node.nodeType === 1) {
        if (node.localName === 'br') {
          result += '\n';
        } else {
          result += extractTtmlText(node);
        }
      }
    }
    return result.replace(/[ \t]+/g, ' ').trim();
  }

  /**
   * TTML/XML 파싱
   * <region> 또는 <p>에 tts:origin / tts:extent 속성이 있으면
   * 화면 좌표가 고정된 자막으로 판단 → hasExplicitPosition: true
   */
  function parseTTML(content) {
    const cues = [];

    let doc;
    try {
      doc = new DOMParser().parseFromString(content, 'application/xml');
      if (doc.querySelector('parsererror')) return { cues: [], hasExplicitPosition: false };
    } catch {
      return { cues: [], hasExplicitPosition: false };
    }

    const allEls = Array.from(doc.getElementsByTagName('*'));

    // tts:origin 또는 tts:extent 가 하나라도 있으면 고정 위치
    const hasExplicitPosition = allEls.some(
      el => el.getAttribute('tts:origin') || el.getAttribute('tts:extent')
    );

    const pEls = allEls.filter(el => el.localName === 'p');

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

    return { cues, hasExplicitPosition };
  }

  /**
   * 포맷 자동 감지 후 파싱
   * @param {string} content - 자막 파일 내용
   * @param {string} [format] - 'srt'|'vtt'|'smi'|'sami'|'ttml'|'xml' (생략 시 자동 감지)
   * @returns {{ cues: {start:number, end:number, text:string}[], hasExplicitPosition: boolean }}
   */
  function parse(content, format) {
    if (!content) return { cues: [], hasExplicitPosition: false };
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
