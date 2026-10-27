# 크랙 '새로하기 ⌄'(누르는 순간 열리는 메뉴) 점검: python3 test/ui/run_drop.py
#  CRION이 새로하기를 한 번 누르면 메뉴가 열리고 → 기본모드·하드모드가 '시작 설정'으로 잡히고 → 고른 것 한 번만 눌린다
import asyncio, sys
sys.path.insert(0, '/home/claude/crion/test/ui')
from run_preload import PRE, SHIM
from playwright.async_api import async_playwright

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await b.new_page(viewport={'width': 1200, 'height': 800})
        errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
        await page.goto('file:///home/claude/crion/test/ui/fakedrop.html')
        await page.evaluate(SHIM); await page.evaluate(PRE)
        await page.evaluate("__fire('crion:config', {play:true, rules:{}, learned:null, modes:['기본모드','하드모드']})"); await page.wait_for_timeout(1500)
        st = [o[1] for o in await page.evaluate('__out') if o[0] == 'crion:state']
        acts = st[-1]['actions'] if st else []
        print('작품 화면에서 찾은 버튼:', [(a['kind'], a['label']) for a in acts])
        nw = next((a for a in acts if a['kind'] == 'new'), None)
        if not nw: fails.append('new not found')
        else:
            await page.evaluate(f"__fire('crion:click', {nw['id']})"); await page.wait_for_timeout(1500)
            st = [o[1] for o in await page.evaluate('__out') if o[0] == 'crion:state']
            acts = st[-1]['actions']
            modes = [a for a in acts if a['kind'] == 'mode']
            print('새로하기 뒤 시작 설정:', [a['label'] for a in modes], '/ 메뉴 기록:', await page.evaluate('__log'))
            if [a['label'] for a in modes] != ['기본모드', '하드모드']: fails.append('modes ' + str(modes))
            hard = next((a for a in modes if a['label'] == '하드모드'), None)
            if hard:
                await page.evaluate(f"__fire('crion:click', {hard['id']})"); await page.wait_for_timeout(500)
                log = await page.evaluate('__log'); print('고른 뒤 기록:', log)
                if log != ['open', 'pick:하드모드']: fails.append('log ' + str(log))
        await b.close()
    print('\n오류:', errs or '없음', '/ 실패:', fails or '없음')
    sys.exit(1 if fails or errs else 0)

asyncio.run(main())
