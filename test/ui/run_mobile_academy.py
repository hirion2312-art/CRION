# 소환수 아카데미 팩 폰 세로 점검: python3 test/ui/run_mobile_academy.py → test/out/ma_*.png (390×844)
import asyncio, json, os, subprocess
from playwright.async_api import async_playwright
ROOT = '/home/claude/crion/'
BASE = 'file://' + ROOT + 'test/ui/harness.html'
OUT = ROOT + 'test/out/'; REG = ROOT + 'registry/'
subprocess.run(['node', 'scripts/make-registry.js', 'https://reg.test/CRION/'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
INDEX = json.load(open(REG + 'index.json', encoding='utf-8'))
INDEX['packs'] = [p for p in INDEX['packs'] if p['id'] == 'hirion.summoner-academy']; INDEX['devPacks'] = []
for p in INDEX['packs']: p['workUrl'] = 'https://crack.wrtn.ai/detail/summoner'; p['workName'] = '소환수아카데미테스트없음'
TURNS = json.load(open(ROOT + 'test/fixtures/academy_turns.json', encoding='utf-8'))['turns']

async def ipc(page, ch, d):
    await page.evaluate("""([ch, d]) => { const w = document.querySelector('#crack'); const e = new Event('ipc-message'); e.channel = ch; e.args = [d]; w.dispatchEvent(e); }""", [ch, d])

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errs.append(str(e)))
        await page.add_init_script("window.__engineVersion='0.9.1'")
        async def reg(route):
            from urllib.parse import unquote
            path = unquote(route.request.url.split('reg.test/CRION/', 1)[-1].split('?')[0])
            if path == 'index.json': return await route.fulfill(body=json.dumps(INDEX, ensure_ascii=False), content_type='application/json')
            f = REG + path
            if os.path.isfile(f): return await route.fulfill(path=f)
            return await route.fulfill(status=404, body='')
        await page.route('https://reg.test/**', reg)
        await page.goto(BASE); await page.evaluate("localStorage.setItem('crion.tut4','1')"); await page.reload(); await page.wait_for_timeout(2000)
        await page.click('.nav [data-v=store]'); await page.wait_for_timeout(700)
        await page.screenshot(path=OUT + 'ma_0_store.png')
        await page.click('.pcard [data-act=pack]'); await page.wait_for_timeout(400)
        await page.click('.modal [data-act=pack-install]')
        for _ in range(240):
            await page.wait_for_timeout(500)
            if await page.evaluate("!!JSON.parse(localStorage.getItem('crion.packs')||'{}')['hirion.summoner-academy']"): break
        await page.wait_for_timeout(300); await page.click('.modal [data-act=pack-play]'); await page.wait_for_timeout(1200)
        await page.evaluate("""(()=>{const w=document.querySelector('#crack');w.dispatchEvent(new Event('did-stop-loading'));})()""")
        await page.wait_for_function("!!document.querySelector('.ak')"); await page.wait_for_timeout(800)
        await page.screenshot(path=OUT + 'ma_1_title.png')
        await page.click('[data-ak=t-new]'); await page.wait_for_timeout(200)
        await ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/a1', 'chat': True})
        await ipc(page, 'crion:state', {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/a1', 'msgs': 1, 'actions': []}); await page.wait_for_timeout(300)
        await page.evaluate("window.__pk.memory.registered = Date.now()")
        await ipc(page, 'crion:reply', {'key': 'k1', 'segs': [{'t': 'text', 's': TURNS[0]}], 'done': True}); await page.wait_for_timeout(800)
        for _ in range(3):
            await page.evaluate("document.querySelector('.ak-ov [data-ak=ov-close]') && document.querySelector('.ak-ov [data-ak=ov-close]').click()")
            await page.evaluate("document.querySelector('.ak-dlg').click()"); await page.wait_for_timeout(120)
        await page.wait_for_timeout(600)
        await page.screenshot(path=OUT + 'ma_2_turn.png')
        await ipc(page, 'crion:reply', {'key': 'k2', 'segs': [{'t': 'text', 's': TURNS[1]}], 'done': True}); await page.wait_for_timeout(900)
        await page.evaluate("document.querySelector('.ak-ov [data-ak=ov-close]') && document.querySelector('.ak-ov [data-ak=ov-close]').click()")
        for _ in range(12):
            await page.evaluate("document.querySelector('.ak-ov [data-ak=ov-close]') && document.querySelector('.ak-ov [data-ak=ov-close]').click()")
            await page.evaluate("document.querySelector('.ak-dlg').click()"); await page.wait_for_timeout(60)
        await page.wait_for_timeout(500)
        await page.screenshot(path=OUT + 'ma_3_battle.png')
        hud = await page.query_selector('[data-ak=hud-toggle]')
        if hud:
            await hud.click(); await page.wait_for_timeout(500); await page.screenshot(path=OUT + 'ma_4_hud.png')
        for k in ['m-dex', 'm-people', 'm-map', 'm-set']:
            el = await page.query_selector(f'[data-ak={k}]')
            if not el: continue
            await page.evaluate(f"document.querySelector('[data-ak={k}]').click()"); await page.wait_for_timeout(500)
            await page.screenshot(path=OUT + f'ma_5_{k}.png'); await page.keyboard.press('Escape'); await page.wait_for_timeout(200)
        await b.close()
    print('오류:', errs or '없음')

asyncio.run(main())
