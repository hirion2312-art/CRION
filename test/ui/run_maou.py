# 마법소녀의 최종보스 팩 화면 점검: python3 test/ui/run_maou.py → test/out/mq_*.png
# 크랙 그림(CDN)은 시험 환경에서 못 받으니, 등록명마다 자리 그림을 만들어 대신 보낸다
import asyncio, json, os, sys, io, hashlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import run_safehouse as T
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = os.path.abspath(os.path.join(HERE, '..', '..')) + '/'
OUT = ROOT + 'test/out/'
os.system(f'cd {ROOT} && node scripts/make-registry.js https://reg.test/CRION/ > /dev/null 2>&1')
IDX = json.load(open(ROOT + 'registry/index.json', encoding='utf-8'))
PK = 'hirion.magical-boss'
T.INDEX.clear(); T.INDEX.update(IDX)
T.INDEX['devPacks'] = [p for p in IDX['packs'] + IDX.get('devPacks', []) if p['id'] == PK]
T.INDEX['packs'] = []
for p in T.INDEX['devPacks']: p['workUrl'] = 'https://crack.wrtn.ai/detail/maou'
D = json.load(open(ROOT + 'packs/' + PK + '/data.json', encoding='utf-8'))
BYURL = {u: n for n, u in D['imgs'].items()}
COL = {r['name']: r.get('color', '#8b8bd8') for r in D['oseong'] + D['kanbu'] + D.get('extra', [])}
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc'
CACHE = {}
THUMB = Image.open(ROOT + 'config/thumbs/magical.webp').convert('RGB')
def fake(name):
    if name in CACHE: return CACHE[name]
    p = name.split('_'); h = int(hashlib.md5(name.encode()).hexdigest()[:6], 16)
    place = p[-1] == '장소'; wide = place or p[0] in ('인물 외', '엔딩') and '웹툰' not in name
    W, H = (1280, 720) if wide else ((1080, 1600) if '웹툰' in name else (960, 1280))
    if p[0] == '인물 외' and '타이틀' in name or p[0] == '엔딩':
        bg = THUMB.resize((W, int(W * 1.5))).crop((0, 200, W, 200 + H)).filter(ImageFilter.GaussianBlur(2))
        im = bg
    else:
        c = COL.get(p[-1], '#%06x' % (0x302060 + h % 0x203040))
        base = tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))
        im = Image.new('RGB', (W, H), (12, 10, 30)); dr = ImageDraw.Draw(im)
        for y in range(H):
            t = y / H; dr.line([(0, y), (W, y)], fill=tuple(int(base[i] * (0.25 + 0.5 * (1 - t)) * (0.6 if place else 1)) for i in range(3)))
        if not place and '웹툰' not in name:
            dr.ellipse([W * .3, H * .12, W * .7, H * .42], fill=tuple(min(255, x + 60) for x in base))
            dr.rounded_rectangle([W * .18, H * .45, W * .82, H * 1.05], 120, fill=tuple(min(255, x + 25) for x in base))
    dr = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, 46 if wide else 54)
    dr.text((40, H - 110), name, font=f, fill=(255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0))
    b = io.BytesIO(); im.save(b, 'JPEG', quality=70); CACHE[name] = b.getvalue(); return CACHE[name]

def IM(name, w=960, h=1280): return {'t': 'img', 'src': D['imgs'][name], 'w': w, 'h': h, 'alt': ''}
def tx(s, code=False): return {'t': 'text', 's': s, 'code': code}
PRO = [IM('인물 외_타이틀', 1280, 720), tx('EP.PROLOG | 반지하의 마왕\n-\n')] + [IM('인물 외_프롤로그 웹툰 %d' % n, 1080, 1600) for n in range(1, 7)] + [
  IM('허름한 반지하_장소', 1280, 720), tx('곰팡이 냄새가 코끝을 찔렀다. 낮은 천장에서는 빗물이 새어 들어와 양은 대야에 톡, 톡 떨어지고 있었다.\n\n몸을 일으키려 하자 삐걱, 낡은 침상이 앓는 소리를 냈다.\n'),
  IM('당황_세이렌'), tx('설거지를 하던 중 {user}이/가 내는 기척에 뒤를 돌아보고는 화들짝 놀라 달려온다\n\n세이렌💬 폐...폐하!!! 일어나셨습니까!! 몸은 좀 괜찮으십니까?\n')]
EX1 = [IM('방송국로비_장소', 1280, 720), tx('방송국 예능국 면접실. 형광등 아래 면접관이 이력서를 넘긴다.\n'),
  tx('방송국 면접관💬 책상을 두들기며 "반갑습니다 그.. 흐음, 이름이 특이하군요. 그래서 저희 방송국엔 왜 지원하셨죠?"\n'),
  tx('🕖 D+1 | 🏚️ 방송국 예능국\n👤 {user} 상태 | 하급마족 (쇠약)\n💫 권능 0/5 | 🔮 마력 15/50\n💰 자금 0원\n\n❣️ 호감도 (잠김)\n💀 균열도 (잠김)\n⚠️ 정체발각위험 0 (안전)\n🏛️ 협회 동향 (잠김)\n🤝 관계 | 세이렌: 충성', True)]
