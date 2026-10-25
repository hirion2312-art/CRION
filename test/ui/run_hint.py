# 플레이팩 안내 창 점검: python3 test/ui/run_hint.py
import asyncio, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import run as R
R.BASE = 'file://' + HERE + '/harness.html'; R.OUT = ROOT + '/test/out/'; R.IMG = HERE + '/img/'
from playwright.async_api import async_playwright

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 1360, 'height': 860})
        page.on('pageerror', lambda e: errs.append(str(e)))
        await R.setup(page, [R.PACK])
        await page.goto(R.BASE); await page.evaluate("localStorage.setItem('crion.tut4','1')"); await page.reload(); await page.wait_for_timeout(2200)
        await page.evaluate("window.__crion.go('home')")
        # 팩이 있는 작품(w1)과 없는 작품(w2) 열기
        await page.evaluate("document.querySelector('[data-act=play][data-id=w2]') ? 0 : window.__crion.go('home')")
        has = await page.evaluate("!!document.querySelector('[data-act=play][data-id=w1], [data-act=info][data-id=w1]')")
        print('홈에 w1 있음:', has)
        await page.click('[data-act=info][data-id=w1]'); await page.wait_for_timeout(300)
        await page.click('.modal [data-act=play][data-id=w1], #layer [data-act=play][data-id=w1]'); await page.wait_for_timeout(400)
        print('안내 창:', await page.evaluate("document.querySelector('.hint h3') && document.querySelector('.hint h3').textContent"))
        await page.screenshot(path=R.OUT + 'h1_hint.png')
        await page.check('#hintNo'); await page.click('[data-act=hint-skip]'); await page.wait_for_timeout(500)
        print('그냥 플레이로 열림:', await page.evaluate("window.__crion.S.view"), await page.evaluate("localStorage.getItem('crion.nohint.demo')"))
        await page.evaluate("window.__crion.go('home')"); await page.wait_for_timeout(200)
        await page.click('[data-act=info][data-id=w1]'); await page.wait_for_timeout(300)
        await page.click('#layer [data-act=play][data-id=w1]'); await page.wait_for_timeout(500)
        print('다시 묻지 않기 → 바로 열림:', await page.evaluate("window.__crion.S.view"))
        await b.close()
    print('오류:', errs or '없음')
asyncio.run(main())
