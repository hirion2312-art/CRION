# 6팀 리그(개발자 전용 · 혼자 실행) 화면 점검: python3 test/ui/run_league.py → test/out/lg_*.png
#  폰 먼저(360·390·430) + PC. LG_ONLY=m390|m360|m430|pc
#  글꼴: BARLOW_DIR(Barlow Condensed ttf 폴더) · BLACKHAN_TTF — 없으면 기본 글꼴로 찍힌다
import asyncio, json, os, subprocess
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')) + '/'
BASE = 'file://' + ROOT + 'test/ui/harness.html'
OUT = ROOT + 'test/out/'
REG = ROOT + 'registry/'
PACK = 'hirion.baseball-proto'
os.makedirs(OUT, exist_ok=True)
subprocess.run(['node', 'scripts/make-registry.js', 'https://reg.test/CRION/'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
INDEX = json.load(open(REG + 'index.json', encoding='utf-8'))
INDEX['devPacks'] = [p for p in INDEX.get('devPacks', []) if p['id'] == PACK]
INDEX['packs'] = []
ENGINE = json.load(open(ROOT + 'src/renderer/engine.json'))['version']
ONLY = os.environ.get('LG_ONLY', '')
GF = '/tmp/claude-0/-home-claude/ff52d3e7-9b37-509e-8c52-2fa5470c16a0/scratchpad/gfonts/ofl/'
BARLOW = os.environ.get('BARLOW_DIR', GF + 'barlowcondensed/')
BHS = os.environ.get('BLACKHAN_TTF', GF + 'blackhansans/BlackHanSans-Regular.ttf')


async def setup(page):
    async def reg(route):
        from urllib.parse import unquote
        path = unquote(route.request.url.split('reg.test/CRION/', 1)[-1].split('?')[0])
        if path == 'index.json': return await route.fulfill(body=json.dumps(INDEX, ensure_ascii=False), content_type='application/json')
        f = REG + path
        if os.path.isfile(f): return await route.fulfill(path=f)
        return await route.fulfill(status=404, body='')
    await page.route('https://reg.test/**', reg)
    if os.path.isdir(BARLOW):
        css = "@font-face{font-family:'Black Han Sans';src:url(https://fonts.gstatic.com/bhs.ttf)}"
        for w, f in [(600, 'SemiBold'), (700, 'Bold'), (800, 'ExtraBold')]:
            css += "@font-face{font-family:'Barlow Condensed';font-weight:%d;src:url(https://fonts.gstatic.com/bc-%s.ttf)}" % (w, f)
            css += "@font-face{font-family:'Barlow Condensed';font-weight:%d;font-style:italic;src:url(https://fonts.gstatic.com/bc-%sItalic.ttf)}" % (w, f)
        async def gcss(route):
            u = route.request.url
            if 'Barlow' in u or 'Black+Han' in u: return await route.fulfill(body=css, content_type='text/css')
            await route.fulfill(body='', content_type='text/css')
        await page.route('https://fonts.googleapis.com/**', gcss)
        async def gfile(route):
            n = route.request.url.rsplit('/', 1)[-1]
            if n == 'bhs.ttf' and os.path.isfile(BHS): return await route.fulfill(path=BHS, content_type='font/ttf')
            if n.startswith('bc-'):
                f = BARLOW + 'BarlowCondensed-' + n[3:]
                if os.path.isfile(f): return await route.fulfill(path=f, content_type='font/ttf')
            await route.fulfill(status=404, body='')
        await page.route('https://fonts.gstatic.com/**', gfile)


async def run(p, name, vw, vh, mobile):
    errs = []
    b = await p.chromium.launch(args=['--allow-file-access-from-files'])
    page = await b.new_page(viewport={'width': vw, 'height': vh}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
    page.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
    page.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' and 'Failed to load' not in m.text and 'ERR_' not in m.text else None)
    await page.add_init_script(f"window.__engineVersion='{ENGINE}'")
    await setup(page)
    await page.goto(BASE)
    await page.evaluate("localStorage.setItem('crion.tut4','1')"); await page.reload(); await page.wait_for_timeout(1500)
    await page.evaluate("window.__crion.S.dev.repo = { loadWorks: async () => ({ data: { works: [], hidden: [] } }), lastDeploy: async () => null }")
    await page.evaluate("document.querySelector('[data-v=store]').click()"); await page.wait_for_timeout(800)
    await page.evaluate("document.querySelector('.pcard [data-act=pack]').click()"); await page.wait_for_timeout(500)
    await page.evaluate("document.querySelector('.modal [data-act=pack-install]').click()")
    for _ in range(120):
        await page.wait_for_timeout(300)
        if await page.evaluate("!!JSON.parse(localStorage.getItem('crion.packs')||'{}')['%s']" % PACK): break
    await page.wait_for_timeout(400)
    await page.evaluate("document.querySelector('.modal [data-act=pack-solo]').click()")
    await page.wait_for_function("!!document.querySelector('.lg')", timeout=15000); await page.wait_for_timeout(1300)
    shot = lambda n: page.screenshot(path=OUT + f'lg_{name}_{n}.png')
    click = lambda sel: page.evaluate(f"(()=>{{const e=document.querySelector({json.dumps(sel)}); if(!e) throw new Error('없음 '+{json.dumps(sel)}); e.click();}})()")
    if os.environ.get('LG_COVER') == '1' and not mobile:
        await page.wait_for_timeout(4000); await page.screenshot(path=OUT + 'lg_cover.png', clip={'x': 0, 'y': 40, 'width': 1280, 'height': 720})
    await shot('01_title')
    await click('[data-a=t-new]'); await page.wait_for_timeout(200); await shot('02_mode')
    await click('[data-a=t-mode][data-k=manager]'); await page.wait_for_timeout(200); await shot('03_team')
    await click('[data-a=t-team][data-k=SEO]'); await page.wait_for_timeout(500); await shot('04_home')
    await click('[data-a=pregame]'); await page.wait_for_timeout(300); await shot('05_pregame')
    await click('[data-a=speed][data-k=res]'); await page.wait_for_timeout(100)
    await click('[data-a=preset][data-k=std]'); await page.wait_for_timeout(100)
    await click('[data-a=playball]'); await page.wait_for_timeout(200)
    await page.evaluate("window.__pk.debug.setAuto(false)"); await page.wait_for_timeout(300)
    # 몇 타석 진행 (전 타석 연출 하나 찍기)
    for i in range(8): await page.evaluate("window.__pk.debug.oneStep()"); await page.wait_for_timeout(120)
    await page.evaluate("(()=>{const s=document.getElementById('lg-sheet'); if(!s.hidden) s.querySelector('[data-a=sheet-x]').click();})()")
    await page.wait_for_timeout(1400); await shot('06_game')
    # 결정 순간 강제
    await page.evaluate("""(()=>{const R=window.__pk.state, G=R.G; const my=G.teams.indexOf(R.L.my); G.inn=8; G.half=1-my; G.outs=1; G.bases=[{id:G.lineup[1-my][0].id},{id:G.lineup[1-my][1].id},null]; window.__pk.debug.paintGame(); })()""")
    await page.evaluate("window.__pk.debug.oneStep()"); await page.wait_for_timeout(400); await shot('07_decision')
    await page.evaluate("document.querySelector('[data-a=ord][data-i=\"0\"]').click()"); await page.wait_for_timeout(300)
    await page.evaluate("window.__pk.debug.setAuto(false)")
    await page.evaluate("window.__pk.debug.stopSheet()"); await page.wait_for_timeout(300); await shot('08_mid')
    await page.evaluate("document.querySelector('[data-a=mid-send]').click()"); await page.wait_for_timeout(200)
    # 크랙 답 붙여넣기 → order 확인
    await page.evaluate("document.querySelector('[data-a=paste-open]').click()"); await page.wait_for_timeout(200)
    await page.fill('#lg-paste', '【노태경|진지】"한 타자만 더 가자."\n【CRION】 scene=paused order=투수교체:마무리 hint=번트 【/CRION】')
    await click('[data-a=paste]'); await page.wait_for_timeout(300); await shot('09_order')
    await click('[data-a=oq-ok]'); await page.wait_for_timeout(200)
    # 직접 플레이: 타격
    await page.evaluate("(()=>{const R=window.__pk.state,G=R.G; window.__pk.debug.openDP(G.half===G.teams.indexOf(R.L.my)?'bat':'pit');})()"); await page.wait_for_timeout(300)
    kind = await page.evaluate("window.__pk.state.dp.kind")
    if kind == 'bat':
        await click('.dp-zone .z4'); await page.wait_for_timeout(100); await shot('10_dp_guess')
        await click('[data-a=dp-throw]'); await page.wait_for_timeout(int(await page.evaluate("window.__pk.state.dp.dur")) * 0.78)
        await shot('11_dp_swing')
        await page.evaluate("window.__pk.debug.dpResolveSwing(performance.now())"); await page.wait_for_timeout(250); await shot('12_dp_result')
    else:
        await click('.dp-zone .z6'); await page.wait_for_timeout(500); await shot('10_dp_pick')
        await page.evaluate("window.__pk.debug.dpLock()"); await page.wait_for_timeout(250); await shot('12_dp_result')
    await page.evaluate("document.querySelector('[data-a=dp-auto]') && document.querySelector('[data-a=dp-auto]').click()"); await page.wait_for_timeout(300)
    await page.evaluate("document.getElementById('lg-dp').hidden=true; window.__pk.state.dp=null")
    # 끝까지
    await page.evaluate("document.querySelector('[data-a=g-ff]').click()"); await page.wait_for_timeout(600); await shot('13_end')
    await page.evaluate("document.querySelector('#lg-sheet .lg-sbox').scrollTop=2000"); await page.wait_for_timeout(150); await shot('14_end2')
    await click('[data-a=g-next]'); await page.wait_for_timeout(400); await shot('15_home2')
    # 결과만으로 몇 경기
    for i in range(5):
        await page.evaluate("document.querySelector('[data-a=quick]') && document.querySelector('[data-a=quick]').click()"); await page.wait_for_timeout(250)
        await page.evaluate("document.querySelector('[data-a=g-next]') && document.querySelector('[data-a=g-next]').click()"); await page.wait_for_timeout(250)
    await shot('16_home3')
    await click('[data-a=tab][data-k=league]'); await page.wait_for_timeout(200); await shot('17_standings')
    await click('[data-a=lk][data-k=lead]'); await page.wait_for_timeout(200); await shot('18_leaders')
    await click('[data-a=tab][data-k=team]'); await page.wait_for_timeout(200); await shot('19_team')
    await click('.lg-pc[data-id=SEO02]'); await page.wait_for_timeout(300); await shot('20_player')
    await page.evaluate("document.querySelector('#lg-sheet [data-a=sheet-x]').click()")
    await click('[data-a=tab][data-k=story]'); await page.wait_for_timeout(200); await shot('21_story')
    await click('[data-a=tab][data-k=home]'); await page.wait_for_timeout(200)
    await page.evaluate("document.querySelector('.lg-recent [data-a=glog]').click()"); await page.wait_for_timeout(200); await shot('22_gamelog')
    # 커리어 모드
    await page.evaluate("window.__pk.state.L=null; window.__pk.state.sub={}; window.__pk.debug.render()"); await page.wait_for_timeout(200)
    await click('[data-a=t-new]'); await click('[data-a=t-mode][data-k=career]'); await click('[data-a=t-team][data-k=GWJ]'); await page.wait_for_timeout(200)
    await page.fill('#tt-name', '한결'); await click('[data-a=t-me][data-f=pos][data-v=SS]'); await page.wait_for_timeout(150); await shot('23_career_make')
    await click('[data-a=t-go]'); await page.wait_for_timeout(300)
    await click('[data-a=tab][data-k=career]'); await page.wait_for_timeout(200); await shot('24_career')
    print(name, '오류:', errs or '없음')
    await b.close()
    return errs


async def main():
    sizes = [('m390', 390, 844, True), ('m360', 360, 740, True), ('m430', 430, 932, True), ('pc', 1280, 800, False)]
    errs = []
    async with async_playwright() as p:
        for s in sizes:
            if ONLY and s[0] != ONLY: continue
            errs += await run(p, *s)
    print('전체:', '통과' if not errs else '오류 있음')

asyncio.run(main())
