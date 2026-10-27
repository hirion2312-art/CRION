# 새로하기 뒤 '시작 설정'(기본모드·하드모드) 고르는 창 알아보기 점검: python3 test/ui/run_startmode.py
#  가짜 크랙 작품 화면 3가지(역할 있는 버튼 / 설명 붙은 카드 / 역할 없는 div)에서 'mode' 버튼을 찾고, 누르면 그것만 눌리는지
import asyncio, json
from playwright.async_api import async_playwright
PRE = open('/home/claude/crion/src/renderer/crack-preload.js', encoding='utf-8').read()
SHIM = """
window.__out = []; window.__h = {}; window.__clicked = [];
window.require = () => ({ ipcRenderer: { on: (ch, fn) => { window.__h[ch] = fn; }, sendToHost: (ch, d) => { window.__out.push([ch, JSON.parse(JSON.stringify(d))]); } } });
window.__fire = (ch, d) => window.__h[ch] && window.__h[ch]({}, d);
"""
PAGES = {
  'button': '<h1>아포칼립스 안전지대의 관리자</h1><button>이어하기</button><button>새로하기</button><div role="dialog"><p>시작 설정</p><button onclick="__clicked.push(\'기본\')">기본모드</button><button onclick="__clicked.push(\'하드\')">하드모드</button><button onclick="__clicked.push(\'시작\')">대화 시작하기</button></div>',
  'card': '<h1>작품</h1><button>새로하기</button><div class="modal"><ul><li onclick="__clicked.push(\'기본\')"><b>기본모드</b><small>식량 7로 시작해요. 처음이라면 추천</small></li><li onclick="__clicked.push(\'하드\')"><b>하드모드</b><small>더 혹독한 시작</small></li></ul><button onclick="__clicked.push(\'시작\')">확인</button></div>',
  'div': '<h1>작품</h1><button>새로하기</button><div class="sheet"><div style="cursor:pointer" onclick="__clicked.push(\'기본\')"><div><span>기본모드</span></div></div><div style="cursor:pointer" onclick="__clicked.push(\'하드\')"><div><span>하드모드</span></div></div></div>',
  # 실제와 비슷한 흐름: 작품 화면에 설정 탭이 있고(떠 있지 않음), 새로하기를 누르면 화면 고정 팝업이 뜬다 → 팝업 안의 것을 골라야 함
  'popup': '<h1>작품</h1><div class="tabs"><span onclick="__clicked.push(\'탭기본\')">기본모드</span><span onclick="__clicked.push(\'탭하드\')">하드모드</span></div><button onclick="document.getElementById(\'pp\').style.display=\'block\'">새로하기</button><div id="pp" style="display:none;position:fixed;inset:20% 30%;background:#fff"><div style="cursor:pointer" onclick="__clicked.push(\'기본\')"><p>기본모드</p><small>처음이라면</small></div><div style="cursor:pointer" onclick="__clicked.push(\'하드\')"><p>하드모드</p></div><button onclick="__clicked.push(\'시작\')">대화 시작하기</button></div>',
}
CHAT_INPUT = '<textarea style="position:fixed;bottom:10px;left:10px;width:600px;height:40px"></textarea>'
CHATS = {
  # 대화 화면 머리줄에 남은 '하드모드' 글자 → 고르기 아님
  'chat-header': '<header>아포칼립스 안전지대의 관리자 · 하드모드</header><div>프롤로그</div>' + CHAT_INPUT,
  # 대화 화면 위에 뜬 고르기 창 → 고르기 + 시작 버튼
  'chat-modal': '<div>…</div>' + CHAT_INPUT + '<div style="position:fixed;inset:25%;background:#fff"><button onclick="__clicked.push(\'기본\')">기본모드</button><button onclick="__clicked.push(\'하드\')">하드모드</button><button onclick="__clicked.push(\'시작\')">시작하기</button></div>',
}

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name, html in CHATS.items():
            page = await b.new_page()
            await page.set_content('<!doctype html><meta charset=utf-8><body style="height:900px">' + html + '</body>')
            await page.evaluate(SHIM); await page.evaluate(PRE)
            await page.evaluate("__fire('crion:config', {play:true, rules:{}, learned:null, modes:['기본모드','하드모드']})")
            await page.wait_for_timeout(1800)
            st = [o[1] for o in await page.evaluate('__out') if o[0] == 'crion:state']
            acts = st[-1]['actions'] if st else []
            print(name, '→ page', st[-1]['page'] if st else None, [(a['kind'], a['label']) for a in acts])
            modes = [a for a in acts if a['kind'] == 'mode']
            if name == 'chat-header' and modes: fails.append('header text taken as mode')
            if name == 'chat-modal':
                if [a['label'] for a in modes] != ['기본모드', '하드모드']: fails.append('chat modal modes missing')
                if not any(a['kind'] == 'confirm' for a in acts): fails.append('chat modal confirm missing')
            await page.close()
        for name, html in PAGES.items():
            page = await b.new_page()
            await page.set_content('<!doctype html><meta charset=utf-8><body>' + html + '</body>')
            await page.evaluate(SHIM); await page.evaluate(PRE)
            await page.evaluate("__fire('crion:config', {play:true, rules:{}, learned:null, modes:['기본모드','하드모드']})")
            if name == 'popup': await page.wait_for_timeout(1600); await page.click('text=새로하기')
            await page.wait_for_timeout(1800)
            st = [o[1] for o in await page.evaluate('__out') if o[0] == 'crion:state']
            acts = st[-1]['actions'] if st else []
            modes = [a for a in acts if a['kind'] == 'mode']
            print(name, '→', [(a['kind'], a['label']) for a in acts])
            if [a['label'] for a in modes] != ['기본모드', '하드모드']: fails.append(name + ': modes ' + json.dumps([a['label'] for a in modes], ensure_ascii=False))
            hard = next((a for a in modes if a['label'] == '하드모드'), None)
            if hard:
                await page.evaluate(f"__fire('crion:click', {hard['id']})"); await page.wait_for_timeout(100)
                clicked = await page.evaluate('__clicked')
                print('   하드모드 누름 →', clicked)
                if clicked != ['하드']: fails.append(name + ': clicked ' + str(clicked))
            # 팩이 시작 설정을 안 알려 주면 mode 로 안 잡는다
            await page.evaluate("__fire('crion:config', {play:true, rules:{}, learned:null})"); await page.wait_for_timeout(1700)
            st = [o[1] for o in await page.evaluate('__out') if o[0] == 'crion:state']
            if any(a['kind'] == 'mode' for a in st[-1]['actions']): fails.append(name + ': mode without config')
            await page.close()
        await b.close()
    print('\n실패:', fails or '없음')

asyncio.run(main())
