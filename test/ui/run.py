# 화면 점검: python3 test/ui/run.py  → test/out/*.png
#  가짜 업데이트 서버(reg.test)로 작품 목록·스토어를 흉내 낸다
import asyncio, json
from playwright.async_api import async_playwright
BASE = 'file:///home/claude/crion/test/ui/harness.html'
OUT = '/home/claude/crion/test/out/'
IMG = '/home/claude/crion/test/ui/img/'

CATALOG = {
  'creatorUrl': 'https://share.crack.wrtn.ai/le3go2',
  'notice': {'on': True, 'id': 'n1', 'text': '새 작품 「크랙대학교」 오픈 준비 중이에요!'},
  'news': [{'date': '2026-10-24', 'title': 'CRION 0.4 업데이트', 'text': '메뉴가 새로 바뀌었어요. 작품은 크랙 화면 그대로 열려요.'}],
  'links': {'discord': 'https://discord.gg/x'},
  'report': {},
  'hidden': [],
  'works': [
    {'id': 'w1', 'name': '아포칼립스 안전지대의 관리자', 'genre': '좀비 생존 운영', 'url': 'https://crack.wrtn.ai/detail/a', 'thumb': 'https://reg.test/t1.png', 'featured': True, 'desc': '좀비가 들끓는 도시, 마지막 안전지대의 관리자가 된 당신. 생존자를 받아들이고 식량과 방어를 꾸려 큰 밤을 버텨 내세요.', 'guide': '# 시작 팁\n- 첫날은 **식량**부터 확보하세요\n- 밤에는 바리케이드를 점검\n\n# 생존자\n세라는 의무실, 카일은 정찰 담당이에요.'},
    {'id': 'w2', 'name': '마법소녀의 최종보스', 'genre': '샌드박스', 'url': 'https://crack.wrtn.ai/detail/b', 'thumb': 'https://reg.test/t2.png', 'bgm': 'https://reg.test/bgm.mp3'},
    {'id': 'w3', 'name': '이종족 길드의 유일한 남자', 'genre': '판타지 모험', 'url': 'https://crack.wrtn.ai/detail/c', 'thumb': 'https://reg.test/t3.png'},
    {'id': 'w4', 'name': '크랙대학교', 'genre': '캠퍼스 로맨스 코미디', 'url': '', 'thumb': ''},
    {'id': 'w5', 'name': '돌아온 프로필 평가하는 평가혜', 'genre': '캐릭터챗', 'url': 'https://share.crack.wrtn.ai/okelh4', 'thumb': ''}
  ]
}
PACK = {'id': 'demo', 'name': '안전지대 관리실', 'version': '1.0.0', 'base': 'https://reg.test/CRION/packs/demo/', 'summary': '생존자·식량·방어를 한눈에 보는 관리실 화면', 'desc': '# 들어 있는 것\n- 상태창 게이지\n- 생존자 카드', 'workId': 'w1', 'tags': ['생존', '관리'], 'cover': 'cover.png', 'previews': ['p1.png', 'p2.png'], 'ui': 'ui.html', 'bytes': 2400000}


async def setup(page, packs):
    async def reg(route):
        u = route.request.url
        if 'catalog.json' in u: return await route.fulfill(body=json.dumps(CATALOG, ensure_ascii=False), content_type='application/json')
        if 'index.json' in u: return await route.fulfill(body=json.dumps({'engine': {}, 'packs': packs}), content_type='application/json')
        if u.endswith('ui.html') or 'ui.html?' in u: return await route.fulfill(body='<meta charset="utf-8"><body style="margin:0;background:#1b1412;color:#fff;font:16px sans-serif;display:grid;place-items:center;height:100vh"><div>관리실 화면 미리보기</div></body>', content_type='text/html')
        name = {'t1.png': 't1.png', 't2.png': 't2.png', 't3.png': 't3.png', 'cover.png': 'scene.png', 'p1.png': 'scene.png', 'p2.png': 'sera.png'}.get(u.split('/')[-1].split('?')[0])
        if name: return await route.fulfill(path=IMG + name)
        return await route.fulfill(status=404, body='')
    await page.route('https://reg.test/**', reg)


