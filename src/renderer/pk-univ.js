// 플레이팩 「리온대학교 x스학과」 — 크랙 응답 해석기 (화면 없이 동작, node 시험 가능)
//  크랙 출력 순서(메인 프롬프트 # 출력 형식): 배경 그림 → *상황 묘사* → 인물 그림 → **인물 💬** 대사
//    → 핸드폰 블록(🕖·📆·🔔 뤼브리타임·💬 가가오톡·📍) → 상태창(📅·🎓·📚·💌·📝)
//  특수 블록: WREVERYTIME(수강신청) · GAGAOTALK(단톡방) · [가가오톡 | 발신자] 메시지 · 뤼브리타임 게시판(익명1·익명2)
//  크랙 화면에서 마크다운이 렌더링된 뒤의 글(** · * 가 사라진 모양)도, 원문 그대로도 읽는다.
//  이 팩은 크랙 출력에 새 표식을 요구하지 않는다. 표식이 없어도 장면은 나온다.
(function (root) {
  'use strict';

  const EMO = { '💜': '무관심', '💙': '연민', '🧡': '우정', '💛': '가족', '🖤': '비호감', '💔': '적대', '❤️': '사랑', '❤': '사랑' };
  const EMO_RE = '(💜|💙|🧡|💛|🖤|💔|❤️|❤)';
  const GRADE_PT = { S: 4.5, 'A+': 4.5, A: 4.0, 'B+': 3.5, B: 3.0, 'C+': 2.5, C: 2.0, D: 1.0, F: 0 };
  const LETTER = (p) => p >= 4.25 ? 'A+' : p >= 3.75 ? 'A' : p >= 3.25 ? 'B+' : p >= 2.75 ? 'B' : p >= 2.25 ? 'C+' : p >= 1.75 ? 'C' : p >= 0.75 ? 'D' : 'F';
  const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
  const ST_LINE = /^\s*(📅|🎓|📚|💌|📝)/u;
  const PH_LINE = /^\s*(🕖|🕐|⏰|📆|🔔|💬\s*[|｜]|📍\s*[|｜]|👤\s*\[|💯|💪|❤️?\s*호감도|-{4,})/u;
  const AFF_LINE = new RegExp('^\\s*[(（]?\\s*[가-힣]{2,4}\\s*[)）]?\\s*[|｜]\\s*' + EMO_RE, 'u');
  const stripMd = (s) => String(s || '').replace(/\{\{\s*img\s*::[^}]*\}\}/g, '').replace(/\*\*|__/g, '').replace(/(^|[^*])\*(?!\*)/g, '$1').replace(/`/g, '').replace(/^\\\s*$/, '').trim();
  const clean = (s) => stripMd(s).replace(/^[-•>\s]+/, '').trim();

  // ---------- 명부 ----------
  function Roster(data) {
    this.list = ((data && data.roster) || []).slice();
    this.by = {}; this.alias = {};
    this.list.forEach(r => {
      this.by[r.name] = r;
      if (r.key && r.key !== r.name) this.alias[r.key] = r.name;          // 소희 → 유소희, 담당관 → 양가희
      const g = r.name.length >= 3 ? r.name.slice(r.name.length === 4 ? 2 : 1) : '';
      if (g.length >= 2 && !this.alias[g]) this.alias[g] = r.name;
    });
    Object.assign(this.alias, { '양가희 검사관': '양가희', '가희': '양가희', '검사관': '양가희', '학식 이모': '정순자', '이모님': '정순자', '진아': '류진아', '학과장님': '황보경', '보경': '황보경' });
    this.keys = Object.keys(this.by).concat(Object.keys(this.alias)).sort((a, b) => b.length - a.length);
  }
  Roster.prototype.resolve = function (s) {
    const n = String(s || '').replace(/[*_💬:：]/g, '').trim();
    if (!n) return '';
    const flat = n.replace(/\s/g, '');
    if (this.by[flat]) return flat;
    if (this.alias[n]) return this.alias[n];
    if (this.alias[flat]) return this.alias[flat];
    // "양가희 검사관", "유라 교수님", "소희 선배" 같은 꼴: 앞부분이 이름
    const k = this.keys.find(x => flat.startsWith(x.replace(/\s/g, '')) && flat.length - x.length <= 4);
    return k ? (this.by[k] ? k : this.alias[k]) : '';
  };
  Roster.prototype.get = function (n) { return this.by[n] || null; };
  Roster.prototype.find = function (text) {
    const out = [], t = String(text || '');
    for (const k of this.keys) {
      let i = t.indexOf(k);
      while (i >= 0) {
        const full = this.by[k] ? k : this.alias[k];
        const prev = t[i - 1] || '';
        if ((this.by[k] || !/[가-힣]/.test(prev)) && !out.some(o => o.name === full)) { out.push({ name: full, at: i }); break; }
        i = t.indexOf(k, i + 1);
      }
    }
    return out.sort((a, b) => a.at - b.at).map(o => o.name);
  };

  // ---------- 과목 이름 맞추기 ----------
  function courseOf(name, data) {
    const n = String(name || '').replace(/[\s()（）·]/g, '');
    if (!n) return '';
    for (const c of (data && data.courses) || []) {
      const keys = [c.n].concat(c.aka || []).map(x => x.replace(/[\s()（）·]/g, ''));
      if (keys.some(k => n === k || n.includes(k) || (k.length >= 4 && k.includes(n)))) return c.n;
    }
    return String(name).trim();
  }

  // ---------- 상태창 ----------
  function parseStatus(lines, roster, data) {
    const st = {};
    const all = lines.join('\n');
    const dl = lines.find(l => /📅/.test(l));
    if (dl) {
      const b = dl.replace(/^.*?📅\s*/, '');
      const sem = b.match(/(\d)\s*학년\s*(\d)\s*학기/); if (sem) { st.year = +sem[1]; st.sem = +sem[2]; }
      const wk = b.match(/(\d{1,2})\s*주\s*차/); if (wk) st.week = +wk[1];
      const dy = b.match(/([월화수목금토일])\s*요일/) || b.match(/주\s*차\s*([월화수목금토일])(?![가-힣])/); if (dy) st.day = dy[1];
      const tm = b.match(/(\d{1,2}\s*:\s*\d{2})/) || b.match(/((?:오전|오후|새벽|아침|점심|저녁|밤)\s*\d{0,2}\s*시?(?:\s*\d{1,2}\s*분)?)/);
      if (tm) st.time = tm[1].replace(/\s+/g, ' ').trim();
      const pl = b.match(/📍\s*([^|｜\n]+)/); if (pl) st.place = pl[1].trim();
    }
    const gl = lines.find(l => /🎓/.test(l));
    if (gl) {
      const parts = gl.replace(/^.*?🎓\s*/, '').split(/\s*[|｜]\s*/);
      if (parts[0] && !/등급|평점/.test(parts[0])) st.me = clean(parts[0]).replace(/^\{\{?user\}?\}$/, '');
      const g = gl.match(/등급\s*[:：]?\s*([SABCD])\b/i); if (g) st.grade = g[1].toUpperCase();
      const p = gl.match(/평점\s*[:：]?\s*([0-9.]+|-)/); if (p) st.gpaPrev = p[1];
    }
    // 📚 과목 (한 줄에 여러 개 또는 여러 줄)
    const cl = [];
    let inC = false;
    lines.forEach(l => { if (/📚/.test(l)) { inC = true; cl.push(l.replace(/^.*?📚\s*/, '')); } else if (inC && !ST_LINE.test(l) && /과제/.test(l)) cl.push(l); else if (ST_LINE.test(l)) inC = false; });
    if (cl.length) {
      st.courses = [];
      const re = /([^,，·|｜/()（）\n]+?)\s*[(（]\s*과제\s*(\d)\s*\/\s*(\d)\s*(?:[,，]\s*(?:최근\s*(?:평가)?\s*[:：]?\s*)?([SABCDF]\+?|-|–|없음|미정)?)?\s*[)）]/g;
      let m;
      const src = cl.join(' · ').replace(/^[-•\s]+/gm, '');
      while ((m = re.exec(src))) {
        const name = courseOf(clean(m[1]).replace(/^[-•\d.\s]+/, ''), data);
        if (!name) continue;
        const rg = m[4] && /^[SABCDF]/.test(m[4]) ? m[4] : '';
        st.courses.push({ n: name, done: +m[2], of: +m[3] || 4, recent: rg });
      }
      if (!st.courses.length) delete st.courses;
    }
    // 💌 호감도 (만난 히로인만)
    const al = lines.filter(l => /💌/.test(l)).map(l => l.replace(/^.*?💌\s*/, '').replace(/\[[^\]]*만난[^\]]*\]/, '')).join(' · ');
    if (al) st.aff = parseAff(al, roster);
    const nx = lines.find(l => /📝/.test(l));
    if (nx) { const t = clean(nx.replace(/^.*?📝\s*/, '').replace(/^다음\s*일정\s*[:：]?\s*/, '')); if (t) st.next = t; }
    return Object.keys(st).length ? st : null;
  }
  function parseAff(text, roster) {
    const out = [];
    const re = new RegExp('([가-힣]{2,4})\\s*[)）]?\\s*[|｜:：]?\\s*' + EMO_RE + '\\s*(\\d+(?:\\.\\d+)?)\\s*%?', 'gu');
    let m;
    while ((m = re.exec(text))) {
      const who = roster.resolve(m[1]) || m[1];
      if (out.some(o => o.n === who)) continue;
      out.push({ n: who, e: m[2] === '❤' ? '❤️' : m[2], v: +m[3] });
    }
    return out;
  }

  // ---------- 핸드폰 블록 (예시 대화 형식) ----------
  function parsePhone(lines, roster) {
    const ph = { notifs: [] };
    for (const raw of lines) {
      const l = raw.trim();
      let m;
      if ((m = l.match(/^(?:🕖|🕐|⏰)\s*[|｜]?\s*(.+)$/u))) ph.clock = clean(m[1]);
      else if ((m = l.match(/^📆\s*[|｜]?\s*(?:다음\s*수업\s*[:：]?)?\s*(.*)$/u))) { const v = clean(m[1]); if (v) ph.nextClass = v; }
      else if ((m = l.match(/^🔔\s*[|｜]?\s*(.+)$/u))) {
        const v = clean(m[1]);
        const ago = (v.match(/[(（]\s*([^)）]*?전)\s*[)）]/) || [])[1] || '';
        const title = (v.match(/["“]([^"”]+)["”]/) || [])[1] || v.replace(/^뤼브리타임\s*/, '').replace(/[(（][^)）]*[)）]/, '').trim();
        if (title) ph.notifs.push({ app: /가가오톡/.test(v) ? 'kakao' : 'riv', title, ago });
      } else if ((m = l.match(/^💬\s*[|｜]\s*(.+)$/u))) {
        const v = clean(m[1]).replace(/^가가오톡\s*/, '');
        const room = (v.match(/^\[([^\]]+)\]/) || [])[1] || '';
        const msg = v.replace(/^\[[^\]]+\]\s*/, '');
        if (msg) ph.notifs.push({ app: 'kakao', room, title: msg });
      } else if ((m = l.match(/^📍\s*[|｜]\s*(.+)$/u))) ph.place = clean(m[1]);
      else if ((m = l.match(/^💯[^|｜]*[|｜]\s*(.*)$/u))) { const v = clean(m[1]); if (v) ph.gpaEst = v; }
      else if ((m = l.match(/^💪[^|｜]*[|｜]\s*(.*)$/u))) { const g = clean(m[1]).match(/[SABCD]/); if (g) ph.grade = g[0]; }
    }
    const aff = parseAff(lines.filter(l => AFF_LINE.test(l)).join(' · '), roster);
    if (aff.length) ph.aff = aff;
    return ph;
  }

  // ---------- 가가오톡 ----------
  // [가가오톡 | 발신자] 메시지  ·  [가가오톡 | 1학년 단톡방 | 발신자] 메시지
  const KAKAO_INLINE = /^\s*\[\s*가가오톡\s*[|｜]\s*([^\]]+)\]\s*(.*)$/u;
  function kakaoInline(line, roster) {
    const m = stripMd(line).match(KAKAO_INLINE);
    if (!m) return null;
    const parts = m[1].split(/\s*[|｜]\s*/).map(x => x.trim()).filter(Boolean);
    let room = '', who = parts[parts.length - 1];
    if (parts.length >= 2) room = parts[0];
    else if (/단톡|톡방|방$/.test(who)) { room = who; who = ''; }
    let t = m[2].trim();
    const sp = !who && t.match(/^([가-힣A-Za-z0-9]{1,8})\s*[:：]\s*(.+)$/);
    if (sp) { who = sp[1]; t = sp[2]; }
    const res = roster.resolve(who) || who;
    return { room: room || res || '알 수 없음', who: res, t: t.replace(/^["“]|["”]$/g, '') };
  }

  // ---------- 해석 ----------
  // segs: [{t:'text', s, code}, {t:'img', src, w, h, alt}] 또는 글 하나
  // opts.me = 플레이어 이름 (가가오톡에서 내가 보낸 말을 오른쪽에)
  function parse(segs, roster, data, opts) {
    opts = opts || {};
    const isMe = (n) => !!n && (n === '나' || n === '{user}' || (opts.me && n.replace(/\s/g, '') === String(opts.me).replace(/\s/g, '')));
    // 이야기 묘사 줄 (가가오톡 말풍선으로 잘못 넣지 않게): '~다.' 로 끝나는 긴 문장
    const isNarr = (r) => (r.length >= 22 && /[다요죠]\.[”"']?\s*$/.test(r) && !/[ㅋㅎㅠㅜ]{2}/.test(r)) || r.length > 70;
    if (typeof segs === 'string') segs = [{ t: 'text', s: segs }];
    roster = roster || new Roster({});
    const lines = [];
    for (const sg of segs || []) {
      if (!sg) continue;
      if (sg.t === 'img') { lines.push({ img: { src: sg.src, w: sg.w || 0, h: sg.h || 0, alt: sg.alt || '' } }); continue; }
      String(sg.s || '').split('\n').forEach(s => lines.push({ s, code: !!sg.code }));
    }
    const drop = new Set();
    const isText = (i) => lines[i] && lines[i].s != null;
    const txt = (i) => (isText(i) ? lines[i].s : '');

    // 1) 상태창: 마지막 📅 줄부터 이어지는 📅🎓📚💌📝 묶음
    let status = null;
    const sIdx = lines.map((l, i) => (l.s != null && /📅/.test(l.s) ? i : -1)).filter(i => i >= 0);
    if (sIdx.length) {
      const a = sIdx[sIdx.length - 1];
      let b = a;
      while (b + 1 < lines.length && isText(b + 1) && (ST_LINE.test(txt(b + 1)) || (!txt(b + 1).trim() && ST_LINE.test(txt(b + 2))) || (/과제\s*\d\s*\/\s*\d/.test(txt(b + 1))) || new RegExp('^\\s*[-•]?\\s*[가-힣]{2,4}\\s*' + EMO_RE, 'u').test(txt(b + 1)))) b++;
      const blk = [];
      for (let i = a; i <= b; i++) { drop.add(i); blk.push(txt(i)); }
      status = parseStatus(blk, roster, data);
    }
    // 🎓 등이 📅 없이 따로 나오면(구형) 그것도 상태창으로
    lines.forEach((l, i) => { if (!drop.has(i) && l.s != null && /^\s*(🎓|📚|💌|📝)/u.test(l.s)) { drop.add(i); const s2 = parseStatus([l.s], roster, data); if (s2) status = Object.assign(status || {}, s2); } });

    // 2) 핸드폰 블록
    const phLines = [];
    lines.forEach((l, i) => {
      if (drop.has(i) || l.s == null) return;
      const s = l.s.trim();
      if (/^핸드폰\s*블록\s*[:：]?$/.test(stripMd(s)) || PH_LINE.test(s) || AFF_LINE.test(s)) { drop.add(i); phLines.push(s); }
    });
    const phone = phLines.length ? parsePhone(phLines, roster) : null;

    // 3) 가가오톡 단톡방 블록 (GAGAOTALK 블록: / [~가 있는 단톡방] → 👤 이름 / 메시지)
    const kakao = [];
    for (let i = 0; i < lines.length; i++) {
      if (drop.has(i) || !isText(i)) continue;
      const s = stripMd(txt(i));
      const inl = kakaoInline(s, roster);
      if (inl && inl.t) { if (isMe(inl.who)) { inl.me = true; } kakao.push(inl); drop.add(i); continue; }
      const head = /GAGAOTALK/i.test(s) || /^가가오톡\s*(블록|화면)?\s*[:：]?$/.test(s);
      const roomLine = /^\[([^\]]*(단톡방|톡방|채팅방|대화방))\]$/.test(s);
      if (!head && !roomLine && !inl) continue;
      drop.add(i);
      // [가가오톡 | 차예은] 만 있는 줄 = 그 사람과의 1:1 대화가 아래로 이어짐
      let room = inl ? inl.room : roomLine ? s.slice(1, -1) : '';
      let who = inl && inl.who && !isMe(inl.who) ? inl.who : '';
      let narrRun = 0;
      let j = i + 1, blank = 0;
      for (; j < lines.length; j++) {
        if (!isText(j) || drop.has(j)) break;
        const r = stripMd(txt(j));
        if (!r) { blank++; if (blank >= 2) break; drop.add(j); continue; }
        if (ST_LINE.test(r) || PH_LINE.test(r) || /블록\s*[:：]?$/.test(r) || /💬/.test(r.replace(/^👤/, '')) && !/^👤/.test(r)) break;
        blank = 0;
        const rm = r.match(/^\[([^\]]+)\]$/);
        if (rm && !room) { room = rm[1]; drop.add(j); continue; }
        const inl2 = kakaoInline(r, roster);
        if (inl2) { drop.add(j); if (inl2.t) { inl2.me = isMe(inl2.who); kakao.push(inl2); } else { room = inl2.room; who = isMe(inl2.who) ? '' : inl2.who; } continue; }
        if (isNarr(r)) { narrRun++; if (narrRun >= 2) break; continue; }   // 묘사 줄은 장면으로 남긴다
        narrRun = 0;
        const p = r.match(/^👤\s*[(（]?\s*([^)）:：]{1,12}?)\s*[)）]?\s*(?:[:：]\s*(.*))?$/u);
        if (p) { who = roster.resolve(p[1]) || p[1].trim(); drop.add(j); if (p[2]) kakao.push({ room: room || '단톡방', who, t: p[2].trim(), me: isMe(who) }); continue; }
        const sp = r.match(/^([가-힣A-Za-z]{1,8})\s*[:：]\s*(.+)$/);
        if (sp && (roster.resolve(sp[1]) || isMe(sp[1]))) { const w2 = roster.resolve(sp[1]) || sp[1]; kakao.push({ room: room || '단톡방', who: w2, t: sp[2].trim(), me: isMe(w2) }); drop.add(j); continue; }
        if (!who) break;
        kakao.push({ room: room || '단톡방', who, t: r, me: isMe(who) });
        drop.add(j);
      }
      i = j - 1;
    }

    // 4) 뤼브리타임 게시판
    const riv = [];
    for (let i = 0; i < lines.length; i++) {
      if (drop.has(i) || !isText(i)) continue;
      const s = stripMd(txt(i));
      if (!(/뤼브리타임/.test(s) && s.length <= 40 && !/^🔔/.test(s)) && !/^\[?\s*(자유|비밀|정보|새내기|졸업생|장터|이벤트)게시판\s*\]?$/.test(s)) continue;
      drop.add(i);
      const board = (s.match(/(자유|비밀|정보|새내기|졸업생|장터|이벤트)게시판/) || [])[0] || '자유게시판';
      let cur = null, blank = 0, j = i + 1;
      const push = () => { if (cur && (cur.title || cur.body.length)) riv.push(cur); cur = null; };
      for (; j < lines.length; j++) {
        if (!isText(j) || drop.has(j)) break;
        const raw = txt(j), r = stripMd(raw);
        if (!r) { blank++; if (blank >= 2) break; drop.add(j); push(); continue; }
        if (ST_LINE.test(r) || PH_LINE.test(r) || KAKAO_INLINE.test(r) || /GAGAOTALK/i.test(r)) break;
        const say = r.indexOf('💬');
        if (say > 0 && say < 16 && roster.resolve(r.slice(0, say))) break;
        if (/^[-━─=_]{3,}$/.test(r)) { drop.add(j); push(); continue; }
        blank = 0;
        drop.add(j);
        const cm = r.match(/^(?:ㄴ|└|↳|➥|>|💬|댓글\s*[:：]?)\s*(?:(익명\s*\d*|글쓴이)\s*[:：|]?\s*)?(.+)$/u);
        if (cm && cur) { cur.cmts.push({ who: (cm[1] || '익명').replace(/\s/g, ''), t: cm[2].trim() }); continue; }
        const an = r.match(/^(익명\s*\d+|글쓴이)\s*[:：|]\s*(.+)$/);
        if (an && cur && (cur.title || cur.body.length)) {
          if (cur.body.length || cur.who) cur.cmts.push({ who: an[1].replace(/\s/g, ''), t: an[2].trim() });
          else { cur.who = an[1].replace(/\s/g, ''); cur.body.push(an[2].trim()); }
          continue;
        }
        const tl = r.match(/^(?:\d+[.)]\s*|[■□▶▷●○📌🔥💡]\s*|\[(?:제목|자유|비밀|정보|질문|후기|꿀팁|ㅋㅋ)[^\]]*\]\s*)(.+)$/u) || r.match(/^제목\s*[:：]\s*(.+)$/);
        if (tl || !cur) {
          push();
          let title = (tl ? tl[1] : r).trim();
          const by = title.match(/\s*[-–|]\s*(익명\s*\d+)\s*$/) || title.match(/^(익명\s*\d+)\s*[:：|]\s*/);
          let who = '';
          if (by) { who = by[1].replace(/\s/g, ''); title = title.replace(by[0], '').trim(); }
          const ttl = title.match(/^["“](.+?)["”]\s*(.*)$/);
          cur = { board, title: ttl ? ttl[1] : title, body: ttl && ttl[2] ? [ttl[2]] : [], cmts: [], who: who || '익명' };
          continue;
        }
        cur.body.push(r.replace(/^본문\s*[:：]\s*/, ''));
      }
      push();
      i = j - 1;
    }

    // 5) 수강신청 (WREVERYTIME 블록)
    let enroll = null;
    for (let i = 0; i < lines.length; i++) {
      if (drop.has(i) || !isText(i)) continue;
      const s = stripMd(txt(i));
      if (!/WREVERYTIME/i.test(s) && !/수강\s*가능\s*수업/.test(s)) continue;
      enroll = { lines: [] };
      drop.add(i);
      let j = i + 1, blank = 0;
      for (; j < lines.length; j++) {
        if (!isText(j) || drop.has(j)) break;
        const r = stripMd(txt(j));
        if (!r) { blank++; if (blank >= 2) break; drop.add(j); continue; }
        if (ST_LINE.test(r) || PH_LINE.test(r) || /💬/.test(r) || /블록\s*[:：]?$/.test(r)) break;
        blank = 0; drop.add(j); enroll.lines.push(r);
      }
      i = j - 1;
    }

    // 6) 입학 검사 결과 양식 (프롤로그) → 입학 검사 화면을 띄울 신호, 양식 줄은 장면에서 뺀다
    let needExam = false;
    lines.forEach((l, i) => {
      if (drop.has(i) || l.s == null) return;
      const s = stripMd(l.s);
      if (/\[\s*입학\s*검사\s*결과/.test(s)) { needExam = true; drop.add(i); }
      else if (needExam && /^(이름|나이|특기|취미|성격|등급|능력치|지원동기|자기소개|학번|유형|담당관\s*코멘트)\s*[:：]\s*$/.test(s)) drop.add(i);
      else if (needExam && /^※\s*아직 검사를/.test(s)) drop.add(i);
      else if (/아래 형식 그대로 붙여넣어|해당 사이트에 방문하여 입학시험|사이트에서 치르는|hyerong\.live\.net\/exam|이미지 클릭시에도 안 넘어가|^https?:\/\/\S+\*?$/.test(s)) { needExam = needExam || /붙여넣어|입학시험/.test(s); drop.add(i); }
    });
    // 코드 상자의 빈 줄
    lines.forEach((l, i) => { if (l.code && !(l.s || '').trim()) drop.add(i); });

    // 7) 장면: 대사(이름 💬) · 묘사 · 그림
    const beats = [], imgs = [];
    let pend = [];
    const pushBeat = (b) => { if (pend.length) { b.imgs = pend; pend = []; } beats.push(b); return b; };
    lines.forEach((l, i) => {
      if (drop.has(i)) return;
      if (l.img) { pend.push(l.img); imgs.push(l.img); return; }
      const raw = l.s, s = raw.trim();
      if (!s || /^[-━─=_\\]{1,}$/.test(s) || /^```/.test(s) || /^\\$/.test(s)) return;
      const say = sayLine(raw, roster);
      if (say) { pushBeat(say); return; }
      const c = stripMd(s);
      if (!c) return;
      const ep = c.match(/^EPISODE\.?\s*(\d+)\s*[|｜]\s*(.+)$/i);
      if (ep) { pushBeat({ kind: 'title', ep: +ep[1], text: ep[2].trim() }); return; }
      if (/^⚠️/.test(c)) { pushBeat({ kind: 'sys', text: c.replace(/^⚠️\s*/, '') }); return; }
      if (/^[(（].*[)）]$/.test(c) && c.length < 60) { pushBeat({ kind: 'sys', text: c.replace(/^[(（]|[)）]$/g, '') }); return; }
      chunk(c, 120).forEach(t => pushBeat({ kind: 'narr', text: t }));
    });
    if (pend.length) { if (beats.length) beats[beats.length - 1].imgsAfter = pend; else beats.push({ kind: 'narr', text: '', imgs: pend }); pend = []; }

    // 그림 나누기: 넓은 그림 = 배경 / 좁은 그림 = 인물 (바로 뒤 대사 화자의 얼굴)
    const faces = {};
    let firstBg = null;
    beats.forEach((b, bi) => {
      (b.imgs || []).forEach(im => {
        const r = im.w && im.h ? im.w / im.h : 0;
        const alt = (im.alt || '') + ' ' + safeDecode(im.src || '');
        const altWho = roster.find(im.alt || '')[0];
        const wide = r >= 1.3 || /배경|background/i.test(im.alt || '');
        if (wide && !altWho) { im.kind = 'bg'; if (!firstBg) firstBg = im; im.place = placeOf(alt, data); return; }
        let who = altWho;
        if (!who && b.kind === 'say' && b.known) who = b.who;
        im.kind = 'person'; im.who = who || '';
        if (who) { faces[who] = faces[who] || im.src; }
      });
      if (b.kind === 'say') {
        const p = (b.imgs || []).filter(x => x.kind === 'person').pop();
        if (p) b.portrait = p.src;
        const bgi = (b.imgs || []).filter(x => x.kind === 'bg').pop();
        if (bgi) b.bg = bgi.src;
      } else {
        const bgi = (b.imgs || []).filter(x => x.kind === 'bg').pop();
        if (bgi) b.bg = bgi.src;
        const p = (b.imgs || []).filter(x => x.kind === 'person').pop();
        if (p) b.portrait = p.src;   // 화자 없는 인물 그림(리액션·장면)
      }
    });

    const text = beats.map(b => (b.kind === 'say' ? b.who + ' ' : '') + (b.text || '')).join('\n');
    const met = roster.find(text);
    beats.forEach(b => { if (b.kind === 'say' && b.known && !met.includes(b.who)) met.push(b.who); });
    kakao.forEach(k => { if (k.who && roster.get(k.who) && !met.includes(k.who)) met.push(k.who); });
    return { status, phone, kakao, riv, enroll, needExam, beats, imgs, faces, met, text, bg: firstBg };
  }
  function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function placeOf(text, data) {
    const map = (data && data.bg) || {};
    const k = Object.keys(map).sort((a, b) => b.length - a.length).find(x => String(text || '').includes(x));
    return k || '';
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
    if (i < 1 || i > 24) return null;
    const rawName = stripMd(line.slice(0, i)).replace(/^[-•>\s👤]+/, '').trim();
    if (!rawName || rawName.length > 16 || /[|｜\[\]]/.test(rawName)) return null;
    let rest = stripMd(line.slice(i + 2)).trim();
    let act = '';
    const q = rest.search(/["“]/);
    if (q > 0) { act = rest.slice(0, q).trim(); rest = rest.slice(q); }
    let text = rest.replace(/^["“]/, '');
    const c = text.search(/["”](?=[^"”]*$)/);
    if (c >= 0) { const tail = text.slice(c + 1).trim(); text = text.slice(0, c) + (tail ? ' ' + tail : ''); }
    const who = roster.resolve(rawName);
    const title = who && rawName.replace(/\s/g, '') !== who ? rawName.replace(who, '').replace(/^\s+/, '').trim() : '';
    return { kind: 'say', who: who || rawName, raw: rawName, title, known: !!who, act, text: text.trim() };
  }

  // ---------- 입학 검사 결과 블록 (보낸 글·붙여 넣은 글) ----------
  function parseExam(text) {
    const t = String(text || '');
    if (!/입학\s*검사\s*결과/.test(t)) return null;
    const get = (k) => { const m = t.match(new RegExp('^\\s*' + k + '\\s*[:：]\\s*(.*)$', 'm')); return m ? m[1].trim() : ''; };
    const r = { name: get('이름'), age: get('나이'), skill: get('특기'), hobby: get('취미'), traits: get('성격'), why: get('지원동기'), intro: get('자기소개'), sid: get('학번'), type: get('유형'), cm: get('담당관\\s*코멘트').replace(/^["“]|["”]$/g, '') };
    const g = get('등급').match(/[SABCD]/); r.grade = g ? g[0] : '';
    const ab = get('능력치');
    const num = (k) => { const m = ab.match(new RegExp(k + '\\s*(\\d+)')); return m ? +m[1] : null; };
    r.stats = { 체력: num('체력'), 이론: num('이론'), 센스: num('센스'), 멘탈: num('멘탈'), 정직도: num('정직도') };
    return r.name ? r : null;
  }

  // ---------- 기록 (세이브에 남는 것) ----------
  function blank() {
    return { status: null, courses: {}, aff: {}, met: {}, face: {}, kakao: {}, kakaoRead: {}, riv: [], rivRead: 0, notifs: [], album: [], exam: null, lines: [], log: [], prologue: false, lastBg: '', order: 0, enroll: null, week: 0 };
  }
  function gpa(M, data) {
    let sum = 0, cr = 0;
    for (const [n, c] of Object.entries(M.courses || {})) {
      const g = (c.hist || []).filter(x => GRADE_PT[x] != null);
      if (!g.length) continue;
      const avg = g.reduce((a, x) => a + GRADE_PT[x], 0) / g.length;
      const k = ((data && data.courses) || []).find(x => x.n === n);
      const w = (k && k.cr) || 3;
      sum += avg * w; cr += w;
    }
    return cr ? Math.round(sum / cr * 100) / 100 : null;
  }
  function courseLetter(c) {
    const g = ((c && c.hist) || []).filter(x => GRADE_PT[x] != null);
    if (!g.length) return '';
    return LETTER(g.reduce((a, x) => a + GRADE_PT[x], 0) / g.length);
  }
  // 해석 결과를 기록에 더한다. 돌려주는 값: 화면 알림에 쓸 내용
  function absorb(M, P, data, now) {
    now = now || Date.now();
    const out = { weekChanged: false, affUp: [], newKakao: 0, newRiv: 0, graded: [], enroll: !!P.enroll, needExam: P.needExam };
    const prev = M.status || {};
    const st = Object.assign({}, prev, P.status || {});
    if (P.phone) {
      if (!P.status || !P.status.place) { if (P.phone.place) st.place = P.phone.place; }
      if (P.phone.grade && !(P.status && P.status.grade)) st.grade = P.phone.grade;
      if (P.phone.clock) st.clock = P.phone.clock;
      if (P.phone.nextClass) st.nextClass = P.phone.nextClass;
      if (P.phone.gpaEst) st.gpaEst = P.phone.gpaEst;
    }
    if (P.status && P.status.week && prev.week && P.status.week > prev.week) out.weekChanged = true;
    M.status = st;
    const wk = st.week || 0;
    const log = (t) => M.log.push({ w: wk, t, at: now });
    // 과목
    ((P.status && P.status.courses) || []).forEach(c => {
      const o = M.courses[c.n] || (M.courses[c.n] = { done: 0, of: 4, recent: '', hist: [] });
      if (c.done > o.done && c.recent) { for (let k = o.done; k < c.done - 1; k++) o.hist.push(''); o.hist.push(c.recent); out.graded.push({ n: c.n, g: c.recent, k: c.done }); log(`${c.n} 과제 ${c.done}/${c.of} · ${c.recent}`); }
      else if (c.done === o.done && c.recent && c.recent !== o.recent && o.hist.length) o.hist[o.hist.length - 1] = c.recent;
      o.done = Math.max(o.done, c.done); o.of = c.of || 4; if (c.recent) o.recent = c.recent;
      o.hist = o.hist.slice(0, o.of);
    });
    if (P.status && P.status.courses && P.status.courses.length) M.enrolled = P.status.courses.map(c => c.n);
    // 호감도
    const affs = [].concat((P.status && P.status.aff) || [], (!(P.status && P.status.aff) && P.phone && P.phone.aff) || []);
    affs.forEach(a => {
      const o = M.aff[a.n];
      if (o && (o.v !== a.v || o.e !== a.e)) out.affUp.push({ n: a.n, from: o.v, to: a.v, e: a.e, changed: o.e !== a.e });
      if (!o) out.affUp.push({ n: a.n, from: null, to: a.v, e: a.e, first: true });
      M.aff[a.n] = { e: a.e, v: a.v, at: now, hist: ((o && o.hist) || []).concat([[wk, a.v]]).slice(-40) };
      if (o && o.e !== a.e) log(`${a.n} ${EMO[o.e] || ''} → ${EMO[a.e] || ''}`);
    });
    // 만난 사람
    (P.met || []).forEach(n => { if (!M.met[n]) { M.met[n] = { w: wk, order: ++M.order }; log(`${n} 처음 만남`); } });
    Object.assign(M.face, P.faces || {});
    // 가가오톡
    (P.kakao || []).forEach(k => {
      const room = k.room || k.who || '알 수 없음';
      const list = (M.kakao[room] = M.kakao[room] || []);
      if (k.me) {   // 내가 보낸 말: 앱에서 미리 넣어 둔 같은 말이 있으면 다시 넣지 않는다
        if (list.slice(-6).some(x => x.me && x.t.replace(/\s/g, '') === k.t.replace(/\s/g, ''))) return;
        list.push({ who: k.who, t: k.t, at: now, w: wk, me: true }); M.kakao[room] = list.slice(-200); return;
      }
      list.push({ who: k.who, t: k.t, at: now, w: wk });
      M.kakao[room] = M.kakao[room].slice(-200);
      out.newKakao++;
    });
    // 뤼브리타임
    (P.riv || []).forEach(p => { if (!M.riv.some(x => x.title === p.title && x.body.join() === p.body.join())) { M.riv.unshift(Object.assign({ at: now, w: wk }, p)); out.newRiv++; } });
    M.riv = M.riv.slice(0, 80);
    // 알림 (핸드폰 블록)
    ((P.phone && P.phone.notifs) || []).forEach(n => {
      if (M.notifs.some(x => x.title === n.title)) return;
      M.notifs.unshift(Object.assign({ at: now }, n));
      if (n.app === 'riv' && !M.riv.some(x => x.title === n.title)) { M.riv.unshift({ board: '자유게시판', title: n.title, body: [], cmts: [], who: '익명', at: now, w: wk, peek: true }); out.newRiv++; }
      if (n.app === 'kakao' && n.room) { (M.kakao[n.room] = M.kakao[n.room] || []).push({ who: '', t: n.title, at: now, w: wk }); out.newKakao++; }
    });
    M.notifs = M.notifs.slice(0, 30);
    // 앨범
    (P.imgs || []).forEach(im => {
      if (!im.src || M.album.some(x => x.src === im.src)) return;
      M.album.push({ src: im.src, kind: im.kind || '', who: im.who || '', place: im.place || st.place || '', w: wk, at: now });
    });
    M.album = M.album.slice(-300);
    if (P.enroll) M.enroll = { lines: P.enroll.lines, at: now };
    M.week = wk;
    return out;
  }

  // 학기 몇 주차 → 날짜 (2026-03-02 월요일이 1주차)
  function weekDate(week, day, data) {
    const s = new Date(((data && data.semesterStart) || '2026-03-02') + 'T00:00:00');
    const di = Math.max(0, DAYS.indexOf(day));
    s.setDate(s.getDate() + (Math.max(1, week || 1) - 1) * 7 + di);
    return s;
  }

  // 받침
  function hasBatchim(word) {
    const w = String(word || '').trim();
    const c = w.charCodeAt(w.length - 1);
    if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
    return /[136780lmnr]$/i.test(w);
  }
  const josa = (w, a, b) => w + (hasBatchim(w) ? a : b);

  const api = { Roster, parse, parseStatus, parsePhone, parseAff, parseExam, kakaoInline, absorb, blank, gpa, courseLetter, weekDate, courseOf, josa, hasBatchim, chunk, EMO, GRADE_PT, LETTER, DAYS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionUniv = api;
})(typeof window !== 'undefined' ? window : globalThis);
