// 플레이팩 「소환수 아카데미」 응답 해석 (화면 없이 동작 → node 시험 가능: test/academy.test.js)
//  입력: 크랙 응답 글 (그림은 {t:'img'} 조각으로 따로)
//  출력: 장면(대사·서술) · 상태창 · 전투창 · 도감/배지 코드 · 행동 힌트 · 【CRION】 블록
//  작품 자료(계열·인물·배지)는 팩의 data.json 을 받아 쓴다. 숨은 값(유대·호감)은 다루지 않는다.
(function (root) {
  'use strict';

  const DIVIDER = /^\s*[━─═]{6,}\s*$/;
  const IMG_TOKEN = /\{\{\s*img\s*::([^}]*)\}\}/gi;
  const STAGES = ['기본', '1진화', '최종'];
  const stageNo = (s) => { const i = STAGES.indexOf(String(s || '').trim()); return i < 0 ? (/최종/.test(s) ? 3 : /1진/.test(s) ? 2 : 1) : i + 1; };
  const num = (s) => { const n = Number(String(s).replace(/[^\d.-]/g, '')); return isFinite(n) ? n : 0; };

  // ---------- 작품 자료 색인 ----------
  function Dex(data) {
    this.data = data || { lineages: [], legends: [], people: [], badges: [] };
    this.byName = new Map();          // 계열 이름(아무 단계) → { lin, stage }
    for (const l of (this.data.lineages || []).concat(this.data.legends || [])) {
      (l.names || [l.base]).forEach((n, i) => this.byName.set(n, { lin: l, stage: l.legend ? 3 : i + 1 }));
    }
    this.people = new Map((this.data.people || []).map(p => [p.name, p]));
  }
  // "야생 월리" · "템퍼" · "위카(위카·기본)" 같은 글에서 소환수 찾기
  Dex.prototype.find = function (text) {
    const t = String(text || '').replace(/^(야생|폭주한|교수|상대|적)\s*/, '').trim();
    if (this.byName.has(t)) return this.byName.get(t);
    let best = null;
    for (const [n, v] of this.byName) if (t.includes(n) && (!best || n.length > best.n.length)) best = { n, v };
    return best ? best.v : null;
  };
  Dex.prototype.lineage = function (base) { const h = this.byName.get(base); return h ? h.lin : null; };
  // 인물 이름 (호칭 '교수'·'선배' 등을 떼고)
  Dex.prototype.person = function (name) {
    const n = String(name || '').replace(/\s*(교수님?|선배님?|학장님?|씨|군|양)$/, '').trim();
    if (this.people.has(n)) return this.people.get(n);
    for (const p of this.people.values()) if (p.full && (p.full === n || p.full.startsWith(n + ' '))) return p;
    return null;
  };
  // 상성 배율: 공격 속성 → 방어 속성
  Dex.prototype.mult = function (atk, def) {
    const c = this.data.chart || {};
    if (!atk || !def) return 1;
    if ((c[atk] || []).includes(def)) return 1.5;
    if ((c[def] || []).includes(atk) && atk !== '빛' && atk !== '어둠') return 0.5;
    return 1;
  };
  // 포획 성공률 추정 (메인 프롬프트 규칙: HP 30% 이하에서만, 상한 95%)
  Dex.prototype.capture = function (rarity, hpPct, opt) {
    const base = (this.data.capture || {})[rarity];
    if (base == null || hpPct > 0.3) return null;
    let p = base + (hpPct <= 0.1 ? 20 : 0) + (opt && opt.ailment ? 10 : 0) + (opt && opt.hi ? 20 : 0);
    return Math.min(95, p);
  };
  // 도감 번호 (계열 1~26 × 3단계 = 1~78, 전설 79·80)
  Dex.prototype.no = function (base, stage) {
    const l = this.lineage(base);
    if (!l) return 0;
    return l.legend ? l.no : l.no + (stage - 1);
  };
  Dex.prototype.imgKey = function (base, stage, situ) {
    const l = this.lineage(base);
    if (!l) return '';
    return `s/${l.base}_${STAGES[(l.legend ? 3 : stage) - 1]}${situ || '평상시'}.webp`;
  };

  // ---------- 상태창 ----------
  function parseSkills(line) {
    const out = [];
    const re = /([^()]*?)\(\s*(⚔️|💫|✨)\s*([0-9×]*)\s*\|\s*(\d+)\s*(?:\/\s*(\d+))?\s*([^)]*)\)/gu;
    let m;
    while ((m = re.exec(line))) {
      const pre = m[1].split(/\s*\/\s*/);
      const name = pre.pop().replace(/^[\s,·:]+|[\s,·]+$/g, '').replace(/^기술\s*[:：]\s*/, '');
      if (pre.length && out.length) { const extra = pre.join(' ').trim(); if (extra) out[out.length - 1].eff = (out[out.length - 1].eff + ' ' + extra).trim(); }
      if (!name) continue;
      const left = Number(m[4]), max = m[5] != null ? Number(m[5]) : null;
      out.push({ name, kind: { '⚔️': '물리', '💫': '특수', '✨': '보조' }[m[2]], icon: m[2], power: m[3] || '', left: max == null ? left : left, max: max == null ? left : max, eff: (m[6] || '').trim() });
    }
    // 마지막 기술 뒤에 붙은 효과 글 (괄호 밖)
    const tail = /\)\s*([^()\/]+)$/.exec(line);
    if (tail && out.length && !/\(/.test(tail[1])) out[out.length - 1].eff = (out[out.length - 1].eff + ' ' + tail[1].trim()).trim();
    return out;
  }

  // 괄호 밖 쉼표로 나누기: "털뭉치 박치기(폭신한 털뭉치로, 들이받는다), 자장가(…)"
  function splitTop(s) {
    const out = []; let d = 0, b = '';
    for (const ch of s) {
      if ('(（'.includes(ch)) d++; else if (')）'.includes(ch)) d = Math.max(0, d - 1);
      if (d === 0 && ',，、'.includes(ch)) { if (b.trim()) out.push(b.trim()); b = ''; } else b += ch;
    }
    if (b.trim()) out.push(b.trim());
    return out;
  }
  // 설명형 기술 "이름(설명)" — 위력·횟수는 도감 자료에서 이름으로 찾아 채운다
  function parseSkillsLoose(line, dex, base) {
    const lin = dex && base ? dex.lineage(base) : null;
    const known = lin && lin.skills ? [].concat(...Object.values(lin.skills)) : [];
    return splitTop(line).map(x => {
      const m = /^(.+?)\s*[(（](.*)[)）]\s*$/.exec(x);
      const name = (m ? m[1] : x).trim(), eff = m ? m[2].trim() : '';
      const k = known.find(z => z.name === name || name.includes(z.name) || z.name.includes(name));
      const kind = k ? k.kind : (/궁극/.test(eff) ? '특수' : /회복|경감|재운|올린|낮춘|막는|방벽|보호/.test(eff) ? '보조' : '물리');
      return { name, kind, icon: { 물리: '⚔️', 특수: '💫', 보조: '✨' }[kind] || '✨', power: k && k.power ? String(k.power) : '', left: null, max: k && k.pp ? Number(k.pp) : null, eff, ult: /궁극/.test(eff) };
    }).filter(x => x.name);
  }
  // 한 조각(📅 · 📍 · 💰 · 🎒 · 📦 · 📖 · 🏅 · 📜 · 🗓 · 🎓 · 🏠)을 상태에 넣는다
  function statusPart(st, part) {
    const t = part.trim(); let m;
    if (/^📅/.test(t)) {
      const d = t.replace(/^📅\s*/, '');
      m = /(\d)\s*학년\s*(봄|여름|가을|겨울)\s*(\d+)\s*일차\s*(오전|오후|저녁|밤|아침|새벽|점심)?/.exec(d);
      if (m) Object.assign(st, { year: Number(m[1]), season: m[2], day: Number(m[3]), time: m[4] || '' });
      st.dateText = d.trim(); return true;
    }
    if (/^📍/.test(t)) { st.place = t.replace(/^📍\s*/, '').trim(); return true; }
    if (/^🎓/.test(t)) { st.student = t.replace(/^🎓\s*/, '').trim(); return true; }
    if (/^🏠/.test(t)) { st.dorm = t.replace(/^🏠\s*/, '').trim(); return true; }
    if (/^💰/.test(t)) {
      const s2 = t.replace(/^💰\s*/, '');
      const g = /(\d+)\s*금/.exec(s2), sv = /(\d+)\s*은/.exec(s2), c = /(\d+)\s*동/.exec(s2);
      st.money = { gold: g ? Number(g[1]) : 0, silver: sv ? Number(sv[1]) : 0, copper: c ? Number(c[1]) : 0, text: s2.trim() }; return true;
    }
    if (/^🎒/.test(t)) {
      const s2 = t.replace(/^🎒\s*/, '').trim();
      st.items = /^(없음|-|—)?$/.test(s2) ? [] : s2.split(/\s*[,，、]\s*/).filter(Boolean).map(x => {
        const q = /^(.+?)\s*[×x*]\s*(\d+)$/.exec(x);
        return q ? { name: q[1].trim(), n: Number(q[2]) } : { name: x.trim(), n: 1 };
      }); return true;
    }
    if (/^📦/.test(t) && (m = /(\d+)\s*\/\s*(\d+)/.exec(t))) { st.contract = { n: Number(m[1]), max: Number(m[2]) }; return true; }
    if (/^📖/.test(t) && (m = /(\d+)\s*\/\s*(\d+)/.exec(t))) { st.dex = { n: Number(m[1]), max: Number(m[2]) }; return true; }
    if (/^🏅/.test(t) && (m = /(\d+)\s*\/\s*(\d+)/.exec(t))) { st.badges = { n: Number(m[1]), max: Number(m[2]) }; return true; }
    if (/^📜/.test(t)) { const q = t.replace(/^📜\s*(의뢰)?\s*[:：]?\s*/, '').trim(); st.quests = /^(없음|-|—)?$/.test(q) ? [] : q.split(/\s*[,/]\s*/).filter(Boolean); return true; }
    if (/^🗓/.test(t)) {
      const q = t.replace(/^🗓️?\s*(다음\s*일정)?\s*[:：]?\s*/u, '').trim();
      const d = /D\s*-\s*(\d+)/i.exec(q);
      st.next = { text: q.replace(/\s*D\s*-\s*\d+/i, '').trim(), d: d ? Number(d[1]) : null }; return true;
    }
    return false;
  }
  function parseStatusLines(lines, dex) {
    const st = { partners: [] };
    let cur = null;
    for (const raw of lines) {
      const l = raw.replace(/\*\*/g, '').trim();
      if (!l || DIVIDER.test(l)) continue;
      let m;
      // 🐾 줄이 아니면: '|'로 나눈 조각마다 이모지로 판단 (한 줄에 📅|📍|💰 처럼 섞여 나와도 됨)
      if (!/^🐾/.test(l) && /^(📅|📍|🎓|🏠|💰|🎒|📦|📖|🏅|📜|🗓)/u.test(l)) {
        for (const part of l.split(/\s*[|｜]\s*/)) statusPart(st, part);
        if (/^(📦|📖|🏅|📜|🗓)/u.test(l)) cur = null;
        continue;
      }
      if (/^📍/.test(l)) { st.place = l.replace(/^📍\s*/, '').trim(); continue; }
      if (/^🎓/.test(l)) {
        for (const part of l.split(/\s*\|\s*/)) {
          if (/^🎓/.test(part)) st.student = part.replace(/^🎓\s*/, '').trim();
          else if (/^🏠/.test(part)) st.dorm = part.replace(/^🏠\s*/, '').trim();
          else if (/^💰/.test(part)) {
            const s = part.replace(/^💰\s*/, '');
            const g = /(\d+)\s*금/.exec(s), sv = /(\d+)\s*은/.exec(s), c = /(\d+)\s*동/.exec(s);
            st.money = { gold: g ? Number(g[1]) : 0, silver: sv ? Number(sv[1]) : 0, copper: c ? Number(c[1]) : 0, text: s.trim() };
          } else if (/^🎒/.test(part)) {
            const s = part.replace(/^🎒\s*/, '').trim();
            st.items = /^(없음|-|—)?$/.test(s) ? [] : s.split(/\s*[,，、]\s*/).filter(Boolean).map(x => {
              const q = /^(.+?)\s*[×x*]\s*(\d+)$/.exec(x);
              return q ? { name: q[1].trim(), n: Number(q[2]) } : { name: x.trim(), n: 1 };
            });
          }
        }
        continue;
      }
      if (/^🐾/.test(l)) {
        cur = { raw: l, skills: [], ailment: '' };
        const head = l.replace(/^🐾\s*/, '').split(/\s*\|\s*/);
        m = /^(.+?)\s*\(\s*([^·()]+?)\s*·\s*([^()]+?)\s*\)\s*(?:Lv\.?\s*(\d+))?/.exec(head[0]);
        if (m) { cur.nick = m[1].trim(); cur.base = m[2].trim(); cur.stageName = m[3].trim(); cur.stage = stageNo(m[3]); cur.lv = m[4] ? Number(m[4]) : 0; }
        else { const n = /^(.+?)\s*(?:Lv\.?\s*(\d+))?$/.exec(head[0]); cur.nick = n[1].trim(); cur.lv = n[2] ? Number(n[2]) : 0; const f = dex && dex.find(cur.nick); if (f) { cur.base = f.lin.base; cur.stage = f.stage; } }
        { const g0 = /❤️?\s*(\d+)\s*\/\s*(\d+)/u.exec(head[0]); if (g0) { cur.hp = Number(g0[1]); cur.hpMax = Number(g0[2]); } }
        // 기술 목록 안의 '|'는 조각을 나누지 않게: '기술:' 뒤는 통째로
        { const ki = l.search(/[|｜]\s*기술\s*[:：]/); if (ki >= 0) { cur.skillsRaw = l.slice(ki).replace(/^[|｜]\s*기술\s*[:：]\s*/, ''); head.splice(1, head.length, ...l.slice(0, ki).replace(/^🐾\s*/, '').split(/\s*\|\s*/).slice(1)); } }
        for (const part of head.slice(1)) {
          let g;
          if (/^기술\s*[:：]/.test(part)) { cur.skillsRaw = part.replace(/^기술\s*[:：]\s*/, ''); continue; }
          if ((g = /Lv\.?\s*(\d+)/.exec(part)) && !cur.lv) cur.lv = Number(g[1]);
          if ((g = /❤️?\s*(\d+)\s*\/\s*(\d+)/u.exec(part))) { cur.hp = Number(g[1]); cur.hpMax = Number(g[2]); }
          else if ((g = /XP\s*(\d+)\s*\/\s*(\d+)/i.exec(part))) { cur.xp = Number(g[1]); cur.xpMax = Number(g[2]); }
        }
        if (dex && cur.base) {
          const lin = dex.lineage(cur.base);
          if (lin) { cur.el = lin.el; cur.rarity = lin.rarity; cur.formName = (lin.names || [])[cur.stage - 1] || cur.base; }
        }
        if (cur.skillsRaw) { const s1 = parseSkills(cur.skillsRaw); cur.skills = s1.length ? s1 : parseSkillsLoose(cur.skillsRaw, dex, cur.base); }
        st.partners.push(cur);
        continue;
      }
      if (cur && /^(공|HP)\s*\d/.test(l)) {
        const [s, a] = l.split(/\s*\|\s*/);
        const g = (k) => { const x = new RegExp('(?:^|\\s)' + k + '\\s*(\\d+)').exec(s); return x ? Number(x[1]) : null; };
        cur.stats = { atk: g('공'), def: g('방'), spa: g('특공'), spd: g('특방'), spe: g('속') };
        cur.ailment = a && !/^(없음|-|—|정상)$/.test(a.trim()) ? a.trim() : '';
        continue;
      }
      if (cur && /^기술\s*[:：]/.test(l)) { const r = l.replace(/^기술\s*[:：]\s*/, ''); const s1 = parseSkills(r); cur.skills = s1.length ? s1 : parseSkillsLoose(r, dex, cur.base); continue; }
      if (/^📦|📖|🏅/.test(l)) {
        if ((m = /계약\s*(\d+)\s*\/\s*(\d+)/.exec(l))) st.contract = { n: Number(m[1]), max: Number(m[2]) };
        if ((m = /도감\s*(\d+)\s*\/\s*(\d+)/.exec(l))) st.dex = { n: Number(m[1]), max: Number(m[2]) };
        if ((m = /배지\s*(\d+)\s*\/\s*(\d+)/.exec(l))) st.badges = { n: Number(m[1]), max: Number(m[2]) };
        cur = null;
        continue;
      }
      if (/^📜|🗓/.test(l)) {
        for (const part of l.split(/\s*\|\s*/)) {
          if (/^📜/.test(part)) { const q = part.replace(/^📜\s*의뢰\s*[:：]?\s*/, '').trim(); st.quests = /^(없음|-|—)?$/.test(q) ? [] : q.split(/\s*[,/]\s*/).filter(Boolean); }
          else if (/^🗓/.test(part)) {
            const q = part.replace(/^🗓️?\s*다음\s*일정\s*[:：]?\s*/u, '').trim();
            const d = /D\s*-\s*(\d+)/i.exec(q);
            st.next = { text: q.replace(/\s*D\s*-\s*\d+/i, '').trim(), d: d ? Number(d[1]) : null };
          }
        }
        cur = null;
      }
    }
    return st;
  }

  // ---------- 전투창 ----------
  function side(text, dex) {
    const m = /^(.*?)\s*Lv\.?\s*(\d+)\s*❤️?\s*(\d+)\s*\/\s*(\d+)\s*(?:\[([^\]]*)\])?/u.exec(text.trim());
    if (!m) return null;
    const s = { name: m[1].trim(), lv: Number(m[2]), hp: Number(m[3]), hpMax: Number(m[4]), ailment: m[5] && !/^(없음|정상|-)$/.test(m[5].trim()) ? m[5].trim() : '' };
    s.wild = /^(야생|폭주)/.test(s.name);
    const f = dex && dex.find(s.name);
    if (f) { s.base = f.lin.base; s.stage = f.stage; s.el = f.lin.el; s.rarity = f.lin.rarity; s.formName = (f.lin.names || [])[f.stage - 1]; }
    return s;
  }
  // 실제 작품 전투창 (2026-10 확인, 상태창 안에 뜸):
  //  ⚔️ 연습전 · 1턴째 | 🔮 상대 예고: …
  //  🟦 플리시아 Lv24 ❤️214/214 ▰▰▰ | - | 대기 ●
  //  🟥 라벨 Lv24 ❤️214/214 ▰▰▰ | 간파 중 | 대기 ●
  const SWORD = /^\s*\**\s*⚔\uFE0F?/u;
  const TEAM = /^\s*\**\s*(🟦|🟥)/u;
  function teamSide(l, dex) {
    const parts = l.replace(/\*\*/g, '').replace(TEAM, '').split('|').map(x => x.trim());
    const s = side(parts[0].replace(/[▰▱■□▮▯█░]+/g, ' '), dex);
    if (!s) return null;
    const st = (parts[1] || '').trim();
    if (st && !/^[-–—]$|^(없음|정상)$/.test(st) && !s.ailment) s.ailment = st;
    s.extra = (parts[2] || '').trim();
    return s;
  }
  function parseBattle(lines, dex) {
    let b = null;
    for (const raw of lines) {
      const l = raw.replace(/\*\*/g, '').trim();
      if (SWORD.test(l) && !/\bvs\b/i.test(l)) {
        const head = l.replace(SWORD, '').split('|').map(x => x.trim());
        const turn = /(\d+)\s*턴/.exec(l);
        const fore = /🔮\s*(.*)$/u.exec(l);
        b = { title: head[0].replace(/\s*·?\s*\d+\s*턴째?\s*$/, '').trim(), turn: turn ? Number(turn[1]) : null, forecast: fore ? fore[1].trim() : '', ally: null, enemy: null, allies: [], enemies: [], log: [], pp: [] };
        continue;
      }
      if (b && TEAM.test(l)) {
        const blue = /🟦/u.test(l);
        const sd = teamSide(l, dex);
        if (sd) { (blue ? b.allies : b.enemies).push(sd); if (blue && !b.ally) b.ally = sd; if (!blue && !b.enemy) b.enemy = sd; }
        continue;
      }
      if (SWORD.test(l) && /\bvs\b/i.test(l)) {
        const [a, e] = l.replace(SWORD, '').replace(/^\s*/, '').split(/\s+vs\s+/i);
        b = { ally: side(a, dex), enemy: side(e || '', dex), log: [], pp: [] };
        continue;
      }
      if (!b) continue;
      if (/^▶/.test(l)) {
        for (const part of l.replace(/^▶\s*/, '').split(/\s+\/\s+/)) {
          const m = /^(.*?)\s*→\s*(?:💥\s*(-?\d+))?\s*(?:\((.*?)\))?\s*$/u.exec(part.trim());
          if (m) b.log.push({ act: m[1].trim(), dmg: m[2] != null ? Math.abs(Number(m[2])) : null, note: (m[3] || '').trim() });
        }
        continue;
      }
      const pp = [...l.matchAll(/([가-힣A-Za-z ]+?)\s*(\d+)\s*\/\s*(\d+)/g)];
      if (pp.length && !/[❤️📅🐾]/u.test(l) && b.pp.length === 0 && l.length < 120) b.pp = pp.map(x => ({ name: x[1].replace(/^[,\s]+/, '').trim(), left: Number(x[2]), max: Number(x[3]) }));
    }
    if (b && (!b.ally || !b.enemy)) return null;
    if (b && b.ally && b.enemy && dex) {
      b.mult = b.ally.el && b.enemy.el ? dex.mult(b.ally.el, b.enemy.el) : 1;
      b.multBack = b.ally.el && b.enemy.el ? dex.mult(b.enemy.el, b.ally.el) : 1;
      b.over = b.enemy.hp <= 0 || b.ally.hp <= 0;
      if (b.enemy.rarity) b.capture = dex.capture(b.enemy.rarity, b.enemy.hpMax ? b.enemy.hp / b.enemy.hpMax : 1, { ailment: !!b.enemy.ailment });
    }
    return b;
  }

  // ---------- 코드 줄 ----------
  function parseCodes(text, dex) {
    const out = [];
    const re = /🔑\s*AC\s*[·\-_.:/ ]\s*([가-힣]+)\s*[·\-_.:/ ]\s*([1-3])\s*([CS])/gu;
    let m;
    while ((m = re.exec(text))) {
      const f = dex && dex.find(m[1]);
      const base = f ? f.lin.base : m[1];
      const stage = Number(m[2]);
      out.push({ kind: 'dex', base, stage, mode: m[3], code: `AC·${base}·${stage}${m[3]}`, no: dex ? dex.no(base, stage) : 0 });
    }
    const rb = /🔑\s*BG\s*[·\-_.:/ ]\s*([가-힣]+)/gu;
    while ((m = rb.exec(text))) out.push({ kind: 'badge', prof: m[1], code: `BG·${m[1]}` });
    return out;
  }

  // ---------- 【CRION】 블록 ----------
  function parseBlock(text) {
    const m = /【\s*CRION\s*】([\s\S]*?)【\s*\/\s*CRION\s*】/.exec(text);
    if (!m) return null;
    const o = {};
    for (const l of m[1].split('\n')) {
      const kv = /^\s*([a-z.]+)\s*=\s*(.*?)\s*$/i.exec(l);
      if (kv) o[kv[1].toLowerCase()] = kv[2];
    }
    const list = (s) => String(s || '').split(/\s*[,|]\s*/).filter(Boolean);
    return { bg: o.bg || '', bgm: o.bgm || '', cg: o.cg || '', fx: list(o.fx), sprites: o.sprites || '', choices: o.choices ? o.choices.split('|').map(x => x.trim()).filter(Boolean) : [] };
  }

  // ---------- 대사·서술 ----------
  const NAME = '[가-힣A-Za-z0-9·]{1,10}(?:\\s[가-힣]{1,4})?';
  const RE_MARK = new RegExp('^【\\s*(' + NAME + ')\\s*(?:[|｜]\\s*([^】]{1,8}))?\\s*】\\s*(.*)$');
  const RE_BOLD = new RegExp('^\\*\\*\\s*(' + NAME + ')\\s*\\*\\*\\s*[:：]?\\s*([“"「『].*)$');
  const RE_QUOTE = new RegExp('^(' + NAME + ')\\s*[:：]?\\s*([“"「『].*[”"」』])\\s*(.*)$');
  const QUOTED = /^[“"「『](.*?)[”"」』]\s*(.*)$/;
  const strip = (s) => String(s || '').replace(/^\*+|\*+$/g, '').trim();

  const SPEAK = /^\**\s*([가-힣A-Za-z0-9·?？ ]{1,14}?)\s*\**\s*💬\s*(.*)$/u;
  const STATUS_LINE = /^\s*[*>\-•]*\s*(📅|📍|🎓|🏠|💰|🎒|🐾|📦|📖|🏅|📜|🗓|⚔|🟦|🟥|🔮|ℹ|📊|📋|🧾|💳)|^\s*[\[［(]?\s*(info|INFO|Info|상태창|정보창|상태)\s*[\]］):：]/u;
  function lineBeat(line, ctx) {
    const l = line.trim();
    let m = RE_MARK.exec(l);
    if (m) {
      const q = QUOTED.exec(m[3].trim());
      return { kind: 'say', who: m[1].trim(), face: (m[2] || '').trim(), text: q ? q[1] : strip(m[3]), mark: true };
    }
    if ((m = RE_BOLD.exec(l))) { const q = QUOTED.exec(m[2]); return { kind: 'say', who: m[1].trim(), text: q ? q[1] : strip(m[2]) }; }
    if ((m = RE_QUOTE.exec(l)) && !/^(그|그녀|그는|나|내|우리)$/.test(m[1])) {
      const q = QUOTED.exec(m[2]);
      return { kind: 'say', who: m[1].trim(), text: q ? q[1] : m[2], after: (m[3] || '').trim() };
    }
    if ((m = QUOTED.exec(l))) {
      // "…" 위카가 올려다본다. → 뒤 서술의 주어를 화자로
      const after = m[2] || '';
      const s = /^([가-힣]{1,8})(?:이|가|는|은)\s/.exec(after);
      const who = s && ctx && ctx.isName(s[1]) ? s[1] : null;
      return { kind: 'say', who, text: m[1], after: after.trim() };
    }
    return { kind: 'narr', who: null, text: strip(l) };
  }

  function chunk(text, max) {
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

  // 응답 전체 → 결과
  //  segs: [{t:'text',s}|{t:'img',src,w,h,alt}] 또는 글 하나
  function parse(input, dex, opt) {
    opt = opt || {};
    const segs = typeof input === 'string' ? [{ t: 'text', s: input }] : (input || []);
    const lines = [], imgAt = [], codeAt = new Set();
    const tokens = [];
    for (const sg of segs) {
      if (sg.t === 'img') { imgAt.push({ at: lines.length, img: sg }); continue; }
      String(sg.s || '').replace(/ /g, ' ').split('\n').forEach((p) => {
        if (sg.code) codeAt.add(lines.length);
        let m; IMG_TOKEN.lastIndex = 0;
        while ((m = IMG_TOKEN.exec(p))) tokens.push({ at: lines.length, token: m[1] });
        lines.push(p.replace(IMG_TOKEN, '').replace(/\s+$/, ''));
      });
    }
    const text = lines.join('\n');
    const block = parseBlock(text);
    const drop = new Array(lines.length).fill(false);
    // CRION 블록
    let inBlock = false;
    lines.forEach((l, i) => {
      if (/【\s*CRION\s*】/.test(l)) inBlock = true;
      if (inBlock) drop[i] = true;
      if (/【\s*\/\s*CRION\s*】/.test(l)) inBlock = false;
    });
    // 상태창: 📅 줄부터 구분선(━) 또는 끝까지
    let status = null;
    let si = -1;
    for (let i = lines.length - 1; i >= 0; i--) if (/^\s*📅/.test(lines[i]) && !drop[i]) { si = i; break; }
    if (si >= 0) {
      let s = si, e = si;
      if (s > 0 && DIVIDER.test(lines[s - 1])) s--;
      while (e < lines.length && !drop[e] && !(e > si && DIVIDER.test(lines[e]))) e++;
      if (e < lines.length && DIVIDER.test(lines[e])) e++;
      status = parseStatusLines(lines.slice(si, e), dex);
      for (let i = s; i < e; i++) drop[i] = true;
    }
    // 전투창
    let battle = null;
    // 새 형식(⚔️ 머리줄 + 🟦/🟥 줄) — 상태창 안에 있어도 읽는다
    const ni = lines.findIndex((l, i) => SWORD.test(l) && !/\bvs\b/i.test(l) && lines.slice(i + 1, i + 8).some(x => TEAM.test(x)));
    if (ni >= 0) {
      let e = ni + 1;
      while (e < lines.length && e <= ni + 8 && (TEAM.test(lines[e]) || /^\s*▶/.test(lines[e]))) e++;
      battle = parseBattle(lines.slice(ni, e), dex);
      for (let i = ni; i < e; i++) drop[i] = true;
    }
    const bi = battle ? -1 : lines.findIndex((l, i) => !drop[i] && SWORD.test(l) && /\bvs\b/i.test(l));
    if (bi >= 0) {
      let e = bi + 1;
      while (e < lines.length && e <= bi + 4 && !drop[e] && (/^\s*▶/.test(lines[e]) || (/\d+\s*\/\s*\d+/.test(lines[e]) && !/[“"「]/.test(lines[e]) && lines[e].length < 120))) e++;
      battle = parseBattle(lines.slice(bi, e), dex);
      for (let i = bi; i < e; i++) drop[i] = true;
    }
    // 코드·알림 줄
    const codes = parseCodes(text, dex);
    const notices = [];
    lines.forEach((l, i) => {
      if (drop[i]) return;
      if (/🔑/.test(l) || /^\s*(📖\s*도감\s*등록|🏅\s*배지\s*획득)/.test(l)) {
        notices.push(l.trim()); drop[i] = true;
      }
    });
    // 행동 힌트(💡)
    let hints = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      if (drop[i] || !lines[i].trim()) continue;
      const h = /^\s*💡\s*(.+)$/u.exec(lines[i]);
      if (h) { hints = h[1].split(/\s*(?:\/|｜|\|)\s*/).map(x => x.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean).slice(0, 4); drop[i] = true; }
      break;
    }
    if (block && block.choices.length) hints = block.choices.slice(0, 4);

    // 장면
    const ctx = { isName: (n) => !!((dex && (dex.person(n) || dex.find(n))) || (opt.names || []).includes(n)) };
    const beats = [];
    let pend = [], who = null;
    const take = (i) => { for (const x of imgAt) if (x.at === i) pend.push(x.img); for (const x of tokens) if (x.at === i) pend.push({ token: x.token }); };
    for (let i = 0; i <= lines.length; i++) {
      take(i);
      if (i === lines.length) break;
      if (drop[i]) continue;
      const raw = lines[i];
      if (!raw.trim() || DIVIDER.test(raw)) continue;
      if (codeAt.has(i) || STATUS_LINE.test(raw)) continue;          // 상태창·정보 줄·코드 상자는 대사로 안 보냄
      // 「이름💬」 → 사람 이름 (같은 줄 대사 또는 다음 줄 대사의 화자)
      const sp = SPEAK.exec(raw.trim());
      if (sp) {
        const nm = sp[1].replace(/\*/g, '').trim(), rest = (sp[2] || '').trim();
        if (!rest) { who = nm; continue; }
        const q = QUOTED.exec(rest);
        beats.push(Object.assign({ kind: 'say', who: nm, text: q ? q[1] : strip(rest) }, pend.length ? { imgs: pend } : {})); pend = [];
        if (q && q[2]) beats.push({ kind: 'narr', who: null, text: strip(q[2]) });
        who = null; continue;
      }
      let b = lineBeat(raw, ctx);
      if (who) { if (/^[“"「『]/.test(raw.trim())) { const q = QUOTED.exec(raw.trim()); b = { kind: 'say', who, text: q ? q[1] : strip(raw), after: q ? q[2] : '' }; } who = null; }
      if (!b.text) continue;
      const pieces = b.kind === 'narr' ? chunk(b.text, opt.max || 160) : [b.text];
      pieces.forEach((t, k) => {
        const beat = { kind: b.kind, who: b.who, text: t };
        if (b.face) beat.face = b.face;
        if (k === 0 && pend.length) { beat.imgs = pend; pend = []; }
        beats.push(beat);
      });
      if (b.after && b.kind === 'say') beats.push({ kind: 'narr', who: null, text: strip(b.after) });
    }
    if (pend.length) { if (beats.length) beats[beats.length - 1].imgs = (beats[beats.length - 1].imgs || []).concat(pend); else beats.push({ kind: 'narr', who: null, text: '', imgs: pend }); }
    return { beats, status, battle, codes, notices, hints, block, tokens: tokens.map(t => t.token) };
  }

  // 표식을 지운 글 (폴백 확인용)
  function stripMarks(text) {
    return String(text || '').replace(/\n?【\s*CRION\s*】[\s\S]*?【\s*\/\s*CRION\s*】/g, '').replace(/【[^】|]+[|｜][^】]*】/g, '').replace(/【[^】|]{1,10}】(?=["“「])/g, '');
  }

  // 지난 상태 → 이번 상태로 바뀐 사건 (소환·진화·도감·배지·레벨업)
  function events(prev, now, codes, dex) {
    const ev = [];
    const pp = (prev && prev.partners) || [];
    for (const p of (now && now.partners) || []) {
      const old = pp.find(o => o.base && o.base === p.base && o.nick === p.nick) || pp.find(o => o.base && o.base === p.base);
      if (!old && prev) ev.push({ type: 'new', partner: p });
      else if (old && p.stage > (old.stage || 1)) ev.push({ type: 'evolve', partner: p, from: old });
      else if (old && p.lv > old.lv) ev.push({ type: 'level', partner: p, from: old });
    }
    if (prev && now && now.dex && prev.dex && now.dex.n > prev.dex.n) ev.push({ type: 'dex', n: now.dex.n });
    if (prev && now && now.badges && prev.badges && now.badges.n > prev.badges.n) ev.push({ type: 'badge', n: now.badges.n });
    for (const c of codes || []) if (c.kind === 'badge') ev.push({ type: 'badge-code', prof: c.prof });
    return ev;
  }

  const api = { Dex, parse, parseStatusLines, parseBattle, parseSkills, parseCodes, parseBlock, lineBeat, stripMarks, events, stageNo, STAGES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionAcademy = api;
})(typeof window !== 'undefined' ? window : globalThis);
