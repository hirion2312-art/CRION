# 플레이팩 「아포칼립스 안전지대의 관리자」 화면 점검: python3 test/ui/run_safehouse.py → test/out/sh_*.png
#  가짜 업데이트 서버(reg.test) + 가짜 크랙 화면(webview ipc 흉내)으로
#  개발자 전용 공개 → 받기 → 처음부터(새 대화 연결) → 프롤로그·등록증 → 샘플 3턴(부록 G) → 관리 화면들 → 이어하기를 돌려 본다
import asyncio, json, os, subprocess
from playwright.async_api import async_playwright
ROOT = '/home/claude/crion/'
BASE = 'file://' + ROOT + 'test/ui/harness.html'
OUT = ROOT + 'test/out/'
REG = ROOT + 'registry/'
IMG = ROOT + 'test/ui/img/'
os.makedirs(OUT, exist_ok=True)
subprocess.run(['node', 'scripts/make-registry.js', 'https://reg.test/CRION/'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
INDEX = json.load(open(REG + 'index.json', encoding='utf-8'))
PACK = 'hirion.safehouse'
print('공개 목록에 있음:', any(p['id'] == PACK for p in INDEX['packs']), '/ 개발자 목록에 있음:', any(p['id'] == PACK for p in INDEX.get('devPacks', [])))
# 공개 팩이든 개발자 전용이든 이 팩 하나만 남겨 시험 (시험은 개발자 목록 자리로 싣는다)
INDEX['devPacks'] = [p for p in INDEX['packs'] + INDEX.get('devPacks', []) if p['id'] == PACK]
INDEX['packs'] = []
for p in INDEX['devPacks']:
    p['workUrl'] = 'https://crack.wrtn.ai/detail/safehouse'

PLACE = 'https://img.test/빌라.webp'
PERSON = 'https://img.test/김소담.webp'
WAVE = 'https://img.test/빌라웨이브.webp'

PROLOGUE = [{'t': 'img', 'src': PLACE, 'w': 1920, 'h': 1072, 'alt': ''},
            {'t': 'text', 's': '해령시. 남해안의 항구도시, 인구 82만.\n사흘 전, 바이오센터에서 무언가 새어 나왔다. 항구와 대학병원에서 시작된 비명은 하루 만에 도시를 덮었고, 군은 도시를 통째로 봉쇄했다. 외곽 도로 위를 도는 헬기는 구하러 온 게 아니다. 아무도 못 나가게 지키는 중이다. 휴대폰은 끊겼고, 라디오는 같은 문장만 되풀이한다. "절대 외출하지 마십시오."\n청운동 언덕 꼭대기, 계단 140개 위의 석벽빌라. 할아버지가 지은 4층짜리 요새 같은 건물.\n그때, 아래층에서 철문이 울렸다. 3년 만에 처음 듣는 노크였다.\n쾅. 쾅. 쾅.'},
            {'t': 'text', 's': '📍2층 빈 호실 · D1 아침\n🍚식량 7 | 🩹의료품 2 | 🧱자재 5 | 🛡️방어력 30\n👥주민 0/3 | 😊사기 60\n🛠️일과: 없음\n🚶파견: 없음 | 🚪대기: 없음\n🏢확장 1단계 | ⛽연료 0 💎희귀 0 🧪연구재료 0 | 🔬연구 Lv 0', 'code': True}]
T1 = [{'t': 'img', 'src': PERSON, 'w': 1536, 'h': 912, 'alt': ''},
      {'t': 'text', 's': '철문 너머로 두 사람의 그림자가 보였다. 하나는 편의점 조끼를 입은 마른 여자, 하나는 큰 배낭을 멘 여자였다.\n계단 아래에서 무언가 질질 끌리는 소리가 올라왔다.\n김소담💬 철문을 두드리던 손을 멈춘다 "저기요! 안에 사람 있죠? 문 좀 열어 주세요!"\n이나래💬 숨을 몰아쉬며 뒤를 돌아본다 "아래에서… 뭔가 따라와요."'},
      {'t': 'text', 's': '📍1층 철문 · D1 아침\n🍚식량 7 | 🩹의료품 2 | 🧱자재 5 | 🛡️방어력 30\n👥주민 0/3 | 😊사기 60\n🛠️일과: 없음\n🚶파견: 없음 | 🚪대기: 김소담(1일째), 이나래(1일째)\n🏢확장 1단계 | ⛽연료 0 💎희귀 0 🧪연구재료 0 | 🔬연구 Lv 0', 'code': True}]
T2 = [{'t': 'img', 'src': WAVE, 'w': 1920, 'h': 1072, 'alt': '빌라웨이브'},
      {'t': 'text', 's': '밤새 계단 아래가 시끄러웠다. 아침 햇빛 아래, 철문 경첩 하나가 휘어 있었다.\n소담💬 팔에 감은 붕대를 내려다본다 "괜찮아요. 긁힌 거예요, 그냥."\n📦 🍚식량 −2 · 🛡️방어력 −1 · 🩹소담 부상'},
      {'t': 'text', 's': '📍식당 · D2 🌅아침\n🍚식량 5 | 🩹의료품 2 | 🧱자재 5 | 🛡️방어력 29\n👥주민 2/3 | 😊사기 58\n🛠️일과: 미정\n🚶파견: 없음 | 🚪대기: 없음\n🏢확장 1단계 | ⛽연료 0 💎희귀 0 🧪연구재료 0 | 🔬연구 Lv 0', 'code': True}]
T3 = [{'t': 'img', 'src': PLACE, 'w': 1920, 'h': 1072},
      {'t': 'text', 's': '청운동 골목 끝, 셔터가 반쯤 내려간 편의점 앞에 두 사람이 섰다.\n조현우💬 지름길을 가리키며 씩 웃는다 "여기 골목으로 가면 오 분이면 돌아와요. 진짜로."\n면접 때 본 조현우는 탐7/전6/스8 정도였다.'},
      {'t': 'text', 's': '📍청운24시 편의점 · D3 ☀️낮\n🍚식량 9 | 🩹의료품 2 | 🧱자재 5 | 🛡️방어력 29\n👥주민 4/10 | 😊사기 61\n🛠️일과: 이나래(휴식), 김소담(의무) / 조현우(파견)\n🚶파견: 조현우·최하은→청운24시 편의점(귀환 D3) | 🚪대기: 없음\n🏢확장 2단계 | ⛽연료 0 💎희귀 0 🧪연구재료 0 | 🔬연구 Lv 0', 'code': True}]


async def setup(page):
    async def reg(route):
        from urllib.parse import unquote
        path = unquote(route.request.url.split('reg.test/CRION/', 1)[-1].split('?')[0])
        if path == 'index.json': return await route.fulfill(body=json.dumps(INDEX, ensure_ascii=False), content_type='application/json')
        f = REG + path
        if os.path.isfile(f): return await route.fulfill(path=f)
        return await route.fulfill(status=404, body='')
    async def img(route):
        from urllib.parse import unquote
        u = unquote(route.request.url)
        f = IMG + ('sh_person.png' if '김소담' in u else 'sh_place.png')
        return await route.fulfill(path=f)
    await page.route('https://reg.test/**', reg)
    await page.route('https://img.test/**', img)


async def ipc(page, ch, data):
    await page.evaluate("""([ch, d]) => { const w = document.querySelector('#crack'); const e = new Event('ipc-message'); e.channel = ch; e.args = [d]; w.dispatchEvent(e); }""", [ch, data])


async def drain(page, n=40):
    for _ in range(n):
        st = await page.evaluate("(()=>{const r=window.__pk&&window.__pk.state;return r?{i:r.i,n:r.beats.length,t:!!r.typing,cen:!!r.cen}:null})()")
        if not st: break
        if st['cen']: await page.click('[data-sh=cen-ok]'); await page.wait_for_timeout(100); continue
        if st['i'] >= st['n'] - 1 and not st['t']: break
        await page.click('#sh-dlg'); await page.wait_for_timeout(50)


sent = lambda page: page.evaluate("window.__sent.filter(x => x[0] === 'crion:send').length")


async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 1440, 'height': 900})
        page.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
        page.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' and 'Failed to load' not in m.text and 'ERR_' not in m.text else None)
        await page.add_init_script("window.__engineVersion='0.8.0'")
        await setup(page)
        await page.goto(BASE)
        await page.evaluate("localStorage.setItem('crion.tut4','1')"); await page.reload(); await page.wait_for_timeout(2000)
        # 1) 일반 사용자: 스토어에 안 보임
        await page.click('.nav [data-v=store]'); await page.wait_for_timeout(500)
        print('일반 사용자 스토어 팩 수:', await page.evaluate("document.querySelectorAll('.pcard').length"))
        # 2) 개발자 로그인(흉내) → 다시 불러오면 보임
        await page.evaluate("window.__crion.S.dev.repo = { loadWorks: async () => ({ data: { works: [], hidden: [] } }), lastDeploy: async () => null }")
        await page.click('.nav [data-v=store]'); await page.wait_for_timeout(800)
        print('개발자 스토어 팩:', await page.evaluate("[...document.querySelectorAll('.pcard .name')].map(x=>x.textContent)"))
        await page.screenshot(path=OUT + 'sh_a1_store_dev.png')
        await page.click('.pcard [data-act=pack]'); await page.wait_for_timeout(500)
        await page.screenshot(path=OUT + 'sh_a2_detail.png')
        await page.click('.modal [data-act=pack-install]')
        for _ in range(120):
            await page.wait_for_timeout(400)
            if await page.evaluate("!!JSON.parse(localStorage.getItem('crion.packs')||'{}')['%s']" % PACK): break
        await page.wait_for_timeout(400)
        await page.click('.modal [data-act=pack-play]'); await page.wait_for_timeout(1500)
        await page.evaluate("""(()=>{const w=document.querySelector('#crack');w.dispatchEvent(new Event('did-stop-loading'));w.dispatchEvent(new Event('dom-ready'));})()""")
        await page.wait_for_function("!!document.querySelector('.sh')", timeout=15000)
        print('위쪽 전환 버튼:', await page.evaluate("document.querySelector('[data-act=pk-crack]').innerText"))
        await page.wait_for_timeout(700); await page.screenshot(path=OUT + 'sh_b0_splash.png')
        await page.wait_for_timeout(2200); await page.screenshot(path=OUT + 'sh_b1_title.png')
        print('음악 · 타이틀:', await page.evaluate('window.__pk.bgmNow()'))
        # 처음부터 → 새 대화 연결
        await page.click('[data-sh=t-new]'); await page.wait_for_timeout(300)
        await ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/detail/safehouse', 'chat': False})
        await ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/safehouse', 'actions': [{'id': 0, 'kind': 'continue', 'label': '이어서 대화하기'}, {'id': 1, 'kind': 'new', 'label': '새로하기'}]})
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + 'sh_b2_opening_new.png')
        print('자동으로 누른 버튼:', [x for x in await page.evaluate('window.__sent') if x[0] == 'crion:click'])
        print('크랙 도우미에 알린 시작 설정:', [x[1].get('modes') for x in await page.evaluate('window.__sent') if x[0] == 'crion:config'][-1:])
        # 새로하기 뒤 시작 설정(기본모드·하드모드) 고르는 창 → 게임 화면에 버튼, 고른 것만 누르고 시작 버튼 한 번
        MODES = [{'id': 0, 'kind': 'new', 'label': '새로하기'}, {'id': 1, 'kind': 'mode', 'label': '기본모드'}, {'id': 2, 'kind': 'mode', 'label': '하드모드'}, {'id': 3, 'kind': 'confirm', 'label': '대화 시작하기'}]
        await ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/safehouse', 'actions': MODES}); await page.wait_for_timeout(300)
        n_click = len([x for x in await page.evaluate('window.__sent') if x[0] == 'crion:click'])
        print('고르기 전 자동 클릭 없음:', n_click == 1, '/ 버튼:', await page.evaluate("[...document.querySelectorAll('.sh-mode')].map(b=>b.innerText)"))
        await page.screenshot(path=OUT + 'sh_b3_pick_mode.png')
        await page.click('.sh-mode[data-label=하드모드]'); await page.wait_for_timeout(200)
        await ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/safehouse', 'actions': MODES + [{'id': 4, 'kind': 'x', 'label': 'sig'}]}); await page.wait_for_timeout(200)
        await ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/safehouse', 'actions': MODES}); await page.wait_for_timeout(200)
        print('누른 버튼(새로하기→하드모드→시작 한 번):', [x[1] for x in await page.evaluate('window.__sent') if x[0] == 'crion:click'])
        await ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/s1', 'chat': True})
        await ipc(page, 'crion:state', {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/s1', 'msgs': 1, 'actions': [{'id': 0, 'kind': 'mode', 'label': '기본모드'}]})
        await page.wait_for_timeout(300)
        print('연결:', await page.evaluate('window.__pk.state.mode'), [x['url'] for x in await page.evaluate('window.__pk.saves()')])
        # 프롤로그 → 영화식 → 등록증
        await ipc(page, 'crion:reply', {'key': 'k0', 'segs': PROLOGUE, 'done': True}); await page.wait_for_timeout(1500)
        await page.screenshot(path=OUT + 'sh_c1_prologue.png')
        for _ in range(30):
            if not await page.evaluate("!!window.__pk.state.cine"): break
            await page.click('#sh-cine .ctext'); await page.wait_for_timeout(60)
        await page.wait_for_timeout(700)
        await page.screenshot(path=OUT + 'sh_c2_register.png')
        await page.fill('#sh-rname', '유'); await page.click('[data-sh=reg-act][data-i="1"]'); await page.click('[data-sh=reg-ok]'); await page.wait_for_timeout(300)
        print('등록증 → 입력칸:', await page.evaluate("document.querySelector('#sh-in').value"), '/ 전송 수:', await sent(page))
        await page.screenshot(path=OUT + 'sh_c3_lobby_after_reg.png')
        print('음악 · 첫 로비(D1 아침):', await page.evaluate('window.__pk.bgmNow()'))
        # 보내기 1번 = 1번
        await page.click('[data-sh=send]'); await page.wait_for_timeout(200); await page.click('[data-sh=send]'); await page.wait_for_timeout(200)
        print('보내기 두 번 눌러도 전송 수:', await sent(page))
        await ipc(page, 'crion:reply', {'key': 'k1', 'segs': [{'t': 'text', 's': '철문 너머로 두 사람의'}], 'done': False}); await page.wait_for_timeout(500)
        await page.screenshot(path=OUT + 'sh_c4_waiting.png')
        # 샘플 1
        await ipc(page, 'crion:reply', {'key': 'k1', 'segs': T1, 'done': True}); await page.wait_for_timeout(1400)
        await page.screenshot(path=OUT + 'sh_d1_turn1.png')
        await page.click('#sh-dlg'); await page.wait_for_timeout(50); await page.click('#sh-dlg'); await page.wait_for_timeout(50); await page.click('#sh-dlg'); await page.wait_for_timeout(1500)
        await page.screenshot(path=OUT + 'sh_d2_turn1_say.png')
        await drain(page); await page.wait_for_timeout(400)
        await page.screenshot(path=OUT + 'sh_d3_turn1_end.png')
        # 샘플 2: 날짜 바뀜 → 아침점호
        await page.evaluate("window.__pk.state.waiting = false")
        await ipc(page, 'crion:reply', {'key': 'k2', 'segs': T2, 'done': True}); await page.wait_for_timeout(700)
        print('아침점호 카드:', (await page.evaluate("(document.querySelector('#sh-cen:not([hidden])')||{innerText:''}).innerText")).replace('\n', ' | '))
        await page.screenshot(path=OUT + 'sh_e1_rollcall.png')
        print('음악 · 아침점호:', await page.evaluate('window.__pk.bgmNow()'))
        await page.click('[data-sh=cen-ok]'); await page.wait_for_timeout(1200)
        await page.screenshot(path=OUT + 'sh_e2_crisis.png')
        print('음악 · 웨이브 그림:', await page.evaluate('window.__pk.bgmNow()'))
        await drain(page)
        # 샘플 3
        await ipc(page, 'crion:reply', {'key': 'k3', 'segs': T3, 'done': True}); await page.wait_for_timeout(700)
        await drain(page); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'sh_f1_turn3.png')
        print('음악 · 편의점 동행(낮):', await page.evaluate('window.__pk.bgmNow()'))
        await page.click('#sh-phone .chev'); await page.wait_for_timeout(500)
        await page.screenshot(path=OUT + 'sh_f2_phone_down.png')
        await page.click('#sh-phone .chev'); await page.wait_for_timeout(500)
        await page.click('[data-sh=endday]'); await page.wait_for_timeout(100)
        print('하루 마치기 → 입력칸:', await page.evaluate("document.querySelector('#sh-in').value"))
        # 관리 화면들
        for k, name in [('building', 'g1_building'), ('people', 'g2_people'), ('explore', 'g3_map'), ('lab', 'g4_lab'), ('dex', 'g5_dex'), ('log', 'g6_log')]:
            if k == 'log': await page.click('#sh-hudr [data-k=log]')
            else: await page.click(f'#sh-screen [data-sh=go][data-k={k}]')
            await page.wait_for_timeout(900)
            if k == 'building':
                await page.screenshot(path=OUT + 'sh_g1a_building_2f.png')
                await page.click('[data-sh=floor][data-k="1"]'); await page.wait_for_timeout(300)
                await page.click('[data-sh=note][data-k=expand]'); await page.wait_for_timeout(200)
                await page.click('.note [data-key=who] >> nth=0'); await page.click('.note [data-key=who] >> nth=1'); await page.wait_for_timeout(200)
                await page.screenshot(path=OUT + 'sh_g1b_building_note.png')
                await page.click('[data-sh=note-fill]'); await page.wait_for_timeout(100)
                print('확장 공사 지시서 → 입력칸:', await page.evaluate("document.querySelector('#sh-in').value"))
                await page.click('[data-sh=note][data-k=ration]'); await page.wait_for_timeout(100); await page.click('.note [data-key=mode][data-v=균등]'); await page.click('[data-sh=note-fill]')
                print('배급 지시서 → 입력칸:', await page.evaluate("document.querySelector('#sh-in').value"))
            if k == 'people':
                await page.click('[data-sh=selp][data-id=김소담]'); await page.wait_for_timeout(300)
                await page.screenshot(path=OUT + 'sh_g2a_people_sodam.png')
                await page.click('[data-sh=note][data-k=job]'); await page.wait_for_timeout(100); await page.click('.note [data-key=job][data-v=보초]'); await page.click('[data-sh=note-fill]')
                print('일과 지시서 → 입력칸:', await page.evaluate("document.querySelector('#sh-in').value"))
                await page.click('[data-sh=selp][data-id=조현우]'); await page.wait_for_timeout(200)
            if k == 'explore':
                await page.click('[data-sh=region][data-k="청운 상가 약국"]'); await page.wait_for_timeout(200)
                await page.click('.note [data-key=team][data-v=김소담]'); await page.click('.note [data-key=team][data-v=이나래]'); await page.click('.note [data-key=form][data-v=당일치기]')
                await page.click('.note [data-sh=withme]'); await page.wait_for_timeout(150)
                print('집 맡을 사람 후보:', await page.evaluate("[...document.querySelectorAll('.note [data-key=keeper]')].map(b=>b.dataset.v)"))
                await page.wait_for_timeout(300)
                await page.screenshot(path=OUT + 'sh_g3a_map_pick.png')
                await page.click('[data-sh=xfill]')
                print('파견 지시서 → 입력칸:', await page.evaluate("document.querySelector('#sh-in').value"))
                print('지도 ? 핀 수:', await page.evaluate("document.querySelectorAll('.pinb.sh-unk').length"), '/ 보이는 핀:', await page.evaluate("document.querySelectorAll('button.pinb').length"))
            await page.screenshot(path=OUT + 'sh_' + name + '.png')
        n0 = await sent(page)
        await page.click('#sh-topnav'); await page.wait_for_timeout(300)
        print('지시서를 여러 번 채워도 전송 수 그대로:', await sent(page) == n0)
        # 겹창
        await page.click('#sh-hudr [data-sh=lines]'); await page.wait_for_timeout(300); await page.screenshot(path=OUT + 'sh_h1_lines.png'); await page.keyboard.press('Escape')
        await page.click('#sh-hudr [data-sh=set]'); await page.wait_for_timeout(300); await page.screenshot(path=OUT + 'sh_h2_set.png'); await page.click('[data-sh=mclose]')
        mem = await page.evaluate("window.__pk.memory")
        print('주민 기록:', {k: v['st'] for k, v in mem['people'].items()}, '/ 사진:', list(mem['face'].keys()), '/ 능력:', mem['stats'])
        # 크랙 화면 토글
        await page.click('[data-act=pk-crack]'); await page.wait_for_timeout(200)
        print('크랙 화면 보기:', await page.evaluate("document.querySelector('#pk').classList.contains('off')"), await page.evaluate("document.querySelector('[data-act=pk-crack]').innerText"))
        await page.click('[data-act=pk-crack]'); await page.wait_for_timeout(200)
        # 다른 대화로 옮기면 읽지 않음
        await ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/other', 'chat': True}); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'sh_i1_away.png')
        await ipc(page, 'crion:reply', {'key': 'kx', 'segs': [{'t': 'text', 's': '다른 대화의 응답'}], 'done': True}); await page.wait_for_timeout(200)
        print('다른 대화 응답 무시:', await page.evaluate("!window.__pk.state.beats.some(b => /다른 대화/.test(b.text))"))
        # 처음 화면 → 세이브 목록 → 이어하기
        await page.click('.sh-gate [data-sh=title]'); await page.wait_for_timeout(400)
        await page.screenshot(path=OUT + 'sh_i2_title_saves.png')
        await page.evaluate("window.__loads = []")
        await page.click('.sh-save [data-sh=t-cont]'); await page.wait_for_timeout(300)
        print('이어하기 → 연 주소:', await page.evaluate('window.__loads'), '/ 상태 복원:', await page.evaluate("(window.__pk.memory.status||{}).day"))
        # 작은 화면
        await page.set_viewport_size({'width': 1100, 'height': 680}); await page.wait_for_timeout(300)
        await ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/s1', 'chat': True})
        await ipc(page, 'crion:reply', {'key': 'k4', 'segs': T3, 'done': True}); await page.wait_for_timeout(500); await drain(page)
        await page.screenshot(path=OUT + 'sh_j1_small.png')
        await b.close()
    print('\n오류:', errs or '없음')

if __name__ == '__main__':
    asyncio.run(main())
