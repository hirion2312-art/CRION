// 플레이팩 「아포칼립스 안전지대의 관리자」 — 크랙 응답 해석기 (화면 없이 동작, node 시험 가능)
//  크랙 출력 형식(메인 프롬프트 [출력]): ①장면 ②이름💬 행동 "대사" ③📦 변동 한 줄 ④맨 끝 코드블록 상태창
//  크랙 화면에서 마크다운이 렌더링된 뒤의 글(** · * 가 사라진 모양)도, 원문 그대로도 읽는다.
//  이 팩은 크랙 출력에 새 표식을 요구하지 않는다. 표식이 없어도(상태창이 없어도) 장면은 나온다.
(function (root) {
  'use strict';

  const MINUS = /[−–—]/g;
  const TIMES = ['아침', '낮', '저녁', '밤'];
  const RES_KEYS = [
    ['rmat', '연구재료'], ['food', '식량'], ['med', '의료품'], ['mat', '자재'], ['def', '방어력'],
    ['morale', '사기'], ['fuel', '연료'], ['rare', '희귀'], ['ppl', '주민']
  ];
  const RES_LABEL = Object.fromEntries(RES_KEYS.map(([k, l]) => [k, l]));
  const EVENTS = ['부상', '사망', '이탈', '추방', '실종', '입주', '전환', '감염', '회복', '귀환', '발열', '격리'];
  const FACILITIES = ['의무실', '연구실', '격리실', '무전실', '텃밭', '발전기'];
  const STATUS_HEAD = /📍\s*([^·\n]*?)\s*·\s*D\s*(\d+)\s*(.*)$/;
  const STATUS_LINE = /^\s*(?:👁️?\s*)?(?:📍|🍚|👥|🛠️?|🚶|🚪|🏢|⛽|🔬)/;

  // ---------- 명부 · 이름 ----------
  function Roster(data) {
    this.list = ((data && data.roster) || []).map(r => ({ no: r.no, name: r.name, sex: r.sex, age: r.age }));
    this.by = {};
    this.list.forEach(r => { this.by[r.name] = r; });
    // 성을 뗀 이름(2글자 이상)이 명부에서 하나뿐이면 별칭으로 쓴다 (소담 = 김소담). 1글자(한설→설)는 안 쓴다
    const cnt = {};
    const given = (n) => n.length >= 3 ? n.slice(n.length === 4 ? 2 : 1) : '';
    this.list.forEach(r => { const g = given(r.name); if (g.length >= 2) cnt[g] = (cnt[g] || 0) + 1; });
    this.alias = {};
    this.list.forEach(r => { const g = given(r.name); if (g.length >= 2 && cnt[g] === 1 && !this.by[g]) this.alias[g] = r.name; });
    this.keys = Object.keys(this.by).concat(Object.keys(this.alias)).sort((a, b) => b.length - a.length);
  }
  Roster.prototype.resolve = function (s) {
    const n = String(s || '').replace(/[*_\s💬:：]/g, '');
    if (!n) return '';
    if (this.by[n]) return n;
    if (this.alias[n]) return this.alias[n];
    // "소담이", "소담 씨" 같은 꼴
    const k = this.keys.find(x => n.startsWith(x) && n.length - x.length <= 2);
    return k ? (this.by[k] ? k : this.alias[k]) : '';
  };
  // 글 속에 나온 명부 이름들 (처음 나온 순서)
  Roster.prototype.find = function (text) {
    const out = [];
    const t = String(text || '');
    for (const k of this.keys) {
      let i = t.indexOf(k);
      while (i >= 0) {
        // 별칭은 앞 글자가 한글이면(다른 낱말의 일부) 건너뛴다
        const prev = t[i - 1] || '';
        const full = this.by[k] ? k : this.alias[k];
        if (this.by[k] || !/[가-힣]/.test(prev)) { if (!out.some(o => o.name === full)) out.push({ name: full, at: i }); break; }
        i = t.indexOf(k, i + 1);
      }
    }
    return out.sort((a, b) => a.at - b.at).map(o => o.name);
  };

  // ---------- 상태창 ----------
  const numAfter = (s, label) => { const m = String(s).replace(MINUS, '-').match(new RegExp(label + '\\s*[:：]?\\s*(-?\\d+)')); return m ? Number(m[1]) : null; };
  function timeOf(s) {
    const t = String(s || '');
    for (const x of TIMES) if (t.includes(x)) return x;
    if (/새벽|오전/.test(t)) return '아침';
    if (/오후|점심/.test(t)) return '낮';
    return '';
  }
  function parseStatus(lines, roster) {
    const all = lines.join('\n');
    const head = lines.find(l => STATUS_HEAD.test(l));
    if (!head) return null;
    const h = head.match(STATUS_HEAD);
    const st = { place: h[1].replace(/^\s*👁️?\s*/, '').trim(), day: Number(h[2]), time: timeOf(h[3]), god: /👁/.test(all) };
    st.dateText = `D${st.day}${st.time ? ' ' + st.time : ''}`;
    const src = all.replace(/연구\s*재료/g, '연구재료');
    st.food = numAfter(src, '식량');
    st.med = numAfter(src, '의료품');
    st.mat = numAfter(src.replace(/연구재료\s*-?\d+/g, ''), '자재');
    st.def = numAfter(src, '방어력');
    const pp = src.match(/주민\s*(\d+)\s*\/\s*(\d+)/);
    st.ppl = pp ? Number(pp[1]) : numAfter(src, '주민');
    st.cap = pp ? Number(pp[2]) : null;
    st.morale = numAfter(src, '사기');
    st.fuel = numAfter(src, '연료');
    st.rare = numAfter(src, '희귀');
    st.rmat = numAfter(src, '연구재료');
    const rl = src.match(/연구\s*Lv\.?\s*(\d+)/i);
    st.rlv = rl ? Number(rl[1]) : null;
    const ex = src.match(/확장\s*(\d+)\s*단계/);
    st.exp = ex ? Number(ex[1]) : null;
    const pick = (re) => { const l = lines.find(x => re.test(x)); return l || ''; };
    // 일과: 이름(일)
    const chLine = pick(/일과\s*[:：]/).replace(/^.*?일과\s*[:：]/, '');
    st.chores = [];
    chLine.replace(/([가-힣A-Za-z]{1,8})\s*\(([^)]{1,20})\)/g, (_, n, j) => { st.chores.push({ name: roster.resolve(n) || n, job: j.trim() }); return ''; });
    // 파견: 파티→목적지(귀환 D) — 여러 개는 / 또는 ; 로
    const dLine = pick(/파견\s*[:：]/).replace(/^.*?파견\s*[:：]/, '').split(/[|｜]\s*🚪|[|｜]\s*대기/)[0];
    st.dispatch = [];
    const reD = /([^→>|]+?)\s*(?:→|->|⇒)\s*([^()|]+?)\s*\(\s*(?:귀환\s*)?D?\s*(\d+)[^)]*\)/g;
    let m;
    while ((m = reD.exec(dLine))) {
      const party = m[1].replace(/^[\s,/;·]+/, '').split(/[·,、&/+]|\s+/).map(x => x.trim()).filter(Boolean)
        .map(x => roster.resolve(x) || x).filter(x => !/^(와|과|및)$/.test(x));
      st.dispatch.push({ party, dest: m[2].trim(), ret: Number(m[3]) });
    }
    // 대기: 이름(n일째)
    const wLine = (lines.find(x => /대기\s*[:：]/.test(x)) || '').replace(/^.*?대기\s*[:：]/, '');
    st.wait = [];
    wLine.replace(/([^(),/|]{1,12}?)\s*\(\s*(\d+)\s*일째\s*\)/g, (_, n, d) => { const nm = n.trim(); st.wait.push({ name: roster.resolve(nm) || nm, days: Number(d) }); return ''; });
    return st;
  }

  // ---------- 📦 변동 ----------
  function parseDelta(line, roster) {
    const body = String(line).replace(/^.*?📦\s*/, '').replace(MINUS, '-').replace(/[*_]/g, '');
    const items = body.split(/\s*[·•,]\s*|\s{2,}|\s\/\s/).map(x => x.trim()).filter(Boolean);
    const out = [];
    for (const it of items) {
      const plain = it.replace(/연구\s*재료/g, '연구재료');
      const r = RES_KEYS.find(([, l]) => new RegExp(l + '\\s*[+-]\\s*\\d+').test(plain));
      if (r) {
        const n = Number(plain.match(new RegExp(r[1] + '\\s*([+-])\\s*(\\d+)')).slice(1).join(''));
        out.push({ kind: 'res', key: r[0], label: r[1], n, text: it });
        continue;
      }
      const ev = EVENTS.find(e => it.includes(e));
      const who = roster.find(it);
      if (ev && who.length) { who.forEach(nm => out.push({ kind: 'ev', name: nm, ev, text: it })); continue; }
      out.push({ kind: 'note', text: it });
    }
    return out;
  }

  // ---------- 장면 조각 ----------
  const stripMd = (s) => String(s || '').replace(/\{\{\s*img\s*::[^}]*\}\}/g, '').replace(/\*\*|__/g, '').replace(/(^|[^*])\*(?!\*)/g, '$1').replace(/`/g, '').trim();
  function chunk(text, size) {
    const sents = String(text).split(/(?<=[.!?。…][”"’']?)\s+/).filter(Boolean);
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
    if (i < 1 || i > 16) return null;
    const rawName = stripMd(line.slice(0, i)).replace(/^[-•>\s]+/, '');
    if (!rawName || rawName.length > 14) return null;
    let rest = line.slice(i + 2).trim();
    let act = '', text = '';
    const q = rest.search(/["“]/);
    if (q >= 0) {
      act = stripMd(rest.slice(0, q));
      const after = rest.slice(q + 1);
      const c = after.search(/["”]/);
      text = c >= 0 ? after.slice(0, c) : after;
      const tail = c >= 0 ? stripMd(after.slice(c + 1)) : '';
      if (tail) text += ' ' + tail;
    } else {
      text = stripMd(rest);
    }
    const who = roster.resolve(rawName);
    return { kind: 'say', who: who || rawName, raw: rawName, known: !!who, act: act.trim(), text: stripMd(text).trim() };
  }

  const ratio = (w, h) => (w && h) ? w / h : 0;
  const isPerson = (r) => r > 1.6 && r < 1.74;     // 인물 1536×912 ≈ 1.684
  const isPlace = (r) => r >= 1.74 && r < 1.86;    // 장소 1920×1072 ≈ 1.791

  // segs: [{t:'text', s, code}, {t:'img', src, w, h, alt}] 또는 글 하나
  function parse(segs, roster) {
    if (typeof segs === 'string') segs = [{ t: 'text', s: segs }];
    roster = roster || new Roster({});
    const lines = [];   // {s, code, img}
    for (const sg of segs || []) {
      if (!sg) continue;
      if (sg.t === 'img') { lines.push({ img: { src: sg.src, w: sg.w || 0, h: sg.h || 0, alt: sg.alt || '' } }); continue; }
      String(sg.s || '').split('\n').forEach(s => lines.push({ s, code: !!sg.code }));
    }
    // 상태창: '📍 … D숫자' 줄이 있는 마지막 묶음 (코드 상자 우선)
    const heads = lines.map((l, i) => (l.s != null && STATUS_HEAD.test(l.s)) ? i : -1).filter(i => i >= 0);
    const codeHeads = heads.filter(i => lines[i].code);
    const hi = codeHeads.length ? codeHeads[codeHeads.length - 1] : heads.length ? heads[heads.length - 1] : -1;
    const drop = new Set();
    let status = null;
    if (hi >= 0) {
      let a = hi, b = hi;
      while (a - 1 >= 0 && lines[a - 1].s != null && (/^\s*👁/.test(lines[a - 1].s) || (lines[hi].code && lines[a - 1].code && STATUS_LINE.test(lines[a - 1].s)))) a--;
      while (b + 1 < lines.length && lines[b + 1].s != null && (STATUS_LINE.test(lines[b + 1].s) || (lines[hi].code && lines[b + 1].code && lines[b + 1].s.trim() && b - hi < 8))) b++;
      for (let i = a; i <= b; i++) drop.add(i);
      status = parseStatus(lines.slice(a, b + 1).map(l => l.s), roster);
    }
    // 코드 상자의 다른 줄(빈 줄)도 장면에서 뺀다
    lines.forEach((l, i) => { if (l.code && !(l.s || '').trim()) drop.add(i); });

    const delta = [];
    const beats = [];
    let pendImg = [];
    let para = '';
    const imgs = [];
    const flushPara = () => {
      const t = para.trim(); para = '';
      if (!t) return;
      chunk(t, 110).forEach(c => pushBeat({ kind: 'narr', text: c }));
    };
    const pushBeat = (b) => {
      if (pendImg.length) { b.img = pendImg[pendImg.length - 1]; b.imgs = pendImg; pendImg = []; }
      beats.push(b);
    };
    lines.forEach((l, i) => {
      if (drop.has(i)) return;
      if (l.img) { flushPara(); pendImg.push(l.img); imgs.push(l.img); return; }
      const raw = l.s;
      if (/📦/.test(raw)) { flushPara(); delta.push(...parseDelta(raw, roster)); return; }
      const s = raw.trim();
      if (!s || /^[-━─=_]{3,}$/.test(s)) { flushPara(); return; }
      if (/^```/.test(s)) return;
      const say = sayLine(raw, roster);
      if (say) { flushPara(); pushBeat(say); return; }
      const clean = stripMd(s);
      if (!clean) { flushPara(); return; }
      if (/^[(（].*[)）]$/.test(clean)) { flushPara(); pushBeat({ kind: 'sys', text: clean.replace(/^[(（]|[)）]$/g, '') }); return; }
      para = clean; flushPara();   // 크랙 화면에선 한 줄 = 한 문단
    });
    flushPara();
    if (pendImg.length) {
      if (beats.length) { const lb = beats[beats.length - 1]; if (!lb.img) { lb.img = pendImg[0]; lb.imgs = pendImg; } else lb.imgsAfter = pendImg; }
      else beats.push({ kind: 'narr', text: '', img: pendImg[pendImg.length - 1], imgs: pendImg });
      pendImg = [];
    }

    // 인물 사진 배우기: alt 에 명부 이름 → 그 사람 / 인물형 크기 + 바로 다음 대사 화자가 명부 인물 → 그 사람
    const faces = {};
    const scene = [];   // 장소형 그림
    beats.forEach((b, bi) => {
      (b.imgs || []).forEach(im => {
        const r = ratio(im.w, im.h);
        const byAlt = roster.find(im.alt)[0];
        if (byAlt) { faces[byAlt] = im.src; im.kind = 'person'; im.who = byAlt; return; }
        // 그림 뒤 첫 대사 (다음 그림이 나오기 전까지)
        let sb = null;
        for (let k = bi; k < beats.length; k++) { if (k > bi && beats[k].imgs) break; if (beats[k].kind === 'say') { sb = beats[k]; break; } }
        if (isPerson(r) && sb && sb.known) { faces[sb.who] = im.src; im.kind = 'person'; im.who = sb.who; return; }
        im.kind = isPlace(r) ? 'place' : isPerson(r) ? 'person' : 'other';
        if (im.kind === 'place') scene.push(im);
      });
    });

    const text = beats.map(b => (b.kind === 'say' ? b.who + ' ' + b.act + ' ' : '') + b.text).join('\n');
    // 능력치 배우기: "이름 … 탐7/전2/스9" 또는 "탐사력 7 전투력 2 스테미나 9"
    const stats = {};
    const allText = lines.filter((l, i) => l.s != null && !drop.has(i)).map(l => stripMd(l.s)).join('\n');
    allText.split('\n').forEach((ln, i, arr) => {
      let m = ln.match(/탐(?:사력)?\s*[:：]?\s*(\d+)\s*[/·,|\s]\s*전(?:투력)?\s*[:：]?\s*(\d+)\s*[/·,|\s]\s*스(?:테미나|태미나)?\s*[:：]?\s*(\d+)/);
      if (!m) return;
      let who = roster.find(ln)[0];
      if (!who) { for (let k = i - 1; k >= 0 && !who; k--) who = roster.find(arr[k]).slice(-1)[0]; }
      if (who) stats[who] = { E: +m[1], C: +m[2], S: +m[3] };
    });
    // 만난 사람: 장면 글과 상태창에 나온 명부 이름
    const met = roster.find(allText + '\n' + (status ? [].concat(status.chores.map(c => c.name), status.wait.map(w => w.name), ...status.dispatch.map(d => d.party)).join(' ') : ''));
    beats.forEach(b => { if (b.kind === 'say' && b.known && !met.includes(b.who)) met.push(b.who); });
    // 시설 완공
    const built = [];
    for (const f of FACILITIES) {
      const re = new RegExp(f + '[^.\\n]{0,16}(완공|완성|생겼|들어섰|문을 열|마련됐|마련되|설치)');
      if (re.test(allText)) built.push(f);
    }
    const mood = moodOf(imgs, status, allText);
    return { status, beats, delta, imgs, faces, stats, met, built, mood, text: allText };
  }

  // 무대 분위기: 위기 그림(빌라웨이브·빌라함락·봉쇄선) / 밤 / 공사 중
  function moodOf(imgs, status, text) {
    const alts = (imgs || []).map(i => i.alt || '').join(' ') + ' ' + (imgs || []).map(i => decodeURIComponentSafe(i.src || '')).join(' ');
    return {
      crisis: /빌라웨이브|빌라함락|봉쇄선/.test(alts),
      night: /빌라밤|옥상밤|해령시밤/.test(alts) || (status && status.time === '밤'),
      build: /빌라공사/.test(alts)
    };
  }
  function decodeURIComponentSafe(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

  // ---------- 기록 (세이브에 남는 것) ----------
  function blank() {
    return { status: null, people: {}, face: {}, stats: {}, regions: {}, facilities: {}, log: [], lines: [], maxDay: 0, firstWave: false, prologue: false, owner: '', lastBg: '', order: 0 };
  }
  // 해석 결과를 기록에 더한다. 돌려주는 값: 아침점호 카드에 쓸 내용
  function absorb(M, P, data) {
    const prev = M.status;
    const st = P.status;
    const out = { dayChanged: false, prevDay: prev ? prev.day : 0, day: st ? st.day : (prev ? prev.day : 0), lines: [], joined: [], returned: [], left: [] };
    const day = out.day || 0;
    const person = (nm) => { if (!M.people[nm]) M.people[nm] = { st: 'met', first: day, order: ++M.order }; return M.people[nm]; };
    const log = (t) => { M.log.push({ d: day, t }); };
    const regionNames = ((data && data.regions) || []).map(r => r.n);

    (P.met || []).forEach(nm => person(nm));
    Object.assign(M.face, P.faces || {});
    Object.assign(M.stats, P.stats || {});
    (P.built || []).forEach(f => { if (!M.facilities[f]) { M.facilities[f] = day || 1; log(`${f} 완공`); } });
    // 글에 나온 지역 = 소문 들음
    for (const n of regionNames) if (P.text && P.text.includes(n) && !M.regions[n]) M.regions[n] = { heard: day || 1 };

    if (st) {
      if (prev && st.day > prev.day) out.dayChanged = true;
      M.maxDay = Math.max(M.maxDay || 0, st.day);
      if (M.maxDay >= 12) M.firstWave = true;
      // 일과·파견 = 거주, 대기 = 대기
      const live = new Set();
      st.chores.forEach(c => { if (/^[가-힣]{2,4}$/.test(c.name)) live.add(c.name); });
      st.dispatch.forEach(d => d.party.forEach(n => { if (/^[가-힣]{2,4}$/.test(n) && n !== '나' && n !== '집주인') live.add(n); }));
      live.forEach(n => { const p = person(n); if (p.st !== 'res') { if (p.st === 'wait' || p.st === 'met') out.joined.push(n); p.st = 'res'; p.since = p.since || day; } });
      st.wait.forEach(w => { const p = person(w.name); if (p.st === 'met') p.st = 'wait'; });
      // 대기하던 사람이 사라지고 주민 수가 그만큼 늘었으면 입주한 것으로 본다
      if (prev) {
        const gone = (prev.wait || []).map(w => w.name).filter(n => !st.wait.some(w => w.name === n) && M.people[n] && M.people[n].st === 'wait');
        const grew = (st.ppl || 0) - (prev.ppl || 0);
        if (gone.length && grew >= gone.length) gone.forEach(n => { M.people[n].st = 'res'; M.people[n].since = day; out.joined.push(n); });
        // 파견 귀환
        (prev.dispatch || []).forEach(d => {
          if (!st.dispatch.some(x => x.dest === d.dest && x.party.join() === d.party.join())) { out.returned.push(d); log(`${d.party.join('·')} ${d.dest}에서 귀환`); }
        });
        st.dispatch.forEach(d => {
          if (!(prev.dispatch || []).some(x => x.dest === d.dest && x.party.join() === d.party.join())) log(`${d.party.join('·')} → ${d.dest} 출발 (귀환 D${d.ret})`);
        });
      } else {
        st.dispatch.forEach(d => log(`${d.party.join('·')} → ${d.dest} (귀환 D${d.ret})`));
      }
      st.dispatch.forEach(d => { if (regionNames.includes(d.dest)) { const r = M.regions[d.dest] || (M.regions[d.dest] = { heard: day }); r.went = (r.went || 0) + (prev && (prev.dispatch || []).some(x => x.dest === d.dest) ? 0 : 1); } });
      if (st.cap == null && prev) st.cap = prev.cap;
      M.status = st;
    }
    // 📦 사건
    (P.delta || []).forEach(d => {
      if (d.kind === 'ev') {
        const p = person(d.name);
        if (d.ev === '입주') { if (p.st !== 'res') out.joined.push(d.name); p.st = 'res'; p.since = day; }
        else if (d.ev === '사망' || d.ev === '전환') { p.st = 'dead'; out.left.push(d.name); }
        else if (/이탈|추방|실종/.test(d.ev)) { p.st = 'gone'; out.left.push(d.name); }
        else if (d.ev === '부상' || d.ev === '감염' || d.ev === '발열') p.hurt = d.ev;
        else if (d.ev === '회복') p.hurt = '';
      }
      log(d.text);
      out.lines.push(d.text);
    });
    out.joined.forEach(n => log(`${n} 입주`));
    if (!st && prev) out.day = prev.day;
    return out;
  }

  // ---------- 지시서 문장 (조사 받침 판별) ----------
  function hasBatchim(word) {
    const w = String(word || '').trim();
    const c = w.charCodeAt(w.length - 1);
    if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
    return /[136780lmnr]$/i.test(w);
  }
  const josa = (w, a, b) => w + (hasBatchim(w) ? a : b);   // josa('소담','을','를')
  function joinNames(list) {
    const a = (list || []).filter(Boolean);
    if (a.length <= 1) return a[0] || '';
    return a.slice(0, -1).join(', ') + ', ' + a[a.length - 1];
  }

  const api = { Roster, parse, parseStatus, parseDelta, absorb, blank, josa, hasBatchim, joinNames, chunk, timeOf, RES_LABEL, isPerson, isPlace };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionSafehouse = api;
})(typeof window !== 'undefined' ? window : globalThis);
