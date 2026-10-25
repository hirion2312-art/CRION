# 작품 소개 페이지에서 댓글 칸에 절대 보내지 않는지 점검: python3 test/ui/run_detail.py
import asyncio
from playwright.async_api import async_playwright
PRE = open('/home/claude/crion/src/renderer/crack-preload.js', encoding='utf-8').read() + ';0;'
SHIM = "window.__out=[];window.__h={};window.require=()=>({ipcRenderer:{on:(c,f)=>{__h[c]=f},sendToHost:(c,d)=>{__out.push([c,JSON.parse(JSON.stringify(d))])}}});window.__fire=(c,d)=>__h[c]&&__h[c]({},d);"


async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args=['--allow-file-access-from-files'])
        pg = await b.new_page(viewport={'width': 1200, 'height': 800})
        await pg.goto('file:///home/claude/crion/test/ui/fakedetail.html')
        await pg.evaluate(SHIM); await pg.evaluate(PRE)
        await pg.evaluate("__fire('crion:config',{play:true,rules:{},learned:null})")
        await pg.wait_for_timeout(1800)
        st = [o[1] for o in await pg.evaluate('__out') if o[0] == 'crion:state']
        print('① 페이지 판단:', st[-1] if st else None)
        if not st or st[-1].get('page') != 'detail': fails.append('not detail')
        await pg.evaluate("__fire('crion:send',{text:'안녕'})"); await pg.wait_for_timeout(400)
        sent = [o[1] for o in await pg.evaluate('__out') if o[0] == 'crion:sent']
        val = await pg.evaluate("document.querySelector('textarea').value")
        print('② 보내기 결과:', sent[-1] if sent else None, '/ 댓글 칸 내용:', repr(val))
        if val or (sent and sent[-1]['ok']): fails.append('sent to comment')
        acts = st[-1].get('actions', []) if st else []
        cont = next((a for a in acts if a['kind'] == 'continue'), None)
        if cont:
            await pg.evaluate(f"__fire('crion:click',{cont['id']})"); await pg.wait_for_timeout(200)
        print('③ 이어하기 누름 →', await pg.evaluate('window.__clicked'))
        if await pg.evaluate('window.__clicked') != 'continue': fails.append('click')
        await b.close()
    print('\n결과:', '통과' if not fails else '실패 ' + str(fails))

asyncio.run(main())
