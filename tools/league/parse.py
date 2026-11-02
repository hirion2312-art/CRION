import re, json, sys
# 프로필 원문(브리지 crack/to-claude/2026-11-02_073) → profiles.json   python3 parse.py <원문 경로>
src = open(sys.argv[1] if len(sys.argv) > 1 else '../../../usagi-claude-bridge/crack/to-claude/2026-11-02_073_baseball6-league-profiles.txt', encoding='utf-8').read()
lines = src.split('\n')
teams = []; players = []; cur = None; team = None
for i, l in enumerate(lines):
    m = re.match(r'■ 팀 소개 — (\S+) (\S+) \((.+)\)', l)
    if m:
        team = {'city': m.group(1), 'nick': m.group(2), 'en': m.group(3), 'intro': lines[i + 1].strip()}; teams.append(team); cur = None; continue
    m = re.match(r'■ (\S+) / (\d+)세 / 등번호 (\d+)', l)
    if m:
        cur = {'name': m.group(1), 'age': int(m.group(2)), 'num': int(m.group(3)), 'team': team['city'], 'emo': []}; players.append(cur); continue
    if not cur: continue
    s = l.strip()
    def val(k):
        return s.split(':', 1)[1].strip() if s.startswith('- ' + k) else None
    for k, f in [('포지션·타순', 'pos'), ('투타', 'hand'), ('외모', 'look'), ('성격 라벨', 'label'), ('성격 상세', 'detail'), ('말투', 'tone'), ('플레이 스타일', 'style'), ('대표 능력치', 'rep'), ('배경·훅', 'hook')]:
        v = val(k)
        if v is not None: cur[f] = v
    v = val('감정표현 4종')
    if v: cur['emo'] += [x.strip() for x in v.split(' / ') if x.strip()]
    if s.startswith('·'): cur['emo'].append(s[1:].strip())
for p in players:
    p['emo'] = [re.split(r' — | \(|:', e, maxsplit=1)[0].strip() for e in p['emo']]
    sty = p.get('style', '')
    m = re.search(r'강점\s*[—:-]?\s*(.+?)\s*/\s*약점\s*[—:-]?\s*(.+)', sty)
    p['str'], p['weak'] = (m.group(1), m.group(2)) if m else (sty, '')
    p['rep'] = [(a.strip(), int(b)) for a, b in re.findall(r'([^/\d]+?)\s*(\d+)', p.get('rep', ''))]
    tone = p.get('tone', ''); q = re.findall(r'"([^"]+)"', tone); p['quote'] = q[0] if q else ''
    p['label'] = p.get('label', '').strip('「」')
    hm = re.match(r'(.)투(.)타', p.get('hand', '')); p['throws'], p['bats'] = (hm.group(1), hm.group(2)) if hm else ('우', '우')
for i, p in enumerate(players): p['team'] = ['서울', '부산', '대구', '인천', '광주', '대전'][i // 9]
json.dump({'teams': teams, 'players': players}, open('profiles.json', 'w'), ensure_ascii=False, indent=1)
print(len(teams), len(players))
for t in teams: print(t['city'], t['nick'], t['intro'][:90])
for p in players: print(p['team'][:2], p['name'], p['pos'][:14], p['throws']+p['bats'], p['rep'], p['emo'])
