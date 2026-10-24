import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome')
        pg = await b.new_page()
        await pg.goto('file:///home/claude/crion/test/ui/crack.html')
        await pg.evaluate("""()=>{document.getElementById('chat').innerHTML='<div class=\"msg\"><p>해가 지자 계단이 울기 시작했다.</p><p>[상태창]<br>📍1층 철문 · D11 밤<br>🍚식량 10 | 🩹의료품 2 | 🧱자재 4 | 🛡️방어력 41<br>👥주민 4/5 | 😊사기 52<br>🛠️일과: 전원 방어<br>🚶파견: 없음 | 🚪대기: 없음</p></div>';}""")
        await pg.evaluate("""()=>window.__on['crion:config'](null,{detect:'식량\\\\s*-?\\\\d+[\\\\s\\\\S]{0,120}방어력\\\\s*-?\\\\d+',anchor:'식량',hide:true,lineHint:'식량|의료품|자재|방어력|주민|사기|일과|파견|대기|📍'})""")
        await pg.wait_for_timeout(1600)
        r = await pg.evaluate("()=>({sent:window.__host.filter(h=>h[0]==='crion:status').map(h=>h[1].text),narr:window.__host.filter(h=>h[0]==='crion:status').map(h=>h[1].narration.trim().slice(0,30)),hidden:[...document.querySelectorAll('[data-crion-status]')].map(e=>e.tagName),storyVisible:document.querySelector('p').offsetHeight>0})")
        print(r)
        await b.close()
asyncio.run(main())
