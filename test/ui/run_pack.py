# 플레이팩 「소환수 아카데미」 화면 점검: python3 test/ui/run_pack.py → test/out/pk_*.png
#  먼저 node scripts/make-registry.js https://reg.test/CRION/ 로 registry/ 를 만든다 (이 스크립트가 알아서 실행)
#  가짜 업데이트 서버(reg.test) + 가짜 크랙 화면(webview ipc 흉내)으로 받기 → 플레이 → 연출 → 모달을 돌려 본다
import asyncio, json, os, subprocess, sys
from playwright.async_api import async_playwright
ROOT = '/home/claude/crion/'
BASE = 'file://' + ROOT + 'test/ui/harness.html'
OUT = ROOT + 'test/out/'
REG = ROOT + 'registry/'
os.makedirs(OUT, exist_ok=True)
subprocess.run(['node', 'scripts/make-registry.js', 'https://reg.test/CRION/'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
INDEX = json.load(open(REG + 'index.json', encoding='utf-8'))
PACK = os.environ.get('PACK', 'hirion.summoner-academy')   # 성인판: PACK=hirion.summoner-academy-adult
INDEX['packs'] = [p for p in INDEX['packs'] if p['id'] == PACK]
for p in INDEX['packs']:
    p['workUrl'] = 'https://crack.wrtn.ai/detail/summoner'
TURNS = json.load(open(ROOT + 'test/fixtures/academy_turns.json', encoding='utf-8'))['turns']
CATALOG = json.load(open(REG + 'catalog.json', encoding='utf-8'))

FIRST = """*소환진이 일곱 빛깔로 타올랐다. 빛 속에서 촛불을 머리에 인 작은 아이가 나타났다.*

"저, 저기… 괜찮아요?" 위카가 소매를 붙잡았다.

**마가렛 교수** "계약 성립입니다. 손등의 문장을 확인하십시오."

📖 도감 등록! 🔑AC·위카·1C

💡 위카에게 인사한다 / 손등을 본다 / 레이먼드를 본다
━━━━━━━━━━━━━━
📅 1학년 봄 1일차 오전 | 📍소환의제단
🎓 하루 | 🏠해의 동 | 💰3은 0동 | 🎒상처약×2, 계약석×1
🐾 위카(위카·기본) Lv 5 | ❤️165/165 | ✨XP 0/20
 공55 방80 특공95 특방110 속80 | 없음
 기술: 촛불 점화(💫40|15 화상10%) 촛농 붕대(✨|5 HP 25% 회복)
📦 계약 1/6 | 📖 도감 1/80 | 🏅 배지 0/7
📜 의뢰: 없음 | 🗓️ 다음 일정: 저녁 신입생 환영회
━━━━━━━━━━━━━━"""

EVOLVE = """*위카의 몸이 빛에 감싸였다. 촛불이 등불로, 작은 손이 길어진다.*

【탤로윈|웃음】"저… 이제, 지킬 수 있어요."

📖 도감 등록! 🔑AC·위카·2C
🏅 배지 획득! 🔑BG·마가렛

💡 탤로윈을 안아 준다 / 마가렛에게 인사한다
━━━━━━━━━━━━━━
📅 1학년 가을 3일차 오후 | 📍대투기장
🎓 하루 | 🏠해의 동 | 💰12은 40동 | 🎒상처약×3, 계약석×2, 고급 계약석×1
🐾 탤로윈(위카·1진화) Lv 16 | ❤️272/272 | ✨XP 0/64
 공92 방117 특공140 특방156 속117 | 없음
 기술: 촛불 점화(💫40|15/15 화상10%) 촛농 붕대(✨|5/5 HP 25% 회복) 밀랍 방벽(✨|5/5 2턴 받는 피해 절반)
🐾 오토(오토·기본) Lv 12 | ❤️180/180 | ✨XP 10/48
 공119 방84 특공74 특방84 속139 | 화상
 기술: 물살 박치기(⚔️40|15/15 선공) 조개 던지기(⚔️25×2|10/10)
📦 계약 3/6 | 📖 도감 6/80 | 🏅 배지 1/7
📜 의뢰: 서고 폐허 조사(★2) | 🗓️ 다음 일정: 에테르나 컵 D-17
━━━━━━━━━━━━━━
【CRION】
fx=sparks
【/CRION】"""

CAPTURE = TURNS[1].replace('야생 월리 Lv 15 ❤️71/215', '야생 월리 Lv 15 ❤️40/215').replace('❤️58/210 [없음]', '❤️120/210 [없음]').replace('❤️58/210 |', '❤️120/210 |')


async def setup(page):
    async def reg(route):
        u = route.request.url
        path = u.split('reg.test/CRION/', 1)[-1].split('?')[0]
        from urllib.parse import unquote
        path = unquote(path)
        if path == 'index.json': return await route.fulfill(body=json.dumps(INDEX, ensure_ascii=False), content_type='application/json')
        f = REG + path
        if os.path.isfile(f): return await route.fulfill(path=f)
        return await route.fulfill(status=404, body='')
    await page.route('https://reg.test/**', reg)


def reply(text, key):
    return json.dumps({'key': key, 'segs': [{'t': 'text', 's': text}], 'done': True}, ensure_ascii=False)


async def ipc(page, ch, data):
    await page.evaluate("""([ch, d]) => { const w = document.querySelector('#crack'); const e = new Event('ipc-message'); e.channel = ch; e.args = [d]; w.dispatchEvent(e); }""", [ch, json.loads(data) if isinstance(data, str) else data])


async def drain(page, n=30):
    # 대사를 끝까지 넘긴다 (겹창이 있으면 닫고)
    for _ in range(n):
        st = await page.evaluate("(()=>{const r=window.__pk&&window.__pk.state;return r?{i:r.i,n:r.beats.length,ov:r.overlayOn,t:!!r.typing}:null})()")
        if not st: break
        if st['ov']:
            await page.click('.ak-ov [data-ak=ov-close].ak-btn.primary'); await page.wait_for_timeout(250); continue
        if st['i'] >= st['n'] - 1 and not st['t']: break
        await page.click('.ak-dlg'); await page.wait_for_timeout(60)


async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
        page = await b.new_page(viewport={'width': 1440, 'height': 900})
        page.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
        page.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' and 'Failed to load' not in m.text and 'ERR_' not in m.text else None)
        await page.add_init_script("window.__engineVersion='0.5.0'")
        await setup(page)
        await page.goto(BASE); await page.evaluate("localStorage.setItem('crion.tut4','1'); localStorage.setItem('crion.prefs', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('crion.prefs')||'{}'), {adult: %s})))" % ('true' if PACK.endswith('-adult') else 'false')); await page.reload(); await page.wait_for_timeout(2000)
        # 스토어
        await page.click('.nav [data-v=store]'); await page.wait_for_timeout(600)
        await page.screenshot(path=OUT + 'pk_a1_store.png')
        await page.click('.pcard [data-act=pack]'); await page.wait_for_timeout(500)
        await page.screenshot(path=OUT + 'pk_a2_detail.png')
        await page.click('.modal [data-act=pack-install]'); await page.wait_for_timeout(400)
        await page.screenshot(path=OUT + 'pk_a3_downloading.png')
        for _ in range(120):
            await page.wait_for_timeout(500)
            if await page.evaluate("!!JSON.parse(localStorage.getItem('crion.packs')||'{}')['hirion.summoner-academy']"): break
        await page.wait_for_timeout(400)
        await page.screenshot(path=OUT + 'pk_a4_installed.png')
        n = await page.evaluate("""new Promise(r=>{const q=indexedDB.open('crion-packs');q.onsuccess=()=>{const t=q.result.transaction('files').objectStore('files').count();t.onsuccess=()=>r(t.result)}})""")
        print('저장된 파일 수:', n, '/', len(INDEX['packs'][0]['files']))
        # 플레이
        await page.click('.modal [data-act=pack-play]'); await page.wait_for_timeout(1500)
        await page.evaluate("""(()=>{const w=document.querySelector('#crack');w.dispatchEvent(new Event('did-stop-loading'));w.dispatchEvent(new Event('dom-ready'));})()""")
        await page.wait_for_function("!!document.querySelector('.ak')", timeout=15000)
        await page.wait_for_timeout(300)
        print('보낸 설정:', [x for x in await page.evaluate('window.__sent') if x[0] == 'crion:config'][:1])
        await page.screenshot(path=OUT + 'pk_b0_title.png')
        # 처음부터: 새 대화를 열고(작품 화면의 '새 대화'를 한 번 누름) 새 대화가 열리면 세이브에 연결
        await page.click('[data-ak=t-new]'); await page.wait_for_timeout(300)
        print('처음부터 → 연 주소:', await page.evaluate('window.__loads'))
        await ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/detail/summoner', 'chat': False})
        await ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/summoner', 'actions': [{'id': 0, 'kind': 'continue', 'label': '이어서 대화하기'}, {'id': 1, 'kind': 'new', 'label': '새 대화'}]})
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + 'pk_b1_opening_new.png')
        print('자동으로 누른 버튼:', [x for x in await page.evaluate('window.__sent') if x[0] == 'crion:click'])
        # 예전 대화의 응답은 연결 전이라 읽지 않는다
        await ipc(page, 'crion:reply', reply('*예전 대화의 마지막 응답*', 'old'))
        await ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/new1', 'chat': True})
        await ipc(page, 'crion:state', {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/new1', 'msgs': 1, 'actions': []})
        await page.wait_for_timeout(300)
        st = await page.evaluate("({mode: window.__pk.state.mode, beats: window.__pk.state.beats.length, saves: window.__pk.saves()})")
        print('연결:', st['mode'], '/ 예전 응답 읽음:', st['beats'], '/ 세이브:', [(x['url']) for x in st['saves']])
        print('다시 읽기 요청(config):', len([x for x in await page.evaluate('window.__sent') if x[0] == 'crion:config']))
        # 프롤로그(첫 화면): 그림 순서대로 무대 전체 → 대사 끝나면 소환의 제단
        R = 'https://reg.test/CRION/packs/hirion.summoner-academy/'
        PRO = [{'t': 'img', 'src': R + 'assets/bg/hero.webp', 'w': 1080, 'h': 560},
               {'t': 'text', 's': '*사흘 동안 안개 속을 헤친 은빛 갈매기호가 마침내 닻을 내렸다.*\n\n**에테르나 아카데미.**\n\n*입학식이 끝나자, 신입생들은 첨탑 아래 \'소환의 제단\' 앞에 길게 줄을 섰다.*\n'},
               {'t': 'img', 'src': R + 'assets/c/margaret.webp', 'w': 480, 'h': 640},
               {'t': 'text', 's': '**마가렛 교수** "다음, {user}. 소환진 중앙에 손을 올리고 마나를 일정하게 흘려 넣으십시오."\n\n**레이먼드 교수** "…하암. 긴장할 거 없어."\n'},
               {'t': 'img', 'src': R + 'assets/c/raymond.webp', 'w': 480, 'h': 640},
               {'t': 'text', 's': '*제단 위 소환진이 당신의 마나를 기다리며 희미하게 맥동한다.*'}]
        await ipc(page, 'crion:reply', {'key': 'k0', 'segs': PRO, 'done': True}); await page.wait_for_timeout(1500)
        await page.screenshot(path=OUT + 'pk_c0a_prologue_bg.png')
        for i in range(3): await page.click('.ak-dlg'); await page.wait_for_timeout(80)
        await page.wait_for_timeout(1500)
        print('3번째 장면 무대 그림:', await page.evaluate("window.__pk.state.bgKey.split('/').slice(-1)[0]"))
        await page.screenshot(path=OUT + 'pk_c0b_prologue_person.png')
        for i in range(12):
            if await page.query_selector('.ak-ov'): break
            await page.click('.ak-dlg'); await page.wait_for_timeout(80)
        await page.wait_for_timeout(1200)
        await page.screenshot(path=OUT + 'pk_c0c_altar.png')
        before = len([x for x in await page.evaluate('window.__sent') if x[0] == 'crion:send'])
        # 0.5.5: 프롤로그 뒤엔 입학 등록 창 (결과 붙여 넣고 한 번 보내기)
        await page.wait_for_selector('.akr-sheet')
        await page.screenshot(path=OUT + 'pk_r1_form.png')
        await page.fill('#rName', '아린'); await page.fill('#rAge', '20')
        await page.click('[data-r=g][data-v=f]'); await page.select_option('#rOrigin', index=1)
        await page.click('[data-r=mon] >> nth=0'); await page.click('[data-r=submit]'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'pk_r2_card.png')
        await page.wait_for_selector('#rNext:not([disabled])', timeout=15000); await page.click('#rNext')
        box = await page.query_selector('#rHold'); bb = await box.bounding_box()
        await page.mouse.move(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); await page.mouse.down(); await page.wait_for_timeout(1500)
        await page.screenshot(path=OUT + 'pk_r3_altar.png')
        await page.wait_for_timeout(1700); await page.mouse.up(); await page.wait_for_timeout(2000)
        await page.screenshot(path=OUT + 'pk_r4_result.png')
        await page.click('[data-r=send]'); await page.wait_for_timeout(300)
        sent_txt = [x for x in await page.evaluate('window.__sent') if x[0] == 'crion:send']
        print('입학 결과 글 첫 줄:', (sent_txt[-1][1].get('text', '') if sent_txt else '').split('\n')[0])
        print('입학 등록 → 보낸 횟수:', len([x for x in await page.evaluate('window.__sent') if x[0] == 'crion:send']) - before)
        await page.evaluate("window.__pk.state.waiting = false")
        # 첫 응답: 소환 (대사가 다 끝난 뒤 소환 연출)
        await ipc(page, 'crion:reply', {'key': 'k1', 'segs': [{'t': 'text', 's': FIRST.split('\n\n', 1)[0] + '\n'}, {'t': 'img', 'src': R + 'assets/s/위카_기본기쁨.webp', 'w': 800, 'h': 600}, {'t': 'text', 's': FIRST.split('\n\n', 1)[1]}], 'done': True})
        await page.wait_for_timeout(600)
        print('첫 장면에 겹창 없음:', not await page.query_selector('.ak-ov'))
        await page.click('.ak-dlg'); await page.wait_for_timeout(50); await page.click('.ak-dlg'); await page.wait_for_timeout(900)
        await page.screenshot(path=OUT + 'pk_c3_margaret.png')
        for i in range(12):
            if await page.query_selector('.ak-ov'): break
            await page.click('.ak-dlg'); await page.wait_for_timeout(80)
        await page.wait_for_timeout(1300)
        await page.screenshot(path=OUT + 'pk_c1_summon.png')
        await page.click('.ak-ov .ak-btn.primary'); await page.wait_for_timeout(500)
        await page.screenshot(path=OUT + 'pk_c2_after_summon.png')
        # 샘플 1 (평상)
        await ipc(page, 'crion:reply', reply(TURNS[0], 'k2')); await page.wait_for_timeout(500)
        for _ in range(3): await page.click('.ak-dlg'); await page.wait_for_timeout(60)
        await page.wait_for_timeout(1000)
        await page.screenshot(path=OUT + 'pk_d1_turn1.png')
        for _ in range(20): await page.click('.ak-dlg'); await page.wait_for_timeout(50)
        await page.wait_for_timeout(400)
        await page.screenshot(path=OUT + 'pk_d2_turn1_choices.png')
        # 카드 뒤집기
        await page.click('.ak-pc'); await page.wait_for_timeout(700)
        await page.screenshot(path=OUT + 'pk_d3_flip.png', clip={'x': 1060, 'y': 0, 'width': 380, 'height': 900})
        await page.click('.ak-pc'); await page.wait_for_timeout(300)
        # 샘플 2 (위기 · 전투)
        await ipc(page, 'crion:reply', reply(TURNS[1], 'k3')); await page.wait_for_timeout(900)
        await page.screenshot(path=OUT + 'pk_e1_battle.png')
        for _ in range(20): await page.click('.ak-dlg'); await page.wait_for_timeout(50)
        await page.wait_for_timeout(500)
        await page.screenshot(path=OUT + 'pk_e2_battle_actions.png')
        await page.click('.ak-act.skill'); await page.wait_for_timeout(150)
        print('기술 버튼 → 입력창:', await page.evaluate("document.querySelector('#akIn').value"))
        sent_before = len([x for x in await page.evaluate('window.__sent') if x[0] == 'crion:send'])
        await page.click('[data-ak=send]'); await page.wait_for_timeout(300)
        sent_after = [x for x in await page.evaluate('window.__sent') if x[0] == 'crion:send']
        print('보내기 1번 → 전송', len(sent_after) - sent_before, '번:', sent_after[-1][1])
        await page.click('[data-ak=send]'); await page.wait_for_timeout(200)
        print('쓰는 중 다시 눌러도 전송 수:', len([x for x in await page.evaluate('window.__sent') if x[0] == 'crion:send']) - sent_before)
        await ipc(page, 'crion:reply', json.dumps({'key': 'k4', 'segs': [{'t': 'text', 's': '*위카가 촛불을 높이 들었다. 불꽃이…*'}], 'done': False}, ensure_ascii=False))
        await page.wait_for_timeout(400); await page.screenshot(path=OUT + 'pk_e3_writing.png')
        # 포획 가능 상태
        await ipc(page, 'crion:reply', reply(CAPTURE, 'k4')); await page.wait_for_timeout(500)
        for _ in range(20): await page.click('.ak-dlg'); await page.wait_for_timeout(40)
        await page.wait_for_timeout(400)
        print('계약석 버튼:', await page.evaluate("[...document.querySelectorAll('.ak-act.cap')].map(b=>b.innerText.replace(/\\n/g,' '))"))
        await page.screenshot(path=OUT + 'pk_e4_capture.png')
        # 아카데미+ 형식: ▶ 행동 줄(급소·효과)·🎯 포획·과제 카드·힌트 한 줄
        PLUS_ON = PACK.endswith('-adult')
        PLUS = '풀숲이 크게 흔들렸다.\n위카💬 "지금이에요!"\n🎯 포획 성공! 월리\n보건실로 간다 / 시가지로 간다 / 도서관에 들른다\n━━━━━━━━━━━━━━\n📅 1학년 봄 3일차 오후 | 📍야생지대 | 💰3은 0동\n⚔️ 근교 야생 · 4턴째 | 🔮 상대 예고: 회전 바람\n▶ 🗡️ 위카 「촛불 점화」 💥-42 (화상) 🔺 ❗ / 🗡️ 야생 월리 「회전 바람」 💥-12 🔻\n🟦 위카 Lv5 ❤️120/165 | - | 대기 ●\n🟥 야생 월리 Lv6 ❤️9/215 | 화상 | 대기 -\n🎓 {user} | 🏠해의 동\n🐾 위카(위카·기본) Lv 5 ❤️120/165 ✨XP 0/20 | - | 기술: 촛불 점화(💫40|13/15 화상10%), 촛농 붕대(✨|5/5 HP 25% 회복)\n🎒 상처약×2, 계약석×1\n📦 계약 1/6 | 📖 1/80 | 🏅 0/7\n📜 과제: 근교 야생 1마리 포획 (D-1) / 의뢰: 잃어버린 열쇠 | 🗓️ 신입생 친선전 D-22\n━━━━━━━━━━━━━━'
        if PLUS_ON:
          await ipc(page, 'crion:reply', reply(PLUS, 'kp1')); await page.wait_for_timeout(600)
          for _ in range(12): await page.evaluate("(document.querySelector('.ak-ov')||{}).tagName || document.querySelector('.ak-dlg').click()"); await page.wait_for_timeout(60)
          await page.wait_for_timeout(400)
          await page.screenshot(path=OUT + 'pk_p1_plus_battle.png')
          await page.screenshot(path=OUT + 'pk_p2_plus_hud.png', clip={'x': 1060, 'y': 0, 'width': 380, 'height': 900})
          await page.wait_for_timeout(2600)
          await page.screenshot(path=OUT + 'pk_p3_plus_capture.png')
          print('힌트(플러스):', await page.evaluate("[...document.querySelectorAll('.ak-hints button')].map(b=>b.innerText)"))
          print('과제 카드:', await page.evaluate("[...document.querySelectorAll('.ak-task')].map(b=>b.innerText.replace(/\\n/g,' '))"))
          await page.evaluate("document.querySelector('.ak-ov [data-ak=ov-close]') && document.querySelector('.ak-ov [data-ak=ov-close]').click()")
        # 샘플 3 (선택지)
        await ipc(page, 'crion:reply', reply(TURNS[2], 'k5')); await page.wait_for_timeout(500)
        await page.click('.ak-dlg'); await page.wait_for_timeout(900)
        await page.screenshot(path=OUT + 'pk_f1_turn3.png')
        for _ in range(20): await page.click('.ak-dlg'); await page.wait_for_timeout(40)
        await page.wait_for_timeout(300)
        await page.click('.ak-hints button >> nth=1'); await page.wait_for_timeout(150)
        print('선택지 → 입력창:', await page.evaluate("document.querySelector('#akIn').value"))
        await page.screenshot(path=OUT + 'pk_f2_turn3_choice.png')
        # 진화 + 배지
        await ipc(page, 'crion:reply', reply(EVOLVE, 'k6')); await page.wait_for_timeout(500)
        for _ in range(10):
            if await page.query_selector('.ak-ov'): break
            await page.click('.ak-dlg'); await page.wait_for_timeout(80)
        await page.wait_for_timeout(2600)
        await page.screenshot(path=OUT + 'pk_g1_evolve.png')
        await page.click('.ak-ov .ak-btn.primary'); await page.wait_for_timeout(1200)
        await page.screenshot(path=OUT + 'pk_g1b_join.png')
        await page.click('.ak-ov .ak-btn.primary'); await page.wait_for_timeout(700)
        await page.screenshot(path=OUT + 'pk_g2_badge.png')
        if await page.query_selector('.ak-ov .ak-btn.primary'): await page.click('.ak-ov .ak-btn.primary')
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'pk_g3_two_partners.png')
        # 선택지 화면 + 수치 없는 상태창(크리온이 계산)
        CHOICE = """세라가 책을 끌어안은 채 고개를 갸웃했다. 복도 끝에서 종이 울린다.

세라💬 "같이 도서관 갈래? 아니면… 다른 데?"

어떻게 할까?
1. 세라를 따라 도서관으로 간다
2. 혼자 대투기장에서 훈련한다
3. 탤로윈에게 의견을 묻는다
━━━━━━━━━━━━━━
📅 1학년 가을 4일차 오후 | 📍강의실 | 💰12은 40동
🎓 하루 | 🏠해
🐾 탤로윈(위카·1진화) Lv 16
📦 계약 3/6 | 📖 6/80 | 🏅 1/7
━━━━━━━━━━━━━━"""
        await ipc(page, 'crion:reply', reply(CHOICE, 'kc')); await page.wait_for_timeout(500)
        for _ in range(12):
            if await page.evaluate("window.__pk.state.overlayOn"): break
            await page.click('.ak-dlg'); await page.wait_for_timeout(80)
        await page.wait_for_timeout(700)
        await page.screenshot(path=OUT + 'pk_j1_choice.png')
        await page.click('.ak-choice-btn >> nth=1'); await page.wait_for_timeout(200)
        await page.type('#akChoiceIn', ' 탤로윈도 같이.'); await page.wait_for_timeout(200)
        await page.screenshot(path=OUT + 'pk_j2_choice_pick.png')
        n0 = len([x for x in await page.evaluate('window.__sent') if x[0] == 'crion:send'])
        await page.click('[data-ak=choice-send]'); await page.wait_for_timeout(500)
        sent = [x for x in await page.evaluate('window.__sent') if x[0] == 'crion:send']
        print('선택지 보내기 → 전송', len(sent) - n0, '번:', sent[-1][1] if sent else None)
        await page.screenshot(path=OUT + 'pk_j3_waiting_tip.png')
        await page.evaluate("window.__pk.state.waiting = false")
        await ipc(page, 'crion:reply', reply(CHOICE.replace('어떻게 할까?\n1. 세라를 따라 도서관으로 간다\n2. 혼자 대투기장에서 훈련한다\n3. 탤로윈에게 의견을 묻는다\n', ''), 'kc2')); await page.wait_for_timeout(500)
        await drain(page); await page.wait_for_timeout(300)
        await page.click('.ak-pc'); await page.wait_for_timeout(600)
        await page.screenshot(path=OUT + 'pk_j4_calc_stats.png', clip={'x': 1060, 'y': 0, 'width': 380, 'height': 900})
        await page.click('.ak-pc'); await page.wait_for_timeout(300)
        # 모달
        for k, name in [('m-dex', 'h1_dex'), ('m-people', 'h3_people'), ('m-map', 'h4_map'), ('m-bag', 'h5_bag'), ('m-badge', 'h6_badge'), ('m-set', 'h7_set'), ('log', 'h8_log')]:
            await page.click(f'.ak-menu [data-ak={k}]' if k != 'log' else '.ak-dlg-tools [data-ak=log]'); await page.wait_for_timeout(400)
            if k == 'm-dex':
                await page.screenshot(path=OUT + 'pk_h0_dex_grid.png')
                await page.click('.ak-dc.c >> nth=1'); await page.wait_for_timeout(300)
            await page.screenshot(path=OUT + 'pk_' + name + '.png')
            await page.keyboard.press('Escape'); await page.wait_for_timeout(150)
        # 크랙 화면 토글
        await page.click('[data-act=pk-crack]'); await page.wait_for_timeout(200)
        print('크랙 화면 보기:', await page.evaluate("document.querySelector('#pk').classList.contains('off')"))
        await page.click('[data-act=pk-crack]'); await page.wait_for_timeout(200)
        mem = await page.evaluate("(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('crion.pk.hirion.summoner-academy.s.'));return JSON.parse(localStorage.getItem(k)||'{}')})()")
        print('도감 기록:', sorted(int(k) for k in mem.get('codex', {})), '배지:', list(mem.get('badges', {}).keys()), '만난 사람:', list(mem.get('met', {}).keys()))
        # 나가기 → 다시 열기: 처음 화면에 세이브, 이어하기는 세이브 대화만
        await page.click('[data-act=leave]'); await page.wait_for_timeout(300)
        await page.click('.nav [data-v=home]'); await page.wait_for_timeout(300)
        await page.evaluate("window.__loads = []")
        await page.evaluate("document.querySelector('.card .play[data-id=wsa]') ? 0 : 0")
        await page.evaluate("window.__crion.S.works.length")
        await page.evaluate("(()=>{const w=window.__crion.S.works.find(x=>/소환수/.test(x.name)); if (w) document.dispatchEvent(new CustomEvent('x')); return !!w})()")
        await page.click('.nav [data-v=store]'); await page.wait_for_timeout(400)
        await page.click('.pcard [data-act=pack]'); await page.wait_for_timeout(400)
        await page.click('.modal [data-act=pack-play]'); await page.wait_for_timeout(1500)
        await page.evaluate("""(()=>{const w=document.querySelector('#crack');w.dispatchEvent(new Event('did-stop-loading'));w.dispatchEvent(new Event('dom-ready'));})()""")
        await page.wait_for_function("!!document.querySelector('.ak-title:not([hidden])')", timeout=15000)
        await page.wait_for_timeout(400)
        await page.screenshot(path=OUT + 'pk_i1_title_saves.png')
        await page.click('[data-ak=t-cont]'); await page.wait_for_timeout(300)
        print('이어하기 → 연 주소:', await page.evaluate('window.__loads'))
        await ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/new1', 'chat': True})
        await ipc(page, 'crion:reply', reply(TURNS[2], 'k9')); await page.wait_for_timeout(600)
        print('이어하기 응답 읽음:', await page.evaluate("window.__pk.state.beats.length > 0"), '/ HUD 상태 복원:', await page.evaluate("!!window.__pk.state.status"))
        # 크랙 화면에서 다른 대화로 옮기면 읽지 않음
        await ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/other', 'chat': True}); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'pk_i2_away.png')
        await ipc(page, 'crion:reply', reply('*다른 대화의 응답*', 'k10')); await page.wait_for_timeout(300)
        print('다른 대화 응답 무시:', await page.evaluate("!window.__pk.state.beats.some(b => /다른 대화/.test(b.text))"))
        await page.click('[data-ak=back-save]'); await page.wait_for_timeout(200)
        print('세이브 대화로 돌아가기 → 연 주소:', (await page.evaluate('window.__loads'))[-1])
        # 처음부터 2: 크랙이 예전 대화를 열어 버린 경우 → 대화 화면의 '새 대화'를 한 번 누름
        await page.click('.ak-gate [data-ak=title]'); await page.wait_for_timeout(300)
        await page.click('[data-ak=t-new]'); await page.wait_for_timeout(200)
        await page.evaluate("window.__sent = []")
        await ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/old-before-crion', 'chat': True})
        await ipc(page, 'crion:state', {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/old-before-crion', 'msgs': 14, 'actions': [{'id': 3, 'kind': 'new', 'label': '새 대화'}]})
        await page.wait_for_timeout(300)
        print('예전 대화 → 누른 버튼:', [x for x in await page.evaluate('window.__sent') if x[0] == 'crion:click'], '/ 모드:', await page.evaluate('window.__pk.state.mode'))
        await ipc(page, 'crion:state', {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/new2', 'msgs': 1, 'actions': [{'id': 3, 'kind': 'new', 'label': '새 대화'}]})
        await page.wait_for_timeout(300)
        print('새 대화 연결:', await page.evaluate('window.__pk.state.mode'), [x['url'] for x in await page.evaluate('window.__pk.saves()')])
        # 버튼이 없는 경우 안내
        await page.click('[data-ak=m-set]') if False else None
        await b.close()
    print('\n오류:', errs or '없음')

if __name__ == '__main__':
    asyncio.run(main())
