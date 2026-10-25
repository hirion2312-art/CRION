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
        if (k === 0 && pendImgs.length) {
          const prev = beats[beats.length - 1];
          const back = prev && prev.who && prev.who !== beat.who && pendImgs.every(im => nameIn(im, [prev.who]));
          if (back) prev.imgs = (prev.imgs || []).concat(pendImgs);
          else beat.imgs = pendImgs;
          pendImgs = [];
        }
        beats.push(beat);
      });
    }
    if (pendImgs.length) {
      if (beats.length) beats[beats.length - 1].imgs = (beats[beats.length - 1].imgs || []).concat(pendImgs);
      else beats.push({ kind: 'narr', who: null, text: '', imgs: pendImgs });
    }
    return { beats, status, choices };
  }

  // 그림 분류
  //  - 배경(bg): 가로로 넓은 그림(가로/세로 1.3 이상) 또는 이름에 '배경·장소·풍경·bg'가 있는 그림
  //  - 인물(person): 세로로 긴 그림 또는 이름에 이번 응답의 인물 이름이 있는 그림
  //  - 삽화(cg): 그 밖의 정사각형 가까운 그림 — 그 장면에서만 가운데에 크게
  const BG_WORD = /배경|장소|풍경|전경|background|\bbg\b|scene|place/i;
  function imgKind(img, names) {
    if (!img) return null;
    const label = ((img.alt || '') + ' ' + decodeURIComponent(String(img.src || '').split('/').pop() || '')).replace(/[_:\-.]/g, ' ');
    if (BG_WORD.test(label)) return 'bg';
    if (names && nameIn(img, names)) return 'person';
    if (img.w && img.h) {
      if (img.w >= img.h * 1.3) return 'bg';
      if (img.h > img.w * 1.12) return 'person';
      return 'cg';
    }
    return 'cg';
  }

  // 그림 이름(alt·파일명)에 들어 있는 인물 이름 (이 응답에 말한 사람 중에서)
  function nameIn(img, names) {
    const t = ((img.alt || '') + ' ' + decodeURIComponent(String(img.src || '').split('/').pop() || '')).replace(/[_:\-.]/g, ' ');
    return (names || []).filter(n => n && t.includes(n)).sort((a, b) => b.length - a.length)[0] || null;
  }

  // 각 장면에서 보여 줄 그림 결정
  //  - 배경은 새 배경이 나올 때까지 계속 깔린다 (응답이 바뀌어도: startBg로 이어 받는다)
  //  - 인물은 그 인물이 말하는 동안 보이고, 다른 사람이 말하면 숨는다
  //  - 삽화는 나온 장면부터 다음 그림이 나오거나 3장면이 지날 때까지
  function stageFrames(beats, startBg) {
    const names = [...new Set(beats.map(b => b.who).filter(Boolean))];
    let bg = startBg || null, person = null, owner = null, cg = null, cgLeft = 0;
    return beats.map((b) => {
      for (const im of b.imgs || []) {
        const k = imgKind(im, names);
        if (k === 'bg') { bg = im; continue; }
        if (k === 'cg') { cg = im; cgLeft = 3; continue; }
        person = im;
        owner = nameIn(im, names) || (b.kind === 'say' ? b.who : null);
      }
      if (person && b.kind === 'say' && b.who && !owner) owner = b.who;   // 이름 모르는 그림은 그다음 처음 말하는 사람 것
      const show = person && !(b.kind === 'say' && b.who && owner && b.who !== owner);
      const frame = { bg, person: show ? person : null, cg: cgLeft > 0 ? cg : null, who: b.who };
      frame.scene = frame.bg;   // 예전 이름 호환
      if (cgLeft > 0) cgLeft--;
      return frame;
    });
  }

  const api = { parse, stageFrames, imgKind, statusy, lineBeat, chunk };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionReply = api;
})(typeof window !== 'undefined' ? window : globalThis);
