# 리온대학교 x스학과 팩 화면 점검: python3 test/ui/run_univ.py → test/out/uv_*.png
import asyncio, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import run_safehouse as T
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(HERE, '..', '..')) + '/'
OUT = ROOT + 'test/out/'
os.system(f'cd {ROOT} && node scripts/make-registry.js https://reg.test/CRION/ > /dev/null 2>&1')
IDX = json.load(open(ROOT + 'registry/index.json', encoding='utf-8'))
PK = 'hirion.rion-univ'
T.INDEX.clear(); T.INDEX.update(IDX)
T.INDEX['devPacks'] = [p for p in IDX['packs'] + IDX.get('devPacks', []) if p['id'] == PK]
T.INDEX['packs'] = []
for p in T.INDEX['devPacks']: p['workUrl'] = 'https://crack.wrtn.ai/detail/univ'
U = ROOT + 'packs/hirion.rion-univ/assets/'
def im(name, w, h, alt=''): return {'t': 'img', 'src': 'https://img.test/' + name, 'w': w, 'h': h, 'alt': alt}
def tx(s, code=False): return {'t': 'text', 's': s, 'code': code}
PRO = [im('bg_gate', 1280, 715), tx('EPISODE. 1 | 입학\n=\n세계는 저출산으로 인류 존속의 위기를 맞았다.\n한국은 대학에서 X스에 관한 학문을 가르치도록 했고 이는 명문대 [리온대학교]도 예외가 아니었다..\n그리고 나는 오늘, 그 리온대학교 X스학과에 입학한다.\n나는 합격통지서를 쥐고 신체검사실 문 앞에 섰다. 안에서 무표정한 목소리가 들린다.'),
       im('p_gahee', 400, 500), tx('양가희 검사관💬 "다음 신입생. 결과서를 제출하십시오."\n아래 형식 그대로 붙여넣어 제출하세요.\n[입학 검사 결과 | 리온대학교 X스학과]\n이름:\n나이:\n특기:\n취미:\n성격:\n등급:\n능력치:\n※ 아직 검사를 안 받았다면 검사소에서 먼저 받고 오세요.')]
T1 = [im('bg_board', 1280, 715), tx('양가희가 결과서를 받아 들고 무표정하게 수치를 읽어 내려간다.'), im('p_gahee', 400, 500),
      tx('양가희 💬 "체력 62, 이론 80, 센스 70. 등급 B. 평균입니다. 평균은 나쁜 수치가 아닙니다."'),
      im('bg_cherry', 1280, 715), tx('오리엔테이션장으로 가는 벚꽃길. 누군가 등 뒤에서 헤드락을 건다.'), im('p_yeeun', 360, 450),
      tx('차예은 💬 "야! 너 진짜 여기 왔네? 밥은 먹고 다니냐?"'), im('p_sohee', 360, 450),
      tx('유소희 💬 "어머~ 신입생이 벌써 여자를 끼고 다녀? 나도 끼워 줘~"'),
      tx('[가가오톡 | 박준호] 야 오티 끝나고 학식 ㄱ? ㅋㅋ\n[가가오톡 | 1학년 단톡방 | 이민지] 개총 이번주 목요일 7시 밤결임!!'),
      tx('뤼브리타임 | 자유게시판\n1. 유라 교수 X스학개론 꿀팁 - 익명1\n파트너랑 호흡 점수가 절반임 진짜로\nㄴ 익명2: 손수건 챙겨가셈 ㅋㅋ\n\n2. "학식 계란후라이 기준이 뭐임"\n인사 잘하면 준다는데 사실?\n익명3: 그때그때 기분이래'),
      tx('📅 1학년 1학기 | 1주차 월요일 11:20 | 📍벚꽃길\n🎓 김신입 | 등급: B | 직전 학기 평점: -\n📚 X스학개론(과제 0/4, -) · 체력과 지구력 트레이닝(과제 0/4, -) · 연애심리와 유혹 커뮤니케이션(과제 0/4, -) · 커플 실습 세미나(과제 0/4, -) · 교양 요가(과제 0/4, -)\n💌 차예은 🧡20.5 · 유소희 💜5\n📝 다음 일정: 13:00 X스학개론 첫 수업 (X스학관 301)', True)]
