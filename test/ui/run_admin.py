# 관리 페이지 점검 (GitHub를 흉내 내서): python3 test/ui/run_admin.py
import asyncio, json, base64
from playwright.async_api import async_playwright
OUT = '/home/claude/crion/test/out/'
works = json.load(open('/home/claude/crion/config/works.json', encoding='utf-8'))
pkg = json.load(open('/home/claude/crion/package.json'))
files = {'config/works.json': json.dumps(works, ensure_ascii=False, indent=1), 'package.json': json.dumps(pkg, indent=2)}
puts = []


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


async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 1100, 'height': 900})
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await page.route('https://api.github.com/**', handle)
        await page.goto('file:///home/claude/crion/site/admin.html'); await page.wait_for_timeout(800)
        await page.screenshot(path=OUT + 'a1_login.png', full_page=True)
        await page.fill('#tok', 'github_pat_test'); await page.click('#connect'); await page.wait_for_timeout(800)
        print('state at load:', await page.inner_text('#state'))
        await page.screenshot(path=OUT + 'a2_main.png', full_page=True)
        await page.fill('.work[data-i="0"] input[data-f=url]', 'https://crack.wrtn.ai/detail/abc')
        await page.fill('#noticeText', '신작이 열렸어요!')
        await page.set_input_files('#file', '/home/claude/crion/test/ui/img/t2.png') if False else None
        # 업로드: 버튼 → 파일 선택
        async with page.expect_file_chooser() as fc:
            await page.click('.work[data-i="1"] [data-a=upload]')
        await (await fc.value).set_files('/home/claude/crion/test/ui/img/t2.png')
        await page.wait_for_timeout(600)
        print('state dirty:', await page.inner_text('#state'))
        await page.screenshot(path=OUT + 'a3_dirty.png')
        await page.click('#deploy'); await page.wait_for_timeout(1500)
        print('puts:', puts)
        saved = json.loads(files['config/works.json'])
        print('saved notice:', saved.get('notice'), '| w0 url:', saved['works'][0]['url'], '| w1 thumb:', saved['works'][1]['thumb'])
        print('state after:', await page.inner_text('#state'))
        await page.click('#bump'); await page.wait_for_timeout(800)
        print('version now:', json.loads(files['package.json'])['version'])
        await page.wait_for_timeout(4500)
        await page.screenshot(path=OUT + 'a4_after.png', full_page=True)
        await b.close()
    print('errors:', errs)

asyncio.run(main())
