# 관리 페이지 점검 (GitHub를 흉내 내서): python3 test/ui/run_admin.py
import asyncio, json, base64, tempfile, os
from playwright.async_api import async_playwright
OUT = '/home/claude/crion/test/out/'
works = json.load(open('/home/claude/crion/config/works.json', encoding='utf-8'))
pkg = json.load(open('/home/claude/crion/package.json'))
files = {'config/works.json': json.dumps(works, ensure_ascii=False, indent=1), 'package.json': json.dumps(pkg, indent=2),
         'config/app.json': open('/home/claude/crion/config/app.json', encoding='utf-8').read(), 'supabase/schema.sql': open('/home/claude/crion/supabase/schema.sql', encoding='utf-8').read()}
SB = {'confirm': True}
puts = []
SONG = os.path.join(tempfile.gettempdir(), 'crion_test_song.mp3')
open(SONG, 'wb').write(b'ID3' + b'\0' * 2000)


def b64(s):
    return base64.b64encode(s.encode('utf-8')).decode()


async def handle(route, req):
    u = req.url.split('api.github.com/repos/hirion2312-art/CRION')[1]
    path = u.split('?')[0]
    if path == '':
        return await route.fulfill(json={'full_name': 'hirion2312-art/CRION', 'permissions': {'push': True}})
    if path.startswith('/actions/runs'):
        return await route.fulfill(json={'workflow_runs': [
            {'name': '업데이트 배포 (팩·화면 엔진)', 'status': 'completed', 'conclusion': 'success', 'display_title': '관리 페이지: 작품 목록·공지 수정', 'created_at': '2026-10-25T00:10:00Z', 'html_url': 'https://github.com'},
            {'name': 'CRION 빌드 (설치 파일)', 'status': 'in_progress', 'conclusion': None, 'display_title': '설치 파일 v0.3.1', 'created_at': '2026-10-25T00:05:00Z', 'html_url': 'https://github.com'}]})
    if path.startswith('/contents/'):
        p = path[len('/contents/'):]
        from urllib.parse import unquote
        p = unquote(p)
        if req.method == 'GET':
            if p in files:
                return await route.fulfill(json={'content': b64(files[p]), 'sha': 'sha-' + str(len(files[p]))})
            return await route.fulfill(status=404, json={'message': 'Not Found'})
        if req.method == 'PUT':
            body = json.loads(req.post_data)
            content = base64.b64decode(body['content'])
            puts.append((p, body['message'], len(content)))
            if p.endswith('.json'):
                files[p] = content.decode('utf-8')
            return await route.fulfill(json={'content': {'sha': 'new'}})
    await route.fulfill(status=404, json={'message': 'x'})


async def supa(route, req):
    u = req.url.split('.supabase.co')[1]
    if u.startswith('/auth/v1/settings'):
        return await route.fulfill(json={'external': {'anonymous_users': True, 'email': True}, 'mailer_autoconfirm': not SB['confirm'], 'disable_signup': False})
    if u.startswith('/rest/v1/rpc/crion_schema_version'): return await route.fulfill(json=2)
    if u.startswith('/auth/v1/token'): return await route.fulfill(json={'access_token': 'T'})
    if u.startswith('/rest/v1/admins'): return await route.fulfill(json=[{'uid': 'a'}])
    await route.fulfill(status=404, json={})


