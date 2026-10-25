# 게시판·신고함 화면 점검: python3 test/ui/run_cloud.py  (가짜 Supabase)
import asyncio, json, os, re, sys, base64
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import run as R
R.BASE = 'file://' + HERE + '/harness.html'; R.OUT = ROOT + '/test/out/'; R.IMG = HERE + '/img/'
from playwright.async_api import async_playwright

URL = 'https://abcd1234.supabase.co'
KEY = 'k' * 40
R.CATALOG['cloud'] = {'url': URL, 'anonKey': KEY}
G = {'n': 0, 'anon_users': 0, 'reports': [], 'posts': [], 'comments': [], 'log': []}
ADMIN = {'email': 'boss@x.com', 'pw': 'secret', 'uid': 'admin-1'}


def jwt(uid): return {'access_token': 'T-' + uid, 'refresh_token': 'R-' + uid, 'expires_in': 3600, 'user': {'id': uid}}
def who(h):
    a = (h.get('authorization') or '')[7:]
    return a[2:] if a.startswith('T-') else None


async def sb(route):
    r = route.request; u = r.url[len(URL):]; h = r.headers; me = who(h)
    G['log'].append((r.method, u))
    def ok(body, status=200): return route.fulfill(status=status, content_type='application/json', body=json.dumps(body, ensure_ascii=False))
    if u.startswith('/auth/v1/signup'):
        G['anon_users'] += 1; return await ok(jwt('anon-%d' % G['anon_users']))
    if u.startswith('/auth/v1/token?grant_type=password'):
        b = json.loads(r.post_data)
        if b['email'] == ADMIN['email'] and b['password'] == ADMIN['pw']: return await ok(jwt(ADMIN['uid']))
        return await ok({'msg': 'Invalid login credentials'}, 400)
    if u.startswith('/rest/v1/admins'): return await ok([{'uid': me}] if me == ADMIN['uid'] else [])
    is_admin = me == ADMIN['uid']
    m = re.match(r'/rest/v1/(\w+)\??(.*)', u); tbl, qs = m.group(1), dict(p.split('=', 1) for p in m.group(2).split('&') if '=' in p)
    rows = G[tbl]
    if r.method == 'POST':
        b = json.loads(r.post_data); G['n'] += 1
        if tbl == 'reports':
            if not me: return await ok({'message': 'permission denied'}, 401)
            mine = [x for x in rows if x['uid'] == me]
            if len(mine) >= 5 and not is_admin: return await ok({'message': '잠시 뒤에 다시 보내 주세요 (10분에 5번까지)'}, 400)
            row = dict(b, id=G['n'], uid=me, status='new', reply=None, created_at='2026-10-25T11:00:00Z')
        else:
            row = dict(b, id=G['n'], uid=me, is_admin=is_admin, hidden=False, pinned=False, created_at='2026-10-25T11:%02d:00Z' % (G['n'] % 60))
        rows.append(row)
        return await ok([row], 201) if 'representation' in (h.get('prefer') or '') else await route.fulfill(status=201, body='')
    def match(x):
        for k, v in qs.items():
            if v.startswith('eq.') and k in x and str(x[k]) != v[3:]: return False
        if tbl in ('posts', 'comments') and x.get('hidden') and not is_admin: return False
        if tbl == 'reports' and not is_admin and x['uid'] != me: return False
        return True
    if r.method == 'GET':
        out = [dict(x) for x in rows if match(x)]
        if tbl == 'posts':
            for x in out: x['comments'] = [{'count': len([c for c in G['comments'] if c['post_id'] == x['id'] and not c['hidden']])}]
            out.sort(key=lambda x: (not x['pinned'], -x['id']))
        else: out.sort(key=lambda x: -x['id'])
        return await ok(out)
    if r.method in ('PATCH', 'DELETE'):
        if not is_admin and not (r.method == 'DELETE' and tbl in ('posts', 'comments')): return await ok({'message': 'denied'}, 403)
        hit = [x for x in rows if match(x) and (is_admin or x['uid'] == me)]
        if r.method == 'PATCH':
            for x in hit: x.update(json.loads(r.post_data))
        else:
            for x in hit: rows.remove(x)
            if tbl == 'posts': G['comments'][:] = [c for c in G['comments'] if c['post_id'] in [p['id'] for p in G['posts']]]
        return await route.fulfill(status=204, body='')
    return await route.fulfill(status=404, body='{}')


