# 공용 게임 화면 점검: python3 test/ui/run.py  → test/out/*.png
import asyncio
from playwright.async_api import async_playwright
BASE = 'file:///home/claude/crion/test/ui/harness.html'
OUT = '/home/claude/crion/test/out/'
T1 = """*비가 그친 옥상. 철문 너머로 좀비 무리의 신음이 낮게 깔렸다.*

세라가 난간에 기대 숨을 골랐다. 젖은 머리칼이 뺨에 달라붙어 있었다.
세라: "관리자님, 식량이 이틀 치밖에 안 남았어요."
"그리고… 아래층 바리케이드가 흔들려요."
카일 "내가 보고 올게. 기다려."

어떻게 할까?
1. 세라와 함께 식량 창고를 확인한다
2. 카일을 따라 아래층으로 내려간다
3. 무전기로 다른 생존자를 부른다
━━━━━━━━━━━━━━
📅 DAY 12 저녁 | 📍옥상
🍞 식량 6/40 | 💧 물 12/40 | 🛡️ 방어 55%
👥 생존자 7명 | 😊 사기 42/100
━━━━━━━━━━━━━━"""


async def reply(page, segs, key, done, inp=True):
    await page.evaluate("""([s,k,d,i])=>{const w=document.querySelector('#crack');const e=new Event('ipc-message');e.channel='crion:reply';e.args=[{key:k,segs:s,done:d,input:i,url:'https://crack.wrtn.ai/chat/1'}];w.dispatchEvent(e);}""", [segs, key, done, inp])


async def ev(page, ch, d):
    await page.evaluate("""([c,d])=>{const w=document.querySelector('#crack');const e=new Event('ipc-message');e.channel=c;e.args=[d];w.dispatchEvent(e);}""", [ch, d])


async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 1360, 'height': 860})
        page.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
        page.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' and 'Failed to load' not in m.text else None)
        await page.goto(BASE); await page.wait_for_timeout(1200)
        await page.screenshot(path=OUT + 'v1_home.png')
        await page.click('.card .thumb[data-id=w1]'); await page.wait_for_timeout(500)
        await page.screenshot(path=OUT + 'v2_room_login.png')
        await ev(page, 'crion:state', {'input': True}); await page.wait_for_timeout(400)
        await page.screenshot(path=OUT + 'v3_room_ready.png')
        await page.fill('#msg', '옥상 상황을 살핀다'); await page.keyboard.press('Enter'); await page.wait_for_timeout(200)
        print('sent:', [x for x in await page.evaluate('window.__sent') if x[0] == 'crion:send'])
        await ev(page, 'crion:sent', {'ok': True}); await ev(page, 'crion:state', {'input': True, 'waiting': True})
        await reply(page, [{'t': 'text', 's': T1[:180]}], '7', False); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'v4_streaming.png')
        segs = [{'t': 'text', 's': T1.split('세라:')[0]}, {'t': 'img', 'src': 'img/sera.png', 'w': 500, 'h': 820, 'alt': '세라_걱정'}, {'t': 'text', 's': '세라:' + T1.split('세라:')[1]}]
        await reply(page, segs, '7', False); await page.wait_for_timeout(200)
        await reply(page, segs, '7', True); await page.wait_for_timeout(500)
        await page.screenshot(path=OUT + 'v5_done_end.png')
        await page.click('[data-act=first]'); await page.wait_for_timeout(900)
        await page.screenshot(path=OUT + 'v6_first.png')
        for _ in range(3):
            await page.click('#dlg .text'); await page.wait_for_timeout(500)
        await page.screenshot(path=OUT + 'v7_person.png')
        for _ in range(6):
            await page.keyboard.press('Space'); await page.wait_for_timeout(350)
        await page.screenshot(path=OUT + 'v8_choices.png')
        await page.keyboard.press('2'); await page.wait_for_timeout(200)
        print('choice sent:', [x[1] for x in await page.evaluate('window.__sent') if x[0] == 'crion:send'][-1])
        await reply(page, [{'t': 'img', 'src': 'img/scene.png', 'w': 1200, 'h': 700}, {'t': 'text', 's': '계단 아래는 어두웠다. 비상등이 깜박인다.\n카일 "조용히 해. 뭔가 있어."\n━━━━━━━━━━\n📅 DAY 12 밤 | 📍계단\n🍞 식량 4/40 | 💧 물 12/40 | 🛡️ 방어 50%\n👥 생존자 7명 | 😊 사기 45/100\n━━━━━━━━━━'}], '8', True); await page.wait_for_timeout(1200)
        await page.screenshot(path=OUT + 'v9_scene.png')
        await page.click('[data-act=star]'); await page.wait_for_timeout(200)
        for tab in ['chars', 'album', 'quotes']:
            await page.click(f'[data-act=side-tab][data-tab={tab}]'); await page.wait_for_timeout(250)
            await page.screenshot(path=OUT + f'v9_side_{tab}.png')
        await page.click('[data-act=side-tab][data-tab=status]')
        await page.click('[data-act=quick-edit]'); await page.wait_for_timeout(200)
        await page.fill('#quickText', '주변을 살핀다\n상태창을 확인한다'); await page.click('[data-act=quick-save]'); await page.wait_for_timeout(200)
        await page.click('[data-act=guide]'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'v9b_guide.png')
        await page.keyboard.press('Escape')
        await page.keyboard.press('f'); await page.wait_for_timeout(500)
        await page.screenshot(path=OUT + 'v9c_immersive.png')
        await page.keyboard.press('Escape'); await page.wait_for_timeout(300)
        await page.click('[data-act=log]'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'v10_log.png')
        await page.keyboard.press('Escape')
        await page.click('[data-act=settings]'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'v11_settings.png')
        await page.keyboard.press('Escape')
        await page.click('[data-act=home]'); await page.wait_for_timeout(500)
        await page.screenshot(path=OUT + 'v12_home_after.png')
        await page.click('.card .info-btn[data-id=w1]'); await page.wait_for_timeout(400)
        await page.screenshot(path=OUT + 'v13_info.png')
        await page.click('[data-act=info-tab][data-tab=chars]'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'v13_info_chars.png')
        await b.close()
    print('errors:', errs)

asyncio.run(main())
