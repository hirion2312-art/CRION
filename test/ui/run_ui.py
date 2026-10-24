import asyncio, sys
from playwright.async_api import async_playwright
BASE = 'file:///home/claude/crion/test/ui/harness.html'
OUT = '/home/claude/crion/test/out/'
S10 = "📍식당 · D10 저녁\n🍚식량 14 | 🩹의료품 2 | 🧱자재 9 | 🛡️방어력 34\n👥주민 4/5 | 😊사기 61\n🛠️일과: 방어보강 1 · 창고 1\n🚶파견: 없음 | 🚪대기: 없음\n🏢확장 2단계 | ⛽연료 0 💎희귀 0 🧪연구재료 0 | 🔬연구 Lv 0"
S11N = S10.replace('D10 저녁','D11 밤').replace('식량 14','식량 10').replace('자재 9','자재 4').replace('방어력 34','방어력 41').replace('사기 61','사기 52').replace('방어보강 1 · 창고 1','전원 방어')
async def status(page, text):
    await page.evaluate("""(t)=>{const w=document.querySelector('#crack');const e=new Event('ipc-message');e.channel='crion:status';e.args=[{text:t,narration:'',count:1,url:'https://crack.wrtn.ai/x'}];w.dispatchEvent(e);}""", text)
async def main():
    errs=[]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args=['--autoplay-policy=no-user-gesture-required'])
        page = await b.new_page(viewport={'width':1360,'height':860})
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
        await page.goto(BASE); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT+'1_onboard.png')
        await page.click('[data-act=login]'); await page.wait_for_timeout(200)
        await page.screenshot(path=OUT+'2_login_room.png')
        await page.click('.top [data-act=home], [data-act=home]'); await page.wait_for_timeout(200)
        await page.screenshot(path=OUT+'3_home.png')
        await page.click('.work [data-act=open-work][data-id=safehouse]'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT+'4_offer.png')
        await page.click('.modal [data-act=install]'); await page.wait_for_timeout(250)
        await page.screenshot(path=OUT+'5_installing.png')
        await page.wait_for_timeout(1200)
        await page.screenshot(path=OUT+'6_waiting.png')
        await status(page, S10); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT+'7_dash_d10.png')
        await status(page, S11N); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT+'8_bignight.png')
        sent = await page.evaluate('window.__sent')
        await page.click('[data-act=settings]'); await page.wait_for_timeout(200)
        await page.screenshot(path=OUT+'9_settings.png')
        await page.click('[data-act=close]')
        await page.click('.top [data-act=toggle-pack]'); await page.wait_for_timeout(200)
        await page.screenshot(path=OUT+'10_packoff.png')
        print('sent:', sent[-3:])
        await b.close()
    print('errors:', errs)
asyncio.run(main())