async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 1360, 'height': 860})
        page.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
        page.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' and 'Failed to load' not in m.text else None)
        await setup(page, [])
        # 1) 처음 켰을 때: 시작 애니메이션 → 사용법
        await page.goto(BASE + '?first'); await page.evaluate('localStorage.clear()'); await page.reload()
        await page.wait_for_timeout(500); await page.screenshot(path=OUT + 'a1_splash.png')
        await page.wait_for_timeout(1700); await page.screenshot(path=OUT + 'a2_tut0.png')
        await page.click('[data-act=tut-next]'); await page.wait_for_timeout(350); await page.screenshot(path=OUT + 'a3_tut1_login.png')
        for _ in range(4): await page.click('[data-act=tut-next]'); await page.wait_for_timeout(150)
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + 'a4_tut_last.png')
        await page.click('[data-act=tut-end]'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'a5_home_first.png')
        # 2) 평소 홈
        await page.goto(BASE); await page.wait_for_timeout(2200)
        print('사용법 다시 안 뜸:', await page.evaluate("!document.querySelector('#tut').classList.contains('on')"))
        await page.screenshot(path=OUT + 'b1_home.png')
        await page.evaluate("document.querySelector('.page').scrollTo(0, 9999)"); await page.wait_for_timeout(200)
        await page.screenshot(path=OUT + 'b2_home_grid.png')
        print('작품 수:', await page.evaluate("document.querySelectorAll('.card').length"), '(관리 페이지 5개)')
        await page.fill('#homeQ', '마법'); await page.wait_for_timeout(200)
        print('검색 "마법":', await page.evaluate("[...document.querySelectorAll('.card .name')].map(x=>x.textContent)"))
        await page.fill('#homeQ', '')
        await page.click('.card .info-btn[data-id=w1]'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'b3_info.png')
        # 3) 플레이 = 크랙 화면
        await page.click('.modal [data-act=play]'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'c1_play_loading.png')
        await page.evaluate("""()=>{const w=document.querySelector('#crack');w.dispatchEvent(new Event('did-stop-loading'));const e=new Event('ipc-message');e.channel='crion:url';e.args=[{url:'https://crack.wrtn.ai/u/x/c/123',chat:true}];w.dispatchEvent(e);}""")
        await page.wait_for_timeout(500)
        print('이어하기 주소 기억:', await page.evaluate("window.__crion.S.settings.workUrls"))
        await page.click('[data-act=guide].icon-btn'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'c2_play_guide.png')
        await page.click('[data-act=report]'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + 'c3_report.png')
        await page.keyboard.press('Escape')
        await page.click('[data-act=leave]'); await page.wait_for_timeout(300)
        print('홈 이어하기 버튼:', await page.evaluate("document.querySelector('.hero [data-act=play]').textContent.trim()"))
        print('보낸 신호(webview):', [x[0] for x in await page.evaluate('window.__sent')])
        # 4) 스토어 (빈 상태)
        await page.click('.nav [data-v=store]'); await page.wait_for_timeout(500)
        await page.screenshot(path=OUT + 'd1_store_empty.png')
        # 5) 커뮤니티 · 내 기록 · 설정
        await page.click('.nav [data-v=community]'); await page.wait_for_timeout(300); await page.screenshot(path=OUT + 'e1_comm_news.png')
        await page.click('[data-act=comm-tab][data-v=send]'); await page.wait_for_timeout(200); await page.screenshot(path=OUT + 'e2_comm_send.png')
        await page.click('.nav [data-v=records]'); await page.wait_for_timeout(300); await page.screenshot(path=OUT + 'f1_records.png')
        await page.click('.nav [data-v=settings]'); await page.wait_for_timeout(300); await page.screenshot(path=OUT + 'g1_settings.png', full_page=True)
        await page.click('[data-act=pref][data-k=navSmall][data-v=true]'); await page.wait_for_timeout(250); await page.screenshot(path=OUT + 'g2_nav_small.png')
        await page.click('[data-act=pref][data-k=navSmall][data-v=false]')
        # 6) 스토어에 팩이 있을 때 (나중 모습 점검)
        p2 = await b.new_page(viewport={'width': 1360, 'height': 860})
        p2.on('pageerror', lambda e: errs.append('pageerror2:' + str(e)))
        await setup(p2, [PACK])
        await p2.goto(BASE); await p2.evaluate("localStorage.setItem('crion.tut4','1')"); await p2.reload(); await p2.wait_for_timeout(2200)
        await p2.screenshot(path=OUT + 'h0_home_packbadge.png')
        await p2.click('.nav [data-v=store]'); await p2.wait_for_timeout(500); await p2.screenshot(path=OUT + 'h1_store_list.png')
        await p2.click('.pcard [data-act=pack]'); await p2.wait_for_timeout(400); await p2.screenshot(path=OUT + 'h2_pack_detail.png')
        await p2.click('.modal [data-act=pack-install]'); await p2.wait_for_timeout(300)
        print('설치됨:', await p2.evaluate("JSON.parse(localStorage.getItem('crion.packs')||'{}')"))
        await p2.click('[data-act=pack-preview]'); await p2.wait_for_timeout(600); await p2.screenshot(path=OUT + 'h3_pack_preview.png')
        await b.close()
    print('\n오류:', errs or '없음')

if __name__ == '__main__':
    asyncio.run(main())
