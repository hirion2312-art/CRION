# 작가 프로필 작품 인식 점검: python3 test/ui/run_profile.py
#  fakeprofile.html  기본 / fakeprofile2.html  추천 구역 + 캐러셀 복제 / fakeprofile3.html  + 페이지 데이터
import asyncio, json
from playwright.async_api import async_playwright
EX = open('/home/claude/crion/src/renderer/catalog-extract.js', encoding='utf-8').read()
OWN = ['아포칼립스 안전지대의 관리자', '마법소녀의 최종보스', '이종족 길드의 유일한 남자', '크랙대학교', '돌아온 프로필 평가하는 평가혜', '용사하렘파티의 노예']


async def run(b, name):
    page = await b.new_page(viewport={'width': 1280, 'height': 900})
    html = open('/home/claude/crion/test/ui/' + name, encoding='utf-8').read().replace('<head>', '<head><base href="https://crack.wrtn.ai/u/le3go2">')
    await page.route('https://crack.wrtn.ai/u/le3go2', lambda r: r.fulfill(body=html, content_type='text/html'))
    await page.route('https://example.invalid/**', lambda r: r.fulfill(status=404, body=''))
    await page.goto('https://crack.wrtn.ai/u/le3go2'); await page.wait_for_timeout(300)
    r = await page.evaluate(EX)
    await page.close()
    return r


async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args=['--allow-file-access-from-files'])
        for name in ['fakeprofile.html', 'fakeprofile2.html', 'fakeprofile3.html']:
            r = await run(b, name)
            titles = [w['title'] for w in r['works']]
            ok = sorted(titles) == sorted(OWN) and all('/detail/6712aa' in w['url'] for w in r['works'])
            print(f'{name}: 방식 {r["method"]} · {len(titles)}개 · {"OK" if ok else "틀림"}  {r["log"]}')
            if not ok:
                fails.append(name)
                print('   ', titles)
        r = await run(b, 'fakeprofile4.html')
        t4 = [w['title'] for w in r['works']]
        ok4 = len(t4) == 52 and len(set(t4)) == 52 and all(t.startswith('히리온 작품') for t in t4)
        print(f'fakeprofile4.html (52개·더보기·데이터 12개만·추천 구역): 방식 {r["method"]} · {len(t4)}개 · {"OK" if ok4 else "틀림"}  {r["log"]}')
        if not ok4: fails.append('fakeprofile4.html')
        await b.close()
    print('\n결과:', '통과' if not fails else '실패 ' + str(fails))

asyncio.run(main())
