// 크랙 응답 한 개를 게임 화면용 조각으로 나눈다 (작품에 상관없이 쓰는 공용 규칙)
//   입력: segs = [{t:'text', s, code?}, {t:'img', src, w, h, alt}]  (응답 안 순서 그대로)
//   출력: { beats:[{kind:'say'|'narr', who, text, img, scene}], status:{rows}|null, choices:[...] }
(function (root) {
  'use strict';

  const DIVIDER = /^\s*[━─═―\-=_~·•]{5,}\s*$/;
  const EMOJI = /\p{Extended_Pictographic}/u;
  const CHOICE = /^\s*(?:(\d{1,2})\s*[.)．]|([①②③④⑤⑥⑦⑧⑨⑩])|([A-Da-d])\s*[.)]|[▶►▷➤→]|-\s*\[)\s*(.+?)\s*$/;
  const HINT = /^\s*(?:💡|선택지\s*[:：]|선택\s*[:：]|▶\s*선택)\s*(.+)$/;
  const IMG_TOKEN = /\{\{\s*img\s*::[^}]*\}\}/gi;

  const clean = (s) => String(s || '').replace(IMG_TOKEN, '').replace(/ /g, ' ').replace(/[ \t]+$/gm, '');

  // 상태창 줄처럼 보이는가
  function statusy(line) {
    const l = line.trim();
    if (!l) return false;
    if (/^\s*["“「『*]/.test(l)) return false;              // 대사·서술
    if (l.length > 90) return false;
    let score = 0;
    if (EMOJI.test(l.slice(0, 3))) score += 2;
    if (/\d+\s*\/\s*\d+/.test(l)) score += 2;
    if (/[|｜]/.test(l)) score += 2;
    if (/^[^\s:：]{1,12}\s*[:：]\s*\S/.test(l)) score += 2;
    if (/^\[[^\]]{1,14}\]/.test(l)) score += 1;
    if (/\d/.test(l)) score += 1;
    if (/[.!?…]["”]?$/.test(l) && !/[:：]/.test(l)) score -= 2; // 문장으로 끝나면 서술
    return score >= 3;
  }

  // 응답에서 상태창 줄 범위를 찾는다 → [start, end) 또는 null
  function findStatus(lines, codeMask) {
    // 1) 코드 상자(```)로 온 덩어리 중 상태창다운 것
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!codeMask[i]) continue;
      let s = i; while (s > 0 && codeMask[s - 1]) s--;
      const block = lines.slice(s, i + 1).filter(l => l.trim());
      if (block.length >= 2 && block.filter(statusy).length / block.length >= 0.4) return [s, i + 1];
      i = s;
    }
    // 2) 구분선 사이 / 마지막 구분선 뒤
    const divs = [];
    lines.forEach((l, i) => { if (DIVIDER.test(l)) divs.push(i); });
    for (let k = divs.length - 1; k >= 0; k--) {
      const s = divs[k] + 1;
      const e = k + 1 < divs.length ? divs[k + 1] : lines.length;
      const block = lines.slice(s, e).filter(l => l.trim());
      if (block.length >= 2 && block.filter(statusy).length / block.length >= 0.5) {
        return [s - 1, Math.min(lines.length, e + (k + 1 < divs.length ? 1 : 0))];
      }
    }
    // 3) 끝부분에 상태창 줄이 3줄 이상 몰려 있을 때
    let e = lines.length;
    while (e > 0 && !lines[e - 1].trim()) e--;
    let s = e, miss = 0;
    for (let i = e - 1; i >= 0; i--) {
      const l = lines[i];
      if (!l.trim()) continue;
      if (statusy(l) || /^\s{1,}\S/.test(l) && s - i <= 2) { s = i; miss = 0; }
      else if (++miss > 1) break;
    }
    const block = lines.slice(s, e).filter(l => l.trim());
    if (block.length >= 3 && block.filter(statusy).length / block.length >= 0.6) return [s, e];
    return null;
  }

  // 상태창 한 줄 → 칸들 (게이지 숫자 포함)
  function statusRow(line) {
    const parts = line.split(/\s*[|｜]\s*|\s{2,}|\s+·\s+/).map(x => x.trim()).filter(Boolean);
    return parts.map((p) => {
      const g = /(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/.exec(p);
      const cell = { text: p };
      if (g) { cell.cur = Number(g[1]); cell.max = Number(g[2]); }
      const pct = /(\d{1,3})\s*%/.exec(p);
      if (!g && pct) { cell.cur = Number(pct[1]); cell.max = 100; }
      return cell;
    });
  }

  function parseStatus(lines) {
    const rows = lines.map(l => l.trim()).filter(l => l && !DIVIDER.test(l) && !/^`{3}/.test(l)).map(statusRow).filter(r => r.length);
    return rows.length ? { rows, text: lines.join('\n').trim() } : null;
  }

  // 끝부분 선택지
  function findChoices(lines) {
    let e = lines.length;
    while (e > 0 && !lines[e - 1].trim()) e--;
    if (!e) return null;
    const last = lines[e - 1];
    const h = HINT.exec(last);
    if (h) {
      const items = h[1].split(/\s*(?:\/|｜|\||·)\s*/).map(x => x.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
      if (items.length >= 2 && items.length <= 6) return { start: e - 1, end: e, items };
    }
    let s = e;
    const items = [];
    for (let i = e - 1; i >= 0 && items.length < 7; i--) {
      const m = CHOICE.exec(lines[i]);
      if (!m) { if (!lines[i].trim() && items.length) continue; break; }
      items.unshift(m[4].replace(/^["“]|["”]$/g, ''));
      s = i;
    }
    if (items.length >= 2 && items.length <= 6 && items.every(x => x.length <= 80)) {
      // 바로 위 '선택지' 같은 머리줄도 함께 뺀다
      if (s > 0 && /^\s*(?:💡|선택지|무엇을|어떻게 할|행동)/.test(lines[s - 1]) && lines[s - 1].length < 30) s--;
      return { start: s, end: e, items };
    }
    return null;
  }

  // 한 줄 → 대사/서술
  const NAME = '[가-힣A-Za-z0-9_·\\- ]{1,12}';
  const RE_BRACKET = new RegExp('^【\\s*(' + NAME + ')\\s*(?:[|｜]\\s*([^】]{1,12}))?\\s*】\\s*(.+)$');
  const RE_COLON = new RegExp('^\\*{0,2}\\[?(' + NAME + ')\\]?\\*{0,2}\\s*[:：]\\s*(.+)$');
  const RE_QUOTE = new RegExp('^(' + NAME + ')\\s*([“"「『].+[”"」』])\\s*$');
  const RE_SQUARE = new RegExp('^\\[(' + NAME + ')\\]\\s*(.+)$');
  const stripQ = (s) => s.trim().replace(/^[“"「『]/, '').replace(/[”"」』]$/, '').trim();

  function lineBeat(line) {
    const l = line.trim();
    let m = RE_BRACKET.exec(l);
    if (m) return { kind: 'say', who: m[1].trim(), face: m[2] ? m[2].trim() : null, text: stripQ(m[3]) };
    m = RE_QUOTE.exec(l);
    if (m) return { kind: 'say', who: m[1].trim(), text: stripQ(m[2]) };
    m = RE_SQUARE.exec(l);
    if (m && !/^\d/.test(m[1])) return { kind: 'say', who: m[1].trim(), text: stripQ(m[2]) };
    m = RE_COLON.exec(l);
    if (m && !/\d/.test(m[1]) && m[1].trim().split(' ').length <= 2 && !/[.!?]$/.test(m[1])) return { kind: 'say', who: m[1].trim(), text: stripQ(m[2]) };
    if (/^[“"「『]/.test(l)) return { kind: 'say', who: null, text: stripQ(l) };
    return { kind: 'narr', who: null, text: l.replace(/^\*+|\*+$/g, '').trim() };
  }

  // 긴 서술은 문장 끝에서 나눈다
  function chunk(text, max) {
    max = max || 150;
    if (text.length <= max) return [text];
    const out = [];
    let cur = '';
    for (const s of text.match(/[^.!?…。]+[.!?…。]+["”’』」)]*\s*|[^.!?…。]+$/g) || [text]) {
      if (cur && (cur + s).length > max) { out.push(cur.trim()); cur = ''; }
      cur += s;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function parse(input, opts) {
    opts = opts || {};
    const segs = typeof input === 'string' ? [{ t: 'text', s: input }] : (input || []);
    // 글을 줄로 펴고, 그림은 줄 사이 자리 표시로
    const lines = [], codeMask = [], imgAt = {};
    for (const sg of segs) {
      if (sg.t === 'img') { (imgAt[lines.length] = imgAt[lines.length] || []).push(sg); continue; }
      const parts = clean(sg.s).split('\n');
      parts.forEach((p) => { lines.push(p); codeMask.push(!!sg.code); });
    }
    const drop = new Array(lines.length).fill(false);
    let status = null, choices = [];
    const st = findStatus(lines, codeMask);
    if (st) {
      status = parseStatus(lines.slice(st[0], st[1]));
      for (let i = st[0]; i < st[1]; i++) drop[i] = true;
    }
    const keep = lines.map((l, i) => drop[i] ? '' : l);
    const ch = findChoices(keep);
    if (ch) { choices = ch.items; for (let i = ch.start; i < ch.end; i++) drop[i] = true; }

    const beats = [];
    let pendImgs = [];
    const flushImgs = (i) => { if (imgAt[i]) pendImgs = pendImgs.concat(imgAt[i]); };
    for (let i = 0; i <= lines.length; i++) {
      flushImgs(i);
      if (i === lines.length) break;
      if (drop[i]) continue;
      const raw = lines[i];
      if (!raw.trim() || DIVIDER.test(raw) || /^`{3}/.test(raw.trim())) continue;
      const b = lineBeat(raw);
      if (!b.text) continue;
      const pieces = b.kind === 'narr' ? chunk(b.text, opts.max) : [b.text];
      pieces.forEach((t, k) => {
        const beat = { kind: b.kind, who: b.who, text: t };
        if (b.face) beat.face = b.face;
        if (k === 0 && pendImgs.length) { beat.imgs = pendImgs; pendImgs = []; }
        beats.push(beat);
      });
    }
    if (pendImgs.length) {
      if (beats.length) beats[beats.length - 1].imgs = (beats[beats.length - 1].imgs || []).concat(pendImgs);
      else beats.push({ kind: 'narr', who: null, text: '', imgs: pendImgs });
    }
    return { beats, status, choices };
  }

  // 그림 분류: 세로로 긴 그림 = 인물, 가로 = 장면
  function imgKind(img) {
    if (!img) return null;
    if (img.w && img.h) return img.h > img.w * 1.12 ? 'person' : 'scene';
    return 'scene';
  }

  // 각 장면에서 보여 줄 그림 결정
  //  - 장면 그림(가로)은 다음 장면 그림이 나올 때까지 배경으로 남는다
  //  - 인물 그림(세로)은 그 그림이 나온 대사 묶음에서만 보이고, 다른 사람이 말하기 시작하면 내려간다
  //  - 그림 이름(alt)에 다른 인물 이름이 있으면 그 사람이 말할 때만 보인다
  function stageFrames(beats) {
    let scene = null, person = null, owner = null;
    return beats.map((b) => {
      for (const im of b.imgs || []) {
        if (imgKind(im) === 'scene') scene = im;
        else { person = im; owner = (im.alt && b.who && im.alt.includes(b.who)) ? b.who : (b.who || null); }
      }
      if (person && b.kind === 'say' && b.who) {
        if (owner === null && !(b.imgs || []).includes(person)) owner = b.who;
        else if (owner && b.who !== owner && !(b.imgs || []).includes(person)) { person = null; owner = null; }
      }
      if (person && person.alt && b.kind === 'say' && b.who && !(b.imgs || []).includes(person)) {
        // 그림 이름이 지금 말하는 사람과 다르면 내린다
        const named = person.alt.replace(/[_:\-.]/g, ' ');
        if (/[가-힣]{2,}/.test(named) && !named.includes(b.who)) { person = null; owner = null; }
      }
      return { scene, person, who: b.who };
    });
  }

  const api = { parse, stageFrames, imgKind, statusy, lineBeat, chunk };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionReply = api;
})(typeof window !== 'undefined' ? window : globalThis);
