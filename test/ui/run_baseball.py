# 3D 야구 프로토타입(개발자 전용 · 혼자 실행 팩) 화면 점검: python3 test/ui/run_baseball.py → test/out/bb_*.png
#  가짜 업데이트 서버(reg.test)로 개발자 로그인 → 스토어 → 받기 → 바로 플레이 → 타격·투구·경기 모드
#  BB_ONLY=pc|m 로 한쪽만, BB_COVER=1 이면 스토어 표지(packs/hirion.baseball-proto/store/*.webp)도 만든다
import asyncio, json, os, subprocess, io
from playwright.async_api import async_playwright
ROOT = '/home/claude/crion/'
BASE = 'file://' + ROOT + 'test/ui/harness.html'
OUT = ROOT + 'test/out/'
REG = ROOT + 'registry/'
PACK = 'hirion.baseball-proto'
os.makedirs(OUT, exist_ok=True)
subprocess.run(['node', 'scripts/make-registry.js', 'https://reg.test/CRION/'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
INDEX = json.load(open(REG + 'index.json', encoding='utf-8'))
print('공개 목록에 없음:', not any(p['id'] == PACK for p in INDEX['packs']), '/ 개발자 목록에 있음:', any(p['id'] == PACK for p in INDEX.get('devPacks', [])))
INDEX['devPacks'] = [p for p in INDEX.get('devPacks', []) if p['id'] == PACK]
INDEX['packs'] = []
ENGINE = json.load(open(ROOT + 'src/renderer/engine.json'))['version']
ONLY = os.environ.get('BB_ONLY', '')
COVER = os.environ.get('BB_COVER') == '1'


async def setup(page):
    async def reg(route):
        from urllib.parse import unquote
        path = unquote(route.request.url.split('reg.test/CRION/', 1)[-1].split('?')[0])
        if path == 'index.json': return await route.fulfill(body=json.dumps(INDEX, ensure_ascii=False), content_type='application/json')
        f = REG + path
        if os.path.isfile(f): return await route.fulfill(path=f)
        return await route.fulfill(status=404, body='')
    await page.route('https://reg.test/**', reg)


async def st(page):
    return await page.evaluate("(()=>{const s=window.__pk&&window.__pk.state;return s?{fps:s.fps,mode:s.mode,phase:s.phase,P:s.P,play:s.play,G:s.G&&{inning:s.G.inning,half:s.G.half,outs:s.G.outs,balls:s.G.balls,strikes:s.G.strikes,score:s.G.score,bases:s.G.bases,stat:s.G.stat,over:s.G.over}}:null})()")


async def wait_phase(page, ph, ms=8000):
    for _ in range(ms // 50):
        s = await st(page)
        if s and s['phase'] in ph: return s
        await page.wait_for_timeout(50)
    return await st(page)


async def perfect_swing(page, dy=0.0, dt=0.0):
    # 다음 공을 바로 던지고, 공이 올 때 겨냥 원을 맞춰 친다
    await page.evaluate(f"window.__pk.bb.debug.auto({dy}, {dt})")
    await page.evaluate("window.__pk.bb.debug.pitchNow('FB', {x:0.02, y:0.8}, 148)")


async def run(p, name, vw, vh, mobile):
    errs = []
    ctx = await p.chromium.launch(args=['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    page = await ctx.new_page(viewport={'width': vw, 'height': vh}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
    page.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
    page.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' and 'Failed to load' not in m.text and 'ERR_' not in m.text and 'GPU stall' not in m.text else None)
    await page.add_init_script(f"window.__engineVersion='{ENGINE}'")
    # 소프트웨어 그리기(시험 환경)는 느려서 그림자를 끈 '화질 낮음'으로. 표지 만들 때만 높음
    await page.add_init_script("localStorage.setItem('crion.bb.prefs', JSON.stringify({hq: %s}))" % ('true' if COVER and not mobile else 'false'))
    await setup(page)
    await page.goto(BASE)
    await page.evaluate("localStorage.setItem('crion.tut4','1')"); await page.reload(); await page.wait_for_timeout(1800)
    if mobile:
        await page.evaluate("window.__crion && window.__crion.S && (window.__crion.S.dev.repo = { loadWorks: async () => ({ data: { works: [], hidden: [] } }), lastDeploy: async () => null })")
        await page.evaluate("window.__crion.go ? window.__crion.go('store') : null")
    await page.evaluate("window.__crion.S.dev.repo = { loadWorks: async () => ({ data: { works: [], hidden: [] } }), lastDeploy: async () => null }")
    if not mobile:
        await page.click('.nav [data-v=store]'); await page.wait_for_timeout(800)
    else:
        b = await page.query_selector('[data-v=store]')
        if b: await b.click(); await page.wait_for_timeout(800)
    names = await page.evaluate("[...document.querySelectorAll('.pcard .name')].map(x=>x.textContent)")
    print(name, '개발자 스토어:', names)
    await page.screenshot(path=OUT + f'bb_{name}_a1_store.png')
    await page.click('.pcard [data-act=pack]'); await page.wait_for_timeout(500)
    await page.click('.modal [data-act=pack-install]')
    for _ in range(120):
        await page.wait_for_timeout(300)
        if await page.evaluate("!!JSON.parse(localStorage.getItem('crion.packs')||'{}')['%s']" % PACK): break
    await page.wait_for_timeout(400)
    await page.screenshot(path=OUT + f'bb_{name}_a2_detail.png')
    print(name, '바로 플레이 단추:', await page.evaluate("!!document.querySelector('.modal [data-act=pack-solo]')"))
    await page.click('.modal [data-act=pack-solo]')
    await page.wait_for_function("!!document.querySelector('.bb canvas')", timeout=20000)
    await page.wait_for_timeout(2500)
    print(name, '크랙 화면 없음:', await page.evaluate("!document.querySelector('#crack')"), '/ 위 단추:', await page.evaluate("[...document.querySelectorAll('.pbar .ptools button')].map(b=>b.title)"))
    await page.screenshot(path=OUT + f'bb_{name}_b1_title.png')
    # 타격 연습
    await page.click('.bb [data-bb=mode][data-m=bat]'); await page.wait_for_timeout(1200)
    s = await wait_phase(page, ['wait'])
    print(name, '타격 연습:', s['mode'], s['phase'])
    await page.screenshot(path=OUT + f'bb_{name}_c1_bat_ready.png')
    # 공이 날아오는 중
    await page.evaluate("window.__pk.bb.debug.pitchNow('SL', {x:0.12, y:0.62}, 134)")
    await page.wait_for_timeout(280)
    await page.screenshot(path=OUT + f'bb_{name}_c2_pitch.png')
    s = await page.evaluate("window.__pk.bb.debug.run(3, s => s.phase === 'after')")
    print(name, '그냥 보냄 →', s['G']['balls'], '볼', s['G']['strikes'], '스트')
    # 정타 (뜬공 쪽으로 살짝 아래)
    hits = []
    for i, (dy, dt) in enumerate([(-0.03, 0.0), (0.0, -0.02), (0.06, 0.01), (-0.05, 0.0)]):
        await page.evaluate("window.__pk.bb.debug.run(8, s => s.phase === 'wait')")
        await page.evaluate(f"window.__pk.bb.debug.auto({dy}, {dt})")
        await page.evaluate("window.__pk.bb.debug.pitchNow('FB', {x:0.02, y:0.8}, 148)")
        s = await page.evaluate("window.__pk.bb.debug.run(2, s => s.phase === 'play' || s.phase === 'after')")
        if s['phase'] == 'play':
            await page.evaluate("window.__pk.bb.debug.run(1.1)"); await page.wait_for_timeout(500)
            await page.screenshot(path=OUT + f'bb_{name}_c3_flight{i}.png')
            s = await page.evaluate("window.__pk.bb.debug.run(15, s => s.phase === 'after')")
            await page.evaluate("window.__pk.bb.debug.run(0.6)"); await page.wait_for_timeout(500)
            await page.screenshot(path=OUT + f'bb_{name}_c4_result{i}.png')
        hits.append(s['play'] and (s['play']['kind'], round(s['play']['dist'])))
    print(name, '정타 결과:', hits, '/ 기록', (await st(page))['G']['stat'])
    # 빠른 경기
    await page.evaluate("window.__pk.bb.title()"); await page.wait_for_timeout(500)
    await page.click('.bb [data-bb=inn][data-v="1"]'); await page.click('.bb [data-bb=mode][data-m=game]')
    await page.wait_for_timeout(1500)
    await page.screenshot(path=OUT + f'bb_{name}_d1_game.png')
    # 초: 3아웃까지 그냥 보내기(시간 빨리 감기) → 말: 투구
    for _ in range(80):
        s = await page.evaluate("window.__pk.bb.debug.run(3, s => s.phase === 'wait' || (s.G && s.G.half === 1) || s.phase === 'over')")
        if s['G']['half'] == 1 or s['phase'] == 'over': break
        if s['phase'] == 'wait': await page.evaluate("window.__pk.bb.debug.pitchNow('FB', {x:0, y:0.8}, 145)")
    s = await page.evaluate("window.__pk.bb.debug.run(8, s => s.phase === 'p_aim')")
    await page.wait_for_timeout(800)
    s = await st(page)
    print(name, '말 공격(투구):', s['G']['half'], s['phase'], '점수', s['G']['score'])
    await page.screenshot(path=OUT + f'bb_{name}_e1_pitch_aim.png')
    await page.click('.bb [data-bb=pt][data-k=SL]')
    await page.wait_for_timeout(1500)
    await page.evaluate("window.__pk.bb.debug.aim(0.15, 0.55)"); await page.wait_for_timeout(600)
    await page.screenshot(path=OUT + f'bb_{name}_e2_meter.png')
    await page.evaluate("window.__pk.bb.debug.lock()"); await page.wait_for_timeout(300)
    await page.screenshot(path=OUT + f'bb_{name}_e3_thrown.png')
    for _ in range(300):
        s = await page.evaluate("window.__pk.bb.debug.run(4, s => ['p_aim','wait','over'].includes(s.phase))")
        if s['phase'] == 'over': break
        if s['phase'] == 'p_aim': await page.evaluate("window.__pk.bb.debug.aim(0.0, 0.78)"); await page.evaluate("window.__pk.bb.debug.lock()")
        if s['phase'] == 'wait': await page.evaluate("window.__pk.bb.debug.pitchNow('FB', {x:0, y:0.8}, 145)")
    s = await st(page)
    print(name, '경기 끝:', s['phase'], s['G']['score'], s['G']['over'])
    await page.wait_for_timeout(600)
    await page.screenshot(path=OUT + f'bb_{name}_f1_end.png')
    print(name, '결과 글:', (await page.evaluate("window.__pk.bb.result()")).split('\n')[0])
    # ⋯ 메뉴 (CRION 메뉴로)
    await page.evaluate("document.querySelector('.bb [data-bb=again]').click()"); await page.wait_for_timeout(800)
    await page.click('.bb [data-bb=menu]'); await page.wait_for_timeout(400)
    print(name, '⋯ 메뉴:', await page.evaluate("[...document.querySelectorAll('.pkm-it span')].map(x=>x.textContent)"))
    await page.screenshot(path=OUT + f'bb_{name}_g1_menu.png')
    await page.keyboard.press('Escape'); await page.evaluate("document.querySelector('[data-act=close-modal]') && document.querySelector('[data-act=close-modal]').click()")
    if COVER and not mobile:
        await make_covers(page)
    # 나가기
    await page.evaluate("document.querySelector('[data-act=leave]') ? document.querySelector('[data-act=leave]').click() : null"); await page.wait_for_timeout(600)
    print(name, '나간 뒤 화면 정리:', await page.evaluate("!document.querySelector('.bb')"))
    bad = [e for e in errs if 'WebGL' not in e or 'error' in e.lower()]
    print(name, '오류:', bad[:6] or '없음')
    await ctx.close()


async def make_covers(page):
    from PIL import Image
    D = ROOT + 'packs/' + PACK + '/store/'
    async def snap(fn):
        await page.evaluate("document.querySelectorAll('.bb-help').forEach(e=>e.style.opacity=0)")
        png = await page.screenshot(clip={'x': 0, 'y': 54, 'width': 1440, 'height': 810})
        im = Image.open(io.BytesIO(png)).convert('RGB').resize((1280, 720), Image.LANCZOS)
        im.save(D + fn, 'WEBP', quality=86, method=6)
        await page.evaluate("document.querySelectorAll('.bb-help').forEach(e=>e.style.opacity='')")
    await page.evaluate("window.__pk.bb.title()"); await page.wait_for_timeout(2500)
    await snap('cover.webp')
    await page.evaluate("window.__pk.bb.start('bat')"); await page.wait_for_timeout(600)
    await page.evaluate("window.__pk.bb.debug.run(8, s => s.phase === 'wait')")
    await page.evaluate("window.__pk.bb.debug.pitchNow('FB', {x:0.05, y:0.85}, 149)"); await page.evaluate("window.__pk.bb.debug.run(0.22)"); await page.wait_for_timeout(700)
    await snap('shot1.webp')
    for k in range(6):
        await page.evaluate("window.__pk.bb.debug.run(8, s => s.phase === 'wait')")
        await page.evaluate("window.__pk.bb.debug.auto(-0.05, -0.01)")
        await page.evaluate("window.__pk.bb.debug.pitchNow('FB', {x:0.02, y:0.8}, 148)")
        s = await page.evaluate("window.__pk.bb.debug.run(2, s => s.phase === 'play' || s.phase === 'after')")
        if s['phase'] == 'play' and s['play']['kind'] == 'HR':
            await page.evaluate("window.__pk.bb.debug.run(1.6)"); await page.wait_for_timeout(900); await snap('shot2.webp'); break
    await page.evaluate("window.__pk.bb.start('pitch')"); await page.evaluate("window.__pk.bb.debug.run(3)")
    await page.evaluate("document.querySelector('.bb [data-bb=pt][data-k=CU]').click()")
    await page.evaluate("window.__pk.bb.debug.aim(0.18, 0.6)"); await page.evaluate("window.__pk.bb.debug.run(0.3)"); await page.wait_for_timeout(900)
    await snap('shot3.webp')
    print('표지 만듦')


async def main():
    async with async_playwright() as p:
        if ONLY != 'm': await run(p, 'pc', 1440, 900, False)
        if ONLY != 'pc': await run(p, 'm', 390, 844, True)

if __name__ == "__main__":
    asyncio.run(main())