T2 = [im('bg_lab', 1280, 715), tx('X스학관 301호. 조유라 교수가 손수건으로 목을 닦으며 칠판 앞에 선다.'), im('p_yura', 400, 500),
      tx('조유라 💬 "첫 과제는 2인 1조입니다. 파트너와의 호흡을 보겠습니다."'), im('p_dain', 360, 450), tx('강다인💬 "저, 저기… 혹시 파트너 정했어? 아, 아니 그냥 물어본 거야!"'),
      tx('📅 1학년 1학기 | 2주차 수요일 14:40 | 📍X스학관 301\n🎓 김신입 | 등급: B | 직전 학기 평점: -\n📚 X스학개론(과제 1/4, A) · 체력과 지구력 트레이닝(과제 1/4, B) · 연애심리와 유혹 커뮤니케이션(과제 0/4, -) · 커플 실습 세미나(과제 0/4, -) · 교양 요가(과제 1/4, B)\n💌 차예은 🧡21.2 · 유소희 💜6 · 강다인 💜6.3 · 조유라 💜5.5\n📝 다음 일정: 목 19:00 개강총회 (밤결)', True)]
IMGS = {'bg_gate': 'bg/gate.webp', 'bg_board': 'bg/board.webp', 'bg_cherry': 'bg/cherry.webp', 'bg_lab': 'bg/lab.webp', 'p_gahee': 'face/gahee.webp', 'p_yeeun': 'face/yeeun.webp', 'p_sohee': 'face/sohee.webp', 'p_yura': 'face/yura.webp', 'p_dain': 'face/dain.webp'}

