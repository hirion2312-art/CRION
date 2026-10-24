import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome')
        pg = await b.new_page(viewport={'width':900,'height':700})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/crion/test/ui/crack.html')
        await pg.evaluate("""()=>window.__on['crion:config'](null,{detect:'식량\\\\s*-?\\\\d+[\\\\s\\\\S]{0,120}방어력\\\\s*-?\\\\d+',anchor:'식량',hide:true,lineHint:'식량|의료품|자재|방어력|주민|사기|📍',chipText:'상태창 → CRION 대시보드'})""")
        await pg.wait_for_timeout(1300)
        r1 = await pg.evaluate("()=>({host:window.__host.map(h=>[h[0],h[1].text&&h[1].text.slice(0,12),h[1].narration&&h[1].narration.slice(0,20)]),hidden:[...document.querySelectorAll('[data-crion-status]')].map(e=>e.tagName),chips:document.querySelectorAll('[data-crion-chip]').length,visible:getComputedStyle(document.querySelector('pre')).display})")
        print('1 초기:', r1)
        # 스트리밍 흉내: 새 응답이 조금씩 써짐
        await pg.evaluate("""async()=>{const d=document.createElement('div');d.className='msg ai';document.getElementById('chat').appendChild(d);
          const full='밤새 계단 아래에서 무언가 긁는 소리가 났다.\\n📍옥상 · D11 아침\\n🍚식량 10 | 🩹의료품 2 | 🧱자재 9 | 🛡️방어력 34\\n👥주민 4/5 | 😊사기 57';
          const pre=document.createElement('pre');d.appendChild(pre);
          for(let i=0;i<full.length;i+=6){pre.textContent=full.slice(0,i+6);await new Promise(r=>setTimeout(r,120));}}""")
        await pg.wait_for_timeout(2200)
        r2 = await pg.evaluate("()=>window.__host.filter(h=>h[0]==='crion:status').map(h=>h[1].text.split('\\n').find(l=>l.includes('D1')))")
        print('2 스트리밍 후 보낸 상태창:', r2)
        # 칩 눌러 펼치기 → 다른 변화가 생겨도 펼친 채 유지되는지
        await pg.click('[data-crion-chip] >> nth=0')
        await pg.evaluate("()=>{const p=document.createElement('p');p.textContent='새 메시지';document.getElementById('chat').appendChild(p);}")
        await pg.wait_for_timeout(1800)
        r3 = await pg.evaluate("()=>[...document.querySelectorAll('pre')].map(p=>p.offsetHeight>0?'보임':'숨김')")
        print('3 [첫 상태창(칩으로 펼침), 본문 섞인 둘째]:', r3)
        # 팩 끄기
        await pg.evaluate("()=>window.__on['crion:config'](null,null)")
        await pg.wait_for_timeout(300)
        r4 = await pg.evaluate("()=>({pre2:getComputedStyle(document.querySelectorAll('pre')[1]).display,chip:getComputedStyle(document.querySelector('[data-crion-chip]')).display})")
        print('4 팩 끈 뒤:', r4)
        await pg.screenshot(path='/home/claude/crion/test/out/crack_mock.png')
        print('errors', errs)
        await b.close()
asyncio.run(main())