async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 1100, 'height': 900})
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await page.route('https://api.github.com/**', handle)
        await page.goto('file:///home/claude/crion/site/admin.html'); await page.wait_for_timeout(800)
        await page.screenshot(path=OUT + 'a1_login.png', full_page=True)
        await page.fill('#tok', 'github_pat_test'); await page.click('#connect'); await page.wait_for_timeout(800)
        print('state at load:', await page.inner_text('#state'))
        await page.screenshot(path=OUT + 'a2_main.png', full_page=True)
        await page.fill('#works .work[data-i="0"] input[data-f=url]', 'https://crack.wrtn.ai/detail/abc')
        await page.fill('#noticeText', '신작이 열렸어요!')
        await page.set_input_files('#file', '/home/claude/crion/test/ui/img/t2.png') if False else None
        # 업로드: 버튼 → 파일 선택
        async with page.expect_file_chooser() as fc:
            await page.click('#works .work[data-i="1"] [data-a=upload]')
        await (await fc.value).set_files('/home/claude/crion/test/ui/img/t2.png')
        await page.wait_for_timeout(600)
        async with page.expect_file_chooser() as fc2:
            await page.click('#works .work[data-i="2"] [data-a=bgm]')
        await (await fc2.value).set_files(SONG)
        await page.wait_for_timeout(400)
        await page.click('#works .work[data-i="2"] [data-a=featured]')
        await page.fill('#works .work[data-i="2"] textarea[data-f=desc]', '이종족 길드 소개 문장')
        await page.fill('#lkDiscord', 'https://discord.gg/abc')
        await page.fill('#hook', 'https://discord.com/api/webhooks/123/abc-DEF')
        await page.click('#addNews'); await page.wait_for_timeout(100)
        await page.fill('#news input[data-nf=title]', 'CRION 0.3.7 업데이트')
        await page.fill('#news textarea[data-nf=text]', '소통 화면이 생겼어요')
        # 카테고리: 0번 작품에 첫 카테고리 켜기 / 새 카테고리
        await page.click('#works .work[data-i="0"] [data-a=cat]')
        await page.click('#addCat'); await page.fill('#cats .cat-row:last-child input', '새 칸')
        # 슬라이드 추가: 사진 + 작품 연결
        await page.click('#addSlide'); await page.wait_for_timeout(100)
        async with page.expect_file_chooser() as fc3:
            await page.click('#slides .slide-row:last-child [data-sa=img]')
        await (await fc3.value).set_files('/home/claude/crion/test/ui/img/t2.png')
        await page.wait_for_timeout(500)
        await page.select_option('#slides .slide-row:last-child select[data-sf=work]', index=2)
        await page.fill('#slides .slide-row:last-child input[data-sf=title]', '이번 주 추천')
        # 끌어서 순서: 3번 작품을 맨 위로
        names_before = await page.eval_on_selector_all('#works .work input[data-f=name]', 'l => l.map(x => x.value)')
        await page.set_viewport_size({'width': 1100, 'height': 1700})
        await page.eval_on_selector('#works .work[data-i="0"]', 'e => e.scrollIntoView()'); await page.wait_for_timeout(100)
        h = await page.query_selector('#works .work[data-i="2"] [data-drag]')
        top = await page.query_selector('#works .work[data-i="0"]')
        hb = await h.bounding_box(); tb = await top.bounding_box()
        await page.mouse.move(hb['x'] + 10, hb['y'] + 10); await page.mouse.down()
        for k in range(1, 9):
            await page.mouse.move(hb['x'] + 10, hb['y'] + 10 - (hb['y'] - tb['y'] + 20) * k / 8); await page.wait_for_timeout(30)
        await page.mouse.up(); await page.wait_for_timeout(200)
        names_after = await page.eval_on_selector_all('#works .work input[data-f=name]', 'l => l.map(x => x.value)')
        print('끌기:', names_before[2], '→ 맨 위:', names_after[0] == names_before[2], '| 개수 같음:', len(names_after) == len(names_before))
        await page.set_viewport_size({'width': 1100, 'height': 900})
        await page.eval_on_selector('#slides', 'e => e.scrollIntoView()'); await page.wait_for_timeout(100)
        await page.screenshot(path=OUT + 'a2b_slides.png', full_page=False)
        print('state dirty:', await page.inner_text('#state'))
        await page.screenshot(path=OUT + 'a3_dirty.png')
        await page.click('#deploy'); await page.wait_for_timeout(1500)
        print('puts:', puts)
        saved = json.loads(files['config/works.json'])
        print('bgm/featured/desc:', saved['works'][2].get('bgm'), saved['works'][2].get('featured'), saved['works'][2].get('desc'), [w.get('featured') for w in saved['works']])
        print('소통 설정:', saved.get('links'), saved.get('report'), [(n['title'], n['date']) for n in saved.get('news', [])])
        print('saved notice:', saved.get('notice'), '| w0 url:', saved['works'][0]['url'], '| w1 thumb:', saved['works'][1]['thumb'])
        print('슬라이드:', saved.get('banners'), '| 카테고리 수:', len(saved.get('categories', [])), '| 맨 위 작품:', saved['works'][0]['name'], saved['works'][0].get('cats'))
        print('state after:', await page.inner_text('#state'))
        # 서버 연결 카드
        await page.route('https://*.supabase.co/**', supa)
        await page.eval_on_selector('#srvCard', 'e => e.scrollIntoView()')
        await page.fill('#srvUrl', 'https://abcd.supabase.co/'); await page.fill('#srvKey', 'sb_secret_xxxxxxxxxxxxxxxxxxxxxxxx'); await page.click('#srvTest'); await page.wait_for_timeout(300)
        print('secret 키 막힘:', 'secret' in await page.inner_text('#srvChecks'), await page.is_disabled('#srvSave'))
        await page.fill('#srvKey', 'sb_publishable_abcdefghijklmnopqrstuv'); await page.click('#srvTest'); await page.wait_for_timeout(600)
        print('Confirm email 켜짐 경고:', 'Confirm email' in await page.inner_text('#srvChecks'), await page.is_disabled('#srvSave'))
        SB['confirm'] = False
        await page.fill('#srvAdmEmail', 'boss@x.com'); await page.fill('#srvAdmPw', 'pw')
        await page.click('#srvTest'); await page.wait_for_timeout(600)
        await page.eval_on_selector('#srvCard', 'e => e.scrollIntoView()')
        await page.screenshot(path=OUT + 'a5_server.png')
        await page.click('#srvSave'); await page.wait_for_timeout(800)
        print('저장된 cloud:', json.loads(files['config/app.json'])['cloud'], '| 상태:', await page.inner_text('#srvState'))
        await page.click('#bump'); await page.wait_for_timeout(800)
        print('version now:', json.loads(files['package.json'])['version'])
        await page.wait_for_timeout(4500)
        await page.screenshot(path=OUT + 'a4_after.png', full_page=True)
        await b.close()
    print('errors:', errs)

asyncio.run(main())
