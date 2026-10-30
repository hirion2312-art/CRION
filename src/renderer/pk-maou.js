// 플레이팩 「마법소녀의 최종보스」 — 크랙 응답 해석기 (화면 없이 동작, node 시험 가능)
//  크랙 출력(메인 프롬프트·전개 예시): [장소 그림] → *상황 묘사* → [인물 그림] → **이름💬** *행동* 대사 → 상태창(코드 상자)
//    상태창: 🕖 D+n | 🏚️ 장소 / 👤 상태 | 종족 (컨디션) / 💫 권능 n/5 | 🔮 마력 n/50 / 💰 자금
//            ❣️ 호감도 / 💀 균열도 / ⚠️ 정체발각위험 n (단계) / 🏛️ 협회 동향 / 🤝 관계 | 이름: 태그
//  그림: 크랙 그림 주소의 끝 번호로 빌더 등록명(예: 기쁨_서하린, 협회_장소, 권능회수_사랑_변신_서하린)을 알아낸다 (data.imgs)
//  이 팩은 크랙 출력에 새 표식을 요구하지 않는다. 숨은 진실은 크랙이 말한 것만 보여 준다.
(function (root) {
  'use strict';
  const OSEONG = ['서하린', '한세라', '윤채아', '백설아', '오하나'];
  const KANBU = ['세이렌', '바르크', '리제', '모르페', '노엘'];
  const ST_RE = /^\s*(🕖|🕐|⏰|👤|💫|🔮|💰|❣️|❣|💀|⚠️|⚠|🏛️|🏛|🤝)/u;
  const stripMd = (s) => String(s || '').replace(/\{\{\s*img\s*::[^}]*\}\}/g, '').replace(/\*\*|__/g, '').replace(/(^|[^*])\*(?!\*)/g, '$1').replace(/`/g, '').trim();
  const num = (s) => { const m = String(s || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
  const safeDecode = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  const locked = (s) => /잠김|잠금|\?\?\?|미확인/.test(String(s || ''));

  // ---------- 명부 ----------
  function Roster(data) {
    data = data || {};
    this.list = [].concat(data.oseong || [], data.kanbu || [], data.extra || []);
    this.by = {}; this.alias = {};
    this.list.forEach(r => { this.by[r.name] = r; if (r.key) this.alias[r.key] = r.name; });
    // 오성 이름은 성을 뺀 두 글자로도 부른다 (하린·세라·채아·설아·하나)
    OSEONG.forEach(n => { this.by[n] = this.by[n] || { name: n }; this.alias[n.slice(1)] = n; });
    KANBU.forEach(n => { this.by[n] = this.by[n] || { name: n }; });
    this.keys = Object.keys(this.by).concat(Object.keys(this.alias)).sort((a, b) => b.length - a.length);
  }
  Roster.prototype.resolve = function (s) {
    const n = String(s || '').replace(/[*_💬:：]/g, '').trim();
    if (!n) return '';
    const flat = n.replace(/\s/g, '');
    if (this.by[flat]) return flat;
    if (this.alias[flat]) return this.alias[flat];
    const k = this.keys.find(x => flat.startsWith(x) && flat.length - x.length <= 5);   // "서하린 씨", "세이렌 집사장"
    return k ? (this.by[k] ? k : this.alias[k]) : '';
  };

  // ---------- 그림 주소 → 등록명 ----------
  function ImgIndex(data) {
    const imgs = (data && data.imgs) || {};
    this.byKey = {}; this.byName = imgs; this.keys = [];
    Object.entries(imgs).forEach(([name, url]) => {
      const k = String(url).split('/').pop().replace(/\.(jpe?g|png|webp)$/i, '');
      if (k && k.length >= 12) { this.byKey[k] = name; this.keys.push(k); }
    });
  }
  // 등록명 풀기: 기쁨_서하린 / 기본상태_변신_서하린 / 권능회수_사랑_변신_서하린 / 협회_장소 / 인물 외_프롤로그 웹툰 3 / 엔딩_타락한 오성
  ImgIndex.info = function (name) {
    if (!name) return null;
    const p = name.split('_');
    if (p[0] === '인물 외') return { name, kind: /웹툰/.test(p[1]) ? 'webtoon' : 'title', n: num(p[1]) || 0 };
    if (p[0] === '엔딩') return { name, kind: 'ending', ending: p.slice(1).join('_') };
    if (p[p.length - 1] === '장소') return { name, kind: 'place', place: p.slice(0, -1).join('_') };
    const who = p[p.length - 1];
    const form = p.includes('변신') ? '변신' : '';
    let situ = p[0];
    let method = '';
    if (situ === '권능회수') { method = p[1]; situ = '권능회수'; }
    return { name, kind: 'person', who, situ: situ.replace(/\//g, '·'), form, method };
  };
  ImgIndex.prototype.lookup = function (src, alt) {
    const s = safeDecode(String(src || ''));
    for (const k of this.keys) if (s.includes(k)) return ImgIndex.info(this.byKey[k]);
    // 주소로 못 찾으면 그림 설명(alt)에 등록명이 들어 있는지
    const a = String(alt || '').replace(/\//g, '/');
    if (a && this.byName[a]) return ImgIndex.info(a);
    return null;
  };
  ImgIndex.prototype.url = function (name) { return this.byName[name] || ''; };

  // ---------- 상태창 ----------
  function nameNums(text, roster) {
    const out = {};
    const t = String(text || '');
    OSEONG.concat(KANBU).forEach(n => {
      const names = [n, n.slice(1)].filter((x, i) => i === 0 || OSEONG.includes(n));
      for (const w of names) {
        const re = new RegExp(w + '\\s*[:：(（\\[]?\\s*(-?\\d{1,3}(?:\\.\\d+)?)');
        const m = t.match(re);
        if (m) { out[n] = Number(m[1]); break; }
      }
    });
    return out;
  }
  function parseStatus(lines, roster) {
    const st = {};
    const all = lines.join('\n');
    const L = (re) => lines.find(l => re.test(l)) || '';
    const tl = L(/🕖|🕐|⏰|D\s*\+\s*\d/);
    if (tl) {
      const d = tl.match(/D\s*\+\s*(\d+)/); if (d) st.day = +d[1];
      const pl = tl.split(/[|｜]/)[1]; if (pl) st.place = pl.replace(/^[\s🏚️🏚🏢📍]+/u, '').trim();
    }
    const me = L(/👤/);
    if (me) {
      const parts = me.replace(/^\s*👤\s*/u, '').split(/[|｜]/);
      st.me = (parts[0] || '').replace(/\s*상태\s*$/, '').trim();
      const r = (parts[1] || '').trim();
      const c = r.match(/^(.*?)\s*[(（]([^)）]+)[)）]\s*$/);
      st.race = c ? c[1].trim() : r; st.cond = c ? c[2].trim() : '';
    }
    const pw = L(/💫|권능\s*\d/);
    if (pw) { const m = pw.match(/권능\s*(\d+)\s*\/\s*(\d+)/); if (m) st.power = { n: +m[1], of: +m[2] }; const mm = pw.match(/마력\s*(\d+)\s*\/\s*(\d+)/); if (mm) st.mana = { n: +mm[1], of: +mm[2] }; }
    if (!st.mana) { const mm = all.match(/마력\s*(\d+)\s*\/\s*(\d+)/); if (mm) st.mana = { n: +mm[1], of: +mm[2] }; }
    const mo = L(/💰|자금/);
    if (mo) { st.moneyText = mo.replace(/^\s*💰\s*/u, '').replace(/^자금\s*/, '').trim(); st.money = num(st.moneyText.replace(/만/, '0000')); if (/만\s*원/.test(st.moneyText)) { const m = st.moneyText.replace(/,/g, '').match(/(\d+)\s*만\s*(\d*)/); if (m) st.money = (+m[1]) * 10000 + (m[2] ? +m[2] : 0); } }
    // 블록(여러 줄일 수 있음): 표식 줄부터 다음 표식 줄 전까지
    const block = (re) => {
      const i = lines.findIndex(l => re.test(l));
      if (i < 0) return null;
      const out = [lines[i]];
      for (let j = i + 1; j < lines.length && !ST_RE.test(lines[j]); j++) out.push(lines[j]);
      return out.join('\n');
    };
    const af = block(/❣|호감도/);
    if (af != null) st.aff = locked(af.replace(/❣️?|호감도/g, '')) && !Object.keys(nameNums(af, roster)).length ? null : nameNums(af, roster);
    const cr = block(/💀|균열/);
    if (cr != null) st.crack = locked(cr.replace(/💀|균열도?/g, '')) && !Object.keys(nameNums(cr, roster)).length ? null : nameNums(cr, roster);
    const rk = L(/⚠|발각/);
    if (rk) { const m = rk.match(/발각\s*위험\s*[:：]?\s*(\d{1,3})/) || rk.match(/(\d{1,3})/); st.risk = m ? +m[1] : null; const lb = rk.match(/[(（]([^)）]+)[)）]/); st.riskLabel = lb ? lb[1].trim() : ''; }
    const as = block(/🏛|협회\s*동향/);
    if (as != null) { const t = as.replace(/^\s*🏛️?\s*/u, '').replace(/^협회\s*동향\s*[:：|｜]?\s*/, '').trim(); st.assoc = locked(t) && t.length < 8 ? null : t; }
    const rl = block(/🤝|관계\s*[|｜]/);
    if (rl != null) {
      st.rel = {};
      const t = rl.replace(/^\s*🤝\s*/u, '').replace(/^관계\s*[|｜:：]?\s*/, '');
      t.split(/[,，/·\n]|\s{2,}/).forEach(p => { const m = p.match(/([가-힣]{2,5})\s*[:：]\s*([^,，/]+)/); if (m) { const n = roster.resolve(m[1]) || m[1]; st.rel[n] = m[2].trim(); } });
    }
    return st;
  }

  // ---------- 응답 ----------
  function parse(segs, roster, idx, opts) {
    opts = opts || {};
    if (typeof segs === 'string') segs = [{ t: 'text', s: segs }];
    roster = roster || new Roster({});
    idx = idx || new ImgIndex({});
    const lines = [];
    for (const sg of segs || []) {
      if (!sg) continue;
      if (sg.t === 'img') { const info = idx.lookup(sg.src, sg.alt) || {}; lines.push({ img: Object.assign({ src: sg.src, w: sg.w || 0, h: sg.h || 0, alt: sg.alt || '' }, info) }); continue; }
      String(sg.s || '').split('\n').forEach(s => lines.push({ s, code: !!sg.code }));
    }
    const drop = new Set();
    const isText = (i) => lines[i] && lines[i].s != null;
    const txt = (i) => (isText(i) ? lines[i].s : '');

    // 1) 상태창: 마지막 🕖(또는 D+n) 줄부터 이어지는 상태 줄들 (코드 상자 안이면 상자 끝까지)
    let status = null;
    const sIdx = lines.map((l, i) => (l.s != null && /🕖|🕐|⏰/u.test(l.s) && /D\s*\+\s*\d/.test(l.s) ? i : -1)).filter(i => i >= 0);
    if (sIdx.length) {
      const a = sIdx[sIdx.length - 1];
      const inCode = lines[a].code;
      let b = a;
      while (b + 1 < lines.length && isText(b + 1) && ((inCode && lines[b + 1].code) || ST_RE.test(txt(b + 1)) || !txt(b + 1).trim())) b++;
      const blk = [];
      for (let i = a; i <= b; i++) { drop.add(i); if (txt(i).trim()) blk.push(txt(i)); }
      status = parseStatus(blk, roster);
    }
    // 2) 오답노트(사칭금지 점검 결과) — 화면에선 뺀다
    lines.forEach((l, i) => {
      if (drop.has(i) || l.s == null || !/^\s*\[?오답노트\]?/.test(l.s)) return;
      drop.add(i);
      for (let j = i + 1; j < lines.length && isText(j); j++) { if (!/^\s*-\s*(점검|수정|계획)/.test(txt(j)) && !(lines[j].code && lines[i].code)) break; drop.add(j); }
    });
    // 3) 단서 노트: [단서n] 시점 - 요약
    const clues = [];
    lines.forEach((l, i) => {
      if (drop.has(i) || l.s == null) return;
      const m = stripMd(l.s).match(/^\[?\s*단서\s*(\d+)\s*\]?\s*[:：]?\s*(.+)$/);
      if (!m) return;
      drop.add(i);
      const rest = m[2].trim();
      const sp = rest.match(/^(.*?)\s*[-–—]\s+(.+)$/);
      clues.push({ n: +m[1], when: sp ? sp[1].trim() : '', text: sp ? sp[2].trim() : rest });
    });
    // 4) 스마트폰 화면(단축어 /스마트폰) — 화면에선 뺀다
    let phone = null;
    lines.forEach((l, i) => {
      if (drop.has(i) || l.s == null) return;
      const s = l.s.trim();
      if (/^\d{1,2}:\d{2}\s+.*(📶|🔋)/u.test(s) || /^🗺️?\s+📞/u.test(s) || /^정보\s+연락\s+가이드/.test(s) || /^이용하실 기능을/.test(s) || /^-{10,}$/.test(s)) { drop.add(i); phone = phone || { at: Date.now() }; }
      if (/스마트폰을 보유하고 있지 않습니다/.test(s)) { phone = { none: true }; }
    });

    // 5) 장면
    const beats = [], imgs = [];
    let pend = [];
    const pushBeat = (b) => { if (pend.length) { b.imgs = pend; pend = []; } beats.push(b); return b; };
    lines.forEach((l, i) => {
      if (drop.has(i)) return;
      if (l.img) { pend.push(l.img); imgs.push(l.img); return; }
      const raw = l.s, s = raw.trim();
      if (!s || /^[-━─=_\\]{1,}$/.test(s) || /^```/.test(s)) return;
      if (l.code && ST_RE.test(s)) return;
      const say = sayLine(raw, roster);
      if (say) { pushBeat(say); return; }
      const c = stripMd(s);
      if (!c) return;
      const ep = c.match(/^EP\.?\s*([A-Z0-9]+)\s*[|｜]\s*(.+)$/i);
      if (ep) { pushBeat({ kind: 'title', ep: ep[1], text: ep[2].trim() }); return; }
      if (/^\[?(장소 이미지|인물이미지|상황묘사)/.test(c)) return;
      if (/^[(（].*[)）]$/.test(c) && c.length < 70) { pushBeat({ kind: 'sys', text: c.replace(/^[(（]|[)）]$/g, '') }); return; }
      chunk(c, 130).forEach(t => pushBeat({ kind: 'narr', text: t }));
    });
    if (pend.length) { if (beats.length) beats[beats.length - 1].imgsAfter = pend; else beats.push({ kind: 'narr', text: '', imgs: pend }); pend = []; }

    // 그림 붙이기: 장소 그림 = 배경, 인물 그림 = 그 사람 (대사 화자와 이름이 맞을 때 그 대사에)
    beats.forEach(b => {
      const ims = b.imgs || [];
      const pl = ims.filter(x => x.kind === 'place').pop();
      if (pl) { b.place = pl.place; b.bg = pl.src; }
      const ps = ims.filter(x => x.kind === 'person');
      const mine = b.kind === 'say' ? ps.filter(x => x.who === b.who).pop() : null;
      const p = mine || ps.pop();
      if (p) { b.portrait = p.src; b.pinfo = p; }
      const webtoon = ims.filter(x => x.kind === 'webtoon' || x.kind === 'title');
      if (webtoon.length) b.webtoon = webtoon;
      const end = ims.find(x => x.kind === 'ending');
      if (end) b.ending = end;
    });
    // 묘사 줄에 붙은 인물 그림은, 바로 뒤(3마디 안)에 그 사람이 말하면 그 대사에도 붙인다
    beats.forEach((b, i) => {
      if (b.kind === 'say' || !b.pinfo) return;
      for (let j = i + 1; j < Math.min(beats.length, i + 4); j++) {
        const n = beats[j];
        if (n.kind === 'say' && n.who === b.pinfo.who) { if (!n.portrait) { n.portrait = b.portrait; n.pinfo = b.pinfo; } break; }
        if (n.portrait) break;
      }
    });
    // 권능 회수 그림 = 그 사람의 권능을 그 방식으로 되찾은 장면
    const recovered = imgs.filter(x => x.kind === 'person' && x.situ === '권능회수' && x.method).map(x => ({ who: x.who, method: x.method }));
    const ending = (imgs.find(x => x.kind === 'ending') || {}).ending || '';
    const webtoon = imgs.filter(x => x.kind === 'webtoon').sort((a, b) => a.n - b.n);
    const title = imgs.find(x => x.kind === 'title');
    const text = beats.map(b => (b.kind === 'say' ? b.who + ' ' : '') + (b.text || '')).join('\n');
    return { status, clues, phone, beats, imgs, recovered, ending, webtoon, title, text, prologue: !!(title || webtoon.length) };
  }
  function chunk(text, size) {
    const sents = String(text).split(/(?<=[.!?。…~][”"’']?)\s+/).filter(Boolean);
    const out = [];
    let cur = '';
    for (const s of sents) {
      if (cur && (cur + ' ' + s).length > size) { out.push(cur.trim()); cur = ''; }
      cur += (cur ? ' ' : '') + s;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function sayLine(line, roster) {
    const i = line.indexOf('💬');
    if (i < 1 || i > 26) return null;
    const rawName = stripMd(line.slice(0, i)).replace(/^[-•>\s👤]+/, '').trim();
    if (!rawName || rawName.length > 16 || /[|｜\[\]]/.test(rawName)) return null;
    let rest = line.slice(i + 2);
    // 원문 그대로면 *행동* 을 떼어 낸다 (크랙 화면에서 읽으면 * 가 사라져 있음)
    let act = '';
    rest = rest.replace(/^\s*\*\*(?!\*)/, '');   // 이름을 감싼 ** 의 닫는 쪽
    const am = rest.match(/^\s*\*([^*]+)\*\s*/);
    if (am) { act = am[1].trim(); rest = rest.slice(am[0].length); }
    rest = stripMd(rest).trim();
    const q = rest.search(/["“]/);
    if (q > 0 && !act) { act = rest.slice(0, q).trim(); rest = rest.slice(q); }
    let text = rest.replace(/^["“]/, '');
    const c = text.search(/["”](?=[^"”]*$)/);
    if (c >= 0) { const tail = text.slice(c + 1).trim(); text = text.slice(0, c) + (tail ? ' ' + tail : ''); }
    const who = roster.resolve(rawName);
    return { kind: 'say', who: who || rawName, raw: rawName, known: !!who, act, text: text.trim() };
  }

  // ---------- 기억에 합치기 (계산은 하지 않는다: 숫자는 크랙 상태창 그대로) ----------
  function blank() {
    return { status: {}, aff: {}, crack: {}, rel: {}, powers: {}, clues: [], seen: {}, lines: [], log: [], prologue: false, endings: [], phone: false, lastBg: '', turns: 0, hist: {}, days: {} };
  }
  const STAGES = [[0, '적대·경계'], [20, '무관심·거리두기'], [40, '호의·친근'], [60, '신뢰'], [80, '깊은 유대']];
  const stageOf = (v) => { if (v == null) return ''; let s = STAGES[0][1]; STAGES.forEach(([a, l]) => { if (v >= a) s = l; }); return s; };
  function absorb(M, P, data) {
    const ev = { affUp: [], crackUp: [], recovered: [], newClues: 0, risk: null, day: null, power: null, ending: '', money: null };
    M.turns = (M.turns || 0) + 1;
    const st = P.status;
    if (st) {
      const prev = M.status || {};
      if (st.day != null && prev.day != null && st.day > prev.day) ev.day = { from: prev.day, to: st.day };
      if (st.power && prev.power && st.power.n > prev.power.n) ev.power = { from: prev.power.n, to: st.power.n };
      if (st.risk != null && prev.risk != null && (st.riskLabel !== prev.riskLabel || Math.abs(st.risk - prev.risk) >= 10)) ev.risk = { from: prev.risk, to: st.risk, label: st.riskLabel };
      if (st.money != null && prev.money != null && st.money !== prev.money) ev.money = { from: prev.money, to: st.money };
      if (st.aff) Object.entries(st.aff).forEach(([n, v]) => { const was = M.aff[n]; if (was != null && v !== was) ev.affUp.push({ n, from: was, to: v, stage: stageOf(v), stageChanged: stageOf(v) !== stageOf(was) }); M.aff[n] = v; });
      if (st.crack) Object.entries(st.crack).forEach(([n, v]) => { const was = M.crack[n]; if (was != null && v !== was) ev.crackUp.push({ n, from: was, to: v }); M.crack[n] = v; });
      if (st.rel) Object.assign(M.rel, st.rel);
      // 잠김이 풀리기 전엔 이전 값을 그대로 둔다
      M.status = Object.assign({}, prev, st, { aff: st.aff || prev.aff || null, crack: st.crack || prev.crack || null });
    }
    // 관계 추이(턴마다 한 점) · 하루 기록(일지)
    M.hist = M.hist || {}; M.days = M.days || {};
    const names = new Set([].concat(Object.keys(M.aff || {}), Object.keys(M.crack || {})));
    names.forEach(n => { const h = M.hist[n] = M.hist[n] || []; const pt = [M.turns, M.aff[n] == null ? null : M.aff[n], M.crack[n] == null ? null : M.crack[n]]; const last = h[h.length - 1]; if (!last || last[1] !== pt[1] || last[2] !== pt[2]) h.push(pt); if (h.length > 60) h.splice(0, h.length - 60); });
    const dk = String((M.status && M.status.day) || 0);
    const day = M.days[dk] = M.days[dk] || { places: [], met: [], notes: [] };
    const pl = M.status && M.status.place; if (pl && !day.places.includes(pl)) day.places.push(pl);
    (P.beats || []).forEach(b => { if (b.kind === 'say' && b.known && !day.met.includes(b.who)) day.met.push(b.who); });
    const note = (t) => { if (day.notes.length < 30) day.notes.push(t); };
    ev.affUp.forEach(a => { if (a.stageChanged) note(`${a.n} — ${a.stage}`); });
    (P.recovered || []).forEach(r => { if (!M.powers[r.who]) note(`${r.who}의 권능을 ${r.method}으로 되찾음`); });
    (P.clues || []).forEach(c => { if (!M.clues.find(x => x.n === c.n)) note(`단서 ${c.n}: ${c.text}`); });
    if (!day.first) { const nb = (P.beats || []).find(b => b.kind === 'narr' && b.text && b.text.length > 12); if (nb) day.first = nb.text.slice(0, 90); }
    (P.recovered || []).forEach(r => { if (!M.powers[r.who]) { M.powers[r.who] = r.method; ev.recovered.push(r); } });
    (P.clues || []).forEach(c => { const have = M.clues.find(x => x.n === c.n); if (!have) { M.clues.push(c); ev.newClues++; } else Object.assign(have, c); });
    M.clues.sort((a, b) => a.n - b.n);
    if (P.phone && !P.phone.none) M.phone = true;
    (P.imgs || []).forEach(im => { if (im.name) M.seen[im.name] = M.seen[im.name] || Date.now(); });
    if (P.ending && !M.endings.includes(P.ending)) { M.endings.push(P.ending); ev.ending = P.ending; }
    return ev;
  }

  const api = { Roster, ImgIndex, parse, parseStatus, absorb, blank, stageOf, sayLine, stripMd, OSEONG, KANBU };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionMaou = api;
})(typeof window !== 'undefined' ? window : globalThis);