LATER = [IM('스튜디오_장소', 1280, 720), tx('조명이 꺼진 스튜디오에 정적이 내려앉았다.\n'), IM('부끄러움/사랑_서하린'),
  tx('서하린💬 오늘도... 고마워요. 정말로.\n'), IM('권능회수_사랑_변신_서하린'), tx('빛이 흩어지며 따뜻한 무언가가 가슴으로 스며든다.\n'),
  tx('🕖 D+14 | 🏚️ 방송국 스튜디오\n👤 마왕 상태 | 하급마족 (회복 중)\n💫 권능 1/5 | 🔮 마력 23/50\n💰 자금 1,250,000원\n\n❣️ 호감도 | 서하린 82 · 한세라 31 · 윤채아 45 · 백설아 12 · 오하나 60\n💀 균열도 | 서하린 5 · 한세라 22 · 윤채아 10 · 백설아 41 · 오하나 3\n⚠️ 정체발각위험 45 (주의)\n🏛️ 협회 동향 | 지하 구역 출입 통제가 강화됨\n🤝 관계 | 세이렌: 충성 · 서하린: 연인', True),
  tx('[단서1] D+3 - 야생 마족은 모두 굶주려 있었다\n[단서2] D+9 - 협회 폐기물 차량이 지하로 들어간다\n')]

