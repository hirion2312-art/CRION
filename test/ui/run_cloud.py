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
G = {'n': 0, 'anon_users': 0, 'reports': [], 'posts': [], 'comments': [], 'profiles': [], 'post_likes': [], 'sync_items': [], 'accounts': {}, 'log': []}
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
        b = json.loads(r.post_data or '{}')
        if b.get('email'):
            if b['email'] in G['accounts']: return await ok({'msg': 'User already registered'}, 422)
            uid = 'acc-%d' % (len(G['accounts']) + 1); G['accounts'][b['email']] = (b['password'], uid)
            j = jwt(uid); j['user']['email'] = b['email']; return await ok(j)
        G['anon_users'] += 1; return await ok(jwt('anon-%d' % G['anon_users']))
    if u.startswith('/auth/v1/token?grant_type=password'):
        b = json.loads(r.post_data)
        if b['email'] == ADMIN['email'] and b['password'] == ADMIN['pw']: return await ok(jwt(ADMIN['uid']))
        a = G['accounts'].get(b['email'])
        if a and a[0] == b['password']: j = jwt(a[1]); j['user']['email'] = b['email']; return await ok(j)
        return await ok({'msg': 'Invalid login credentials'}, 400)
    if u.startswith('/auth/v1/logout'): return await route.fulfill(status=204, body='')
    if u.startswith('/rest/v1/rpc/crion_id_available'):
        b = json.loads(r.post_data); return await ok(b['p_id'] != 'taken' and not any(k.startswith(b['p_id'] + '@') for k in G['accounts']))
    if u.startswith('/rest/v1/rpc/crion_nick_available'):
        b = json.loads(r.post_data); return await ok(not any(x['nick'].lower() == b['p_nick'].lower() for x in G['profiles']))
    if u.startswith('/rest/v1/rpc/'): return await ok(3)
    if u.startswith('/rest/v1/admins'): return await ok([{'uid': me}] if me == ADMIN['uid'] else [])
    is_admin = me == ADMIN['uid']
    m = re.match(r'/rest/v1/(\w+)\??(.*)', u); tbl, qs = m.group(1), dict(p.split('=', 1) for p in m.group(2).split('&') if '=' in p)
    rows = G[tbl]
    if r.method == 'POST':
        b = json.loads(r.post_data); G['n'] += 1
        if tbl == 'sync_items':
            out = []
            for x in (b if isinstance(b, list) else [b]):
                G['sync_items'][:] = [y for y in G['sync_items'] if not (y['uid'] == me and y['key'] == x['key'])]
                G['n'] += 1; row = dict(x, uid=me, updated_at='2026-10-27T00:00:%02d.%06d+00:00' % (G['n'] // 1000000 % 60, G['n'])); G['sync_items'].append(row); out.append({'key': row['key'], 'updated_at': row['updated_at']})
            return await ok(out, 201)
        if tbl == 'profiles':
            if any(x['nick'].lower() == b['nick'].lower() for x in rows): return await ok({'code': '23505', 'message': 'duplicate key value violates unique constraint "profiles_nick_lower"'}, 409)
            rows.append(dict(b, uid=me, banned=False)); return await route.fulfill(status=201, body='')
        if tbl == 'post_likes':
            rows.append({'post_id': b['post_id'], 'uid': me})
            for x in G['posts']:
                if x['id'] == b['post_id']: x['like_count'] = x.get('like_count', 0) + 1
            return await route.fulfill(status=201, body='')
        if tbl == 'reports':
            if not me: return await ok({'message': 'permission denied'}, 401)
            mine = [x for x in rows if x['uid'] == me]
            if len(mine) >= 5 and not is_admin: return await ok({'message': '잠시 뒤에 다시 보내 주세요 (10분에 5번까지)'}, 400)
            row = dict(b, id=G['n'], uid=me, status='new', reply=None, created_at='2026-10-25T11:00:00Z')
        else:
            prof = next((x for x in G['profiles'] if x['uid'] == me), None)
            if not is_admin and not prof: return await ok({'code': '42501', 'message': 'new row violates row-level security policy'}, 403)
            row = dict(b, id=G['n'], uid=me, nick=('히리온' if is_admin else prof['nick']), is_admin=is_admin, hidden=False, pinned=False, like_count=0, edited_at=None, created_at='2026-10-25T11:%02d:00Z' % (G['n'] % 60))
        rows.append(row)
        return await ok([row], 201) if 'representation' in (h.get('prefer') or '') else await route.fulfill(status=201, body='')
    def match(x):
        for k, v in qs.items():
            if v.startswith('eq.') and k in x and str(x[k]) != v[3:]: return False
            if v.startswith('in.(') and k in x and str(x[k]) not in v[4:-1].split(','): return False
        if tbl in ('post_likes', 'sync_items') and x['uid'] != me: return False
        if tbl in ('posts', 'comments') and x.get('hidden') and not is_admin: return False
        if tbl == 'reports' and not is_admin and x['uid'] != me: return False
        return True
    if r.method == 'GET':
        out = [dict(x) for x in rows if match(x)]
        if tbl == 'posts':
            for x in out: x['comments'] = [{'count': len([c for c in G['comments'] if c['post_id'] == x['id'] and not c['hidden']])}]
            out.sort(key=lambda x: (not x['pinned'], -x['id']))
        else: out.sort(key=lambda x: -x.get('id', 0))
        return await ok(out)
    if r.method in ('PATCH', 'DELETE'):
        own_ok = (r.method == 'DELETE' and tbl in ('posts', 'comments', 'post_likes')) or (r.method == 'PATCH' and tbl in ('posts', 'profiles'))
        if not is_admin and not own_ok: return await ok({'message': 'denied'}, 403)
        if tbl == 'post_likes' and r.method == 'DELETE':
            for x in [x for x in rows if match(x)]:
                rows.remove(x)
                for p in G['posts']:
                    if p['id'] == x['post_id']: p['like_count'] -= 1
            return await route.fulfill(status=204, body='')
        hit = [x for x in rows if match(x) and (is_admin or x['uid'] == me)]
        if r.method == 'PATCH':
            for x in hit:
                x.update(json.loads(r.post_data))
                if tbl == 'posts' and not is_admin: x['edited_at'] = '2026-10-27T10:00:00Z'
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
        # 팔로워: 글쓰기 → 계정 필요 → 가입
        await page.click('[data-act=board-write]'); await page.wait_for_timeout(300)
        print('계정 없으면 글쓰기 대신 안내:', await page.evaluate("!!document.querySelector('[data-act=acct-open]') && !document.querySelector('#wTitle')"))
        await page.screenshot(path=R.OUT + 'c1b_need_account.png')
        await page.click('.modal [data-act=acct-open][data-v=signup]'); await page.wait_for_timeout(300)
        await page.fill('#acId', 'taken'); await page.click('[data-act=acct-check][data-v=id]'); await page.wait_for_timeout(400)
        print('중복 아이디:', await page.text_content('#acIdChk'))
        await page.fill('#acId', 'fan_one'); await page.fill('#acPw', 'password1'); await page.fill('#acPw2', 'password1'); await page.fill('#acNick', '팬1')
        await page.click('[data-act=acct-submit]'); await page.wait_for_timeout(300)
        print('확인 안 누르면:', await page.text_content('#acctErr'))
        await page.click('[data-act=acct-check][data-v=id]'); await page.click('[data-act=acct-check][data-v=nick]'); await page.wait_for_timeout(500)
        await page.click('[data-act=acct-submit]'); await page.wait_for_timeout(300)
        print('체크 안 하면:', await page.text_content('#acctErr'))
        await page.check('#acAgree')
        await page.screenshot(path=R.OUT + 'c1c_signup.png')
        await page.click('[data-act=acct-submit]'); await page.wait_for_timeout(1500)
        print('서버에 저장된 로그인 주소:', list(G['accounts'].keys()))
        print('가입 → 닉네임:', [x['nick'] for x in G['profiles']], '/ 계정 표시:', await page.evaluate("(document.querySelector('.acct-chip')||{}).textContent"))
        await page.click('[data-act=board-write]'); await page.wait_for_timeout(300)
        await page.fill('#wTitle', '첫날 식량 공략'); await page.fill('#wBody', '첫날은 식량부터!\n두 번째 줄'); await page.fill('#wWork', '아포칼립스 안전지대')
        await page.click('[data-act=board-post]'); await page.wait_for_timeout(800)
        print('글 올림 → 상세:', await page.text_content('.bd-post h3'), '/ 이름:', G['posts'][0]['nick'])
        lk = await page.query_selector('[data-act=post-like]')
        if lk: await lk.click(); await page.wait_for_timeout(600)
        print('좋아요 수(서버):', G['posts'][0].get('like_count'))
        await page.fill('#cmBody', '도움 됐어요'); await page.click('[data-act=comment-send]'); await page.wait_for_timeout(600)
        print('댓글:', await page.evaluate("[...document.querySelectorAll('.bd-cm p')].map(x=>x.textContent)"))
        await page.screenshot(path=R.OUT + 'c2_post.png')
        print('내 글 삭제 버튼 보임:', await page.evaluate("!!document.querySelector('[data-act=post-del]')"))
        await page.click('[data-act=board-back]'); await page.wait_for_timeout(500)
        print('목록:', await page.evaluate("[...document.querySelectorAll('.bd-row b')].map(x=>x.textContent)"))
        # 신고 보내기
        await page.click('[data-act=comm-tab][data-v=send]'); await page.wait_for_timeout(200)
        await page.fill('#fBody', '응답이 안 나와요 — 두 번째 응답부터 멈춰요')
        if await page.query_selector('#fNick'): await page.fill('#fNick', '팬1')
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
        # 설정: 계정·동기화
        await page.click('.nav [data-v=settings]'); await page.wait_for_timeout(400)
        await page.click('[data-act=acct-sync]'); await page.wait_for_timeout(1200)
        await page.screenshot(path=R.OUT + 'c7_settings_account.png')
        print('설정 계정 칸:', (await page.text_content('#acctSet'))[:120].replace('\n', ' '))
        print('서버에 올라간 기록 칸:', sorted(set(x['key'] for x in G['sync_items'])))
        await b.close()
    print('익명 계정 수(0~1):', G['anon_users'])
    print('오류:', errs or '없음')

asyncio.run(main())
