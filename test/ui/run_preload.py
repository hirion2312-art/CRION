# 크랙 페이지 스크립트 점검 (가짜 크랙 화면): python3 test/ui/run_preload.py
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


async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 1200, 'height': 800})
        errs = []
        page.on('pageerror', lambda e: errs.append(str(e)))
        await page.goto('file:///home/claude/crion/test/ui/fakecrack.html')
        await page.evaluate(SHIM); await page.evaluate(PRE)
        await page.evaluate("__fire('crion:config', {play:true, rules:{}, learned:null})"); await page.wait_for_timeout(800)
        out = await page.evaluate('__out')
        replies = [o for o in out if o[0] == 'crion:reply']
        await page.wait_for_timeout(2200)
        out = await page.evaluate('__out')
        replies = [o for o in out if o[0] == 'crion:reply']
        first = ''.join(x.get('s', '') for x in (replies[-1][1]['segs'] if replies else []) if x['t'] == 'text')
        print('① 처음 열었을 때 읽은 글(프롤로그·지난 응답):', json.dumps(first[:60], ensure_ascii=False))
        if '지난 응답' not in first: fails.append('prologue not read')
        for bad in ['최근 대화', '공유', '크래커', '재생성', '세션']:
            if bad in first: fails.append('prologue leak:' + bad)
        before = len(replies)
        await page.evaluate("__fire('crion:send', {text:'옥상을 살핀다'})"); await page.wait_for_timeout(4500)
        out = await page.evaluate('__out')
        sent = [o for o in out if o[0] == 'crion:sent']
        print('② 보내기:', sent[-1][1] if sent else None)
        replies = [o[1] for o in out if o[0] == 'crion:reply'][before:]
        done = [r for r in replies if r['done']]
        print('   스트리밍 중 보낸 횟수:', len([r for r in replies if not r['done']]), '/ 완료:', len(done))
        last = done[-1] if done else replies[-1]
        text = ''.join(s.get('s', '') for s in last['segs'] if s['t'] == 'text')
        print('   조각:', [s['t'] for s in last['segs']])
        print('   응답 글:', json.dumps(text[:400], ensure_ascii=False))
        for bad in ['최근 대화', '공유', '크래커', '옥상을 살핀다', '재생성', '지난 응답', '세션', '미리보기']:
            if bad in text: fails.append('leak:' + bad)
        if '식량이 부족' not in text or '창고로 간다' not in text: fails.append('missing reply text')
        if not any(s['t'] == 'img' for s in last['segs']): fails.append('missing img')
        keys = {r['key'] for r in replies}
        print('   응답 key 수:', len(keys), '(1이어야 같은 장면으로 이어짐)')
        if len(keys) != 1: fails.append('key changed')
        learned = [o[1] for o in out if o[0] == 'crion:learned']
        print('③ 배운 모양:', learned[-1] if learned else None)
        if not learned: fails.append('not learned')
        # 다시 열었을 때(배운 모양으로) 마지막 응답 바로 읽기
        page2 = await b.new_page(viewport={'width': 1200, 'height': 800})
        await page2.goto('file:///home/claude/crion/test/ui/fakecrack.html')
        await page2.evaluate(SHIM); await page2.evaluate(PRE)
        await page2.evaluate("(l)=>__fire('crion:config', {play:true, rules:{}, learned:l})", learned[-1] if learned else None)
        await page2.wait_for_timeout(2800)
        r2 = [o[1] for o in await page2.evaluate('__out') if o[0] == 'crion:reply']
        t2 = ''.join(s.get('s', '') for s in (r2[-1]['segs'] if r2 else []) if s['t'] == 'text')
        print('④ 다시 열었을 때 읽은 응답:', json.dumps(t2[:80], ensure_ascii=False))
        if '지난 응답' not in t2 or '재생성' in t2: fails.append('learned read')
        await page.evaluate("__fire('crion:diag')"); await page.wait_for_timeout(200)
        d = [o[1] for o in await page.evaluate('__out') if o[0] == 'crion:diag']
        print('⑤ 진단: 입력', d[-1]['input'], '/ 보내기', d[-1]['send'])
        await b.close()
        if errs: fails.append('errors:' + ';'.join(errs))
    print('\n결과:', '통과' if not fails else '실패 ' + str(fails))

asyncio.run(main())
