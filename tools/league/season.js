// 시즌 시뮬로 기록이 야구다운지 확인: node tools/league/season.js [시즌 수]
const C = require('../../src/renderer/pk-league.js');
const data = require('../../packs/hirion.baseball-proto/data.json');
const X = C.index(data);
const N = +(process.argv[2] || 3);
let tot = { pa: 0, ab: 0, h: 0, hr: 0, bb: 0, k: 0, r: 0, g: 0, sb: 0, cs: 0, d: 0, e: 0, gdp: 0, inn: 0, pc: 0, er: 0, outs: 0 };
const champs = {};
for (let s = 0; s < N; s++) {
  const L = C.newLeague(X, { seed: 1000 + s, team: 'SEO' }); L.my = null;
  for (const g of L.games) { const G = C.newGame(X, L, g); C.simToEnd(X, L, G); tot.g++; tot.r += G.score[0] + G.score[1]; tot.pc += Object.values(G.pc).reduce((a, b) => a + b, 0); }
  for (const id in L.stats.reg) { const b = L.stats.reg[id].bat; if (b) for (const k of ['pa', 'ab', 'h', 'hr', 'bb', 'k', 'sb', 'cs', 'd', 'e', 'gdp']) tot[k] += b[k]; const p = L.stats.reg[id].pit; if (p) { tot.er += p.er; tot.outs += p.outs; } }
  const st = C.standings(X, L); if (s < 3) console.log(st.map(r => `${r.id} ${r.w}-${r.l}${r.d ? '-' + r.d : ''} ${r.rs}/${r.ra}`).join(' | '));
  champs[st[0].id] = (champs[st[0].id] || 0) + 1;
  if (s === 0) { for (const c of ['avg', 'hr', 'sb', 'era', 'k', 'w', 'sv']) console.log(c, C.leaders(X, L, c, 3).map(r => `${r.name} ${c === 'avg' || c === 'era' ? r.v.toFixed(3) : r.v}`).join(', ')); }
}
const f = (x) => x.toFixed(3);
console.log(`AVG ${f(tot.h / tot.ab)} OBP~${f((tot.h + tot.bb) / tot.pa)} R/G(팀) ${(tot.r / tot.g / 2).toFixed(2)} HR/G ${(tot.hr / tot.g / 2).toFixed(2)} K% ${f(tot.k / tot.pa)} BB% ${f(tot.bb / tot.pa)} 2B/G ${(tot.d / tot.g / 2).toFixed(2)} SB/G ${(tot.sb / tot.g).toFixed(2)} CS ${tot.cs} E/G ${(tot.e / tot.g).toFixed(2)} GDP/G ${(tot.gdp / tot.g).toFixed(2)} 투구/경기 ${(tot.pc / tot.g / 2).toFixed(0)} ERA ${(tot.er * 27 / tot.outs).toFixed(2)}`);
console.log('1위 횟수', champs);
