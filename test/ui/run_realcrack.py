# 실제 크랙 구조(2026-10-25 확인)를 본뜬 화면으로 크랙 도우미 점검: python3 test/ui/run_realcrack.py
#  - 작품 화면 '이어하기 / 새로하기' 인식
#  - 새 대화(프롤로그뿐) = 내 말 0개, 예전 대화 = 내 말 있음
#  - 프롤로그·응답 읽기 (flex-col-reverse 순서), 보내기 한 번 = 전송 한 번, 다 쓴 뒤 id가 바뀌어도 같은 응답
import asyncio, json
from playwright.async_api import async_playwright
PRE = open('/home/claude/crion/src/renderer/crack-preload.js', encoding='utf-8').read()
SHIM = """
window.__out = []; window.__h = {};
window.require = () => ({ ipcRenderer: {
  on: (ch, fn) => { window.__h[ch] = fn; },
  sendToHost: (ch, d) => { window.__out.push([ch, JSON.parse(JSON.stringify(d))]); }
}});
window.__fire = (ch, d) => window.__h[ch] && window.__h[ch]({}, d);
"""
DETAIL = """<!doctype html><meta charset=utf-8><body><a href="/">크랙 홈</a><main><h1>소환수 아카데미</h1>
<button>이어하기</button><button onclick="window.__clicked='new'">새로하기</button><button>무료대화권 0회 7일 남음</button></main></body>"""


def text_of(segs):
    return ''.join(s.get('s', '') for s in segs if s['t'] == 'text')


async def open_page(b, url):
    page = await b.new_page(viewport={'width': 1300, 'height': 850})
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    await page.goto(url)
    await page.evaluate(SHIM); await page.evaluate(PRE)
    await page.evaluate("__fire('crion:config', {play:true, rules:{}, learned:null})")
    await page.wait_for_timeout(3200)
    return page, errs


async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        # ① 작품 화면
        d = await b.new_page()
        await d.set_content(DETAIL)
        await d.evaluate(SHIM); await d.evaluate(PRE)
        await d.evaluate("__fire('crion:config', {play:true, rules:{}, learned:null})")
        await d.wait_for_timeout(1800)
        st = [o[1] for o in await d.evaluate('__out') if o[0] == 'crion:state' and o[1].get('poll')]
        acts = st[-1]['actions'] if st else []
        print('① 작품 화면:', st[-1]['page'] if st else None, [(a['kind'], a['label']) for a in acts])
        newa = [a for a in acts if a['kind'] == 'new']
        if not newa or newa[0]['label'] != '새로하기': fails.append('새로하기 not found')
        else:
            await d.evaluate(f"__fire('crion:click', {newa[0]['id']})"); await d.wait_for_timeout(200)
            if await d.evaluate('window.__clicked') != 'new': fails.append('새로하기 not clicked')
        # ② 새 대화
        page, errs = await open_page(b, 'file:///home/claude/crion/test/ui/realcrack.html')
        out = await page.evaluate('__out')
        st = [o[1] for o in out if o[0] == 'crion:state' and o[1].get('poll')]
        print('② 새 대화 상태:', {k: st[-1].get(k) for k in ('page', 'msgs', 'users')} if st else None)
        if not st or st[-1].get('users') != 0 or st[-1].get('msgs') != 1: fails.append('fresh chat not detected')
        rep = [o[1] for o in out if o[0] == 'crion:reply' and o[1]['done']]
        pro = rep[-1] if rep else None
        print('   프롤로그:', json.dumps(text_of(pro['segs'])[:40], ensure_ascii=False) if pro else None, [s.get('alt') for s in pro['segs'] if s['t'] == 'img'] if pro else None)
        if not pro or '사흘 내내' not in text_of(pro['segs']): fails.append('prologue not read')
        if pro and '예전 대화 미리보기' in text_of(pro['segs']): fails.append('sidebar leak')
        # ③ 보내기 한 번 → 응답
        before = len(out)
        await page.evaluate("__fire('crion:send', {text:'창고로 간다'})"); await page.wait_for_timeout(5000)
        out = await page.evaluate('__out')
        sent = await page.evaluate('window.__sent')
        new = [o[1] for o in out[before:] if o[0] == 'crion:reply']
        done = [r for r in new if r['done']]
        print('③ 전송 횟수:', sent, '/ 응답 조각 보냄:', len(new), '/ 완료:', len(done))
        if sent != 1: fails.append('sent %s times' % sent)
        last = done[-1] if done else (new[-1] if new else None)
        t = text_of(last['segs']) if last else ''
        print('   응답:', json.dumps(t[:80], ensure_ascii=False), [s['t'] for s in last['segs']] if last else None)
        if '식량 창고' not in t or '반짝이는' not in t: fails.append('reply missing')
        if '창고로 간다' in t: fails.append('echo leak')
        if '사흘 내내' in t: fails.append('read old message')
        keys = {r['key'] for r in new}
        print('   응답 key 수:', len(keys))
        if len(keys) != 1: fails.append('key changed')
        await page.wait_for_timeout(1700)
        out2 = await page.evaluate('__out')
        again = [o[1] for o in out2[len(out):] if o[0] == 'crion:reply' and o[1]['done']]
        if again: fails.append('id change re-sent reply')
        st = [o[1] for o in out2 if o[0] == 'crion:state' and o[1].get('poll')]
        print('   상태(보낸 뒤):', {k: st[-1].get(k) for k in ('msgs', 'users')})
        if st[-1].get('users') != 1: fails.append('users after send')
        # ④ 예전 대화
        page3, errs3 = await open_page(b, 'file:///home/claude/crion/test/ui/realcrack.html#old')
        out = await page3.evaluate('__out')
        st = [o[1] for o in out if o[0] == 'crion:state' and o[1].get('poll')]
        rep = [o[1] for o in out if o[0] == 'crion:reply' and o[1]['done']]
        print('④ 예전 대화 상태:', {k: st[-1].get(k) for k in ('msgs', 'users')}, '/ 마지막 응답:', json.dumps(text_of(rep[-1]['segs'])[:20], ensure_ascii=False) if rep else None)
        if st[-1].get('users') != 1: fails.append('old chat users')
        if not rep or '운명의 주사위' not in text_of(rep[-1]['segs']): fails.append('old last reply')
        errs = errs + errs3
        print('\n오류:', errs or '없음')
        print('결과:', '통과' if not fails and not errs else '실패 ' + ', '.join(fails))
        await b.close()

asyncio.run(main())
