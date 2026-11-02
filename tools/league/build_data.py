# 6팀 리그 능력치·특성 시트 → packs/hirion.baseball-proto/data.json 의 teams·players
#   python3 tools/league/build_data.py   (profiles.json = parse.py 결과, 아래 표 = 프로필 강점/약점을 숫자로 옮긴 것)
#   리그 평균 50 · 범위 20~99. 프로필의 대표 능력치 3개는 그대로, 나머지는 강점 +15~25 / 약점 -10~20.
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'packs', 'hirion.baseball-proto', 'data.json')
prof = json.load(open(os.path.join(HERE, 'profiles.json'), encoding='utf-8'))

TEAMS = [
  dict(id='SEO', city='서울', nick='팔콘스', en='Seoul Falcons', gender='M', color='#1f3270', color2='#aab4c4', style='기동력', home='잠실 돔',
       concept='도루와 한 베이스 더 가는 주루로 배터리를 흔드는 젊은 팀', goal='두 번 놓친 우승 트로피'),
  dict(id='BUS', city='부산', nick='웨이브스', en='Busan Waves', gender='M', color='#0b72c4', color2='#dff1ff', style='장타', home='바닷바람 구장', park=1.12,
       concept='삼진 아니면 홈런, 벤치 전원이 풀스윙하는 화력 팀', goal='팀 홈런 1위 수성과 가을야구'),
  dict(id='DGU', city='대구', nick='블리츠', en='Daegu Blitz', gender='M', color='#d3202f', color2='#1b1b1f', style='투수·수비', home='라이온 필드',
       concept='실책 없는 조직력과 물 새지 않는 수비, 노련한 팀', goal='에이스의 첫 우승 반지'),
  dict(id='INC', city='인천', nick='스타라이트', en='Incheon Starlight', gender='W', color='#6a3fd0', color2='#e5b53e', style='패기', home='포트 파크',
       concept='창단 3년차, 넘어진 자리에서 일어서는 언더독', goal='창단 첫 가을야구'),
  dict(id='GWJ', city='광주', nick='페탈스', en='Gwangju Petals', gender='W', color='#e8508a', color2='#fff0f5', style='작전 야구', home='무등 파크',
       concept='번트·도루·호수비로 1점씩 쌓는 끈끈한 팀', goal='창단 첫 포스트시즌'),
  dict(id='DJN', city='대전', nick='노바', en='Daejeon Nova', gender='W', color='#1fb89c', color2='#1c2c4f', style='데이터', home='노바 필드',
       concept='전력분석과 육성, 확률을 쌓는 조용한 강팀', goal="'계획대로' 첫 우승"),
]
CITY = {t['city']: t['id'] for t in TEAMS}
POS = {'투수': 'P', '포수': 'C', '1루수': '1B', '2루수': '2B', '3루수': '3B', '유격수': 'SS', '좌익수': 'LF', '중견수': 'CF', '우익수': 'RF'}

