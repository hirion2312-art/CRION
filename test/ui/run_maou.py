# 마법소녀의 최종보스 팩 화면 점검: python3 test/ui/run_maou.py → test/out/mq_*.png
# 크랙 그림(CDN)은 시험 환경에서 못 받으니, 등록명마다 자리 그림을 만들어 대신 보낸다
import asyncio, json, os, sys, io, hashlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import run_safehouse as T
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = os.path.abspath(os.path.join(HERE, '..', '..')) + '/'
OUT = ROOT + 'test/out/'
os.system(f'cd {ROOT} && node scripts/make-registry.js https://reg.test/CRION/ > /dev/null 2>&1')
IDX = json.load(open(ROOT + 'registry/index.json', encoding='utf-8'))
PK = 'hirion.magical-boss'
T.INDEX.clear(); T.INDEX.update(IDX)
T.INDEX['devPacks'] = [p for p in IDX['packs'] + IDX.get('devPacks', []) if p['id'] == PK]
T.INDEX['packs'] = []
for p in T.INDEX['devPacks']: p['workUrl'] = 'https://crack.wrtn.ai/detail/maou'
D = json.load(open(ROOT + 'packs/' + PK + '/data.json', encoding='utf-8'))
BYURL = {u: n for n, u in D['imgs'].items()}
COL = {r['name']: r.get('color', '#8b8bd8') for r in D['oseong'] + D['kanbu'] + D.get('extra', [])}
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc'
CACHE = {}
HAHM = os.environ.get('HAHMLET_TTF', '/tmp/hahmlet.ttf')
THUMB = Image.open(ROOT + 'config/thumbs/magical.webp').convert('RGB')
def fake(name):
    # 자리 그림: 작품 썸네일(실제 그림체)을 잘라 인물·장소 느낌만 낸다
    if name in CACHE: return CACHE[name]
    p = name.split('_'); h = int(hashlib.md5(name.encode()).hexdigest()[:6], 16)
    place = p[-1] == '장소'; toon = '웹툰' in name
    wide = place or (p[0] in ('인물 외', '엔딩') and not toon)
    W, H = (1280, 720) if wide else ((1080, 1600) if toon else (960, 1280))
    tw, th = THUMB.size
    if place:
        im = THUMB.resize((W, int(W * th / tw))).crop((0, 300 + h % 300, W, 300 + h % 300 + H)).filter(ImageFilter.GaussianBlur(14))
        hx = '%06x' % (0x203050 + h % 0x302020); c = tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4))
        im = Image.blend(im, Image.new('RGB', (W, H), c), .55)
    elif wide:
        im = THUMB.resize((W, int(W * th / tw))).crop((0, 120, W, 120 + H))
    else:
        cw = int(tw * .62); x = 0 if h % 2 else tw - cw
        crop = THUMB.crop((x, int(th * .08), x + cw, int(th * .08) + int(cw * H / W)))
        im = crop.resize((W, H))
        c = COL.get(p[-1])
        if c:
            tint = Image.new('RGB', (W, H), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)))
            im = Image.blend(im, tint, .22)
    dr = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, 30)
    dr.text((24, H - 54), '자리 그림 · ' + name, font=f, fill=(255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0))
    b = io.BytesIO(); im.save(b, 'JPEG', quality=72); CACHE[name] = b.getvalue(); return CACHE[name]

