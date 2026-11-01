// 플레이팩 「반지하 엔터테인먼트」 — 크랙 응답 해석기 + 음악 엔진(커버·가상 차트) (화면 없이 동작, node 시험 가능)
//  출력 규격(구현 기획서 ①~⑤, 브리지 037 [4]):
//    ① 상태창: 📅 n년차 m월 · 행동 a/4 | 🔥 유행: 장르 · 테마 / 💰 자금 | 🧾 부채 (상환 D-n달) / 🏠 숙소 | 🏢 등급 | ⚠️ 루머 n/3
//              💗 코어 n · 라이트 n | ▶️ 구독 n | 📈 최고 n위 / 👥 이름 [포지션·등급] 컨디션 / … / 🎵 진행 곡: 「곡」 제작 a/b달 · m월 발매
//              ⚔️ 라이벌: 이름 n승 n패 / 🤝 약속: … / …
//    ② 알림 줄: 🎵 발매! 「곡」 · 📈 차트 진입! n위 · 🏆 1위! 「곡」 · 🤝 합류! 이름 · 🎧 신곡 공개: 그룹 「곡」 · ⚠️ 루머 n단계 · 🎤 무대: 프로그램
//    ③ 월말 결산: ━━ 📊 n월 결산 ━━ … ━━━━ (💵 수입 · 💸 지출 · 🎵 「곡」 X등급 · 화력 n · 📈 레몬차트 「곡」 n위 (▲n) | 그룹 「곡」 n위 · 💬 반응 · 💪 컨디션 · 🔜 다음 달)
//    ④ 대사 이름💬 "대사" · 그림 {{img::이름::상황}} → 등록명 이름_상황 / 배경_장소
//    ⑤ 곡 기획서(팩 → 입력칸): [곡 기획서] 곡명·장르·테마·배분(10)·작사·후렴·작곡·센터·발매
//  숫자는 계산하지 않는다(크랙 그대로). 차트의 우리·라이벌 외 칸은 분위기용 가상 곡으로 채운다(표시함).
(function (root) {
  'use strict';
  const ST_RE = /^\s*(📅|💰|🧾|🏠|🏢|💗|▶️|▶|📈 ?최고|👥|🎵 ?진행|⚔️|⚔|🤝 ?약속)/u;
  const stripMd = (s) => String(s || '').replace(/\{\{\s*img\s*::[^}]*\}\}/g, '').replace(/\*\*|__/g, '').replace(/(^|[^*])\*(?!\*)/g, '$1').replace(/`/g, '').trim();
  const safeDecode = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  const Q = /「([^」]+)」/;
  // 돈: "120만", "1,200만", "3억 2,000만", "-50만", "8,000원" → 원 단위
  function won(s) {
    const t = String(s || '').replace(/,/g, '').replace(/\s/g, '');
    const neg = /^[-−]/.test(t) ? -1 : 1;
    let v = 0, hit = false;
    const e = t.match(/(\d+(?:\.\d+)?)억/); if (e) { v += +e[1] * 1e8; hit = true; }
    const m = t.match(/(?:억)?(\d+(?:\.\d+)?)만/); if (m) { v += +m[1] * 1e4; hit = true; }
    if (!hit) { const n = t.match(/(\d+(?:\.\d+)?)/); if (!n) return null; v = +n[1]; }
    return neg * Math.round(v);
  }
  const fmtWon = (v) => {
    if (v == null) return '–';
    const a = Math.abs(v), s = v < 0 ? '-' : '';
    if (a >= 1e8) { const e = Math.floor(a / 1e8), m = Math.round((a % 1e8) / 1e4); return s + e + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만' : ''); }
    if (a >= 1e4) return s + Math.round(a / 1e4).toLocaleString('ko-KR') + '만';
    return s + a.toLocaleString('ko-KR') + '원';
  };

  // ---------- 명부 ----------
  function Roster(data) {
    data = data || {};
    this.by = {}; this.alias = {};
    const add = (r, kind) => { if (!r || !r.name) return; this.by[r.name] = Object.assign({ kind }, r); if (r.key) this.alias[r.key] = r.name; if (r.name.length === 3 && kind !== 'staff') this.alias[r.name.slice(1)] = r.name; };
    (data.members || []).forEach(r => add(r, 'member'));
    (data.rivals || []).forEach(r => add({ name: r.rep, color: r.color, group: r.group, age: r.age }, 'rival'));
    (data.staff || []).forEach(r => add(r, 'staff'));
    this.keys = Object.keys(this.by).concat(Object.keys(this.alias)).sort((a, b) => b.length - a.length);
  }
  Roster.prototype.resolve = function (s) {
    const flat = String(s || '').replace(/[*_💬:：]/gu, '').replace(/\s/g, '');
    if (!flat) return '';
    if (this.by[flat]) return flat;
    if (this.alias[flat]) return this.alias[flat];
    const k = this.keys.find(x => flat.startsWith(x) && flat.length - x.length <= 4);
    return k ? (this.by[k] ? k : this.alias[k]) : '';
  };

  // ---------- 그림 ----------
  function ImgIndex(data) {
    const imgs = (data && data.imgs) || {};
    this.byKey = {}; this.byName = imgs; this.keys = [];
    this.people = new Set([].concat((data && data.members) || [], ((data && data.rivals) || []).map(r => ({ name: r.rep })), (data && data.staff) || []).map(p => p.name));
    Object.entries(imgs).forEach(([name, url]) => { const k = String(url).split('/').pop().replace(/\.(jpe?g|png|webp)$/i, ''); if (k && k.length >= 12) { this.byKey[k] = name; this.keys.push(k); } });
  }
  ImgIndex.prototype.info = function (name) {
    const p = String(name || '').replace(/::/g, '_').split('_').map(x => x.trim());
    if (p.length < 2) return null;
    if (p[0] === '배경') return { name: p.join('_'), kind: 'place', place: p.slice(1).join('_') };
    if (this.people.has(p[0])) return { name: p.join('_'), kind: 'person', who: p[0], situ: p.slice(1).join('_') };
    return null;
  };
  ImgIndex.prototype.lookup = function (src, alt) {
    const s = safeDecode(String(src || ''));
    for (const k of this.keys) if (s.includes(k)) return this.info(this.byKey[k]);
    return alt ? this.info(alt) : null;
  };
  ImgIndex.prototype.url = function (n) { return this.byName[n] || ''; };
  const shapeOf = (w, h) => (!w || !h) ? '' : w / h >= 1.2 ? 'wide' : 'tall';

  // ---------- 상태창 ----------
  function parseStatus(lines, roster) {
    const st = {};
    const L = (re) => lines.find(l => re.test(l)) || '';
    const d = L(/📅|\d+\s*년차/);
    if (d) {
      const y = d.match(/(\d+)\s*년차/); if (y) st.year = +y[1];
      const m = d.match(/(\d{1,2})\s*월/); if (m) st.month = +m[1];
      const a = d.match(/행동\s*(\d)\s*\/\s*(\d)/); if (a) st.act = { n: +a[1], of: +a[2] };
      const t = d.match(/유행\s*[:：]?\s*([^|｜\n]+)/); if (t) { const p = t[1].split(/[·,/]/).map(x => x.trim()).filter(Boolean); st.trend = { genre: p[0] || '', theme: p[1] || '' }; }
      const c = d.match(/🏢\s*([^|｜\n]+)/u); if (c) st.grade = c[1].trim();
    }
    const mo = L(/💰|자금/);
    if (mo) {
      const a = mo.match(/자금\s*([-−]?[\d,.]+\s*(?:억\s*)?[\d,.]*\s*만?원?)/) || mo.match(/💰\s*([-−]?[\d,.]+\s*(?:억\s*)?[\d,.]*\s*만?원?)/u);
      if (a) { st.moneyText = a[1].trim(); st.money = won(a[1]); }
      const b = mo.match(/부채\s*([\d,.]+\s*(?:억\s*)?[\d,.]*\s*만?원?)/); if (b) { st.debtText = b[1].trim(); st.debt = won(b[1]); }
      if (/부채\s*(없음|0\b|완납)/.test(mo)) { st.debt = 0; st.debtText = '없음'; }
      const dd = mo.match(/D\s*-\s*(\d+)\s*달/); if (dd) st.payIn = +dd[1];
    }
    const ho = L(/🏠|🏢|루머/);
    if (ho) {
      const h = ho.match(/🏠\s*([^|｜\n]+)/u); if (h) st.house = h[1].trim();
      const g = ho.match(/🏢\s*([^|｜\n]+)/u); if (g) st.grade = g[1].trim();
      const r = ho.match(/루머\s*(\d)\s*\/\s*(\d)/); if (r) st.rumor = { n: +r[1], of: +r[2] };
    }
    const fa = L(/💗|코어|구독/);
    if (fa) {
      const c = fa.match(/코어\s*([\d,.]+\s*[만천]?)/); if (c) st.core = c[1].trim();
      const l = fa.match(/라이트\s*([\d,.]+\s*[만천]?)/); if (l) st.light = l[1].trim();
      const s = fa.match(/구독\s*([\d,.]+\s*[만천]?)/); if (s) st.subs = s[1].trim();
      const b = fa.match(/최고\s*(\d+)\s*위/); if (b) st.best = +b[1];
    }
    const mem = lines.filter(l => /👥/u.test(l)).join(' / ').replace(/^\s*👥\s*/u, '');
    if (mem) {
      st.members = [];
      mem.split(/\s\/\s|\s*\/\s*(?=[가-힣]{2,4}\s*\[)/).forEach(p => {
        const m = p.match(/([가-힣]{2,4})\s*\[([^\]]+)\]\s*([^/|]*)/);
        if (!m) return;
        const who = roster.resolve(m[1]) || m[1];
        const tag = m[2].split(/[·,]/).map(x => x.trim());
        const last = tag[tag.length - 1] || '';
        const gm = last.match(/\b([SABCDF][+-]?)$/);
        st.members.push({ who, pos: tag.join('·').replace(/\s*[SABCDF][+-]?$/, '').trim(), rank: gm ? gm[1] : '', cond: m[3].replace(/[\s/]+$/, '').trim() });
      });
    }
    const so = L(/🎵\s*진행|진행\s*곡/);
    if (so) {
      const t = so.match(Q);
      if (t) { st.wip = { title: t[1].trim() }; const p = so.match(/(\d+)\s*\/\s*(\d+)\s*달/); if (p) st.wip.prog = { n: +p[1], of: +p[2] }; const r = so.match(/(\d{1,2})\s*월\s*발매/); if (r) st.wip.rel = +r[1]; }
      else st.wip = null;
    }
    const rv = L(/⚔/u);
    if (rv) {
      st.rivals = {};
      rv.replace(/^.*?(라이벌\s*[:：])?/u, '').split(/[/·,]/).forEach(p => { const m = p.match(/([가-힣A-Za-zÉé0-9]{2,12})\s*(\d+)\s*승\s*(\d+)\s*패/); if (m) st.rivals[roster.resolve(m[1]) || m[1]] = { w: +m[2], l: +m[3] }; });
    }
    const pr = L(/🤝\s*약속|약속\s*[:：]/);
    if (pr) { const t = pr.replace(/^.*?약속\s*[:：]?\s*/, ''); st.promises = /^(없음|-)?\s*$/.test(t) ? [] : t.split(/\s\/\s|\//).map(x => x.trim()).filter(Boolean).slice(0, 3); }
    return st;
  }

  // ---------- 월말 결산 ----------
  function parseSettle(lines) {
    const S = { incomeText: '', expenseText: '', songs: [], chart: [], reactions: [], cond: '', next: '', extra: [] };
    const h = lines[0] || ''; const m = h.match(/(\d{1,2})\s*월/); if (m) S.month = +m[1];
    lines.slice(1).forEach(raw => {
      const l = stripMd(raw);
      if (/^💵|^수입/u.test(l)) { S.incomeText = l.replace(/^💵\s*/u, '').replace(/^수입\s*/, ''); S.income = won((l.match(/[+＋]?\s*([-−]?[\d,.]+\s*(?:억\s*)?[\d,.]*\s*만?원?)/) || [])[1]); S.incomeItems = items(l); }
      else if (/^💸|^지출/u.test(l)) { S.expenseText = l.replace(/^💸\s*/u, '').replace(/^지출\s*/, ''); const v = won((l.match(/([-−]?\s*[\d,.]+\s*(?:억\s*)?[\d,.]*\s*만?원?)/) || [])[1]); S.expense = v == null ? null : -Math.abs(v); S.expenseItems = items(l); }
      else if (/^🎵/u.test(l) && Q.test(l)) { const t = l.match(Q)[1].trim(); const g = l.match(/\b([SABCDF][+-]?)\s*등급/); const f = l.match(/화력\s*(\d+)/); S.songs.push({ title: t, grade: g ? g[1] : '', heat: f ? +f[1] : null }); }
      else if (/^📈/u.test(l)) {
        l.replace(/^📈\s*/u, '').replace(/레몬\s*차트\s*/, '').split(/\s*[|｜·]\s*(?=[^「」]*「)|\s*\|\s*/).forEach(p => {
          const q = p.match(/^(.*?)「([^」]+)」\s*(\d+)\s*위\s*(?:[(（]\s*([▲▼△▽↑↓]\s*\d+|NEW|new|신규|-|–|유지)\s*[)）])?/);
          if (!q) { const r = p.match(/(?:차트\s*)?(?:아웃|진입 실패|100위\s*밖)/); if (r && !S.chart.length) S.chartOut = true; return; }
          const mv = q[4] ? q[4].replace(/\s/g, '') : '';
          S.chart.push({ artist: q[1].trim(), title: q[2].trim(), rank: +q[3], move: /NEW|신규/i.test(mv) ? 'new' : /^[▲△↑]/.test(mv) ? +mv.slice(1) : /^[▼▽↓]/.test(mv) ? -mv.slice(1) : 0 });
        });
      }
      else if (/^💬|^반응/u.test(l)) S.reactions = S.reactions.concat(l.replace(/^💬\s*/u, '').replace(/^반응\s*[:：]?\s*/, '').split(/\s\/\s|\//).map(x => x.trim()).filter(Boolean));
      else if (/^💪|^컨디션/u.test(l)) S.cond = l.replace(/^💪\s*/u, '').replace(/^컨디션\s*[:：]?\s*/, '');
      else if (/^🔜|^다음\s*달/u.test(l)) S.next = l.replace(/^🔜\s*/u, '').replace(/^다음\s*달\s*[:：]?\s*/, '');
      else if (l && !/^[━─=]+$/.test(l)) S.extra.push(l);
    });
    return S;
  }
  function items(l) { const m = l.match(/[(（]([^)）]+)[)）]/); return m ? m[1].split(/[·,]/).map(x => x.trim()).filter(Boolean) : []; }

  // ---------- 곡 기획서 (팩이 채운 글 / 크랙이 되돌려 준 글) ----------
  function parsePlan(text) {
    const t = String(text || '');
    if (!/\[\s*곡\s*기획서\s*\]/.test(t)) return null;
    const g = (k) => { const m = t.match(new RegExp('^\\s*' + k + '\\s*[:：]\\s*(.*)$', 'm')); return m ? m[1].trim() : ''; };
    const gt = g('장르\\s*[·/]\\s*테마').split(/[·/,]/).map(x => x.trim());
    const alloc = {}; g('배분\\s*(?:\\(10\\))?').replace(/([가-힣]+)\s*(\d+)/g, (_, k, v) => { alloc[k] = +v; });
    const cm = t.match(/후렴\s*[:：]\s*\n?([\s\S]*?)(?=\n\s*(작곡|센터|발매)\s*[:：]|$)/);
    const chorus = cm ? cm[1].split('\n').map(x => x.trim()).filter(Boolean).slice(0, 4) : [];
    const rel = g('발매').split(/[·,]/).map(x => x.trim());
    return { title: g('곡명'), genre: gt[0] || '', theme: gt[1] || '', alloc, lyric: g('작사'), chorus, comp: g('작곡'), center: g('센터'), channel: rel[0] || '', month: (rel[1] || '').replace(/[^\d]/g, '') ? +(rel[1] || '').replace(/[^\d]/g, '') : null };
  }
  function planText(p) {
    const a = p.alloc || {};
    return `[곡 기획서]\n곡명: ${p.title || ''}\n장르·테마: ${p.genre || ''} · ${p.theme || ''}\n배분(10): 멜로디 ${a.멜로디 || 0} · 가사 ${a.가사 || 0} · 퍼포 ${a.퍼포 || 0} · 비주얼 ${a.비주얼 || 0} · 홍보 ${a.홍보 || 0}\n작사: ${p.lyric || ''}\n후렴:\n${(p.chorus || []).filter(Boolean).join('\n')}\n작곡: ${p.comp || ''}\n센터: ${p.center || ''}\n발매: ${p.channel || ''}${p.month ? ' · ' + p.month + '월' : ''}`;
  }

  // ---------- 응답 ----------
  function parse(segs, roster, idx) {
    if (typeof segs === 'string') segs = [{ t: 'text', s: segs }];
    roster = roster || new Roster({}); idx = idx || new ImgIndex({});
    const lines = [];
    for (const sg of segs || []) {
      if (!sg) continue;
      if (sg.t === 'img') { lines.push({ img: Object.assign({ src: sg.src, w: sg.w || 0, h: sg.h || 0, alt: sg.alt || '', shape: shapeOf(sg.w, sg.h) }, idx.lookup(sg.src, sg.alt) || {}) }); continue; }
      String(sg.s || '').split('\n').forEach(s => {
        const tags = [...s.matchAll(/\{\{\s*img\s*::\s*([^:}]+?)\s*::\s*([^}]+?)\s*\}\}/g)];
        tags.forEach(m => { const n = m[1] + '_' + m[2]; lines.push({ img: Object.assign({ src: idx.url(n), tag: true, alt: n }, idx.info(n) || {}) }); });
        const rest = tags.length ? s.replace(/\{\{\s*img\s*::[^}]*\}\}/g, '') : s;
        if (!tags.length || rest.trim()) lines.push({ s: rest, code: !!sg.code });
      });
    }
    const drop = new Set();
    const isText = (i) => lines[i] && lines[i].s != null;
    const txt = (i) => (isText(i) ? lines[i].s : '');
    const rule = (s) => /^\s*[━─=]{4,}\s*$/.test(s);
    // 1) 월말 결산: ━━ 📊 n월 결산 ━━ 부터 다음 ━ 줄까지
    let settle = null;
    lines.forEach((l, i) => {
      if (settle || l.s == null || !/📊/u.test(l.s) || !/결산/.test(l.s)) return;
      const blk = [l.s]; drop.add(i);
      for (let j = i + 1; j < lines.length && isText(j); j++) { drop.add(j); if (rule(txt(j))) break; if (txt(j).trim()) blk.push(txt(j)); }
      settle = parseSettle(blk);
    });
    // 2) 상태창: 마지막 📅 n년차 줄부터
    let status = null;
    const sIdx = lines.map((l, i) => (l.s != null && !drop.has(i) && /📅/u.test(l.s) && /년차|\d+\s*월/.test(l.s) ? i : -1)).filter(i => i >= 0);
    if (sIdx.length) {
      const a = sIdx[sIdx.length - 1];
      let b = a;
      while (b + 1 < lines.length && isText(b + 1) && !drop.has(b + 1) && (ST_RE.test(txt(b + 1)) || rule(txt(b + 1)) || !txt(b + 1).trim() || (lines[a].code && lines[b + 1].code))) b++;
      let a0 = a; while (a0 - 1 >= 0 && isText(a0 - 1) && rule(txt(a0 - 1))) a0--;
      const blk = []; for (let i = a0; i <= b; i++) { drop.add(i); if (txt(i).trim()) blk.push(txt(i)); }
      status = parseStatus(blk, roster);
    }
    // 3) 알림 줄
    const alerts = [];
    lines.forEach((l, i) => {
      if (drop.has(i) || l.s == null) return;
      const s = stripMd(l.s);
      let a = null, m;
      if ((m = s.match(/^🎵\s*발매\s*!?\s*「([^」]+)」/u))) a = { k: 'release', title: m[1].trim() };
      else if ((m = s.match(/^📈\s*차트\s*진입\s*!?\s*(?:「([^」]+)」\s*)?(\d+)\s*위/u))) a = { k: 'chartin', title: (m[1] || '').trim(), rank: +m[2] };
      else if ((m = s.match(/^🏆\s*1\s*위\s*!?\s*(?:「([^」]+)」)?/u))) a = { k: 'first', title: (m[1] || '').trim() };
      else if ((m = s.match(/^🤝\s*합류\s*!?\s*([가-힣]{2,4})/u))) a = { k: 'join', who: roster.resolve(m[1]) || m[1] };
      else if ((m = s.match(/^🎧\s*신곡\s*공개\s*[:：]?\s*(.*?)\s*「([^」]+)」/u))) a = { k: 'rivalnew', group: m[1].trim(), title: m[2].trim() };
      else if ((m = s.match(/^⚠️?\s*루머\s*(\d)\s*단계/u))) a = { k: 'rumor', n: +m[1] };
      else if ((m = s.match(/^🎤\s*무대\s*[:：]?\s*(.+)$/u))) a = { k: 'stage', show: m[1].trim() };
      if (a) { a.text = s; alerts.push(a); drop.add(i); }
    });
    // 4) 기획서(크랙이 되돌려 보여 준 양식)는 장면에서 뺀다
    const planLines = [];
    lines.forEach((l, i) => { if (!drop.has(i) && l.s != null && /\[\s*곡\s*기획서\s*\]/.test(l.s)) { for (let j = i; j < lines.length && isText(j) && (j === i || /^\s*(곡명|장르|배분|작사|후렴|작곡|센터|발매)\s*[:：]|^\s*\S/.test(txt(j))) && !(j > i && /💬/.test(txt(j))); j++) { planLines.push(txt(j)); drop.add(j); if (/^\s*발매\s*[:：]/.test(txt(j))) break; } } });
    const plan = planLines.length ? parsePlan(planLines.join('\n')) : null;
    // 5) 장면
    const beats = [], imgs = [];
    let pend = [];
    const push = (b) => { if (pend.length) { b.imgs = pend; pend = []; } beats.push(b); };
    lines.forEach((l, i) => {
      if (drop.has(i)) return;
      if (l.img) { pend.push(l.img); imgs.push(l.img); return; }
      const raw = l.s, s = raw.trim();
      if (!s || rule(s) || /^```/.test(s)) return;
      const say = sayLine(raw, roster);
      if (say) { push(say); return; }
      const c = stripMd(s); if (!c) return;
      const kt = c.match(/^\[\s*(카톡|문자|DM)\s*\]\s*([^:：]{1,12})\s*[:：]\s*(.*)$/);
      if (kt) { push({ kind: 'kakao', who: roster.resolve(kt[2]) || kt[2].trim(), known: !!roster.resolve(kt[2]), text: kt[3] }); return; }
      if (/^[(（].*[)）]$/.test(c) && c.length < 70) { push({ kind: 'sys', text: c.replace(/^[(（]|[)）]$/g, '') }); return; }
      const th = c.match(/^["“]([^"”]+)["”]$/);
      if (th) { push({ kind: 'think', text: th[1] }); return; }
      chunk(c, 130).forEach(t => push({ kind: 'narr', text: t }));
    });
    if (pend.length) { if (beats.length) beats[beats.length - 1].imgsAfter = pend; else beats.push({ kind: 'narr', text: '', imgs: pend }); }
    beats.forEach((b, i) => {
      (b.imgs || []).forEach(im => {
        if (!im.kind) { im.guess = true; im.kind = im.shape === 'wide' ? 'place' : im.shape === 'tall' ? 'person' : (beats.slice(i, i + 2).some(x => x.kind === 'say' && x.known) ? 'person' : 'place'); }
        if (im.kind === 'person' && !im.who) { const n = beats.slice(i, i + 3).find(x => x.kind === 'say' && x.known); if (n) im.who = n.who; }
      });
      const pl = (b.imgs || []).filter(x => x.kind === 'place').pop(); if (pl) { b.bg = pl.src; if (pl.place) b.place = pl.place; }
      const ps = (b.imgs || []).filter(x => x.kind === 'person');
      const p = (b.kind === 'say' ? ps.filter(x => x.who === b.who).pop() : null) || ps.pop();
      if (p) { b.portrait = p.src; b.pinfo = p; }
    });
    beats.forEach((b, i) => { if (b.kind === 'say' || !b.pinfo || !b.pinfo.who) return; for (let j = i + 1; j < Math.min(beats.length, i + 4); j++) { const n = beats[j]; if (n.kind === 'say' && n.who === b.pinfo.who) { if (!n.portrait) { n.portrait = b.portrait; n.pinfo = b.pinfo; } break; } if (n.portrait) break; } });
    return { status, settle, alerts, plan, beats, imgs, text: beats.map(b => (b.who ? b.who + ' ' : '') + (b.text || '')).join('\n') };
  }
  function chunk(text, size) {
    const sents = String(text).split(/(?<=[.!?。…~][”"’']?)\s+/).filter(Boolean);
    const out = []; let cur = '';
    for (const s of sents) { if (cur && (cur + ' ' + s).length > size) { out.push(cur.trim()); cur = ''; } cur += (cur ? ' ' : '') + s; }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function sayLine(line, roster) {
    const i = line.indexOf('💬');
    if (i < 1 || i > 26) return null;
    const rawName = stripMd(line.slice(0, i)).replace(/^[-•>\s]+/, '').trim();
    if (!rawName || rawName.length > 16 || /[|｜\[\]]/.test(rawName)) return null;
    let rest = line.slice(i + 2).replace(/^\s*\*\*(?!\*)/, '');
    let act = '';
    const am = rest.match(/^\s*\*([^*]+)\*\s*/); if (am) { act = am[1].trim(); rest = rest.slice(am[0].length); }
    rest = stripMd(rest).trim();
    const q = rest.search(/["“]/); if (q > 0 && !act) { act = rest.slice(0, q).trim(); rest = rest.slice(q); }
    let text = rest.replace(/^["“]/, '');
    const c = text.search(/["”](?=[^"”]*$)/); if (c >= 0) { const tail = text.slice(c + 1).trim(); text = text.slice(0, c) + (tail ? ' ' + tail : ''); }
    const who = roster.resolve(rawName);
    return { kind: 'say', who: who || rawName, known: !!who, act, text: text.trim() };
  }

  // ---------- 기억 ----------
  function blank() {
    return { status: {}, songs: {}, charts: {}, chartOrder: [], plans: {}, members: [], joined: [], settles: [], alerts: [], seen: {}, faces: {}, lines: [], days: {}, turns: 0, lastBg: '', rivalNews: [], stages: [], promises: [] };
  }
  const monthKey = (st) => `${(st && st.year) || 1}-${String((st && st.month) || 0).padStart(2, '0')}`;
  const monthLabel = (k) => { const [y, m] = String(k).split('-'); return `${+y}년차 ${+m}월`; };
  function absorb(M, P, data, opt) {
    opt = opt || {};
    const ev = { released: [], chartin: null, first: null, joined: [], rivalNew: [], rumor: null, stage: [], settle: null, month: null, money: null, act: null, cond: [] };
    M.turns = (M.turns || 0) + 1;
    const group = (data && data.group) || '레미나';
    const st = P.status;
    if (opt.sentPlan && opt.sentPlan.title) M.plans[opt.sentPlan.title] = opt.sentPlan;
    if (P.plan && P.plan.title) M.plans[P.plan.title] = Object.assign({}, M.plans[P.plan.title] || {}, P.plan);
    if (st) {
      const prev = M.status || {};
      if ((st.month != null && prev.month != null && (st.month !== prev.month || (st.year || 1) !== (prev.year || 1)))) ev.month = { from: monthKey(prev), to: monthKey(st) };
      if (st.money != null && prev.money != null && st.money !== prev.money) ev.money = { from: prev.money, to: st.money };
      if (st.act && prev.act && st.act.n !== prev.act.n) ev.act = st.act;
      if (st.members) {
        st.members.forEach(m => { const o = (prev.members || []).find(x => x.who === m.who); if (o && o.cond !== m.cond) ev.cond.push({ who: m.who, from: o.cond, to: m.cond }); if (!M.joined.includes(m.who)) M.joined.push(m.who); });
        M.members = st.members;
      }
      if (st.wip && st.wip.title) { const s = song(M, st.wip.title, group); s.wip = st.wip; }
      if (st.promises) M.promises = st.promises;
      M.status = Object.assign({}, prev, st);
    }
    const key = monthKey(M.status);
    (P.alerts || []).forEach(a => {
      M.alerts.push(Object.assign({ at: key }, a)); if (M.alerts.length > 80) M.alerts.shift();
      if (a.k === 'release') { const s = song(M, a.title, group); s.released = s.released || key; s.wip = null; ev.released.push(a.title); }
      if (a.k === 'chartin') { ev.chartin = a; if (a.title) { const s = song(M, a.title, group); addRank(s, key, a.rank); } }
      if (a.k === 'first') { ev.first = a; if (a.title) { const s = song(M, a.title, group); addRank(s, key, 1); } }
      if (a.k === 'join') { if (!M.joined.includes(a.who)) M.joined.push(a.who); ev.joined.push(a.who); }
      if (a.k === 'rivalnew') { const rv = ((data && data.rivals) || []).find(r => norm(r.group) === norm(a.group) || norm(r.rep) === norm(a.group)); const s = song(M, a.title, rv ? rv.group : a.group); s.rival = true; s.released = s.released || key; M.rivalNews.push({ at: key, group: s.artist, title: a.title }); ev.rivalNew.push(s); }
      if (a.k === 'rumor') ev.rumor = a.n;
      if (a.k === 'stage') { M.stages.push({ at: key, show: a.show }); ev.stage.push(a.show); }
    });
    if (P.settle) {
      const S = P.settle;
      const sk = S.month ? `${(M.status && M.status.year) || 1}-${String(S.month).padStart(2, '0')}` : key;
      S.key = sk;
      S.songs.forEach(x => { const s = song(M, x.title, group); if (x.grade) s.grade = x.grade; if (x.heat != null) s.heat = x.heat; s.released = s.released || sk; });
      const list = [];
      S.chart.forEach(c => {
        const rv = ((data && data.rivals) || []).find(r => c.artist && (norm(c.artist).includes(norm(r.group)) || norm(c.artist).includes(norm(r.rep))));
        const ours = !c.artist || norm(c.artist).includes(norm(group)) || !!(M.songs[c.title] && M.songs[c.title].ours);
        const s = song(M, c.title, ours ? group : rv ? rv.group : c.artist);
        if (rv) s.rival = true;
        addRank(s, sk, c.rank);
        list.push({ title: c.title, artist: s.artist, rank: c.rank, move: c.move, ours: s.ours, rival: !!rv });
      });
      if (S.reactions.length) S.songs.forEach(x => { const s = M.songs[x.title]; if (s) s.reactions = S.reactions.slice(0, 6); });
      if (S.songs.length === 0 && S.reactions.length) { const ours = list.find(x => x.ours); if (ours) M.songs[ours.title].reactions = S.reactions.slice(0, 6); }
      M.charts[sk] = list; if (!M.chartOrder.includes(sk)) M.chartOrder.push(sk);
      M.chartOrder.sort();
      M.settles.push(S); if (M.settles.length > 36) M.settles.shift();
      ev.settle = S;
    }
    // 하루(달) 기록
    const day = M.days[key] = M.days[key] || { met: [], notes: [], first: '' };
    (P.beats || []).forEach(b => { if (b.kind === 'say' && b.known && !day.met.includes(b.who)) day.met.push(b.who); });
    ev.released.forEach(t => day.notes.push(`「${t}」 발매`));
    if (ev.chartin) day.notes.push(`차트 진입 ${ev.chartin.rank}위`);
    if (ev.first) day.notes.push('🏆 1위');
    ev.joined.forEach(n => day.notes.push(`${n} 합류`));
    ev.stage.forEach(s => day.notes.push(`무대: ${s}`));
    if (!day.first) { const nb = (P.beats || []).find(b => b.kind === 'narr' && b.text.length > 12); if (nb) day.first = nb.text.slice(0, 90); }
    (P.imgs || []).forEach(im => { if (im.name) M.seen[im.name] = M.seen[im.name] || Date.now(); if (im.kind === 'person' && im.who && im.src) M.faces[im.who] = im.src; });
    // 기획서 → 곡에 붙이기
    Object.values(M.songs).forEach(s => { const p = M.plans[s.title]; if (p && s.ours) { s.genre = s.genre || p.genre; s.theme = s.theme || p.theme; s.chorus = s.chorus && s.chorus.length ? s.chorus : p.chorus; s.center = s.center || p.center; s.lyric = s.lyric || p.lyric; s.comp = s.comp || p.comp; s.channel = s.channel || p.channel; } });
    return ev;
  }
  const norm = (s) => String(s || '').replace(/\s/g, '').toLowerCase();
  function song(M, title, artist) {
    const t = String(title || '').trim();
    let s = M.songs[t];
    const group = artist || '';
    if (!s) s = M.songs[t] = { title: t, artist: group, ours: false, ranks: [], best: null, chorus: [], reactions: [] };
    if (group && !s.artist) s.artist = group;
    if (M.plans && M.plans[t]) s.ours = true;
    if (norm(s.artist) === norm('레미나') || norm(group) === norm('레미나')) { s.ours = true; s.artist = '레미나'; }
    return s;
  }
  function addRank(s, key, rank) { const r = s.ranks.find(x => x[0] === key); if (r) r[1] = rank; else s.ranks.push([key, rank]); s.ranks.sort((a, b) => a[0] < b[0] ? -1 : 1); s.best = s.best == null ? rank : Math.min(s.best, rank); s.last = rank; }

  // ---------- 가상 차트(분위기용) — 실제 순위(우리·라이벌)는 결산 그대로, 나머지 칸만 채운다 ----------
  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let x = seed || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; }
  function fillerOrder(data, key) {
    const F = (data && data.filler) || [];
    const r = rng(hash('chart' + key));
    // 상위권은 천천히 바뀌는 콘크리트 차트: 기본 순서 + 위치에 비례하는 흔들림
    return F.map((f, i) => ({ f, s: i + (r() - 0.5) * (4 + i * 0.9) })).sort((a, b) => a.s - b.s).map(x => x.f);
  }
  function buildChart(M, data, key, size) {
    size = size || 100;
    const real = (M.charts[key] || []).slice().sort((a, b) => a.rank - b.rank);
    const taken = new Set(real.map(x => x.rank));
    const fill = fillerOrder(data, key);
    const prevKey = M.chartOrder[M.chartOrder.indexOf(key) - 1];
    const prevFill = prevKey ? fillerOrder(data, prevKey) : null;
    const out = [];
    let fi = 0;
    for (let r = 1; r <= size; r++) {
      const hit = real.find(x => x.rank === r);
      if (hit) { out.push(Object.assign({ real: true }, hit)); continue; }
      const f = fill[fi++ % fill.length];
      let move = 0;
      if (prevFill) { const p = prevFill.indexOf(f); move = p >= 0 ? (p + 1) - r : 'new'; }
      out.push({ rank: r, title: f.title, artist: f.artist, genre: f.g, move, filler: true });
    }
    void taken;
    return out;
  }

  // ---------- 앨범 커버(SVG 문자열) — 장르가 판형(템플릿), 테마가 색, 센터 멤버 색이 포인트 ----------
  const escX = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 테마별 팔레트 [바탕, 중간, 잉크]
  const PAL = {
    이별: ['#1d2340', '#5b6aa8', '#f2efe9'], 첫사랑: ['#ffd9df', '#ff6f8e', '#3b1520'], 청춘: ['#cdeffd', '#2f95f0', '#0f2340'], 위로: ['#ffe6c2', '#ef9a4a', '#3a2410'],
    자신감: ['#2a0d14', '#e8344e', '#fff1f3'], 여름: ['#d4fbef', '#13bfa6', '#063a33'], 밤: ['#160f2e', '#7b5cff', '#ece6ff'], 꿈: ['#eee4ff', '#a97eff', '#2a1748'],
    우정: ['#fff1bf', '#f2a900', '#3a2a00'], 도전: ['#e3e9ec', '#2f4858', '#ff5a36']
  };
  const THEMES = Object.keys(PAL);
  const LAYOUT = { 발라드: 'orb', 댄스: 'stack', 힙합: 'block', 'R&B': 'orb', 록: 'block', 시티팝: 'sun', 일렉트로닉: 'grid', 어쿠스틱: 'frame' };
  const KR = '"Gasoek One","Black Han Sans","Pretendard Variable","Noto Sans KR",sans-serif', EN = '"Unbounded","Pretendard Variable",sans-serif';
  const glyphW = (t) => Array.from(String(t)).reduce((a, c) => a + (/[가-힣]/.test(c) ? 1 : /[A-Z0-9]/.test(c) ? .74 : /\s/.test(c) ? .35 : .62), 0);
  function lines(title, max) {
    const w = String(title).split(/\s+/).filter(Boolean);
    if (w.length <= 1) { const t = w[0] || ''; if (glyphW(t) <= max) return [t]; const ch = Array.from(t); const h = Math.ceil(ch.length / 2); return [ch.slice(0, h).join(''), ch.slice(h).join('')]; }
    const out = []; let cur = '';
    w.forEach(x => { if (cur && glyphW(cur + ' ' + x) > max) { out.push(cur); cur = x; } else cur = cur ? cur + ' ' + x : x; });
    if (cur) out.push(cur);
    return out.slice(0, 3);
  }
  function coverSvg(s, data, opt) {
    opt = opt || {};
    const r = rng(hash((s.title || '') + '|' + (s.artist || '')));
    const theme = PAL[s.theme] ? s.theme : THEMES[Math.floor(r() * THEMES.length)];
    const [bg, mid, ink] = PAL[theme];
    const center = ((data && data.members) || []).find(m => m.name === s.center || m.key === s.center);
    const rv = ((data && data.rivals) || []).find(x => x.group === s.artist);
    const acc = center ? center.color : rv ? rv.color : mid;
    const lay = LAYOUT[s.genre] || ['orb', 'stack', 'block', 'sun', 'grid', 'frame'][Math.floor(r() * 6)];
    const id = 'cv' + hash(s.title + '|' + s.artist + '|' + (s.genre || '') + (s.theme || '')).toString(36);
    const title = String(s.title || '').slice(0, 20);
    const tag = s.ours ? ((data && data.groupEn) || 'REMINA') : String(s.artist || '').toUpperCase().slice(0, 12);
    const T = (x, y, size, fill, txt, extra) => `<text x="${x}" y="${y}" font-family='${KR}' font-size="${size}" fill="${fill}" ${extra || ''}>${escX(txt)}</text>`;
    const E = (x, y, size, fill, txt, extra) => `<text x="${x}" y="${y}" font-family='${EN}' font-weight="700" font-size="${size}" fill="${fill}" letter-spacing=".6" ${extra || ''}>${escX(txt)}</text>`;
    let body = '';
    if (lay === 'stack') {
      const ls = lines(title, 4.2); const size = Math.min(30, 86 / Math.max(...ls.map(glyphW), 1));
      body = `<rect width="100" height="100" fill="url(#${id}g)"/>` + ls.map((l, i) => T(7, 10 + size * .92 * (i + 1), size, ink, l, `opacity="${1 - i * .12}"`)).join('') +
        `<rect x="7" y="${12 + size * .92 * ls.length + 3}" width="18" height="2.4" fill="${acc}"/>` + E(93, 93, 3.6, ink, tag, 'text-anchor="end"');
    } else if (lay === 'orb') {
      const cx = 38 + r() * 24, cy = 34 + r() * 14;
      body = `<rect width="100" height="100" fill="${bg}"/><circle cx="${cx}" cy="${cy}" r="30" fill="url(#${id}o)"/><circle cx="${cx}" cy="${cy}" r="${36 + r() * 6}" fill="none" stroke="${ink}" stroke-width=".4" opacity=".45"/>` +
        E(7, 11, 3.4, ink, tag) + T(7, 90, Math.min(11, 80 / Math.max(glyphW(title), 1)), ink, title);
    } else if (lay === 'block') {
      const ch = Array.from(title.replace(/\s/g, ''))[0] || '?';
      body = `<rect width="100" height="100" fill="${bg}"/><rect width="100" height="64" fill="${mid}"/>` + T(50, 56, 58, ink, ch, 'text-anchor="middle" opacity=".92"') +
        `<rect x="7" y="70" width="4" height="22" fill="${acc}"/>` + T(15, 81, Math.min(9, 70 / Math.max(glyphW(title), 1)), mid === bg ? ink : mid, title) + E(15, 90, 3.2, mid, tag);
    } else if (lay === 'sun') {
      body = `<rect width="100" height="100" fill="${bg}"/><clipPath id="${id}c"><rect y="0" width="100" height="78"/></clipPath><circle cx="50" cy="78" r="34" fill="${mid}" clip-path="url(#${id}c)"/>` +
        [58, 64, 69, 73, 76].map((y, i) => `<rect x="10" y="${y}" width="80" height="${1 + i * .5}" fill="${bg}"/>`).join('') + `<rect x="0" y="78" width="100" height="22" fill="${ink}" opacity=".08"/>` +
        T(50, 22, Math.min(13, 80 / Math.max(glyphW(title), 1)), ink, title, 'text-anchor="middle"') + E(50, 30, 3.2, ink, tag, 'text-anchor="middle" opacity=".7"') + `<circle cx="50" cy="90" r="2.2" fill="${acc}"/>`;
    } else if (lay === 'grid') {
      body = `<rect width="100" height="100" fill="${bg === '#160f2e' || bg === '#1d2340' || bg === '#2a0d14' ? bg : ink}"/>` + Array.from({ length: 9 }, (_, i) => `<path d="M${i * 12.5} 0V100M0 ${i * 12.5}H100" stroke="${mid}" stroke-width=".25" opacity=".5"/>`).join('') +
        `<rect x="${25 + Math.floor(r() * 4) * 12.5}" y="${25 + Math.floor(r() * 3) * 12.5}" width="12.5" height="12.5" fill="${acc}"/><rect x="12.5" y="62.5" width="75" height="25" fill="${mid}" opacity=".9"/>` +
        T(15.5, 79, Math.min(10, 66 / Math.max(glyphW(title), 1)), '#fff', title) + E(15.5, 10, 3.4, mid, tag);
    } else {
      body = `<rect width="100" height="100" fill="${bg}"/><rect x="8" y="8" width="84" height="84" fill="none" stroke="${ink}" stroke-width=".5"/><rect x="10" y="10" width="80" height="80" fill="none" stroke="${ink}" stroke-width=".2"/>` +
        `<circle cx="50" cy="40" r="13" fill="none" stroke="${mid}" stroke-width="1.6"/><circle cx="50" cy="40" r="4" fill="${acc}"/>` + T(50, 70, Math.min(10, 64 / Math.max(glyphW(title), 1)), ink, title, 'text-anchor="middle"') + E(50, 80, 3, ink, tag, 'text-anchor="middle" opacity=".7"');
    }
    const grain = opt.grain ? `<filter id="${id}n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .45 0"/></filter>` : '';
    return `<svg class="${opt.cls || 'id-cover'}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escX(s.title)} 커버">
      <defs><linearGradient id="${id}g" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
      <radialGradient id="${id}o"><stop offset="0" stop-color="${acc}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${mid}" stop-opacity="0"/></radialGradient>${grain}</defs>
      ${body}${opt.grain ? `<rect width="100" height="100" filter="url(#${id}n)" opacity=".55"/>` : ''}
      ${s.ours ? `<circle cx="92" cy="8" r="2.6" fill="#e8344e" stroke="#fff" stroke-width=".8"/>` : ''}
    </svg>`;
  }

  // ---------- 가이드 데모 악보(브라우저 밖에서도 만들 수 있게 순수 함수) ----------
  function demoScore(s, data) {
    const g = ((data && data.genres) || {})[s.genre] || { bpm: 100, inst: 'keys' };
    const r = rng(hash('demo|' + s.title));
    const key = Math.floor(r() * 12);                              // 0=C
    const minor = /이별|밤|위로/.test(s.theme || '') || /발라드|R&B/.test(s.genre || '');
    const prog = minor ? [[9, 'm'], [5, ''], [0, ''], [7, '']] : [[0, ''], [7, ''], [9, 'm'], [5, '']];
    const scale = minor ? [9, 11, 0, 2, 4, 5, 7] : [0, 2, 4, 5, 7, 9, 11];
    const lines = (s.chorus && s.chorus.length ? s.chorus : [s.title || '라라라']).slice(0, 4);
    const melody = [];
    lines.forEach((ln, li) => {
      const syl = Array.from(String(ln).replace(/\s/g, '')).slice(0, 12);
      let deg = 2 + Math.floor(r() * 3);
      syl.forEach((ch, k) => { deg = Math.max(0, Math.min(9, deg + [-1, 0, 1, 1, -2, 2][hash(ch + k) % 6])); melody.push({ bar: li * 2 + Math.floor(k / 6), step: (k % 6) * 2 + (k % 2), note: 60 + key + scale[deg % 7] + (deg >= 7 ? 12 : 0) - 12 * (key > 6 ? 1 : 0), len: k === syl.length - 1 ? 4 : 2 }); });
    });
    return { bpm: g.bpm, inst: g.inst, key, minor, prog: prog.map(([d, q]) => ({ root: 48 + ((key + d) % 12), minor: q === 'm' })), melody, bars: 8, lines };
  }

  const api = { Roster, ImgIndex, parse, parseStatus, parseSettle, parsePlan, planText, absorb, blank, buildChart, coverSvg, demoScore, won, fmtWon, monthKey, monthLabel, stripMd, hash, rng };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionIdol = api;
})(typeof window !== 'undefined' ? window : globalThis);