async def run(b, name, vp, mobile):
    errs = []
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
    page = await ctx.new_page()
    page.on('pageerror', lambda e: errs.append(str(e)))
    await page.add_init_script("window.__engineVersion='0.10.2'")
    await T.setup(page)
    async def img(route):
        n = BYURL.get(route.request.url.split('?')[0])
        if not n: return await route.fulfill(status=404, body='')
        await route.fulfill(body=fake(n), content_type='image/jpeg')
    await page.route('https://d394jeh9729epj.cloudfront.net/**', img)
    await page.goto(T.BASE); await page.evaluate("localStorage.setItem('crion.tut4','1');localStorage.setItem('crion.prefs',JSON.stringify({adult:true}))"); await page.reload(); await page.wait_for_timeout(1800)
    await page.evaluate("window.__crion.S.dev.repo = { loadWorks: async () => ({ data: { works: [], hidden: [] } }), lastDeploy: async () => null }")
    await page.click('.nav [data-v=store]'); await page.wait_for_timeout(800)
    await page.click('.pcard [data-act=pack]'); await page.wait_for_timeout(500)
    if name == 'pc': await page.screenshot(path=OUT + f'mq_{name}_0_store.png')
    await page.click('.modal [data-act=pack-install]')
    for _ in range(80):
        await page.wait_for_timeout(300)
        if await page.evaluate(f"!!JSON.parse(localStorage.getItem('crion.packs')||'{{}}')['{PK}']"): break
    await page.wait_for_timeout(300); await page.click('.modal [data-act=pack-play]'); await page.wait_for_timeout(1500)
    await page.evaluate("(()=>{const w=document.querySelector('#crack');w.dispatchEvent(new Event('dom-ready'));w.dispatchEvent(new Event('did-stop-loading'));})()")
    await page.wait_for_function("!!document.querySelector('.mq')"); await page.wait_for_timeout(1200)
    await page.screenshot(path=OUT + f'mq_{name}_1_title.png')
    await page.click('[data-mq=t-new]'); await page.wait_for_timeout(200)
    await T.ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/maou', 'actions': [{'id': 0, 'kind': 'new', 'label': '새로하기'}]}); await page.wait_for_timeout(150)
    await T.ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/maou', 'actions': [{'id': 1, 'kind': 'mode', 'label': '마왕, 다시 일어나다'}, {'id': 2, 'kind': 'confirm', 'label': '시작하기'}]}); await page.wait_for_timeout(150)
    await T.ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/maou', 'actions': [{'id': 2, 'kind': 'confirm', 'label': '시작하기'}]}); await page.wait_for_timeout(150)
    clicks = await page.evaluate("JSON.stringify(window.__clicks||null)")
    await T.ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/m1', 'chat': True})
    await T.ipc(page, 'crion:state', {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/m1', 'msgs': 1, 'users': 0, 'actions': []}); await page.wait_for_timeout(300)
    mode = await page.evaluate("window.__pk.state.mode")
    if mode != 'play': errs.append('mode ' + mode)
    await T.ipc(page, 'crion:reply', {'key': 'k0', 'segs': PRO, 'done': True}); await page.wait_for_timeout(1200)
    await page.screenshot(path=OUT + f'mq_{name}_2_cine.png')
    await page.click('#mq-cine .mq-skip'); await page.wait_for_timeout(900)
    await page.screenshot(path=OUT + f'mq_{name}_3_prologue.png')
    for _ in range(6): await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.click('#mq-dlg'); await page.wait_for_timeout(150)
    await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.wait_for_timeout(500)
    await page.screenshot(path=OUT + f'mq_{name}_4_seiren.png')
    await T.ipc(page, 'crion:reply', {'key': 'k1', 'segs': EX1, 'done': True}); await page.wait_for_timeout(1000)
    for _ in range(3): await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.click('#mq-dlg'); await page.wait_for_timeout(150)
    await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.wait_for_timeout(500)
    await page.screenshot(path=OUT + f'mq_{name}_5_status.png')
    await T.ipc(page, 'crion:reply', {'key': 'k2', 'segs': LATER, 'done': True}); await page.wait_for_timeout(1000)
    await page.screenshot(path=OUT + f'mq_{name}_6_pops.png')
    tabs = ['oseong', 'kanbu', 'clue', 'cmd', 'album']
    for t in tabs:
        sel = '#mq-tabs' if mobile else '#mq-stabs'
        if mobile and t == 'album': await page.evaluate("window.__pk.state.tab='album'; document.querySelector('#mq-tabs [data-k=cmd]').click(); window.__pk.state.tab='album'; window.__pk.state.sideTab='album'; document.querySelector('#mq-stabs [data-k=album]').click()")
        else: await page.evaluate(f"document.querySelector('{sel} [data-k={t}]').click()")
        await page.wait_for_timeout(400)
        await page.screenshot(path=OUT + f'mq_{name}_7_{t}.png')
    await page.evaluate("document.querySelector('#mq-stabs [data-k=oseong]').click()"); await page.wait_for_timeout(200)
    if mobile: await page.evaluate("document.querySelector('#mq-tabs [data-k=oseong]').click()"); await page.wait_for_timeout(200)
    await page.evaluate("document.querySelector('[data-mq=who][data-k=서하린]').click()"); await page.wait_for_timeout(400)
    await page.screenshot(path=OUT + f'mq_{name}_8_person.png')
    await page.evaluate("document.querySelector('[data-mq=powers]').click()"); await page.wait_for_timeout(300)
    await page.screenshot(path=OUT + f'mq_{name}_9_powers.png')
    await page.evaluate("document.querySelector('[data-mq=mclose]').click()"); await page.wait_for_timeout(200)
    if mobile:
        await page.evaluate("document.querySelector('#mq-tabs [data-k=cmd]').click()"); await page.wait_for_timeout(200)
    else:
        await page.evaluate("document.querySelector('#mq-stabs [data-k=cmd]').click()"); await page.wait_for_timeout(200)
    await page.evaluate("document.querySelector('[data-mq=sc][data-k=\"/간부보고\"]').click()"); await page.wait_for_timeout(300)
    filled = await page.evaluate("document.querySelector('#mq-in').value.slice(0,40)")
    if mobile:
        tab = await page.evaluate("window.__pk.state.tab")
        if tab != 'stage': errs.append('fill did not return to stage')
        tabs_hidden = await page.evaluate("getComputedStyle(document.querySelector('#mq-tabs')).display === 'none'")
        pbar_hidden = await page.evaluate("getComputedStyle(document.querySelector('.pbar')).display === 'none'")
        print(name, '입력 중 탭 숨김:', tabs_hidden, '/ CRION 머리줄 숨김:', pbar_hidden)
        if not tabs_hidden or not pbar_hidden: errs.append('typing/pbar')
        await page.screenshot(path=OUT + f'mq_{name}_a_typing.png')
        await page.evaluate("document.activeElement.blur()"); await page.wait_for_timeout(200)
        await page.evaluate("document.querySelector('.mq-more').click()"); await page.wait_for_timeout(400)
        menu = await page.evaluate("[...document.querySelectorAll('.pkm-it span')].map(x=>x.textContent)")
        print(name, '⋯ 메뉴:', menu)
        if '나가기' not in menu or '지난 대사' not in menu: errs.append('menu ' + str(menu))
        await page.screenshot(path=OUT + f'mq_{name}_b_menu.png')
        await page.evaluate("document.querySelector('#layer [data-act=close-modal]').click()"); await page.wait_for_timeout(200)
    over = await page.evaluate("document.documentElement.scrollWidth > innerWidth")
    if over: errs.append('horizontal overflow')
    M = await page.evaluate("JSON.stringify({st: window.__pk.memory.status.day, pw: window.__pk.memory.powers, aff: window.__pk.memory.aff, clues: window.__pk.memory.clues.length, seen: Object.keys(window.__pk.memory.seen).length})")
    print(name, '채운 글:', filled.replace('\n', ' '), '| 기록:', M[:300])
    print(name, '오류:', errs or '없음')
    await ctx.close()
    return errs

async def main():
    bad = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        bad += await run(b, 'pc', {'width': 1360, 'height': 820}, False)
        bad += await run(b, 'm', {'width': 390, 'height': 844}, True)
        bad += await run(b, 'm360', {'width': 360, 'height': 740}, True)
        await b.close()
    sys.exit(1 if bad else 0)
asyncio.run(main())