async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 1360, 'height': 860})
        page.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
        await R.setup(page, [])
        await page.route(URL + '/**', sb)
        await page.goto(R.BASE); await page.evaluate("localStorage.setItem('crion.tut4','1')"); await page.reload(); await page.wait_for_timeout(2200)
        await page.click('.nav [data-v=community]'); await page.wait_for_timeout(300)
        await page.click('[data-act=comm-tab][data-v=board]'); await page.wait_for_timeout(500)
        await page.screenshot(path=R.OUT + 'c1_board_empty.png')
        # 팔로워: 글쓰기
        await page.click('[data-act=board-write]'); await page.wait_for_timeout(200)
        await page.fill('#wTitle', '첫날 식량 공략'); await page.fill('#wBody', '첫날은 식량부터!\n두 번째 줄'); await page.fill('#wNick', '팬1'); await page.fill('#wWork', '아포칼립스 안전지대')
        await page.click('[data-act=board-post]'); await page.wait_for_timeout(800)
        print('글 올림 → 상세:', await page.text_content('.bd-post h3'))
        await page.fill('#cmBody', '도움 됐어요'); await page.click('[data-act=comment-send]'); await page.wait_for_timeout(600)
        print('댓글:', await page.evaluate("[...document.querySelectorAll('.bd-cm p')].map(x=>x.textContent)"))
        await page.screenshot(path=R.OUT + 'c2_post.png')
        print('내 글 삭제 버튼 보임:', await page.evaluate("!!document.querySelector('[data-act=post-del]')"))
        await page.click('[data-act=board-back]'); await page.wait_for_timeout(500)
        print('목록:', await page.evaluate("[...document.querySelectorAll('.bd-row b')].map(x=>x.textContent)"))
        # 신고 보내기
        await page.click('[data-act=comm-tab][data-v=send]'); await page.wait_for_timeout(200)
        await page.fill('#fBody', '응답이 안 나와요 — 두 번째 응답부터 멈춰요'); await page.fill('#fNick', '팬1')
        await page.click('[data-act=form-send]'); await page.wait_for_timeout(700)
        print('서버에 쌓인 신고:', [(x['kind'], x['title'], x['status']) for x in G['reports']])
        await page.click('[data-act=comm-tab][data-v=sent]'); await page.wait_for_timeout(700)
        print('보낸 것:', await page.evaluate("[...document.querySelectorAll('.my-r')].map(x=>x.innerText.replace(/\\n/g,' | '))"))
        # 관리자: 개발자 모드 입장 → 신고함
        await page.evaluate("window.__crion.S.dev.repo = {}; window.__crion.render()")
        await page.click('.nav [data-v=inbox]'); await page.wait_for_timeout(300)
        await page.screenshot(path=R.OUT + 'c3_admin_login.png')
        await page.fill('#adEmail', ADMIN['email']); await page.fill('#adPw', 'wrong'); await page.click('[data-act=inbox-login]'); await page.wait_for_timeout(600)
        print('틀린 비번:', await page.text_content('.ad-login .err'))
        await page.fill('#adPw', ADMIN['pw']); await page.click('[data-act=inbox-login]'); await page.wait_for_timeout(1000)
        print('신고 카드:', await page.evaluate("[...document.querySelectorAll('.rp h4')].map(x=>x.textContent)"))
        await page.screenshot(path=R.OUT + 'c4_inbox.png')
        await page.click('[data-act=rep-status][data-v=doing]'); await page.wait_for_timeout(500)
        await page.fill('.rp-rep textarea', '확인했어요. 곧 고칠게요'); await page.click('[data-act=rep-save]'); await page.wait_for_timeout(500)
        print('서버 상태:', G['reports'][0]['status'], G['reports'][0]['reply'])
        # 팔로워 화면에서 처리 상태 보이는지: 관리자 해제 후 보낸 것
        await page.click('[data-act=inbox-tab][data-v=posts]'); await page.wait_for_timeout(600)
        await page.click('.bd-row'); await page.wait_for_timeout(500)
        await page.click('[data-act=post-pin][data-v=true]'); await page.wait_for_timeout(800)
        print('고정됨:', G['posts'][0]['pinned'])
        await page.click('[data-act=post-hide][data-v=true]'); await page.wait_for_timeout(800)
        print('숨김됨:', G['posts'][0]['hidden'])
        await page.screenshot(path=R.OUT + 'c5_post_admin.png')
        await page.click('[data-act=inbox-logout]'); await page.wait_for_timeout(300)
        await page.click('.nav [data-v=community]'); await page.wait_for_timeout(300)
        await page.click('[data-act=comm-tab][data-v=board]'); await page.wait_for_timeout(300)
        await page.click('[data-act=board-refresh]'); await page.wait_for_timeout(600)
        print('숨긴 글은 팔로워에게 안 보임:', await page.evaluate("document.querySelectorAll('.bd-row').length === 0"))
        await page.click('[data-act=comm-tab][data-v=sent]'); await page.wait_for_timeout(700)
        print('답변 보임:', await page.evaluate("document.querySelector('.my-reply') ? document.querySelector('.my-reply').innerText : null"))
        await page.screenshot(path=R.OUT + 'c6_sent_reply.png')
        await b.close()
    print('익명 계정 수(1이어야 함):', G['anon_users'])
    print('오류:', errs or '없음')

asyncio.run(main())
