# 폰에서 앞 작품 크랙 화면이 남아 있을 때, 그 화면의 응답·주소가 새 작품으로 들어가지 않는지: python3 test/ui/run_stale.py
import asyncio, sys
sys.path.insert(0, '/home/claude/crion/test/ui')
import run_safehouse as T
from playwright.async_api import async_playwright

async def main():
    errs, ok = [], True
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 390, 'height': 844})
        page.on('pageerror', lambda e: errs.append(str(e)))
        await page.add_init_script("window.__engineVersion='0.9.0'; window.__autoDomReady=false")
        await T.setup(page)
        await page.goto(T.BASE); await page.evaluate("localStorage.setItem('crion.tut4','1')"); await page.reload(); await page.wait_for_timeout(2000)
        await page.evaluate("window.__crion.S.dev.repo = { loadWorks: async () => ({ data: { works: [], hidden: [] } }), lastDeploy: async () => null }")
        await page.click('.nav [data-v=store]'); await page.wait_for_timeout(700)
        await page.click('.pcard [data-act=pack]'); await page.wait_for_timeout(400)
        await page.click('.modal [data-act=pack-install]')
        for _ in range(60):
            await page.wait_for_timeout(300)
            if await page.evaluate("!!JSON.parse(localStorage.getItem('crion.packs')||'{}')['hirion.safehouse']"): break
        await page.wait_for_timeout(300); await page.click('.modal [data-act=pack-play]'); await page.wait_for_timeout(1500)
        await page.wait_for_function("!!document.querySelector('.sh')"); await page.wait_for_timeout(2600)
        await page.click('[data-sh=t-new]'); await page.wait_for_timeout(200)
        # 아직 새 문서가 열리지 않음: 앞 작품(소환수 아카데미)의 새 대화 화면이 신호를 보낸다
        await T.ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/ACADEMY', 'chat': True})
        await T.ipc(page, 'crion:state', {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/ACADEMY', 'msgs': 1, 'users': 0, 'actions': []})
        await T.ipc(page, 'crion:reply', {'key': 'old', 'segs': [{'t': 'text', 's': '에테르나 아카데미에 온 것을 환영한다'}], 'done': True}); await page.wait_for_timeout(400)
        bound = await page.evaluate("JSON.stringify(window.__pk.saves().map(s=>s.url))")
        mode = await page.evaluate("window.__pk.state.mode")
        print('앞 작품 신호 뒤: 모드', mode, '/ 세이브 주소', bound)
        ok &= mode == 'binding' and 'ACADEMY' not in bound
        # 새 문서가 열림 → 이제부터 받는다
        await page.evaluate("""(()=>{const w=document.querySelector('#crack');w.dispatchEvent(new Event('dom-ready'));})()""")
        await T.ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/safehouse', 'actions': [{'id': 0, 'kind': 'new', 'label': '새로하기'}]}); await page.wait_for_timeout(150)
        await T.ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/SAFE', 'chat': True})
        await T.ipc(page, 'crion:state', {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/SAFE', 'msgs': 1, 'users': 0, 'actions': []}); await page.wait_for_timeout(300)
        bound = await page.evaluate("JSON.stringify(window.__pk.saves().map(s=>s.url))")
        print('새 문서 뒤: 세이브 주소', bound)
        ok &= 'SAFE' in bound
        await b.close()
    print('결과:', '통과' if ok and not errs else '실패', errs or '')
    sys.exit(0 if ok and not errs else 1)
asyncio.run(main())
