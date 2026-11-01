// 플레이팩 「온리펜슬」 — 크랙 응답 해석기 + 주문 잉크 예상 (화면 없이 동작, node 시험 가능)
//  크랙 출력(빌더 v3.1): {{img::이름::상황}} → *상황* → 이름💬 "대사" → *"속마음"* → 상태창
//    상태창(━━━ 사이, 순서 고정):
//      📅 {n}일차 {아침/낮/저녁/밤/심야} | 📍 {장소}
//      👤 {주인공 이름} | 🎚 {NORMAL/GOD/HARD}
//      🖊 잉크 {n}% (GOD ∞, 소멸 후 '소멸') | ⏳ {효과 (남은 턴)}
//      💗 {이름}[🔓] {부호+수치} ({구간}) / ...
//      📜 {이번 턴 변동: 주문 -n% / 리필 +40%}
//    주문 :(내용): · 연락 [카톡] 이름: 내용 · 통화 📞 이름 · EPISODE. n | 제목 · [온리펜슬 | 주인공 등록] 양식
//  그림: data.imgs(빌더 등록명 → 주소)가 있으면 주소 끝 번호로, 없으면 그림 설명(alt)·비율(가로=배경, 세로=인물, 정사각=펜슬)로 짐작
//  숫자는 계산하지 않는다(크랙 상태창 그대로). 주문 잉크는 '예상'만 — 실제 판정은 크랙이 한다.
(function (root) {
  'use strict';
  const ST_RE = /^\s*(📅|📍|👤|🎚|🖊|🖋|✏️|⏳|💗|📜)/u;
  const stripMd = (s) => String(s || '').replace(/\{\{\s*img\s*::[^}]*\}\}/g, '').replace(/\*\*|__/g, '').replace(/(^|[^*])\*(?!\*)/g, '$1').replace(/`/g, '').trim();
  const num = (s) => { const m = String(s || '').replace(/,/g, '').match(/[+-]?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
  const safeDecode = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  const TIMES = ['아침', '낮', '저녁', '밤', '심야'];
  const ZONES = [[-100, '적대'], [-50, '냉소'], [1, '우호'], [51, '신뢰'], [100, '함락']];
  const zoneOf = (v) => { if (v == null) return ''; if (v >= 100) return '함락'; if (v >= 51) return '신뢰'; if (v >= 1) return '우호'; if (v >= -50) return '냉소'; return '적대'; };

  // ---------- 명부 ----------
  function Roster(data) {
    data = data || {};
    this.list = [].concat(data.people || []);
    this.by = {}; this.alias = {};
    this.list.forEach(r => { this.by[r.name] = r; (r.alias || []).concat(r.key ? [r.key] : []).forEach(a => { this.alias[a] = r.name; }); if (r.name.length === 3) this.alias[r.name.slice(1)] = r.name; });
    this.keys = Object.keys(this.by).concat(Object.keys(this.alias)).sort((a, b) => b.length - a.length);
  }
  Roster.prototype.resolve = function (s) {
    const n = String(s || '').replace(/[*_💬:：🔓]/gu, '').trim();
    if (!n) return '';
    const flat = n.replace(/\s/g, '');
    if (this.by[flat]) return flat;
    if (this.alias[flat]) return this.alias[flat];
    const k = this.keys.find(x => flat.startsWith(x) && flat.length - x.length <= 4);   // "아린이", "한채아 씨", "정유나 조교"
    return k ? (this.by[k] ? k : this.alias[k]) : '';
  };
  // 글 속에 나온 인물(성 빼고 불러도) — 주문 대상 세기
  Roster.prototype.mentioned = function (text) {
    const t = String(text || '');
    const out = [];
    this.keys.forEach(k => { if (k.length >= 2 && t.includes(k)) { const n = this.by[k] ? k : this.alias[k]; if (n && !out.includes(n)) out.push(n); } });
    return out;
  };

  // ---------- 그림 ----------
  function ImgIndex(data) {
    const imgs = (data && data.imgs) || {};
    this.byKey = {}; this.byName = imgs; this.keys = [];
    this.people = ((data && data.people) || []).map(p => p.name);
    this.cats = (data && data.imgCats) || {};
    Object.entries(imgs).forEach(([name, url]) => {
      const k = String(url).split('/').pop().replace(/\.(jpe?g|png|webp)$/i, '');
      if (k && k.length >= 12) { this.byKey[k] = name; this.keys.push(k); }
    });
  }
  // 등록명: 박아린_분노 / 배경_자취방 / 온리펜슬_연필  (태그 {{img::A::B}} → A_B)
  ImgIndex.prototype.info = function (name) {
    if (!name) return null;
    const p = String(name).replace(/::/g, '_').split('_').map(x => x.trim());
    if (p.length < 2) return null;
    if (p[0] === '배경') return { name: p.join('_'), kind: 'place', place: p.slice(1).join('_') };
    if (p[0] === '온리펜슬') return { name: p.join('_'), kind: 'pencil', situ: p.slice(1).join('_') };
    if (this.people.includes(p[0])) return { name: p.join('_'), kind: 'person', who: p[0], situ: p.slice(1).join('_'), adult: (this.cats.adult || []).includes(p.slice(1).join('_')) };
    return null;
  };
  ImgIndex.prototype.lookup = function (src, alt) {
    const s = safeDecode(String(src || ''));
    for (const k of this.keys) if (s.includes(k)) return this.info(this.byKey[k]);
    const a = String(alt || '').trim();
    if (a) { const hit = this.info(a); if (hit) return hit; }
    return null;
  };
  ImgIndex.prototype.url = function (name) { return this.byName[name] || ''; };
  const shapeOf = (w, h) => (!w || !h) ? '' : w / h >= 1.25 ? 'wide' : w / h <= 0.88 ? 'tall' : 'square';

  // ---------- 상태창 ----------
  function parseHearts(t, roster) {
    const out = {}, unlock = {};
    String(t || '').replace(/^\s*💗\s*/u, '').split(/\s\/\s|[/｜|·]|\n/).forEach(p => {
      const m = p.match(/([가-힣]{2,4})\s*(🔓)?\s*([+-]?\s*\d{1,3})\s*(?:[(（]\s*([^)）]+?)\s*[)）])?/u);
      if (!m) return;
      const n = roster.resolve(m[1]) || m[1];
      out[n] = Number(m[3].replace(/\s/g, ''));
      if (m[2] || /🔓/u.test(p)) unlock[n] = true;
      if (m[4]) out['@' + n] = m[4].trim();
    });
    return { out, unlock };
  }
  function parseEffects(t) {
    const s = String(t || '').trim();
    if (!s || /^(없음|-|–|—)$/.test(s)) return [];
    // "아린 말 더듬기 (3턴), 꼬리 (영구)" / "아린 말 더듬기 (3턴) / 시간 정지 (1턴)"
    const out = [];
    const re = /([^,，/·]+?)\s*[(（]\s*(영구|\d+\s*턴)\s*[)）]/g;
    let m, got = false;
    while ((m = re.exec(s))) { got = true; out.push({ t: m[1].replace(/^[,，/·\s]+/, '').trim(), left: /영구/.test(m[2]) ? Infinity : num(m[2]) }); }
    if (!got) s.split(/[,，/]/).map(x => x.trim()).filter(Boolean).forEach(x => out.push({ t: x, left: null }));
    return out;
  }
  function parseStatus(lines, roster) {
    const st = {};
    const L = (re) => lines.find(l => re.test(l)) || '';
    const tl = L(/📅|\d+\s*일차/);
    if (tl) {
      const d = tl.match(/(\d+)\s*일차/); if (d) st.day = +d[1];
      const tm = tl.match(/일차\s*([가-힣]{1,3})/); if (tm && TIMES.includes(tm[1])) st.time = tm[1];
      const pl = tl.match(/📍\s*([^|｜\n]+)/u) || tl.split(/[|｜]/)[1] && [0, tl.split(/[|｜]/)[1]];
      if (pl) st.place = String(pl[1]).replace(/^[\s📍]+/u, '').trim();
    }
    if (!st.place) { const p = L(/📍/u); if (p) st.place = p.replace(/^.*📍\s*/u, '').split(/[|｜]/)[0].trim(); }
    const me = L(/👤|🎚/u);
    if (me) {
      const a = me.match(/👤\s*([^|｜\n]+)/u); if (a) st.me = a[1].trim();
      const b = me.match(/🎚\s*([A-Za-z가-힣]+)/u); if (b) st.mode = b[1].toUpperCase();
    }
    const ink = L(/🖊|🖋|잉크/u);
    if (ink) {
      const i = ink.match(/잉크\s*([^|｜\n]+)/) || ink.match(/(?:🖊|🖋)\s*([^|｜\n]+)/u);
      const v = i ? i[1].trim() : '';
      if (/∞|무한|무제한/.test(v)) st.ink = Infinity;
      else if (/소멸|사라|없음/.test(v) && num(v) == null) { st.ink = null; st.gone = true; }
      else if (num(v) != null) st.ink = Math.max(0, Math.min(100, num(v)));
      const e = ink.match(/⏳\s*(.+)$/u);
      st.effects = parseEffects(e ? e[1] : '');
    }
    if (!st.effects) { const e = L(/⏳/u); if (e) st.effects = parseEffects(e.replace(/^.*⏳\s*/u, '')); }
    const ht = lines.filter(l => /💗/u.test(l)).join(' / ');
    if (ht) {
      if (/💗\s*(없음|-)\s*$/u.test(ht.trim())) st.hearts = {};
      else { const h = parseHearts(ht, roster); st.hearts = {}; st.zones = {}; Object.entries(h.out).forEach(([k, v]) => { if (k[0] === '@') st.zones[k.slice(1)] = v; else st.hearts[k] = v; }); st.unlock = h.unlock; }
    }
    const lg = L(/📜/u);
    if (lg) {
      st.ledgerText = lg.replace(/^\s*📜\s*/u, '').trim();
      const sp = st.ledgerText.match(/주문\s*[-−–]\s*(\d+)\s*%?/); if (sp) st.spent = +sp[1];
      const rf = st.ledgerText.match(/리필\s*\+\s*(\d+)\s*%?/); if (rf) st.refill = +rf[1];
      if (/불발/.test(st.ledgerText)) st.fizzle = true;
    }
    return st;
  }

  // ---------- 응답 ----------
  function parse(segs, roster, idx) {
    if (typeof segs === 'string') segs = [{ t: 'text', s: segs }];
    roster = roster || new Roster({});
    idx = idx || new ImgIndex({});
    const lines = [];
    for (const sg of segs || []) {
      if (!sg) continue;
      if (sg.t === 'img') { const info = idx.lookup(sg.src, sg.alt) || {}; lines.push({ img: Object.assign({ src: sg.src, w: sg.w || 0, h: sg.h || 0, alt: sg.alt || '', shape: shapeOf(sg.w, sg.h) }, info) }); continue; }
      String(sg.s || '').split('\n').forEach(s => {
        // 원문 그대로 그림 태그가 글 속에 남아 있으면 그림 자리로
        const tags = [...s.matchAll(/\{\{\s*img\s*::\s*([^:}]+?)\s*::\s*([^}]+?)\s*\}\}/g)];
        tags.forEach(m => { const name = m[1] + '_' + m[2]; const info = idx.info(name) || {}; lines.push({ img: Object.assign({ src: idx.url(name), tag: true, alt: name }, info) }); });
        const rest = tags.length ? s.replace(/\{\{\s*img\s*::[^}]*\}\}/g, '') : s;
        if (!tags.length || rest.trim()) lines.push({ s: rest, code: !!sg.code });
      });
    }
    const drop = new Set();
    const isText = (i) => lines[i] && lines[i].s != null;
    const txt = (i) => (isText(i) ? lines[i].s : '');

    // 1) 상태창: 마지막 📅 n일차 줄부터 이어지는 상태 줄 (━ 줄 포함)
    let status = null;
    const sIdx = lines.map((l, i) => (l.s != null && /📅/u.test(l.s) && /\d+\s*일차/.test(l.s) ? i : -1)).filter(i => i >= 0);
    if (sIdx.length) {
      const a = sIdx[sIdx.length - 1];
      let b = a;
      while (b + 1 < lines.length && isText(b + 1) && (ST_RE.test(txt(b + 1)) || /^\s*[━─=-]{4,}\s*$/.test(txt(b + 1)) || !txt(b + 1).trim() || (lines[a].code && lines[b + 1].code))) b++;
      let a0 = a; while (a0 - 1 >= 0 && isText(a0 - 1) && /^\s*[━─=-]{4,}\s*$/.test(txt(a0 - 1))) a0--;
      const blk = [];
      for (let i = a0; i <= b; i++) { drop.add(i); if (txt(i).trim()) blk.push(txt(i)); }
      status = parseStatus(blk, roster);
    }
    // 2) 주인공 등록 양식(프롤로그) — 화면에선 빼고 표시만
    let reg = false;
    lines.forEach((l, i) => {
      if (drop.has(i) || l.s == null) return;
      if (/\[\s*온리펜슬\s*[|｜]\s*주인공\s*등록\s*\]/.test(l.s)) { reg = true; drop.add(i); for (let j = i + 1; j < lines.length && isText(j) && /^\s*(이름|외형|성격)\s*[:：]|^\s*```|^\s*$/.test(txt(j)); j++) { drop.add(j); if (!txt(j).trim() && j > i + 3) break; } }
      if (/첫 메시지로 아래 양식을 보내면|주인공이 확정됩니다/.test(l.s)) { reg = true; drop.add(i); }
    });

    // 3) 장면
    const beats = [], imgs = [], kakao = [];
    let pend = [];
    const pushBeat = (b) => { if (pend.length) { b.imgs = pend; pend = []; } beats.push(b); return b; };
    lines.forEach((l, i) => {
      if (drop.has(i)) return;
      if (l.img) { pend.push(l.img); imgs.push(l.img); return; }
      const raw = l.s, s = raw.trim();
      if (!s || /^[-━─=_\\]{1,}$/.test(s) || /^```/.test(s)) return;
      if (ST_RE.test(s) && l.code) return;
      // 카톡: [카톡] 이름: 내용
      const kt = stripMd(s).match(/^\[\s*(카톡|문자|DM)\s*\]\s*([^:：]{1,12})\s*[:：]\s*(.*)$/);
      if (kt) { const who = roster.resolve(kt[2]) || kt[2].trim(); const k = { kind: 'kakao', app: kt[1], who, known: !!roster.resolve(kt[2]), text: kt[3].trim() }; kakao.push(k); pushBeat(k); return; }
      const call = stripMd(s).match(/^📞\s*([가-힣A-Za-z]{1,12})\s*(.*)$/u);
      if (call) { const who = roster.resolve(call[1]) || call[1]; pushBeat({ kind: 'call', who, known: !!roster.resolve(call[1]), text: call[2].replace(/^[-–—:：\s]+/, '').trim() || '전화가 걸려 온다' }); return; }
      const say = sayLine(raw, roster);
      if (say) { pushBeat(say); return; }
      const ep = stripMd(s).match(/^EPISODE\.?\s*(\d+)\s*[|｜]\s*(.+)$/i);
      if (ep) { pushBeat({ kind: 'title', ep: ep[1], text: ep[2].trim() }); return; }
      // 주문: :(내용):  — 한 줄에 글과 섞여 있으면 따로 뗀다
      const sp = s.match(/:\(\s*([^)]*?(?:\([^)]*\)[^)]*?)*)\s*\):/);
      if (sp) {
        const before = stripMd(s.slice(0, sp.index)), after = stripMd(s.slice(sp.index + sp[0].length));
        if (before) chunk(before, 130).forEach(t => pushBeat(narrOrThink(t)));
        pushBeat({ kind: 'spell', text: sp[1].trim() });
        if (after) chunk(after, 130).forEach(t => pushBeat(narrOrThink(t)));
        return;
      }
      const c = stripMd(s);
      if (!c) return;
      if (/^[(（].*[)）]$/.test(c) && c.length < 70) { pushBeat({ kind: 'sys', text: c.replace(/^[(（]|[)）]$/g, '') }); return; }
      chunk(c, 130).forEach(t => pushBeat(narrOrThink(t)));
    });
    if (pend.length) { if (beats.length) beats[beats.length - 1].imgsAfter = pend; else beats.push({ kind: 'narr', text: '', imgs: pend }); pend = []; }

    // 그림 붙이기 — 등록명을 알면 그대로, 모르면 비율과 다음 화자로 짐작
    beats.forEach((b, i) => {
      const ims = b.imgs || [];
      ims.forEach(im => {
        let k = im.kind;
        if (!k) k = im.shape === 'wide' ? 'place' : im.shape === 'square' ? 'pencil' : im.shape === 'tall' ? 'person' : '';
        if (!k) {   // 크기도 모르면: 바로 뒤(2마디 안)에 누가 말하면 인물, 아니면 배경
          const n = beats.slice(i, i + 2).find(x => x.kind === 'say' && x.known);
          k = n ? 'person' : 'place';
        }
        im.guess = !im.kind; im.kind = k;
        if (k === 'person' && !im.who) { const n = beats.slice(i, i + 3).find(x => (x.kind === 'say' || x.kind === 'kakao' || x.kind === 'call') && x.known); if (n) im.who = n.who; }
      });
      const pl = ims.filter(x => x.kind === 'place').pop();
      if (pl) { b.bg = pl.src; if (pl.place) b.place = pl.place; }
      const ps = ims.filter(x => x.kind === 'person');
      const mine = b.kind === 'say' ? ps.filter(x => x.who === b.who).pop() : null;
      const p = mine || ps.pop();
      if (p) { b.portrait = p.src; b.pinfo = p; }
      const pen = ims.filter(x => x.kind === 'pencil').pop();
      if (pen) b.pencil = pen;
    });
    // 묘사 줄에 붙은 인물 그림은, 바로 뒤(3마디 안)에 그 사람이 말하면 그 대사에도
    beats.forEach((b, i) => {
      if (b.kind === 'say' || !b.pinfo || !b.pinfo.who) return;
      for (let j = i + 1; j < Math.min(beats.length, i + 4); j++) {
        const n = beats[j];
        if (n.kind === 'say' && n.who === b.pinfo.who) { if (!n.portrait) { n.portrait = b.portrait; n.pinfo = b.pinfo; } break; }
        if (n.portrait) break;
      }
    });
    const prologue = reg || beats.some(b => b.kind === 'title' && b.ep === '1') && beats.some(b => b.kind === 'spell');
    const text = beats.map(b => (b.who ? b.who + ' ' : '') + (b.text || '')).join('\n');
    return { status, beats, imgs, kakao, reg, prologue, text, spells: beats.filter(b => b.kind === 'spell').map(b => b.text) };
  }
  function narrOrThink(t) {
    // 속마음 *"..."* → 따옴표만 남은 줄
    const m = t.match(/^["“]([^"”]+)["”]$/);
    return m ? { kind: 'think', text: m[1].trim() } : { kind: 'narr', text: t };
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
    let act = '';
    rest = rest.replace(/^\s*\*\*(?!\*)/, '');
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

  // ---------- 주문 잉크 예상 (메인 '펜슬' 규칙을 그대로 옮긴 것 — 판정은 크랙이 한다) ----------
  const TIERS = {
    small: { t: '소환·사소한 변화', lo: 10, hi: 30, c: '#7fb6a4' },
    body: { t: '몸·행동·지속 효과', lo: 30, hi: 50, c: '#d9a35b' },
    mind: { t: '마음 조종', lo: 50, hi: 75, c: '#e66f96' },
    life: { t: '생물 창조', lo: 100, hi: 100, c: '#9b7bff' }
  };
  const RE_LIFE = /(강아지|고양이|새끼|동물|생물|사람|아기|애완|펫|햄스터|토끼).{0,12}(나타|생긴|생겨|만들|태어|소환|창조)|(창조|탄생)/;
  const RE_MIND = /(좋아하|좋아지|사랑|반하|반한|설레|두근|흥분|발정|감정|기억|잊어|잊는|잊게|착각|믿게|믿는다|느끼게|민감|질투|호감|그리워|보고\s*싶|끌리|빠지|매료|외로|부끄러워하|수치심|애정|집착|싶어진|싶어한|싶게|하고\s*싶|최면|세뇌|인식)/;
  const RE_BODY = /(턴간|턴\s*동안|동안|말을?\s*더듬|따라\s*하|복종|솔직|명령|움직이|멈추|몸|키가|가슴|꼬리|귀가|머리카락|옷이?\s*(바뀌|변|사라|벗)|변한|변해|변신|되어|된다|순간이동|이동한다|투명|안\s*보|보이지|시간\s*정지|시간이\s*멈|되돌|속마음|들린|체력|정력|강화|목소리|넘어|미끄러|재채기|딸꾹|잠이?\s*든|잠든다|취한|술에|힘이)/;
  const RE_META = /(호감도?|잉크|수치|확률|규칙|스탯|레벨)\s*(을|를|가|이|는)?\s*[+-]?\s*\d+|(호감도?|잉크)\s*(최대|만땅|가득|100)/;
  // N4 판정 사례(빌더 노트) — 정확히 맞으면 그 값
  const CASES = [[/되돌리|되감/, 70, 'body'], [/시간\s*(정지|이?\s*멈)/, 50, 'body'], [/속마음이?\s*들/, 40, 'body'], [/솔직히?\s*답/, 35, 'body'], [/순간\s*이동|으로\s*이동한다/, 30, 'body'], [/(체력|정력).{0,6}강화/, 30, 'body'], [/(안\s*보|투명)/, 25, 'small'], [/옷.{0,6}사라/, 20, 'small'], [/(사과|동전|지폐|컵라면)\s*(하나|한\s*개|한\s*장)?/, 10, 'small']];
  function estimate(spell, opt) {
    opt = opt || {};
    const s = String(spell || '').replace(/^:\(|\):$/g, '').trim();
    const mode = String(opt.mode || 'NORMAL').toUpperCase();
    const out = { text: s, tier: '', lo: 0, hi: 0, cost: 0, targets: [], warn: [], turns: null, forever: false, god: mode === 'GOD' };
    if (!s) return out;
    const tm = s.match(/(\d+)\s*턴/); out.turns = tm ? +tm[1] : null;
    out.forever = /영구|영원히|평생|계속/.test(s) || (!tm && !/동안|잠깐|잠시|한\s*번/.test(s));
    let tier = RE_LIFE.test(s) ? 'life' : RE_MIND.test(s) ? 'mind' : RE_BODY.test(s) ? 'body' : 'small';
    let pin = null;
    if (tier !== 'life' && tier !== 'mind') { const c = CASES.find(([re]) => re.test(s)); if (c) { pin = c[1]; tier = c[2]; } }
    out.tier = tier;
    const T = TIERS[tier];
    out.lo = T.lo; out.hi = T.hi;
    // 대상: 이름이 둘 이상이면 1명당 +10%
    out.targets = opt.roster ? opt.roster.mentioned(s) : [];
    const extra = Math.max(0, out.targets.length - 1) * 10;
    // 관대한 판정: 구간 안에서 낮게. 길고 클수록 위쪽
    let base = pin != null ? pin : T.lo;
    if (pin == null && tier === 'body' && (out.turns >= 10 || (out.forever && !tm))) base = Math.min(T.hi, T.lo + 10);
    if (pin == null && tier === 'mind') base = out.turns && out.turns <= 2 ? 50 : out.turns >= 5 || !out.turns ? 75 : 60;
    if (pin == null && tier === 'small' && /가득|잔뜩|전부|모든|엄청|최고급|명품|수백|수천|수억/.test(s)) base = 20;
    let cost = base + extra;
    if (mode === 'HARD') cost = Math.ceil(cost * 1.5 / 5) * 5;
    out.cost = tier === 'life' ? 100 : cost;
    // 경고
    if (RE_META.test(s)) out.warn.push({ k: 'meta', t: '호감도·잉크 같은 수치를 정하는 주문은 이뤄지지 않아요' });
    if (mode !== 'GOD') {
      if (tier === 'mind' && (out.forever || (out.turns && out.turns > 5))) out.warn.push({ k: 'mind5', t: '마음 조종은 최대 5턴까지예요. 영구로는 안 돼요' });
      if (tier === 'life' && opt.ink != null && opt.ink < 100) out.warn.push({ k: 'life', t: '살아 있는 생물은 잉크가 100%일 때만, 전부 써서 만들어요' });
      if (opt.ink != null && isFinite(opt.ink) && out.cost > opt.ink) out.warn.push({ k: 'short', t: opt.ink <= 0 ? '잉크가 없어서 글자가 스며들지 않아요(불발)' : `잉크가 모자라요 — ${opt.ink}%만 쓰고 약하게·짧게만 이뤄져요` });
      if (mode === 'HARD' && out.cost > 100) out.warn.push({ k: 'over', t: 'HARD에서 100%를 넘는 주문은 잔량 부족으로 처리돼요' });
      if (/절정/.test(s)) out.warn.push({ k: 'refill', t: '주문으로 곧바로 절정시키면 잉크가 충전되지 않아요' });
    }
    if (mode === 'GOD') out.cost = 0;
    return out;
  }

  // ---------- 기억에 합치기 (계산 없음 — 상태창 그대로) ----------
  function blank() {
    return { status: {}, hearts: {}, zones: {}, unlock: {}, met: [], seen: {}, faces: {}, lines: [], spells: [], chats: {}, days: {}, hist: {}, turns: 0, inkHist: [], lastBg: '', prologue: false, reg: false, refills: 0 };
  }
  function absorb(M, P, opt) {
    opt = opt || {};
    const ev = { heart: [], day: null, time: null, spent: null, refill: null, fizzle: false, effectsNew: [], effectsEnd: [], unlocked: [], fall: [], met: [], kakao: [], gone: false, place: null, mode: null };
    M.turns = (M.turns || 0) + 1;
    const st = P.status;
    if (st) {
      const prev = M.status || {};
      if (st.day != null && prev.day != null && st.day > prev.day) ev.day = { from: prev.day, to: st.day };
      if (st.time && prev.time && st.time !== prev.time) ev.time = { from: prev.time, to: st.time };
      if (st.place && prev.place && st.place !== prev.place) ev.place = { from: prev.place, to: st.place };
      if (st.mode && st.mode !== prev.mode) ev.mode = st.mode;
      if (st.gone && !prev.gone) ev.gone = true;
      if (st.spent != null) ev.spent = st.spent;
      if (st.refill != null) { ev.refill = st.refill; M.refills = (M.refills || 0) + 1; }
      if (st.fizzle) ev.fizzle = true;
      const pe = (prev.effects || []).map(e => e.t), ne = (st.effects || []).map(e => e.t);
      ev.effectsNew = (st.effects || []).filter(e => !pe.includes(e.t));
      ev.effectsEnd = (prev.effects || []).filter(e => !ne.includes(e.t));
      if (st.hearts) Object.entries(st.hearts).forEach(([n, v]) => {
        const was = M.hearts[n];
        if (was == null) { if (!M.met.includes(n)) { M.met.push(n); ev.met.push(n); } }
        else if (v !== was) ev.heart.push({ n, from: was, to: v, zone: zoneOf(v), zoneChanged: zoneOf(v) !== zoneOf(was) });
        if (v >= 100 && (was == null || was < 100)) ev.fall.push(n);
        M.hearts[n] = v;
      });
      if (st.zones) Object.assign(M.zones, st.zones);
      if (st.unlock) Object.keys(st.unlock).forEach(n => { if (!M.unlock[n]) { M.unlock[n] = true; ev.unlocked.push(n); } });
      M.status = Object.assign({}, prev, st, { hearts: Object.assign({}, prev.hearts || {}, st.hearts || {}) });
      if (st.ink !== undefined || st.gone) { M.inkHist = M.inkHist || []; const v = st.gone ? -1 : st.ink === Infinity ? 999 : st.ink; const last = M.inkHist[M.inkHist.length - 1]; if (!last || last[1] !== v) M.inkHist.push([M.turns, v]); if (M.inkHist.length > 80) M.inkHist.splice(0, M.inkHist.length - 80); }
    }
    // 대사에 처음 나온 인물(상태창 💗보다 먼저 만날 수도)
    (P.beats || []).forEach(b => { if ((b.kind === 'say' || b.kind === 'kakao' || b.kind === 'call') && b.known && !M.met.includes(b.who)) { M.met.push(b.who); ev.met.push(b.who); } });
    // 주문 기록: 이번 턴에 보낸 주문(opt.sent) + 크랙이 쓴 주문 → 📜 주문 -n%
    const sent = (opt.sent || []).filter(Boolean);
    const told = (P.spells || []).filter(t => !sent.includes(t));
    const list = sent.length ? sent : ev.spent != null ? told.slice(0, 1) : [];   // 프롤로그처럼 이야기 속 주문(소모 없음)은 장부에 안 적는다
    if (list.length || ev.spent != null) {
      const share = list.length ? Math.round((ev.spent || 0) / list.length) : 0;
      (list.length ? list : ['(주문)']).forEach(t => M.spells.push({ t, cost: ev.spent != null ? share : null, fizzle: ev.fizzle, d: (M.status && M.status.day) || 0, time: (M.status && M.status.time) || '', turn: M.turns, mode: (M.status && M.status.mode) || '' }));
      if (M.spells.length > 300) M.spells.splice(0, M.spells.length - 300);
    }
    // 카톡
    (P.kakao || []).forEach(k => { const c = M.chats[k.who] = M.chats[k.who] || []; c.push({ t: k.text, d: (M.status && M.status.day) || 0, time: (M.status && M.status.time) || '', app: k.app }); if (c.length > 120) c.splice(0, c.length - 120); ev.kakao.push(k); });
    // 관계 추이
    M.hist = M.hist || {};
    Object.keys(M.hearts).forEach(n => { const h = M.hist[n] = M.hist[n] || []; const v = M.hearts[n]; const last = h[h.length - 1]; if (!last || last[1] !== v) h.push([M.turns, v]); if (h.length > 60) h.splice(0, h.length - 60); });
    // 하루 기록
    M.days = M.days || {};
    const dk = String((M.status && M.status.day) || 0);
    const day = M.days[dk] = M.days[dk] || { places: [], met: [], notes: [], spells: 0, ink: 0 };
    const pl = M.status && M.status.place; if (pl && !day.places.includes(pl)) day.places.push(pl);
    (P.beats || []).forEach(b => { if (b.kind === 'say' && b.known && !day.met.includes(b.who)) day.met.push(b.who); });
    const note = (t) => { if (day.notes.length < 30) day.notes.push(t); };
    ev.heart.forEach(a => { if (a.zoneChanged) note(`${a.n} — ${a.zone}`); });
    ev.unlocked.forEach(n => note(`${n} — 마음의 벽이 열림 🔓`));
    ev.fall.forEach(n => note(`${n} — 함락`));
    if (list.length) { day.spells += list.length; day.ink += ev.spent || 0; }
    if (ev.refill) note(`잉크 충전 +${ev.refill}%`);
    if (ev.gone) note('온리펜슬이 평범한 연필이 됨');
    if (!day.first) { const nb = (P.beats || []).find(b => b.kind === 'narr' && b.text && b.text.length > 12); if (nb) day.first = nb.text.slice(0, 90); }
    // 본 그림 · 인물별 최근 얼굴
    (P.imgs || []).forEach(im => { if (im.name) M.seen[im.name] = M.seen[im.name] || Date.now(); if (im.kind === 'person' && im.who && im.src && !im.adult) M.faces[im.who] = im.src; });
    if (P.reg) M.reg = true;
    return ev;
  }

  const api = { Roster, ImgIndex, parse, parseStatus, parseEffects, absorb, blank, estimate, zoneOf, sayLine, stripMd, TIERS, TIMES, ZONES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionPencil = api;
})(typeof window !== 'undefined' ? window : globalThis);
