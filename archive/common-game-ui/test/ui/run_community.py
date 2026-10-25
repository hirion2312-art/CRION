# 소통 화면 점검 (디스코드를 흉내 내서): python3 test/ui/run_community.py
import asyncio
from playwright.async_api import async_playwright
OUT = '/home/claude/crion/test/out/'
HOOK = 'https://discord.com/api/webhooks/123456789/abcDEF_-xyz'
got = []


async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 1360, 'height': 900})
        page.on('pageerror', lambda e: errs.append(str(e)))

        async def hook(route, req):
            got.append((req.url, req.headers.get('content-type', ''), req.post_data_buffer))
            await route.fulfill(status=204, body='')
        await page.route('https://discord.com/**', hook)
        await page.goto('file:///home/claude/crion/test/ui/harness.html'); await page.wait_for_timeout(700)
        await page.click('[data-act=community]'); await page.wait_for_timeout(400)
        await page.screenshot(path=OUT + 'c1_empty.png')
        # 관리 페이지에서 설정했다고 치고
        await page.evaluate("""(h)=>{const S=window.__crion.S; S.cat={links:{discord:'https://discord.gg/abc',openchat:'https://open.kakao.com/o/xyz'},
          news:[{date:'2026-10-25',title:'CRION 0.3.5 업데이트',text:'홈 배너, 앨범, 명대사가 생겼어요.'},{date:'2026-10-20',title:'평가혜 리뉴얼',text:'프로필 평가가 더 독해졌어요.',link:'https://crack.wrtn.ai'}],
          report:{webhook:h}}; S.notice={text:'신작 준비 중!'}; window.__crion.render();}""", HOOK)
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'c2_ready.png')
        await page.fill('#fBody', '응답에 왼쪽 목록 글씨가 섞여요')
        await page.fill('#fNick', '팬1')
        await page.click('[data-act=form-send]'); await page.wait_for_timeout(800)
        print('보낸 요청:', len(got), got[0][1][:40] if got else None)
        body = got[0][2].decode('utf-8', 'ignore') if got else ''
        print('payload 포함:', 'payload_json' in body, '응답에 왼쪽 목록' in body, '팬1' in body)
        await page.screenshot(path=OUT + 'c3_sent.png')
        await page.click('[data-act=form-kind][data-kind=tip]'); await page.wait_for_timeout(200)
        await page.screenshot(path=OUT + 'c4_tip.png')
        # 플레이 중 신고
        await page.click('[data-act=home]'); await page.wait_for_timeout(300)
        await page.click('.card .thumb[data-id=w1]'); await page.wait_for_timeout(300)
        await page.click('[data-act=report-here]'); await page.wait_for_timeout(300)
        await page.evaluate("""()=>{const w=document.querySelector('#crack');const e=new Event('ipc-message');e.channel='crion:diag';e.args=[{url:'https://crack.wrtn.ai/c/1',input:'textarea',send:'button',list:'div',messages:3,lastTwo:'div.msg',segs:[]}];w.dispatchEvent(e);}""")
        await page.fill('#fBody', '보내기가 안 돼요'); await page.click('[data-act=form-send]'); await page.wait_for_timeout(800)
        body2 = got[-1][2].decode('utf-8', 'ignore') if len(got) > 1 else ''
        print('플레이 중 신고: 첨부 포함', 'crion-diag.txt' in body2, '작품 이름 포함', '아포칼립스' in body2)
        await b.close()
    print('errors:', errs)

asyncio.run(main())