def IM(name, w=960, h=1280): return {'t': 'img', 'src': D['imgs'][name], 'w': w, 'h': h, 'alt': ''}
def tx(s, code=False): return {'t': 'text', 's': s, 'code': code}
PRO = [IM('인물 외_타이틀', 1280, 720), tx('EP.PROLOG | 반지하의 마왕\n-\n')] + [IM('인물 외_프롤로그 웹툰 %d' % n, 1080, 1600) for n in range(1, 7)] + [
  IM('허름한 반지하_장소', 1280, 720), tx('곰팡이 냄새가 코끝을 찔렀다. 낮은 천장에서는 빗물이 새어 들어와 양은 대야에 톡, 톡 떨어지고 있었다.\n\n몸을 일으키려 하자 삐걱, 낡은 침상이 앓는 소리를 냈다.\n'),
  IM('당황_세이렌'), tx('설거지를 하던 중 {user}이/가 내는 기척에 뒤를 돌아보고는 화들짝 놀라 달려온다\n\n세이렌💬 폐...폐하!!! 일어나셨습니까!! 몸은 좀 괜찮으십니까?\n')]
EX1 = [IM('방송국로비_장소', 1280, 720), tx('방송국 예능국 면접실. 형광등 아래 면접관이 이력서를 넘긴다.\n'),
  tx('방송국 면접관💬 책상을 두들기며 "반갑습니다 그.. 흐음, 이름이 특이하군요. 그래서 저희 방송국엔 왜 지원하셨죠?"\n'),
  tx('🕖 D+1 | 🏚️ 방송국 예능국\n👤 {user} 상태 | 하급마족 (쇠약)\n💫 권능 0/5 | 🔮 마력 15/50\n💰 자금 0원\n\n❣️ 호감도 (잠김)\n💀 균열도 (잠김)\n⚠️ 정체발각위험 0 (안전)\n🏛️ 협회 동향 (잠김)\n🤝 관계 | 세이렌: 충성', True)]
LATER = [IM('스튜디오_장소', 1280, 720), tx('조명이 꺼진 스튜디오에 정적이 내려앉았다.\n'), IM('부끄러움/사랑_서하린'),
  tx('서하린💬 오늘도... 고마워요. 정말로.\n'), IM('권능회수_사랑_변신_서하린'), tx('빛이 흩어지며 따뜻한 무언가가 가슴으로 스며든다.\n'),
  tx('🕖 D+14 | 🏚️ 방송국 스튜디오\n👤 마왕 상태 | 하급마족 (회복 중)\n💫 권능 1/5 | 🔮 마력 23/50\n💰 자금 1,250,000원\n\n❣️ 호감도 | 서하린 82 · 한세라 31 · 윤채아 45 · 백설아 12 · 오하나 60\n💀 균열도 | 서하린 5 · 한세라 22 · 윤채아 10 · 백설아 41 · 오하나 3\n⚠️ 정체발각위험 45 (주의)\n🏛️ 협회 동향 | 지하 구역 출입 통제가 강화됨\n🤝 관계 | 세이렌: 충성 · 서하린: 연인', True),
  tx('[단서1] D+3 - 야생 마족은 모두 굶주려 있었다\n[단서2] D+9 - 협회 폐기물 차량이 지하로 들어간다\n')]

RISK = [IM('협회지하_장소', 1280, 720), tx('철문 너머에서 발소리가 가까워진다. 손전등 불빛이 바닥을 훑는다.\n'), IM('분노_한세라'), tx('한세라💬 거기 누구야. 나와.\n'),
  tx('🕖 D+15 | 🏚️ 협회 지하\n👤 마왕 상태 | 하급마족 (회복 중)\n💫 권능 1/5 | 🔮 마력 9/50\n💰 자금 1,250,000원\n\n❣️ 호감도 | 서하린 82 · 한세라 29.5 · 윤채아 45 · 백설아 12 · 오하나 60\n💀 균열도 | 서하린 5 · 한세라 22 · 윤채아 10 · 백설아 41 · 오하나 3\n⚠️ 정체발각위험 78 (위기)\n🏛️ 협회 동향 | 지하 구역 출입 통제가 강화됨\n🤝 관계 | 세이렌: 충성 · 서하린: 연인', True)]