# 타자: con 컨택 · pow 파워 · eye 선구안 · spd 주루 · def 수비 · arm 송구 / 특성 [id, 값]
B = {
 '차도현': ([78, 58, 50, 91, 84, 66], [['greedy']]),
 '노태경': ([52, 55, 60, 32, 89, 81], [['lead', 89]]),
 '권민석': ([83, 41, 62, 80, 62, 55], [['bunt', 78]]),
 '서태우': ([60, 86, 58, 45, 58, 68], [['clutch', 84], ['clutch2s'], ['breakWeak']]),
 '한이준': ([82, 55, 62, 70, 87, 62], [['lapse', 55], ['bigGame'], ['vsLHP', 62]]),
 '도경태': ([60, 93, 74, 38, 50, 50], [['inside']]),
 '유재현': ([52, 50, 52, 85, 62, 55], [['potential', 88], ['rookie']]),
 '최강록': ([60, 52, 79, 48, 85, 88], [['smallStage']]),
 '배성준': ([55, 74, 52, 30, 70, 61], [['lead', 88], ['clutch', 66]]),
 '강태준': ([55, 91, 55, 45, 48, 65], [['breakWeak']]),
 '남기훈': ([60, 39, 55, 62, 86, 78], [['bunt', 84]]),
 '오지혁': ([62, 35, 52, 92, 85, 55], [['runFirst']]),
 '서민혁': ([66, 76, 55, 33, 44, 50], [['clutch', 85]]),
 '백승훈': ([82, 70, 55, 50, 57, 84], []),
 '정우람': ([62, 50, 81, 40, 62, 52], [['pinch', 83]]),
 '윤태오': ([55, 31, 50, 80, 78, 60], [['bunt', 72], ['rookie']]),
 '박성민': ([42, 35, 50, 35, 90, 72], [['lead', 90]]),
 '장태호': ([62, 89, 38, 35, 50, 50], [['freeSwing']]),
 '유승재': ([62, 30, 55, 80, 82, 58], [['bunt', 76]]),
 '오성훈': ([52, 62, 45, 48, 85, 88], [['breakWeak'], ['mood']]),
 '김도훈': ([55, 38, 50, 60, 91, 87], [['vsLHP', 41]]),
 '남지훈': ([50, 40, 39, 86, 81, 55], [['rookie']]),
 '정우진': ([66, 42, 84, 90, 72, 52], [['runFirst'], ['smallStage']]),
 '한승엽': ([66, 64, 55, 47, 55, 83], [['clutch', 88], ['injury', 40]]),
 '신예린': ([58, 45, 45, 92, 85, 55], [['runFirst'], ['wildThrow']]),
 '윤채원': ([76, 41, 58, 65, 68, 58], [['bunt', 88]]),
 '임서연': ([66, 63, 55, 55, 86, 70], [['clutch', 84], ['slowStart', 44]]),
 '홍다경': ([58, 90, 68, 38, 52, 50], [['breakWeak']]),
 '서민지': ([60, 78, 50, 50, 75, 87], [['injury', 45], ['mood'], ['dive']]),
 '김나래': ([57, 55, 48, 55, 74, 89], [['breakWeak']]),
 '조은별': ([85, 66, 60, 42, 52, 55], [['lateFocus']]),
 '배수아': ([50, 49, 55, 35, 82, 79], [['lead', 91]]),
 '박수연': ([58, 50, 60, 35, 84, 58], [['lead', 92]]),
 '최민서': ([62, 86, 60, 42, 88, 55], [['slowStart', 45], ['inside']]),
 '김나윤': ([60, 32, 55, 62, 75, 60], [['bunt', 91]]),
 '정다인': ([58, 55, 45, 52, 87, 83], [['hothead', 48], ['dive']]),
 '윤도연': ([66, 41, 58, 70, 90, 55], [['smart', 86]]),
 '오지민': ([60, 38, 50, 88, 84, 52], [['bunt', 70]]),
 '서하린': ([62, 42, 55, 87, 89, 60], [['firstPitch'], ['runFirst']]),
 '문예지': ([48, 52, 44, 62, 66, 85], [['potential', 90], ['rookie'], ['dive']]),
 '배수현': ([47, 52, 50, 30, 84, 84], [['lead', 91]]),
 '홍서경': ([58, 89, 71, 40, 42, 50], [['breakWeak']]),
 '임소라': ([62, 38, 60, 65, 85, 70], [['bunt', 90]]),
 '조민하': ([60, 60, 52, 48, 87, 86], [['slowStart', 44], ['clutch', 70]]),
 '신유나': ([82, 50, 58, 60, 88, 63], [['wildThrow']]),
 '오지현': ([60, 45, 62, 55, 86, 45], []),
 '정다혜': ([58, 40, 41, 90, 87, 60], [['firstPitch'], ['runFirst']]),
 '서유정': ([62, 62, 39, 60, 55, 72], [['potential', 89], ['rookie'], ['calmBig'], ['breakWeak']]),
}
# 투수: velo 구위(구속) · ctrl 제구 · brk 변화구 · stam 체력 · cool 위기관리 · hold 견제 / 구종 / 특성
P = {
 '백승호': ([92, 76, 80, 68, 60, 50], ['직구', '포크', '슬라이더'], [['limit90']]),
 '도현수': ([87, 79, 78, 80, 50, 45], ['직구', '포크', '슬라이더'], [['vsLHB', 58], ['stretch']]),
 '김동혁': ([92, 84, 82, 75, 70, 48], ['직구', '포크', '커브'], [['lateFade']]),
 '나윤서': ([90, 77, 80, 65, 61, 40], ['직구', '슬라이더', '커브'], [['stretch']]),
 '강유진': ([54, 88, 75, 80, 90, 60], ['투심', '체인지업', '커브', '슬라이더'], [['grounder']]),
 '강서윤': ([92, 94, 88, 85, 88, 70], ['직구', '슬라이더', '커브', '체인지업'], [['rhythm']]),
}
# 결정 2 기본안: 팀마다 이름 있는 무명 선수 6명 (선발 2 · 불펜 3 · 야수 1), 그림 없이 실루엣
EXTRA = {
 'SEO': [('류지환', 'SP', [60, 62, 58, 70, 52, 50], ['직구', '슬라이더', '체인지업']), ('마승원', 'SP', [55, 60, 60, 66, 50, 55], ['직구', '커브', '체인지업']),
         ('탁민규', 'CL', [80, 58, 66, 40, 62, 45], ['직구', '슬라이더']), ('염준혁', 'RP', [62, 58, 60, 42, 50, 50], ['직구', '커터']), ('표선우', 'RP', [55, 62, 62, 45, 48, 52], ['투심', '체인지업']),
         ('진하람', 'UT', [58, 45, 52, 72, 66, 60])],
 'BUS': [('하도윤', 'SP', [62, 54, 56, 66, 46, 45], ['직구', '슬라이더', '포크']), ('곽태민', 'SP', [56, 55, 58, 64, 45, 48], ['직구', '커브', '체인지업']),
         ('변세찬', 'CL', [74, 52, 60, 40, 52, 45], ['직구', '포크']), ('남궁현', 'RP', [58, 50, 55, 42, 44, 45], ['직구', '슬라이더']), ('육상훈', 'RP', [52, 54, 56, 44, 45, 48], ['투심', '커브']),
         ('기은찬', 'UT', [55, 62, 48, 45, 50, 58])],
 'DGU': [('석주완', 'SP', [62, 66, 62, 72, 58, 55], ['직구', '커브', '슬라이더']), ('엄재경', 'SP', [58, 66, 64, 70, 56, 58], ['투심', '체인지업', '커브']),
         ('피승현', 'CL', [82, 62, 70, 40, 66, 50], ['직구', '포크']), ('방우성', 'RP', [64, 62, 62, 42, 56, 52], ['직구', '슬라이더']), ('송인후', 'RP', [58, 64, 62, 44, 55, 55], ['커터', '커브']),
         ('맹지석', 'UT', [55, 42, 55, 60, 75, 66])],
 'INC': [('여소담', 'SP', [58, 56, 58, 66, 48, 48], ['직구', '슬라이더', '체인지업']), ('함지우', 'SP', [54, 58, 56, 64, 46, 50], ['직구', '커브', '체인지업']),
         ('채다올', 'CL', [76, 54, 62, 40, 55, 45], ['직구', '슬라이더']), ('은하솔', 'RP', [60, 52, 56, 42, 46, 48], ['직구', '커브']), ('국예빈', 'RP', [52, 58, 58, 44, 48, 50], ['투심', '체인지업']),
         ('차슬기', 'UT', [58, 50, 50, 66, 60, 58])],
 'GWJ': [('봉유리', 'SP', [52, 66, 62, 70, 56, 60], ['투심', '커브', '체인지업']), ('탁은서', 'SP', [55, 62, 60, 66, 52, 58], ['직구', '슬라이더', '체인지업']),
         ('길소미', 'CL', [70, 62, 64, 40, 60, 52], ['직구', '포크']), ('반하늘', 'RP', [58, 60, 58, 42, 52, 55], ['직구', '커브']), ('설가윤', 'RP', [52, 64, 60, 44, 54, 58], ['커터', '체인지업']),
         ('편다솜', 'UT', [62, 38, 58, 74, 70, 56])],
 'DJN': [('우채령', 'SP', [60, 66, 64, 70, 58, 56], ['직구', '슬라이더', '체인지업']), ('성다은', 'SP', [56, 64, 64, 68, 55, 58], ['투심', '커브', '체인지업']),
         ('금시아', 'CL', [78, 62, 66, 40, 62, 50], ['직구', '포크']), ('노하은', 'RP', [62, 60, 60, 42, 54, 52], ['직구', '슬라이더']), ('표지안', 'RP', [56, 62, 62, 44, 52, 55], ['커터', '커브']),
         ('허윤슬', 'UT', [60, 48, 60, 60, 64, 60])],
}
TRAITS = {
 'greedy': ('장타 욕심', "컨디션 '절정'인 날 파워 +5 · 삼진 +4%p"),
 'lead': ('투수 리드', '이 포수가 앉으면 투수 제구 보정'),
 'bunt': ('작전 수행', '번트·진루타·히트앤런 성공률 보정'),
 'clutch': ('클러치', '득점권에서 컨택·파워 보정'),
 'clutch2s': ('몰린 카운트', '2스트라이크 뒤 컨택·파워 +10'),
 'breakWeak': ('변화구 약점', '변화구에 헛스윙이 많다 (삼진 +4%p)'),
 'lapse': ('집중력 기복', '집중이 흐트러진 날 평범한 뜬공도 놓친다'),
 'bigGame': ('큰 경기 징크스', '포스트시즌 컨택 -8 (각성 이벤트로 해제)'),
 'vsLHP': ('좌투 상대', '왼손 투수 상대 컨택 보정'),
 'inside': ('몸쪽 약점', '몸쪽 공에 약하고 병살이 잦다'),
 'potential': ('잠재력', '시즌 중 성장이 빠르다'),
 'rookie': ('경험 부족', '7회 이후 접전에서 컨택 -5'),
 'smallStage': ('큰 무대 부담', '포스트시즌 컨택 -4'),
 'runFirst': ('먼저 뛴다', '도루 시도가 많고 견제사도 많다'),
 'pinch': ('대타 전문', '대타로 나오면 컨택 보정'),
 'freeSwing': ('프리 스윙어', '볼넷이 거의 없다'),
 'mood': ('감정 기복', '직전 타석 삼진 뒤 컨택 -6'),
 'injury': ('부상 위험', '부상 확률이 높다'),
 'wildThrow': ('급한 송구', '실책이 조금 더 나온다'),
 'slowStart': ('슬로 스타터', '1~3시리즈 컨택·파워 하락'),
 'dive': ('몸 던지는 수비', '호수비가 많지만 부상 위험'),
 'lateFocus': ('후반 집중 저하', '7회 이후 수비 -10'),
 'hothead': ('뜨거워지면 강해짐', '직전 타석 삼진·실책 뒤 수비 반응 +10 · 송구 정확도 -5'),
 'smart': ('상황 판단', '한 베이스 더 가는 주루 판단'),
 'firstPitch': ('초구 공략', '초구부터 배트가 나간다 (볼넷↓ 삼진↑)'),
 'calmBig': ('큰 경기 침착', '포스트시즌 컨택 +6'),
 'limit90': ('90구의 벽', '투구 수 90개 이후 제구 -15'),
 'vsLHB': ('좌타 상대', '왼손 타자에게 구위 하락'),
 'stretch': ('세트포지션 불안', '주자가 나가면 제구 -10'),
 'lateFade': ('시즌 후반 피로', '7시리즈부터 구위 -6'),
 'grounder': ('땅볼 유도', '낮은 제구로 땅볼이 많다 · 거포에게 장타 허용'),
 'rhythm': ('견제의 시간', '주자가 나가면 견제가 많아져 제구 -5 · 도루 억제'),
}

