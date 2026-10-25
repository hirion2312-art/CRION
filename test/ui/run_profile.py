# 작가 프로필 작품 인식 점검: python3 test/ui/run_profile.py
import asyncio, json, subprocess
from playwright.async_api import async_playwright
EX = open('/home/claude/crion/src/renderer/catalog-extract.js', encoding='utf-8').read()


async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 1280, 'height': 900})
        # 크랙 주소처럼 보이게: file 페이지의 링크를 wrtn.ai 기준으로 풀도록 base 지정
        html = open('/home/claude/crion/test/ui/fakeprofile.html', encoding='utf-8').read().replace('<head>', '<head><base href="https://crack.wrtn.ai/u/le3go2">')
        await page.route('https://crack.wrtn.ai/u/le3go2', lambda r: r.fulfill(body=html, content_type='text/html'))
        await page.route('https://example.invalid/**', lambda r: r.fulfill(status=404, body=''))
        await page.goto('https://crack.wrtn.ai/u/le3go2'); await page.wait_for_timeout(300)
        r = await page.evaluate(EX)
        await b.close()
    works = r['works']
    for w in works:
        print('-', w['title'], '|', w['url'], '|', w['thumb'].split('/')[-1])
    print('주소 모양:', r['shapes'])
    want = ['아포칼립스 안전지대의 관리자', '마법소녀의 최종보스', '이종족 길드의 유일한 남자', '크랙대학교', '돌아온 프로필 평가하는 평가혜', '용사하렘파티의 노예']
    got = [w['title'] for w in works]
    if got != want: fails.append('titles ' + json.dumps(got, ensure_ascii=False))
    if any('/u/' in w['url'] or 'search' in w['url'] for w in works): fails.append('non-work links')
    print('\n결과:', '통과' if not fails else '실패 ' + str(fails))

asyncio.run(main())
