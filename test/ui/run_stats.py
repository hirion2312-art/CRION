# 개발자 모드 '사용자 통계' 화면 점검 (가짜 Supabase): python3 test/ui/run_stats.py → test/out/st_*.png
#  하루 한 번 ping · 관리자 로그인 전엔 로그인 칸 · 로그인 후 숫자 칸·막대 그래프 · 7/30/90일 바꾸기
import asyncio, json, os, sys, datetime
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import run as R
R.BASE = 'file://' + HERE + '/harness.html'; R.OUT = ROOT + '/test/out/'; R.IMG = HERE + '/img/'
from playwright.async_api import async_playwright
URL = 'https://abcd1234.supabase.co'
R.CATALOG['cloud'] = {'url': URL, 'anonKey': 'k' * 40}
LOG = []

def fake_stats(n):
    t = datetime.date(2026, 10, 28); days = []
    for i in range(n):
        d = t - datetime.timedelta(days=n - 1 - i); k = i + 1
        days.append({'day': d.isoformat(), 'join': (k * 7) % 5, 'first': 3 + (k * 13) % 9, 'active': 20 + (k * 37) % 30 + i, 'activeAcc': 6 + (k * 11) % 9})
    return {'today': t.isoformat(), 'days': days, 'total': {'accounts': 84, 'devices': 312, 'nicks': 61, 'today': days[-1]['active'], 'week': 133, 'month': 288, 'since': days[0]['day']}, 'plat': {'win': 190, 'android': 71, 'mac': 27}}

async def sb(route):
    r = route.request; u = r.url[len(URL):]; LOG.append((r.method, u, r.post_data))
    ok = lambda b, s=200: route.fulfill(status=s, content_type='application/json', body=json.dumps(b))
    tok = lambda uid: {'access_token': 'T-' + uid, 'refresh_token': 'R-' + uid, 'expires_in': 3600, 'user': {'id': uid}}
    if u.startswith('/auth/v1/signup'): return await ok(tok('anon-1'))
    if u.startswith('/auth/v1/token'):
        b = json.loads(r.post_data)
        return await ok(tok('admin-1')) if b.get('password') == 'secret' else await ok({'msg': 'Invalid login credentials'}, 400)
    if u.startswith('/rest/v1/admins'): return await ok([{'uid': 'admin-1'}] if 'T-admin-1' in (r.headers.get('authorization') or '') else [])
    if u.startswith('/rest/v1/rpc/crion_ping'): return await route.fulfill(status=204, body='')
    if u.startswith('/rest/v1/rpc/crion_stats'):
        if 'T-admin-1' not in (r.headers.get('authorization') or ''): return await ok({'message': '관리자만 볼 수 있어요'}, 400)
        return await ok(fake_stats(json.loads(r.post_data).get('p_days', 30)))
    if u.startswith('/rest/v1/rpc/'): return await ok(4)
    return await ok([])

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        for tag, vp in [('pc', {'width': 1280, 'height': 900}), ('m', {'width': 390, 'height': 844})]:
            page = await b.new_page(viewport=vp)
            errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
            await R.setup(page, []); await page.route(URL + '/**', sb)
            await page.goto(R.BASE); await page.evaluate("localStorage.setItem('crion.tut4','1')"); await page.reload(); await page.wait_for_timeout(5200)
            pings = [x for x in LOG if 'crion_ping' in x[1]]
            if tag == 'pc':
                print('켜자마자 ping:', len(pings), pings[-1][2] if pings else None)
                if len(pings) != 1: fails.append('ping ' + str(len(pings)))
                await page.reload(); await page.wait_for_timeout(5000)
                n2 = len([x for x in LOG if 'crion_ping' in x[1]])
                print('같은 날 다시 켜도 ping 그대로:', n2)
                if n2 != 1: fails.append('ping twice')
            await page.evaluate("window.__crion.S.dev.repo = { loadWorks: async () => ({ data: { works: [], hidden: [] } }), lastDeploy: async () => null }; window.__crion.go('stats')"); await page.wait_for_timeout(300)
            await page.screenshot(path=R.OUT + f'st_{tag}_1_login.png')
            has_login = await page.evaluate("!!document.querySelector('.st-login')")
            await page.fill('#stEm', 'boss@x.com'); await page.fill('#stPw', 'secret')
            await page.evaluate("document.querySelector('[data-act=st-login]').click()"); await page.wait_for_timeout(800)
            tiles = await page.evaluate("[...document.querySelectorAll('.st-tile b')].map(x=>x.textContent)")
            bars = await page.evaluate("document.querySelectorAll('.st-svg rect[rx]').length")
            await page.screenshot(path=R.OUT + f'st_{tag}_2_stats.png', full_page=True)
            await page.evaluate("document.querySelector('.page').scrollTop = 0")
            await page.evaluate("document.querySelector('[data-act=st-days][data-v=\"90\"]').click()"); await page.wait_for_timeout(700)
            n90 = await page.evaluate("document.querySelectorAll('.st-svg')[0].querySelectorAll('g').length")
            print(tag, '로그인 칸:', has_login, '/ 숫자:', tiles, '/ 막대:', bars, '/ 90일 칸:', n90, '/ 오류:', errs or '없음')
            if not has_login or len(tiles) != 6 or bars < 40 or n90 != 90 or errs: fails.append(tag)
            await page.screenshot(path=R.OUT + f'st_{tag}_3_90.png')
            await page.close()
        await b.close()
    print('\n실패:', fails or '없음')
    sys.exit(1 if fails else 0)

asyncio.run(main())
