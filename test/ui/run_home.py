# 홈 '오늘의 추천작' 슬라이드 · 카테고리 점검: python3 test/ui/run_home.py → test/out/hm_*.png
#  실제 config/works.json·팩으로 만든 가짜 업데이트 서버(reg.test)로 컴퓨터·폰 화면을 찍는다
import asyncio, json, os, subprocess
from urllib.parse import unquote
from playwright.async_api import async_playwright
ROOT = '/home/claude/crion/'
BASE = 'file://' + ROOT + 'test/ui/harness.html'
OUT = ROOT + 'test/out/'
REG = ROOT + 'registry/'
os.makedirs(OUT, exist_ok=True)
subprocess.run(['node', 'scripts/make-registry.js', 'https://reg.test/CRION/'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
BANNER = os.environ.get('BANNER')   # 'demo' 이면 관리 페이지 슬라이드를 넣은 경우


async def setup(page):
    async def reg(route):
        path = unquote(route.request.url.split('reg.test/CRION/', 1)[-1].split('?')[0])
        if path == 'catalog.json' and BANNER:
            c = json.load(open(REG + 'catalog.json', encoding='utf-8'))
            c['banners'] = [{'id': 's1', 'img': 'https://reg.test/CRION/packs/hirion.safehouse/cover.webp', 'work': 'safehouse', 'eyebrow': '신작 플레이팩', 'title': '석벽빌라에서 100일', 'sub': '관리인 스마트폰·빌라 도면·파견 지도가 담긴 전용 화면으로 플레이해 보세요.'},
                            {'id': 's2', 'work': 'univ'}, {'id': 's3', 'title': '디스코드 이벤트', 'sub': '공략 제보하면 굿즈 추첨!', 'link': 'https://discord.gg/x', 'img': 'https://reg.test/CRION/packs/hirion.summoner-academy/cover.webp'}]
            return await route.fulfill(body=json.dumps(c, ensure_ascii=False), content_type='application/json')
        f = REG + path
        if os.path.isfile(f): return await route.fulfill(path=f)
        return await route.fulfill(status=404, body='')
    await page.route('https://reg.test/**', reg)


async def shots(b, tag, vp, mobile):
    errs = []
    page = await b.new_page(viewport=vp, device_scale_factor=2 if mobile else 1, has_touch=mobile)
    page.on('pageerror', lambda e: errs.append(str(e)))
    await setup(page)
    await page.goto(BASE)
    await page.evaluate("localStorage.setItem('crion.tut4','1'); localStorage.setItem('crion.prefs', JSON.stringify({adult:true, splash:false}))")
    await page.reload(); await page.wait_for_timeout(2500)
    n = await page.evaluate("document.querySelectorAll('#slider .slide').length")
    tabs = await page.evaluate("[...document.querySelectorAll('.cats button')].map(x => x.textContent)")
    first = await page.evaluate("[...document.querySelectorAll('#homeGrid .card .name')].slice(0,4).map(x => x.textContent)")
    print(tag, '슬라이드', n, '| 칸', tabs, '| 전체 맨 앞', first)
    await page.screenshot(path=OUT + f'hm_{tag}_1.png')
    if n > 1:
        await page.click('#slider [data-act=sl-go][data-i="1"]') if not mobile else await page.evaluate("document.querySelector('#slider [data-act=sl-go][data-i=\"1\"]').click()")
        await page.wait_for_timeout(900)
        await page.screenshot(path=OUT + f'hm_{tag}_2.png')
    await page.evaluate("document.querySelector('.cats [data-v=pack]') && document.querySelector('.cats [data-v=pack]').click()"); await page.wait_for_timeout(300)
    print(tag, '플레이팩 칸', await page.evaluate("[...document.querySelectorAll('#homeGrid .card .name')].map(x => x.textContent)"))
    await page.evaluate("document.querySelector('.cats [data-v=romance]') && document.querySelector('.cats [data-v=romance]').click()"); await page.wait_for_timeout(300)
    await page.evaluate("document.querySelector('.cats').scrollIntoView({block:'start'})"); await page.wait_for_timeout(200)
    await page.screenshot(path=OUT + f'hm_{tag}_3.png')
    await page.close()
    return errs


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        errs = await shots(b, 'pc' + ('b' if BANNER else ''), {'width': 1280, 'height': 800}, False)
        errs += await shots(b, 'm' + ('b' if BANNER else ''), {'width': 390, 'height': 844}, True)
        await b.close()
    print('오류:', errs or '없음')

asyncio.run(main())
