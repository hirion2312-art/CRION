import asyncio, json, sys
from playwright.async_api import async_playwright
BASE='file:///home/claude/crion/test/ui/harness2.html'
OUT='/home/claude/crion/test/out/'
S1="""📅 1학년 봄 1일차 오후 | 📍기숙사
🎓 {user} | 🏠해의 동 | 💰3은 0동 | 🎒상처약×2, 계약석×1
🐾 위카(위카·기본) Lv 5 | ❤️165/165 | ✨XP 0/20
 공55 방80 특공95 특방110 속80 | 없음
 기술: 촛불 점화(💫40|15 화상10%) 촛농 붕대(✨|5 HP 25% 회복)
📦 계약 1/6 | 📖 도감 1/80 | 🏅 배지 0/7
📜 의뢰: 없음 | 🗓️ 다음 일정: 저녁 신입생 환영회"""
R1="""*제단의 빛이 가라앉자 위카가 내 소매 끝을 꼭 쥐고 있었다. 손등에는 막 새겨진 촛불 모양 계약 문장이 은은하게 식어 간다.*

마가렛 교수가 명부를 넘기며 안경알 너머로 우리를 훑었다.
【마가렛|엄격】"위카, 화 속성. 해의 동으로 배정합니다. 기숙사 규칙은 벽에 붙어 있으니 읽어 두십시오."

"저, 저기… 해의 동이면 따뜻한 곳이에요?" 위카가 올려다본다.

뒤에서 누군가 하품을 삼켰다.
【레이먼드|기본】"…괜찮아, 따뜻해. 난로가 너무 세서 문제지."

💡 기숙사로 짐 풀러 간다 / 위카에게 학교를 구경시켜 준다 / 카일에게 인사한다
━━━━━━━━━━━━━━
"""+S1+"""
━━━━━━━━━━━━━━
【CRION】
bgm=partner
fx=sparks
【/CRION】"""
S2="""📅 1학년 여름 13일차 오후 | 📍야생지대
🎓 {user} | 🏠해의 동 | 💰4은 20동 | 🎒상처약×1, 계약석×1
🐾 위카(위카·기본) Lv 14 | ❤️58/210 | ✨XP 12/56
 공73 방98 특공113 특방128 속98 | 화상
 기술: 촛불 점화(💫40|14/15 화상10%) 촛농 붕대(✨|5/5 HP 25% 회복)
🐾 미르(미르·기본) Lv 3 | ❤️90/100 | ✨XP 1/10
 공40 방40 특공40 특방40 속40 | 없음
 기술: 박치기(⚔️30|10 없음)
📦 계약 2/6 | 📖 도감 3/80 | 🏅 배지 2/7
📜 의뢰: 야외합숙 포획 실습 | 🗓️ 다음 일정: 가을 에테르나 컵 D-38"""
R2="""*풍차 날개가 비명처럼 돌아간다. 폭주한 월리의 날개바퀴가 만든 돌풍이 풀밭을 갈아엎고 있었다.*

⚔️ 위카 Lv 14 ❤️58/210 [화상] vs 야생 월리 Lv 15 ❤️71/215 [없음]
▶ 촛불 점화 → 💥 -38 (효과가 굉장했다!) / 월리 회전 바람 → 💥 -46
촛불 점화 14/15, 촛농 붕대 5/5

위카가 비틀거리며 일어났다. 머리 위 불꽃이 바람에 꺼질 듯 가늘어진다.
"괘, 괜찮아요… 아직, 할 수 있어요…!"

💡 촛농 붕대로 회복한다 / 방어를 지시한다 / 촛불 점화로 밀어붙인다
━━━━━━━━━━━━━━
"""+S2+"""
━━━━━━━━━━━━━━
【CRION】
fx=heartbeat,vignette_red
【/CRION】"""
S3=S1.replace('기숙사','학생식당').replace('오후','저녁').replace('1일차','9일차')
R3="""*저녁 식당은 소란스러웠다. 브루노가 쟁반 두 개를 아슬아슬하게 들고 오다 멈춰 섰다.*
【브루노|웃음】"야, 이쪽 자리 비었어! 한 판 붙자! 아니 밥부터!"
세라가 옆자리 의자를 슬쩍 당겨 주며 웃었다.
【세라|기본】"괜찮아? 오전 수업 내내 위카가 졸고 있던데…"
📖 도감 등록!
🔑 AC-7731-QWER
💡 브루노 옆에 앉는다 / 카일에게 말을 건다 / 위카에게 빵을 사 준다 / 도서관으로 간다
━━━━━━━━━━━━━━
"""+S3+"""
━━━━━━━━━━━━━━
【CRION】
bgm=daily
cg=summon
【/CRION】"""
async def reply(page, text, rep, key, imgs=None):
    await page.evaluate("""([t,r,k,im])=>{const w=document.querySelector('#crack');const e=new Event('ipc-message');e.channel='crion:status';e.args=[{text:t,reply:r,key:k,imgs:im||[],narration:'',count:1,url:'https://crack.wrtn.ai/x'}];w.dispatchEvent(e);}""",[text,rep,key,imgs])
