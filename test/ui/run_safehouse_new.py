# 안전지대 팩 '처음부터' 흐름 점검: python3 test/ui/run_safehouse_new.py
#  새로하기 자동 1번 → 크랙의 기본모드·하드모드 고르기 창을 게임 화면 팝업으로 → 고른 것만 1번 + 시작 1번
#  A) 작품 화면 위 팝업  B) 대화가 먼저 열리고 그 위 팝업  C) 크랙 화면에서 직접 고르기
import asyncio, sys
sys.path.insert(0, '/home/claude/crion/test/ui')
import run_safehouse as T
from playwright.async_api import async_playwright
DETAIL = 'https://crack.wrtn.ai/detail/safehouse'
NEW = {'id': 0, 'kind': 'new', 'label': '새로하기'}
MODES = [{'id': 1, 'kind': 'mode', 'label': '기본모드'}, {'id': 2, 'kind': 'mode', 'label': '하드모드'}]

async def open_pack(page):
    await page.add_init_script("window.__engineVersion='0.9.18'"); await T.setup(page)
    await page.goto(T.BASE); await page.evaluate("localStorage.setItem('crion.tut4','1')"); await page.reload(); await page.wait_for_timeout(1800)
    await page.evaluate("window.__crion.S.dev.repo = { loadWorks: async () => ({ data: { works: [], hidden: [] } }), lastDeploy: async () => null }")
    await page.click('.nav [data-v=store]'); await page.wait_for_timeout(700)
    await page.click('.pcard [data-act=pack]'); await page.wait_for_timeout(400)
    await page.click('.modal [data-act=pack-install]')
    for _ in range(60):
        await page.wait_for_timeout(300)
        if await page.evaluate("!!JSON.parse(localStorage.getItem('crion.packs')||'{}')['hirion.safehouse']"): break
    await page.wait_for_timeout(300); await page.click('.modal [data-act=pack-play]'); await page.wait_for_timeout(1200)
    await page.wait_for_function("!!document.querySelector('.sh')"); await page.wait_for_timeout(2600)
    await page.evaluate("""(()=>{const w=document.querySelector('#crack');w.dispatchEvent(new Event('dom-ready'));})()""")