def hand(p):
    m = {'우': 'R', '좌': 'L', '양': 'S'}
    return m.get(p.get('throws', '우'), 'R'), m.get(p.get('bats', '우'), 'R')

players = []
lineup = {t['id']: [] for t in TEAMS}
for i, pr in enumerate(prof['players']):
    tid = CITY[pr['team']]
    pos = POS[pr['pos'].split('·')[0].split('(')[0].split(' ')[0].strip()]
    th, bt = hand(pr)
    import re
    order = re.search(r'(\d)번', pr['pos'])
    o = dict(id=f'{tid}{len(lineup[tid]) + 1:02d}', name=pr['name'], team=tid, pos=pos, num=pr['num'], age=pr['age'], throws=th, bats=bt,
             label=pr['label'], quote=pr['quote'], emo=pr['emo'][:4], hook=pr.get('hook', ''), named=True,
             str=pr['str'], weak=pr['weak'], rep=[[a, b] for a, b in pr['rep'] if a])
    if pos == 'P':
        r, pitches, tr = P[pr['name']]
        o['p'] = dict(zip(['velo', 'ctrl', 'brk', 'stam', 'cool', 'hold'], r)); o['pitches'] = pitches; o['traits'] = tr; o['role'] = 'SP'
        o['b'] = dict(con=30, pow=32, eye=30, spd=40, defn=60, arm=80)
    else:
        r, tr = B[pr['name']]
        o['b'] = dict(zip(['con', 'pow', 'eye', 'spd', 'defn', 'arm'], r)); o['traits'] = tr
    o['order'] = int(order.group(1)) if order else 9
    players.append(o); lineup[tid].append(o['id'])
