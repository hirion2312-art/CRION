# 배경 그림 유지 점검: python3 test/ui/run_backdrop.py
import asyncio
from playwright.async_api import async_playwright
OUT = '/home/claude/crion/test/out/'


async def reply(page, segs, key, done=True):
    await page.evaluate("""([s,k,d])=>{const w=document.querySelector('#crack');const e=new Event('ipc-message');e.channel='crion:reply';e.args=[{key:k,segs:s,done:d,input:true}];w.dispatchEvent(e);}""", [segs, key, done])


async def ev(page, ch, d):
    await page.evaluate("""([c,d])=>{const w=document.querySelector('#crack');const e=new Event('ipc-message');e.channel=c;e.args=[d];w.dispatchEvent(e);}""", [ch, d])

BG = "(()=>{const on=document.querySelector('.backdrop.on');return on?on.dataset.src:''})()"


async def main():
    fails, errs = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 1360, 'height': 860})
        page.on('pageerror', lambda e: errs.append(str(e)))
        await page.goto('file:///home/claude/crion/test/ui/harness.html'); await page.wait_for_timeout(500)
        await page.click('.card .thumb[data-id=w3]'); await page.wait_for_timeout(300)
        await ev(page, 'crion:state', {'input': True, 'page': 'chat'})
        # 1턴: 배경 그림
        await page.fill('#msg', '숲으로 간다'); await page.keyboard.press('Enter')
        await reply(page, [{'t': 'text', 's': '숲 입구에 섰다.\n'}, {'t': 'img', 'src': 'img/scene.png', 'w': 1200, 'h': 700, 'alt': ''}, {'t': 'text', 's': '세라 "여기야."'}], 'a')
        await page.wait_for_timeout(1400)
        b1 = await page.evaluate(BG)
        await page.click('#dlg .text'); await page.wait_for_timeout(200); await page.click('#dlg .text'); await page.wait_for_timeout(1300)
        b1b = await page.evaluate(BG)
        await page.screenshot(path=OUT + 'b1_bg.png')
        print('1턴: 첫 장면 배경', repr(b1), '→ 그림 나온 장면', repr(b1b))
        if b1 != '' or b1b != 'img/scene.png': fails.append('turn1')
        # 2턴: 그림 없음 → 배경 유지
        await page.fill('#msg', '더 들어간다'); await page.keyboard.press('Enter')
        await reply(page, [{'t': 'text', 's': '나무가 빽빽하다.\n카일 "조심해."'}], 'b')
        await page.wait_for_timeout(1300)
        b2 = await page.evaluate(BG)
        await page.screenshot(path=OUT + 'b2_keep.png')
        print('2턴(그림 없음): 배경', repr(b2))
        if b2 != 'img/scene.png': fails.append('turn2 keep')
        # 3턴: 인물 그림 → 배경 유지 + 인물 앞에
        await page.fill('#msg', '세라를 본다'); await page.keyboard.press('Enter')
        await reply(page, [{'t': 'img', 'src': 'img/sera.png', 'w': 500, 'h': 820, 'alt': '세라'}, {'t': 'text', 's': '세라 "왜?"'}], 'c')
        await page.wait_for_timeout(1300)
        b3 = await page.evaluate(BG)
        await page.screenshot(path=OUT + 'b3_person.png')
        print('3턴(인물 그림): 화면 그림', repr(b3))
        if b3 != 'img/sera.png': fails.append('turn3 next image')
        # 다시 열기 → 마지막 배경
        await page.click('[data-act=home]'); await page.wait_for_timeout(300)
        await page.click('.card .thumb[data-id=w3]'); await page.wait_for_timeout(1200)
        b4 = await page.evaluate(BG)
        print('다시 열었을 때 화면 그림', repr(b4))
        if b4 != 'img/sera.png': fails.append('reopen')
        await b.close()
    print('errors:', errs)
    print('\n결과:', '통과' if not fails and not errs else '실패 ' + str(fails))

asyncio.run(main())