clicks = lambda page: page.evaluate("window.__sent.filter(x => x[0] === 'crion:click').map(x => x[1])")
st = lambda page, d: T.ipc(page, 'crion:state', d)

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 1440, 'height': 900})
        errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
        await open_pack(page)
        # A) 작품 화면 위 팝업
        await page.click('[data-sh=t-new]'); await page.wait_for_timeout(200); await page.evaluate("window.__sent = []")
        await st(page, {'page': 'detail', 'url': DETAIL, 'actions': [NEW]}); await page.wait_for_timeout(150)
        await st(page, {'page': 'detail', 'url': DETAIL, 'actions': [NEW] + MODES + [{'id': 3, 'kind': 'confirm', 'label': '대화 시작하기'}]}); await page.wait_for_timeout(250)
        popup = await page.evaluate("[...document.querySelectorAll('.sh-mode')].map(b=>b.innerText)")
        print('A 팝업:', popup, '/ 지금까지 누른 것:', await clicks(page))
        await page.screenshot(path=T.OUT + 'sh_n1_popup.png')
        await page.click('.sh-mode[data-label=하드모드]'); await page.wait_for_timeout(150)
        await st(page, {'page': 'detail', 'url': DETAIL, 'actions': [NEW] + MODES + [{'id': 3, 'kind': 'confirm', 'label': '대화 시작하기'}], 'x': 1}); await page.wait_for_timeout(150)
        await st(page, {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/a1', 'msgs': 1, 'actions': []}); await page.wait_for_timeout(200)
        c = await clicks(page); print('A 누른 것:', c, '/ 연결:', await page.evaluate('window.__pk.state.mode'))
        if c != [0, 2, 3] or popup != ['기본모드', '하드모드']: fails.append('A ' + str(c))
        # B) 대화가 먼저 열리고, 그 위에 고르기 창
        await page.evaluate("window.__pk.go && 0"); await page.click('[data-act=pk-crack]'); await page.click('[data-act=pk-crack]')
        await T.ipc(page, 'crion:url', {'url': DETAIL, 'chat': False})
        await page.evaluate("window.__pk.state.mode='title'")
        await page.evaluate("document.querySelector('[data-sh=title]') ? 0 : 0")
        await page.evaluate("(()=>{const b=document.createElement('button');b.dataset.sh='t-new';document.querySelector('.sh').appendChild(b);b.click();b.remove();})()"); await page.wait_for_timeout(200)
        await page.evaluate("window.__sent = []")
        await st(page, {'page': 'detail', 'url': DETAIL, 'actions': [NEW]}); await page.wait_for_timeout(150)
        await T.ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/b1', 'chat': True})
        await st(page, {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/b1', 'msgs': 0, 'actions': MODES + [{'id': 3, 'kind': 'confirm', 'label': '시작하기'}]}); await page.wait_for_timeout(250)
        popup = await page.evaluate("[...document.querySelectorAll('.sh-mode')].map(b=>b.innerText)")
        print('B 팝업:', popup, '/ 모드:', await page.evaluate('window.__pk.state.mode'))
        await page.click('.sh-mode[data-label=기본모드]'); await page.wait_for_timeout(150)
        await st(page, {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/b1', 'msgs': 0, 'actions': MODES + [{'id': 3, 'kind': 'confirm', 'label': '시작하기'}], 'x': 2}); await page.wait_for_timeout(150)
        await st(page, {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/b1', 'msgs': 1, 'actions': []}); await page.wait_for_timeout(250)
        c = await clicks(page)
        print('B 누른 것:', c, '/ 연결:', await page.evaluate('window.__pk.state.mode'), [x['url'] for x in await page.evaluate('window.__pk.saves()')][-1:], '/ 팝업 닫힘:', not await page.query_selector('.sh-mode'))
        if c != [0, 1, 3] or popup != ['기본모드', '하드모드']: fails.append('B ' + str(c))
        await T.ipc(page, 'crion:reply', {'key': 'kb', 'segs': T.PROLOGUE, 'done': True}); await page.wait_for_timeout(500)
        print('B 프롤로그 읽음:', await page.evaluate('!!window.__pk.state.cine'))
        # 첫 응답 뒤엔 같은 글자가 와도 팝업 없음
        await page.evaluate("window.__pk.state.cine && document.querySelector('[data-sh=cine-skip]').click()"); await page.wait_for_timeout(600)
        await st(page, {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/b1', 'msgs': 2, 'actions': MODES}); await page.wait_for_timeout(200)
        if await page.query_selector('.sh-mode'): fails.append('popup after first reply')
        # C) 크랙 화면에서 직접 고르기
        await page.evaluate("(()=>{const b=document.createElement('button');b.dataset.sh='t-new';document.querySelector('.sh').appendChild(b);b.click();b.remove();})()"); await page.wait_for_timeout(200)
        await page.evaluate("window.__sent = []")
        await st(page, {'page': 'detail', 'url': DETAIL, 'actions': [NEW]}); await page.wait_for_timeout(150)
        await st(page, {'page': 'detail', 'url': DETAIL, 'actions': [NEW] + MODES}); await page.wait_for_timeout(200)
        await page.click('[data-sh=crack-pick]'); await page.wait_for_timeout(150)
        crack_on = await page.evaluate("document.querySelector('#pk').classList.contains('off')")
        await st(page, {'page': 'detail', 'url': DETAIL, 'actions': [NEW] + MODES, 'x': 3}); await page.wait_for_timeout(150)
        no_popup = not await page.query_selector('#sh-banner:not([hidden]) .sh-mode')
        await T.ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/c1', 'chat': True})
        await st(page, {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/c1', 'msgs': 1, 'actions': []}); await page.wait_for_timeout(250)
        back = not await page.evaluate("document.querySelector('#pk').classList.contains('off')")
        print('C 크랙 화면 열림:', crack_on, '/ 고르는 동안 팝업 없음:', no_popup, '/ 연결:', await page.evaluate('window.__pk.state.mode'), '/ 게임 화면 복귀:', back, '/ 누른 것:', await clicks(page))
        if not (crack_on and no_popup and back) or await clicks(page) != [0]: fails.append('C')
        await b.close()
    print('\n오류:', errs or '없음', '/ 실패:', fails or '없음')

if __name__ == '__main__':
    asyncio.run(main())