async def main():
    errs=[]
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',args=['--autoplay-policy=no-user-gesture-required','--allow-file-access-from-files'])
        page=await b.new_page(viewport={'width':1360,'height':860})
        page.on('pageerror',lambda e:errs.append('pageerror:'+str(e)))
        page.on('console',lambda m: errs.append('console:'+m.text) if m.type=='error' and 'ERR_' not in m.text and 'Failed to load resource' not in m.text else None)
        await page.goto(BASE); await page.wait_for_timeout(500)
        await page.click('.work [data-act=open-work]'); await page.wait_for_timeout(500)
        await page.screenshot(path=OUT+'g0_room_chat_open.png')
        cfg=[x for x in await page.evaluate('window.__sent') if x[0]=='crion:config']
        print('config sent:', cfg[-1][1] if cfg else None)
        await reply(page,S1,R1,'k1'); await page.wait_for_timeout(900)
        await page.screenshot(path=OUT+'g1_first_beat.png')
        await page.click('#gmDlg'); await page.wait_for_timeout(600)
        await page.screenshot(path=OUT+'g2_say.png')
        for _ in range(8):
            await page.click('#gmDlg'); await page.wait_for_timeout(250)
        await page.wait_for_timeout(600)
        await page.screenshot(path=OUT+'g3_choices.png')
        await page.click('[data-g=choice][data-i="0"]'); await page.wait_for_timeout(300)
        print('fill sent:', [x for x in await page.evaluate('window.__sent') if x[0]=='crion:fill'])
        await page.screenshot(path=OUT+'g3b_after_choice.png')
        await page.click('[data-act=chat-close]'); await page.wait_for_timeout(500)
        await reply(page,S2,R2,'k2'); await page.wait_for_timeout(1200)
        await page.screenshot(path=OUT+'g4_battle.png')
        await page.click('[data-g=flip][data-i="0"]'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT+'g5_flip.png')
        await reply(page,S3,R3,'k3',[{'src':'game/assets/wika.png','w':512,'h':512,'alt':'위카'}]); await page.wait_for_timeout(1500)
        await page.screenshot(path=OUT+'g6_cg.png')
        await page.click('#gmCg'); await page.wait_for_timeout(300)
        for _ in range(6):
            await page.click('#gmDlg'); await page.wait_for_timeout(200)
        await page.screenshot(path=OUT+'g7_dex_note.png')
        await page.click('[data-g=modal][data-m=pouch]'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT+'g8_pouch.png')
        await page.click('[data-g=modal-x]')
        await page.click('[data-g=modal][data-m=dex]'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT+'g9_dex.png')
        await page.click('[data-g=modal-x]')
        await page.click('[data-act=settings]'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT+'g10_settings.png')
        st=await page.evaluate('({bg:document.querySelector(".gm-bg.show")?.style.backgroundImage, phase:document.querySelector(".gm")?.dataset.phase, fx:document.querySelector(".gm-stage").className})')
        print(json.dumps(st,ensure_ascii=False))
        await b.close()
    print('errors:',errs)
asyncio.run(main())