async def run(b, name, vp, mobile):
    errs = []
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
    page = await ctx.new_page()
    page.on('pageerror', lambda e: errs.append(str(e)))
    await page.add_init_script("window.__engineVersion='0.9.17'")
    await T.setup(page)
    async def img(route):
        k = route.request.url.split('img.test/')[1]
        await route.fulfill(path=U + IMGS.get(k, 'bg/gate.webp'))
    await page.route('https://img.test/**', img)
    await page.goto(T.BASE); await page.evaluate("localStorage.setItem('crion.tut4','1');localStorage.setItem('crion.prefs',JSON.stringify({adult:true}))"); await page.reload(); await page.wait_for_timeout(1800)
    await page.evaluate("window.__crion.S.dev.repo = { loadWorks: async () => ({ data: { works: [], hidden: [] } }), lastDeploy: async () => null }")
    await page.click('.nav [data-v=store]'); await page.wait_for_timeout(800)
    await page.click('.pcard [data-act=pack]'); await page.wait_for_timeout(500)
    if name == 'pc': await page.screenshot(path=OUT + f'uv_{name}_0_store.png')
    await page.click('.modal [data-act=pack-install]')
    for _ in range(80):
        await page.wait_for_timeout(300)
        if await page.evaluate(f"!!JSON.parse(localStorage.getItem('crion.packs')||'{{}}')['{PK}']"): break
    await page.wait_for_timeout(300); await page.click('.modal [data-act=pack-play]'); await page.wait_for_timeout(1500)
    await page.evaluate("(()=>{const w=document.querySelector('#crack');w.dispatchEvent(new Event('dom-ready'));w.dispatchEvent(new Event('did-stop-loading'));})()")
    await page.wait_for_function("!!document.querySelector('.uv')"); await page.wait_for_timeout(900)
    await page.screenshot(path=OUT + f'uv_{name}_1_title.png')
    await page.click('[data-uv=t-new]'); await page.wait_for_timeout(200)
    await T.ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/univ', 'actions': [{'id': 0, 'kind': 'new', 'label': '새로하기'}]}); await page.wait_for_timeout(150)
    await T.ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/u1', 'chat': True})
    await T.ipc(page, 'crion:state', {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/u1', 'msgs': 1, 'users': 0, 'actions': []}); await page.wait_for_timeout(300)
    await T.ipc(page, 'crion:reply', {'key': 'k0', 'segs': PRO, 'done': True}); await page.wait_for_timeout(900)
    await page.screenshot(path=OUT + f'uv_{name}_2_cine.png')
    await page.click('[data-uv=cine-skip]'); await page.wait_for_timeout(800)
    await page.screenshot(path=OUT + f'uv_{name}_3_ask.png')
    await page.click('#uv-modal [data-uv=exam]'); await page.wait_for_timeout(700)
    await page.screenshot(path=OUT + f'uv_{name}_4_exam.png')
    # 검사 진행: 시작 → 대사 넘기기 → 서류 작성
    await page.click('#uv-exam [data-x=go]'); await page.wait_for_timeout(200)
    ADV = "document.querySelector('#uv-exam .uv-xshade').click()"
    for _ in range(14):
        if await page.query_selector('#xf-name'): break
        await page.evaluate(ADV); await page.wait_for_timeout(120)
    await page.fill('#xf-name', '김신입'); await page.fill('#xf-age', '20'); await page.fill('#xf-skill', '요리'); await page.fill('#xf-hobby', '게임')
    await page.click('#xf-trait .uv-xchip >> nth=0')
    await page.screenshot(path=OUT + f'uv_{name}_5_form.png')
    await page.click('#uv-xfm button[type=submit]'); await page.wait_for_timeout(300)
    for _ in range(8):
        if await page.query_selector('#uv-tapb'): break
        await page.evaluate(ADV); await page.wait_for_timeout(150)
    tap = await page.query_selector('#uv-tapb')
    if tap:
        for _ in range(30): await tap.dispatch_event('pointerdown')
        await page.screenshot(path=OUT + f'uv_{name}_6_tap.png')
    # 나머지 검사는 시간이 걸려서 결과서 붙여 넣기로 확인
    await page.click('#uv-exam [data-uv=ex-close]'); await page.wait_for_timeout(200)
    await page.evaluate("window.__pk.state && 0")
    await page.click('[data-uv=set]'); await page.wait_for_timeout(200); await page.click('#uv-modal [data-uv=exam]'); await page.wait_for_timeout(400)
    await page.click('#uv-exam [data-x=paste]'); await page.wait_for_timeout(300)
    await page.fill('#uv-xpaste', '[입학 검사 결과 | 리온대학교 X스학과]\n이름: 김신입\n나이: 20세\n특기: 요리\n취미: 게임\n성격: 성실\n지원동기: 호기심이 생겨서\n자기소개: 잘 부탁드려요\n학번: 2026-12345\n등급: B (평범한 학생)\n능력치: 체력 62 / 이론 80 / 센스 70 / 멘탈 55 / 정직도 91\n유형: 이론형 (약점: 멘탈)\n담당관 코멘트: "평균입니다. 평균은 나쁜 수치가 아닙니다."')
    await page.click('#uv-exam [data-x=pok]'); await page.wait_for_timeout(300)
    filled = await page.evaluate("document.querySelector('#uv-in').value.slice(0,30)")
    await page.click('[data-uv=send]'); await page.wait_for_timeout(200)
    await T.ipc(page, 'crion:reply', {'key': 'k1', 'segs': T1, 'done': True}); await page.wait_for_timeout(1200)
    await page.screenshot(path=OUT + f'uv_{name}_7_turn.png')
    for _ in range(8): await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.click('#uv-dlg'); await page.wait_for_timeout(120)
    await page.screenshot(path=OUT + f'uv_{name}_8_turn_end.png')
    await page.evaluate("window.__pk.state.waiting=false")
    await T.ipc(page, 'crion:reply', {'key': 'k2', 'segs': T2, 'done': True}); await page.wait_for_timeout(900)
    await page.screenshot(path=OUT + f'uv_{name}_9_pops.png')
    for app in ['kakao', 'riv', 'table', 'heart', 'id', 'cal', 'album', 'meal', 'insta', 'map']:
        await page.evaluate(f"window.__pk.openApp('{app}')"); await page.wait_for_timeout(250)
        await page.screenshot(path=OUT + f'uv_{name}_a_{app}.png')
    await page.evaluate("window.__pk.openApp('kakao', '박준호')"); await page.wait_for_timeout(200); await page.screenshot(path=OUT + f'uv_{name}_b_kroom.png')
    await page.evaluate("window.__pk.openApp('heart', '유소희')"); await page.wait_for_timeout(200); await page.screenshot(path=OUT + f'uv_{name}_b_heart.png')
    await page.evaluate("window.__pk.openApp('table', 'enroll')"); await page.wait_for_timeout(200); await page.screenshot(path=OUT + f'uv_{name}_b_enroll.png')
    await page.evaluate("window.__pk.openApp('insta', '유소희')"); await page.wait_for_timeout(200); await page.screenshot(path=OUT + f'uv_{name}_b_iprof.png')
    await page.evaluate("window.__pk.openApp('')"); await page.wait_for_timeout(200); await page.screenshot(path=OUT + f'uv_{name}_c_home.png')
    M = await page.evaluate("JSON.stringify({ex: window.__pk.memory.exam && window.__pk.memory.exam.grade, st: window.__pk.memory.status.week, aff: Object.keys(window.__pk.memory.aff), kk: Object.keys(window.__pk.memory.kakao), riv: window.__pk.memory.riv.length, gpa: window.__pk.memory.courses})")
    print(name, '채운 글:', filled, '| 기록:', M[:300])
    print(name, '오류:', errs or '없음')
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        await run(b, 'pc', {'width': 1360, 'height': 820}, False)
        await run(b, 'm', {'width': 390, 'height': 844}, True)
        await b.close()
asyncio.run(main())