for t in TEAMS:
    for j, (nm, role, r, *pt) in enumerate(EXTRA[t['id']]):
        o = dict(id=f"{t['id']}{10 + j + 1:02d}", name=nm, team=t['id'], num=60 + j * 3 + (1 if t['gender'] == 'W' else 0), age=23 + (j * 3) % 9,
                 throws='L' if j in (1, 4) else 'R', bats='R', named=False, label='', quote='', emo=[], traits=[])
        if role == 'UT':
            o['pos'] = 'UT'; o['b'] = dict(zip(['con', 'pow', 'eye', 'spd', 'defn', 'arm'], r)); o['bats'] = 'L' if t['id'] in ('SEO', 'GWJ') else 'R'
        else:
            o['pos'] = 'P'; o['role'] = role; o['p'] = dict(zip(['velo', 'ctrl', 'brk', 'stam', 'cool', 'hold'], r)); o['pitches'] = pt[0]
            o['b'] = dict(con=25, pow=25, eye=25, spd=40, defn=50, arm=70)
        players.append(o)

data = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
data.update(dict(title='크랙 프로야구 : 6팀 리그', version='0.1', season=dict(series=10, games=3, startMonth=4), teams=TEAMS, players=players,
                 traits={k: dict(name=a, desc=b) for k, (a, b) in TRAITS.items()}))
json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('teams', len(TEAMS), 'players', len(players), '→', OUT)
for t in TEAMS:
    ps = [p for p in players if p['team'] == t['id']]
    print(t['id'], len(ps), sorted(p['order'] for p in ps if p.get('named')), [p['pos'] for p in ps if p.get('named')])