async def run(b, name, vp, mobile):
    errs = []
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
    page = await ctx.new_page()
    page.on('pageerror', lambda e: errs.append(str(e)))
    await page.add_init_script("window.__engineVersion='0.10.6'")
    await T.setup(page)
    async def img(route):
        n = BYURL.get(route.request.url.split('?')[0])
        if not n: return await route.fulfill(status=404, body='')
        await route.fulfill(body=fake(n), content_type='image/jpeg')
    await page.route('https://d394jeh9729epj.cloudfront.net/**', img)
    # Hahmlet 글꼴: 시험 환경에선 구글 글꼴에 못 가니 내려받아 둔 파일로 대신 (없으면 기본 글꼴)
    if os.path.isfile(HAHM):
        async def gcss(route):
            if 'Hahmlet' in route.request.url: return await route.fulfill(body="@font-face{font-family:'Hahmlet';font-weight:100 900;src:url(https://fonts.gstatic.com/hahmlet.ttf) format('truetype')}", content_type='text/css')
            await route.fulfill(body='', content_type='text/css')
        await page.route('https://fonts.googleapis.com/**', gcss)
        await page.route('https://fonts.gstatic.com/hahmlet.ttf', lambda r: r.fulfill(path=HAHM, content_type='font/ttf'))
    await page.goto(T.BASE); await page.evaluate("localStorage.setItem('crion.tut4','1');localStorage.setItem('crion.prefs',JSON.stringify({adult:true}))"); await page.reload(); await page.wait_for_timeout(1800)
    await page.evaluate("window.__crion.S.dev.repo = { loadWorks: async () => ({ data: { works: [], hidden: [] } }), lastDeploy: async () => null }")
    await page.click('.nav [data-v=store]'); await page.wait_for_timeout(800)
    await page.click('.pcard [data-act=pack]'); await page.wait_for_timeout(500)
    if name == 'pc': await page.screenshot(path=OUT + f'mq_{name}_0_store.png')
    await page.click('.modal [data-act=pack-install]')
    for _ in range(80):
        await page.wait_for_timeout(300)
        if await page.evaluate(f"!!JSON.parse(localStorage.getItem('crion.packs')||'{{}}')['{PK}']"): break
    await page.wait_for_timeout(300); await page.click('.modal [data-act=pack-play]'); await page.wait_for_timeout(1500)
    await page.evaluate("(()=>{const w=document.querySelector('#crack');w.dispatchEvent(new Event('dom-ready'));w.dispatchEvent(new Event('did-stop-loading'));})()")
    await page.wait_for_function("!!document.querySelector('.mq')"); await page.wait_for_timeout(1200)
    await page.screenshot(path=OUT + f'mq_{name}_1_title.png')
    print(name, 'Hahmlet 글꼴:', await page.evaluate("document.fonts.load('800 20px Hahmlet','가').then(f=>f.length+' '+[...document.fonts].filter(x=>x.family.includes('Hahmlet')).map(x=>x.status).join(','))"))
    await page.click('[data-mq=t-new]'); await page.wait_for_timeout(200)
    await T.ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/maou', 'actions': [{'id': 0, 'kind': 'new', 'label': '새로하기'}]}); await page.wait_for_timeout(150)
    await T.ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/maou', 'actions': [{'id': 1, 'kind': 'mode', 'label': '마왕, 다시 일어나다'}, {'id': 2, 'kind': 'confirm', 'label': '시작하기'}]}); await page.wait_for_timeout(150)
    await T.ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/maou', 'actions': [{'id': 2, 'kind': 'confirm', 'label': '시작하기'}]}); await page.wait_for_timeout(150)
    clicks = await page.evaluate("JSON.stringify(window.__clicks||null)")
    await T.ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/m1', 'chat': True})
    await T.ipc(page, 'crion:state', {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/m1', 'msgs': 1, 'users': 0, 'actions': []}); await page.wait_for_timeout(300)
    mode = await page.evaluate("window.__pk.state.mode")
    if mode != 'play': errs.append('mode ' + mode)
    await T.ipc(page, 'crion:reply', {'key': 'k0', 'segs': PRO, 'done': True}); await page.wait_for_timeout(1200)
    SNAP = {0, 1, 2, 4, 5, 7, 9, 11, 13, 14, 15, 16, 17, 19}
    for k in range(0, 21):
        # 장면 k 까지 누르며 넘긴다 (글자 쓰는 중이면 한 번은 글자 완성)
        for _ in range(6):
            st = await page.evaluate("window.__pk.proState()")
            if not st or st['i'] >= k: break
            await page.mouse.click(300, 300); await page.wait_for_timeout(90)
        if k in SNAP and (name != 'm360' or k in (1, 15, 16)):
            await page.wait_for_timeout(1900)
            if os.environ.get('MQ_DEBUG') and k >= 17: print('DBG', k, await page.evaluate("JSON.stringify({cls:document.querySelector('.mq-pro').className, st:window.__pk.proState(), pend:getComputedStyle(document.querySelector('.mq-pend')).opacity, cuts:document.querySelectorAll('.mq-pcut').length, img:(document.querySelector('.mq-pcut img')||{}).src})"))
            await page.screenshot(path=OUT + f'mq_{name}_2p_{k:02d}.png')
    await page.wait_for_timeout(1400)
    if os.environ.get('MQ_DEBUG'): print('DBG end', await page.evaluate("JSON.stringify({cls:document.querySelector('.mq-pro').className, pend:getComputedStyle(document.querySelector('.mq-pend')).opacity, pendz:getComputedStyle(document.querySelector('.mq-pend')).zIndex, pfx:[getComputedStyle(document.querySelector('.mq-pfx')).opacity,getComputedStyle(document.querySelector('.mq-pfx')).backgroundImage.slice(0,80)], top:document.elementFromPoint(680,400).outerHTML.slice(0,120), rect:JSON.stringify(document.querySelector('.mq-pend').getBoundingClientRect()), b:getComputedStyle(document.querySelector('.mq-pend b')).color, vis:getComputedStyle(document.querySelector('.mq-pend')).visibility, disp:getComputedStyle(document.querySelector('.mq-pend')).display, cine:JSON.stringify(document.querySelector('#mq-cine').getBoundingClientRect()), proOp:getComputedStyle(document.querySelector('.mq-pro')).opacity})"))
    await page.screenshot(path=OUT + f'mq_{name}_2p_end.png')
    ended = await page.evaluate("document.querySelector('.mq-pro').classList.contains('ended')")
    if not ended: errs.append('prologue not ended')
    await page.click('#mq-cine .mq-pend [data-mq=cine-end]'); await page.wait_for_timeout(900)
    await page.screenshot(path=OUT + f'mq_{name}_3_prologue.png')
    for _ in range(6): await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.click('#mq-dlg'); await page.wait_for_timeout(150)
    await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.wait_for_timeout(500)
    await page.screenshot(path=OUT + f'mq_{name}_4_seiren.png')
    await T.ipc(page, 'crion:reply', {'key': 'k1', 'segs': EX1, 'done': True}); await page.wait_for_timeout(1000)
    for _ in range(3): await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.click('#mq-dlg'); await page.wait_for_timeout(150)
    await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.wait_for_timeout(500)
    await page.screenshot(path=OUT + f'mq_{name}_5_status.png')
    await T.ipc(page, 'crion:reply', {'key': 'k2', 'segs': LATER, 'done': True}); await page.wait_for_timeout(1000)
    await page.screenshot(path=OUT + f'mq_{name}_6_pops.png')
    # 권능 회수 장면까지 넘기면 의식 화면
    for _ in range(8):
        if await page.evaluate("!document.querySelector('#mq-rite').hidden"): break
        await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.click('#mq-dlg'); await page.wait_for_timeout(200)
    rite = await page.evaluate("!document.querySelector('#mq-rite').hidden")
    if not rite: errs.append('rite not shown')
    await page.wait_for_timeout(1600)
    await page.screenshot(path=OUT + f'mq_{name}_6b_rite.png')
    if rite: await page.click('#mq-rite [data-mq=rite-close]'); await page.wait_for_timeout(300)
    await page.screenshot(path=OUT + f'mq_{name}_6c_after.png')
    sugg = await page.evaluate("[...document.querySelectorAll('#mq-sugg button')].map(b=>b.textContent)")
    print(name, '행동 칩:', sugg)
    if not sugg: errs.append('no suggestions')
    sel = '#mq-tabs' if mobile else '#mq-stabs'
    for t in ['oseong', 'kanbu', 'ops', 'log']:
        await page.evaluate(f"document.querySelector('{sel} [data-k={t}]').click()")
        await page.wait_for_timeout(400)
        await page.screenshot(path=OUT + f'mq_{name}_7_{t}.png')
        if t == 'ops':
            await page.evaluate("document.querySelector('#mq-panel').scrollTop=600"); await page.wait_for_timeout(200)
            await page.screenshot(path=OUT + f'mq_{name}_7_ops2.png')
    await page.evaluate("document.querySelector('[data-mq=album]').click()"); await page.wait_for_timeout(400)
    await page.screenshot(path=OUT + f'mq_{name}_7_album.png')
    await page.evaluate("document.querySelector('[data-mq=mclose]').click()"); await page.wait_for_timeout(200)
    await page.evaluate("document.querySelector('[data-mq=lines]').click()"); await page.wait_for_timeout(400)
    await page.screenshot(path=OUT + f'mq_{name}_7_lines.png')
    await page.evaluate("document.querySelector('[data-mq=mclose]').click()"); await page.wait_for_timeout(200)
    await page.evaluate(f"document.querySelector('{sel} [data-k=oseong]').click()"); await page.wait_for_timeout(200)
    await page.evaluate("document.querySelector('[data-mq=who][data-k=서하린]').click()"); await page.wait_for_timeout(400)
    await page.screenshot(path=OUT + f'mq_{name}_8_person.png')
    await page.evaluate("document.querySelector('#mq-panel').scrollTop=500"); await page.wait_for_timeout(200)
    await page.screenshot(path=OUT + f'mq_{name}_8_person2.png')
    if mobile: await page.evaluate("document.querySelector('#mq-tabs [data-k=stage]').click()"); await page.wait_for_timeout(200)
    await page.evaluate("document.querySelector('[data-mq=powers]').click()"); await page.wait_for_timeout(400)
    await page.screenshot(path=OUT + f'mq_{name}_9_powers.png')
    await page.evaluate("document.querySelector('[data-mq=mclose]').click()"); await page.wait_for_timeout(200)
    # 행동 넣기 + 칩
    await page.evaluate("document.querySelector('[data-mq=act]').click()"); await page.keyboard.type('고개를 든다'); await page.wait_for_timeout(100)
    await page.evaluate("document.querySelector('#mq-sugg [data-mq=add]').click()"); await page.wait_for_timeout(200)
    composed = await page.evaluate("document.querySelector('#mq-in').value")
    print(name, '입력칸:', composed)
    if not composed.startswith('*고개를 든다*'): errs.append('act insert ' + composed)
    await page.evaluate("document.querySelector('#mq-in').value=''")
    if mobile: await page.evaluate("document.querySelector('#mq-tabs [data-k=ops]').click()"); await page.wait_for_timeout(200)
    else: await page.evaluate("document.querySelector('#mq-stabs [data-k=ops]').click()"); await page.wait_for_timeout(200)
    await page.evaluate("document.querySelector('[data-mq=sc][data-k=\"/간부보고\"]').click()"); await page.wait_for_timeout(300)
    filled = await page.evaluate("document.querySelector('#mq-in').value.slice(0,40)")
    if mobile:
        tab = await page.evaluate("window.__pk.state.tab")
        if tab != 'stage': errs.append('fill did not return to stage')
        tabs_hidden = await page.evaluate("getComputedStyle(document.querySelector('#mq-tabs')).display === 'none'")
        pbar_hidden = await page.evaluate("getComputedStyle(document.querySelector('.pbar')).display === 'none'")
        print(name, '입력 중 탭 숨김:', tabs_hidden, '/ CRION 머리줄 숨김:', pbar_hidden)
        if not tabs_hidden or not pbar_hidden: errs.append('typing/pbar')
        await page.screenshot(path=OUT + f'mq_{name}_a_typing.png')
        await page.evaluate("document.activeElement.blur()"); await page.wait_for_timeout(200)
        await page.evaluate("document.querySelector('.mq-more').click()"); await page.wait_for_timeout(400)
        menu = await page.evaluate("[...document.querySelectorAll('.pkm-it span')].map(x=>x.textContent)")
        print(name, '⋯ 메뉴:', menu)
        if '나가기' not in menu or '지난 대사' not in menu: errs.append('menu ' + str(menu))
        await page.evaluate("document.querySelector('#layer [data-act=close-modal]').click()"); await page.wait_for_timeout(200)
    # 발각 위기 연출
    await page.evaluate("window.__pk.state.waiting=false")
    await T.ipc(page, 'crion:reply', {'key': 'k3', 'segs': RISK, 'done': True}); await page.wait_for_timeout(1400)
    await page.screenshot(path=OUT + f'mq_{name}_b_alarm.png')
    alarm = await page.evaluate("document.querySelector('#mq-stage').classList.contains('alarm')")
    if not alarm: errs.append('alarm off')
    # 세이브가 있는 타이틀 + 세이브 서랍
    await page.evaluate("window.__pk.state.waiting=false")
    await page.evaluate("document.querySelector('.mq').querySelector('[data-mq=more]') && 0")
    await page.evaluate("(()=>{const b=document.createElement('button');b.dataset.mq='title';document.querySelector('.mq').appendChild(b);b.click();b.remove();})()"); await page.wait_for_timeout(1800)
    await page.screenshot(path=OUT + f'mq_{name}_c_title2.png')
    await page.evaluate("document.querySelector('[data-mq=t-saves]').click()"); await page.wait_for_timeout(600)
    await page.screenshot(path=OUT + f'mq_{name}_c_saves.png')
    if name == 'pc':
        await page.evaluate("document.querySelector('[data-mq=t-saves]').click()"); await page.wait_for_timeout(300)
        for vw, vh in [(1000, 760), (1920, 900)]:
            await page.set_viewport_size({'width': vw, 'height': vh}); await page.wait_for_timeout(500)
            await page.screenshot(path=OUT + f'mq_{name}_c_title_{vw}.png')
    over = await page.evaluate("document.documentElement.scrollWidth > innerWidth")
    if over: errs.append('horizontal overflow')
    M = await page.evaluate("JSON.stringify({st: window.__pk.memory.status.day, pw: window.__pk.memory.powers, aff: window.__pk.memory.aff, clues: window.__pk.memory.clues.length, seen: Object.keys(window.__pk.memory.seen).length})")
    print(name, '채운 글:', filled.replace('\n', ' '), '| 기록:', M[:300])
    print(name, '오류:', errs or '없음')
    await ctx.close()
    return errs

async def main():
    bad = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        bad += await run(b, 'pc', {'width': 1360, 'height': 820}, False)
        if os.environ.get('MQ_ONLY') == 'pc': await b.close(); sys.exit(1 if bad else 0)
        bad += await run(b, 'm', {'width': 390, 'height': 844}, True)
        bad += await run(b, 'm360', {'width': 360, 'height': 740}, True)
        await b.close()
    sys.exit(1 if bad else 0)
asyncio.run(main())
