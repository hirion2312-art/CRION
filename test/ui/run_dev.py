# 개발자 모드 점검: python3 test/ui/run_dev.py  (가짜 GitHub)
import asyncio, json, base64, sys
sys.path.insert(0, '/home/claude/crion/test/ui')
from run import setup, BASE, OUT, CATALOG
from playwright.async_api import async_playwright

STATE = {'works': {'works': [w for w in CATALOG['works']], 'hidden': []}, 'sha': 's1', 'puts': []}


async def gh(route):
    r = route.request
    u = r.url.split('/repos/hirion2312-art/CRION')[1]
    if r.headers.get('authorization') != 'Bearer github_pat_TEST':
        return await route.fulfill(status=401, body='{"message":"Bad credentials"}')
    if u == '':
        return await route.fulfill(json={'full_name': 'hirion2312-art/CRION', 'permissions': {'push': True}})
    if u.startswith('/actions/runs'):
        return await route.fulfill(json={'workflow_runs': [{'name': '업데이트 배포 (팩·화면 엔진)', 'path': '.github/workflows/registry.yml', 'status': 'in_progress' if STATE['puts'] else 'completed', 'conclusion': None if STATE['puts'] else 'success', 'created_at': '2026-10-25T03:00:00Z'}]})
    if u.startswith('/contents/config/works.json'):
        if r.method == 'GET':
            txt = json.dumps(STATE['works'], ensure_ascii=False)
            return await route.fulfill(json={'content': base64.b64encode(txt.encode()).decode(), 'sha': STATE['sha']})
        body = json.loads(r.post_data)
        assert body['sha'] == STATE['sha'], 'sha 불일치'
        STATE['works'] = json.loads(base64.b64decode(body['content']).decode())
        STATE['sha'] = 's' + str(len(STATE['puts']) + 2)
        STATE['puts'].append(('works.json', body['message']))
        return await route.fulfill(json={'content': {'sha': STATE['sha']}})
    if u.startswith('/contents/config/thumbs/'):
        if r.method == 'GET': return await route.fulfill(status=404, body='{}')
        STATE['puts'].append((u.split('/')[-1], json.loads(r.post_data)['message']))
        return await route.fulfill(json={'content': {'sha': 'x'}})
    return await route.fulfill(status=404, body='{}')


async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 1360, 'height': 860})
        page.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
        await setup(page, [])
        await page.route('https://api.github.com/**', gh)
        await page.goto(BASE); await page.evaluate("localStorage.setItem('crion.tut4','1')"); await page.reload(); await page.wait_for_timeout(2200)
        await page.click('.nav [data-v=settings]'); await page.wait_for_timeout(200)
        await page.click('[data-act=dev-login]'); await page.wait_for_timeout(200)
        await page.screenshot(path=OUT + 'k1_dev_setup.png')
        await page.fill('#devTok', 'github_pat_WRONG'); await page.fill('#devPw', 'hirion'); await page.fill('#devPw2', 'hirion')
        await page.click('[data-act=dev-setup]'); await page.wait_for_timeout(400)
        print('틀린 열쇠:', await page.text_content('.err'))
        await page.fill('#devTok', 'github_pat_TEST'); await page.fill('#devPw', 'hirion'); await page.fill('#devPw2', 'hirion')
        await page.click('[data-act=dev-setup]'); await page.wait_for_timeout(2500)
        print('저장된 금고에 열쇠 원문 없음:', 'github_pat_TEST' not in (await page.evaluate("localStorage.getItem('crion.dev.vault')")))
        await page.screenshot(path=OUT + 'k2_dev_list.png')
        await page.click('.page-h-r [data-act=dev-edit]'); await page.wait_for_timeout(200)
        await page.fill('#dName', '용사하렘파티의 노예'); await page.fill('#dUrl', 'https://share.crack.wrtn.ai/abc123'); await page.fill('#dGenre', '판타지 하렘')
        await page.set_input_files('#devFile', '/home/claude/crion/test/ui/img/t2.png'); await page.wait_for_timeout(500)
        await page.screenshot(path=OUT + 'k3_dev_add.png')
        await page.click('[data-act=dev-save]'); await page.wait_for_timeout(1500)
        print('올린 것:', STATE['puts'])
        print('맨 앞 작품:', STATE['works']['works'][0]['name'], STATE['works']['works'][0].get('thumb'))
        await page.screenshot(path=OUT + 'k4_dev_added.png')
        await page.click('.nav [data-v=home]'); await page.wait_for_timeout(300)
        print('홈에 바로 보임:', await page.evaluate("[...document.querySelectorAll('.card .name')].map(x=>x.textContent).includes('용사하렘파티의 노예')"))
        await page.click('.nav [data-v=dev]'); await page.wait_for_timeout(300)
        await page.click('.dev-row:nth-child(5) [data-act=dev-del]'); await page.wait_for_timeout(200)
        await page.screenshot(path=OUT + 'k5_dev_del.png')
        await page.click('[data-act=dev-del-ok]'); await page.wait_for_timeout(1500)
        print('삭제 후:', [w['name'] for w in STATE['works']['works']])
        await page.click('.nav-dev'); await page.wait_for_timeout(300)
        print('잠근 뒤 메뉴에 작품 관리 없음:', await page.evaluate("!document.querySelector('.nav [data-v=dev]')"))
        await page.click('[data-act=dev-login]'); await page.wait_for_timeout(200)
        await page.fill('#devPw', 'nope'); await page.keyboard.press('Enter'); await page.wait_for_timeout(1500)
        print('틀린 비번:', await page.text_content('.err'))
        await page.screenshot(path=OUT + 'k6_dev_pw.png')
        await page.fill('#devPw', 'hirion'); await page.keyboard.press('Enter'); await page.wait_for_timeout(2500)
        print('다시 입장:', await page.evaluate("window.__crion.S.view"))
        await b.close()
    print('\n오류:', errs or '없음')

asyncio.run(main())
