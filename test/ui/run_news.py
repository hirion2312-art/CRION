# 소식 화면 점검 (실제 works.json 소식 + config/thumbs 사진): python3 test/ui/run_news.py
import asyncio, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import run as R
from playwright.async_api import async_playwright
W = json.load(open(ROOT + '/config/works.json', encoding='utf-8'))
R.CATALOG['news'] = [dict(n, img='https://reg.test/thumbs/' + n['img']) if n.get('img') else n for n in W.get('news', [])]
R.CATALOG['notice'] = None

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        for name, vp in [('pc', {'width': 1360, 'height': 900}), ('m', {'width': 390, 'height': 844})]:
            page = await b.new_page(viewport=vp, device_scale_factor=2 if name == 'm' else 1)
            page.on('pageerror', lambda e: errs.append(str(e)))
            await R.setup(page, [])
            async def th(route):
                f = ROOT + '/config/thumbs/' + route.request.url.split('/thumbs/')[1].split('?')[0]
                await route.fulfill(path=f) if os.path.exists(f) else await route.fulfill(status=404, body='')
            await page.route('https://reg.test/thumbs/**', th)
            await page.goto(R.BASE); await page.evaluate("localStorage.setItem('crion.tut4','1')"); await page.reload(); await page.wait_for_timeout(2000)
            await page.click('[data-act=go][data-v=community]'); await page.wait_for_timeout(1200)
            n = await page.evaluate("document.querySelectorAll('.news-img').length")
            ok = await page.evaluate("[...document.querySelectorAll('.news-img')].filter(i => i.naturalWidth > 0).length")
            print(name, '소식', n, '개, 사진 뜬 것', ok)
            await page.screenshot(path=R.OUT + f'n_{name}_news.png')
            await page.close()
        await b.close()
    print('오류:', errs or '없음')
asyncio.run(main())
