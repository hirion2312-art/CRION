# 반지하 엔터테인먼트 팩 화면 점검(폰 먼저): python3 test/ui/run_idol.py → test/out/id_*.png
#  크랙 그림은 시험 환경에서 못 받으니 자리 그림으로 대신(가로=배경, 세로=인물). ID_ONLY=m390|m360|m430|pc
import asyncio, json, os, sys, io, hashlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import run_safehouse as T
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from urllib.parse import unquote
ROOT = os.path.abspath(os.path.join(HERE, '..', '..')) + '/'
OUT = ROOT + 'test/out/'
os.system(f'cd {ROOT} && node scripts/make-registry.js https://reg.test/CRION/ > /dev/null 2>&1')
IDX = json.load(open(ROOT + 'registry/index.json', encoding='utf-8'))
PK = 'hirion.basement-ent'
T.INDEX.clear(); T.INDEX.update(IDX)
T.INDEX['devPacks'] = [p for p in IDX['packs'] + IDX.get('devPacks', []) if p['id'] == PK]
T.INDEX['packs'] = []
for p in T.INDEX['devPacks']: p['workUrl'] = 'https://crack.wrtn.ai/detail/idol'
D = json.load(open(ROOT + 'packs/' + PK + '/data.json', encoding='utf-8'))
COL = {m['name']: m['color'] for m in D['members']}; COL.update({r['rep']: r['color'] for r in D['rivals']})
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc'
GF = '/tmp/claude-0/-home-claude/ff52d3e7-9b37-509e-8c52-2fa5470c16a0/scratchpad/gfonts/ofl/'
GAS = os.environ.get('GASOEK_TTF', GF + 'gasoekone/GasoekOne-Regular.ttf')
UNB = os.environ.get('UNBOUNDED_TTF', GF + 'unbounded/Unbounded[wght].ttf')
PEN = os.environ.get('NANUMPEN_TTF', '/tmp/claude-0/-home-claude/ff52d3e7-9b37-509e-8c52-2fa5470c16a0/scratchpad/gfonts/ofl/nanumpenscript/NanumPenScript-Regular.ttf')
CACHE = {}
def hexrgb(c): return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))
def fake(name):
    if name in CACHE: return CACHE[name]
    cat, situ = (name.split('_') + [''])[:2]
    if cat == '배경':
        W, H = 1152, 896
        im = Image.new('RGB', (W, H), (52, 50, 58)); dr = ImageDraw.Draw(im)
        for i in range(0, W, 120): dr.rectangle((i, 520, i + 80, H), fill=(70, 66, 76))
        dr.rectangle((0, 0, W, 180), fill=(90, 88, 96)); dr.rectangle((380, 40, 780, 140), fill=(140, 130, 110))
        im = im.filter(ImageFilter.GaussianBlur(5))
    else:
        W, H = 896, 1152
        c = hexrgb(COL.get(cat, '#888888'))
        im = Image.new('RGB', (W, H), tuple(int(x * .35) for x in c)); dr = ImageDraw.Draw(im)
        dr.ellipse((W * .3, H * .12, W * .7, H * .48), fill=(238, 214, 196))
        dr.rounded_rectangle((W * .18, H * .45, W * .82, H), 120, fill=c)
        dr.rectangle((W * .27, H * .1, W * .73, H * .22), fill=tuple(int(x * .6) for x in c))
    dr = ImageDraw.Draw(im)
    dr.text((24, H - 60), '자리 그림 · ' + name, font=ImageFont.truetype(FONT, 30), fill=(255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0))
    b = io.BytesIO(); im.save(b, 'JPEG', quality=72); CACHE[name] = b.getvalue(); return CACHE[name]
def IM(name):
    w, h = (1152, 896) if name.startswith('배경') else (896, 1152)
    return {'t': 'img', 'src': 'https://img.test/idol/' + name + '.jpg', 'w': w, 'h': h, 'alt': name}
def tx(s, code=False): return {'t': 'text', 's': s, 'code': code}
ST = lambda y, m, a, money, debt, d, wip='', mem='윤서하 [리더·보컬 B] 보통', best='-', extra='': tx(f"━━━━━━━━━━━━━━\n📅 {y}년차 {m}월 · 행동 {a}/4 | 🔥 유행: 발라드 · 이별\n💰 자금 {money} | 🧾 부채 {debt} (상환 D-{d}달)\n🏠 반지하 | 🏢 무명 | ⚠️ 루머 1/3\n💗 코어 12 · 라이트 340 | ▶️ 구독 85 | 📈 최고 {best}\n👥 {mem}\n🎵 진행 곡: {wip or '없음'}\n⚔️ 라이벌: 진세린 0승 1패\n🤝 약속: 서하에게 다음 센터\n━━━━━━━━━━━━━━", True)
R1 = [IM('배경_반지하숙소'), tx('곰팡이 냄새가 밴 반지하. 벽에 붙은 화이트보드에는 아버지의 글씨가 그대로 남아 있다. 연습실 구석에서 누군가 혼자 안무를 맞추고 있었다.\n'), IM('윤서하_통상'),
  tx('윤서하💬 *수건으로 땀을 닦으며* "…왔어요? 사장님. 이번 달은 뭐부터 할 건데요."\n"아버지 대신 온 사람이 이 사람이라니."\n'), ST(1, 3, 0, '120만', '3,000만', 3)]
R2 = [IM('윤서하_진지'), tx('윤서하💬 기획서를 한참 들여다본다 "후렴은… 나쁘지 않네요. 배분이 고르게 나뉜 게 조금 걱정이지만."\n'), ST(1, 3, 2, '90만', '3,000만', 3, '「첫 줄」 제작 1/2달 · 5월 발매')]
R3 = [tx('🎵 발매! 「첫 줄」\n🎧 신곡 공개: VELA 「Starlight」\n━━ 📊 5월 결산 ━━\n💵 수입 +80만 (알바 60만 · 유튜브 20만)\n💸 지출 -150만 (월세 50만 · 상환 100만)\n🎵 「첫 줄」 B등급 · 화력 42\n📈 레몬차트 「첫 줄」 87위 (NEW) | LUCÉ 「Mirror」 12위 (▼2) · VELA 「Starlight」 3위 (NEW)\n💬 반응: 후렴이 귀에 붙는다 / 가사가 입에 안 붙는다 / 서하 목소리 미쳤다\n💪 컨디션: 윤서하 보통→지침\n🔜 다음 달: 대학축제 섭외 시작\n━━━━━━━━━━\n'),
  IM('배경_연습실'), IM('윤서하_미소'), tx('윤서하💬 "87위. …차트에 우리 이름이 있어요, 사장님."\n'), ST(1, 6, 0, '50만', '2,900만', 0, '', '윤서하 [리더·보컬 B] 지침', '87위')]
R4 = [tx('🤝 합류! 한소율\n'), IM('한소율_미소'), tx('한소율💬 헤드폰을 목에 건 채 고개를 끄덕인다 "…곡, 같이 써요."\n'), ST(1, 6, 1, '50만', '2,900만', 0, '', '윤서하 [리더·보컬 B] 지침 / 한소율 [작곡 C] 좋음', '87위')]

async def run(b, name, vp, mobile):
    errs = []
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
    page = await ctx.new_page()
    page.on('pageerror', lambda e: errs.append(str(e)))
    await page.add_init_script("window.__engineVersion='0.14.0'")
    await T.setup(page)
    await page.add_init_script("try{localStorage.setItem('crion.kit.coach.hirion.basement-ent','1')}catch(e){}")
    await page.route('https://img.test/idol/**', lambda r: r.fulfill(body=fake(unquote(r.request.url).split('/idol/')[-1].replace('.jpg', '')), content_type='image/jpeg'))
    if os.path.isfile(PEN):
        async def gcss(route):
            if 'Gasoek' in route.request.url: return await route.fulfill(body="@font-face{font-family:'Gasoek One';src:url(https://fonts.gstatic.com/gasoek.ttf) format('truetype')}@font-face{font-family:'Unbounded';font-weight:200 900;src:url(https://fonts.gstatic.com/unbounded.ttf) format('truetype')}", content_type='text/css')
            if 'Nanum+Pen' in route.request.url: return await route.fulfill(body="@font-face{font-family:'Nanum Pen Script';src:url(https://fonts.gstatic.com/nanumpen.ttf) format('truetype')}", content_type='text/css')
            await route.fulfill(body='', content_type='text/css')
        await page.route('https://fonts.googleapis.com/**', gcss)
        await page.route('https://fonts.gstatic.com/gasoek.ttf', lambda r: r.fulfill(path=GAS, content_type='font/ttf'))
        await page.route('https://fonts.gstatic.com/unbounded.ttf', lambda r: r.fulfill(path=UNB, content_type='font/ttf'))
        await page.route('https://fonts.gstatic.com/nanumpen.ttf', lambda r: r.fulfill(path=PEN, content_type='font/ttf'))
    await page.goto(T.BASE); await page.evaluate("localStorage.setItem('crion.tut4','1')"); await page.reload(); await page.wait_for_timeout(1500)
    await page.evaluate("window.__crion.S.dev.repo = { loadWorks: async () => ({ data: { works: [], hidden: [] } }), lastDeploy: async () => null }")
    await page.click('.nav [data-v=store]'); await page.wait_for_timeout(700)
    await page.click('.pcard [data-act=pack]'); await page.wait_for_timeout(500)
    await page.click('.modal [data-act=pack-install]')
    for _ in range(80):
        await page.wait_for_timeout(300)
        if await page.evaluate(f"!!JSON.parse(localStorage.getItem('crion.packs')||'{{}}')['{PK}']"): break
    await page.wait_for_timeout(300); await page.click('.modal [data-act=pack-play]'); await page.wait_for_timeout(1400)
    await page.evaluate("(()=>{const w=document.querySelector('#crack');w.dispatchEvent(new Event('dom-ready'));w.dispatchEvent(new Event('did-stop-loading'));})()")
    await page.wait_for_function("!!document.querySelector('.id')"); await page.wait_for_timeout(1000)
    await page.screenshot(path=OUT + f'id_{name}_1_title.png')
    await page.click('[data-id=t-new]'); await page.wait_for_timeout(200)
    await T.ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/idol', 'actions': [{'id': 0, 'kind': 'new', 'label': '새로하기'}]}); await page.wait_for_timeout(150)
    await T.ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/idol', 'actions': [{'id': 2, 'kind': 'confirm', 'label': '시작하기'}]}); await page.wait_for_timeout(150)
    await T.ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/i1', 'chat': True})
    await T.ipc(page, 'crion:state', {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/i1', 'msgs': 1, 'users': 0, 'actions': []}); await page.wait_for_timeout(300)
    if await page.evaluate("window.__pk.state.mode") != 'play': errs.append('not play')
    async def done_beats():
        for _ in range(12):
            await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()")
            st = await page.evaluate("[window.__pk.state.i, window.__pk.state.beats.length]")
            if st[0] >= st[1] - 1: break
            await page.evaluate("document.querySelector('#id-dlg').click()"); await page.wait_for_timeout(80)
        await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.wait_for_timeout(300)
    await T.ipc(page, 'crion:reply', {'key': 'k1', 'segs': R1, 'done': True}); await page.wait_for_timeout(700)
    await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.wait_for_timeout(200)
    await page.screenshot(path=OUT + f'id_{name}_2_stage.png')
    await done_beats()
    sel = '#id-tabs' if mobile else '#id-stabs'
    async def tab(k): await page.evaluate(f"document.querySelector('{sel} [data-k={k}]').click()"); await page.wait_for_timeout(350)
    await tab('music'); await page.screenshot(path=OUT + f'id_{name}_3_chart0.png')
    # 작업실: 기획서 쓰기
    await tab('studio')
    await page.fill('#st-title', '첫 줄'); await page.dispatch_event('#st-title', 'change')
    await page.evaluate("document.querySelector('[data-id=st-set][data-f=genre][data-v=\"발라드\"]').click()")
    await page.evaluate("document.querySelector('[data-id=st-set][data-f=theme][data-v=\"이별\"]').click()")
    for k, d in [('홍보', -1), ('퍼포', -1), ('멜로디', 1), ('가사', 1)]:
        await page.evaluate(f"document.querySelector('[data-id=st-al][data-k=\"{k}\"][data-d=\"{d}\"]').click()")
    await page.fill('[data-ch="0"]', '너의 첫 줄을 아직 외워'); await page.fill('[data-ch="1"]', '끝줄은 우리가 쓸게'); await page.dispatch_event('[data-ch="1"]', 'change'); await page.wait_for_timeout(200)
    await page.evaluate("document.querySelector('[data-id=st-demo]').click()"); await page.wait_for_timeout(600)
    playing = await page.evaluate("JSON.stringify(window.__pk.playing())")
    print(name, '데모 재생:', playing)
    if 'demo' not in (playing or ''): errs.append('demo not playing')
    await page.screenshot(path=OUT + f'id_{name}_4_studio.png')
    await page.evaluate("document.querySelector('#id-panel').scrollTop=900"); await page.wait_for_timeout(150)
    await page.screenshot(path=OUT + f'id_{name}_4_studio2.png')
    await page.evaluate("document.querySelector('[data-id=st-fill]').click()"); await page.wait_for_timeout(300)
    v = await page.evaluate("document.querySelector('#id-in').value")
    if not v.startswith('[곡 기획서]\n곡명: 첫 줄\n장르·테마: 발라드 · 이별\n배분(10): 멜로디 3 · 가사 3 · 퍼포 1 · 비주얼 2 · 홍보 1'): errs.append('plan fill ' + v[:80])
    await page.screenshot(path=OUT + f'id_{name}_5_typing.png')
    await page.evaluate("document.querySelector('[data-id=send]').click()"); await page.wait_for_timeout(200)
    await page.evaluate("document.activeElement && document.activeElement.blur()")
    await T.ipc(page, 'crion:reply', {'key': 'k2', 'segs': R2, 'done': True}); await page.wait_for_timeout(500); await done_beats()
    await T.ipc(page, 'crion:reply', {'key': 'k3', 'segs': R3, 'done': True}); await page.wait_for_timeout(900)
    await page.screenshot(path=OUT + f'id_{name}_6_release.png')
    await page.evaluate("document.querySelector('[data-id=fx-next]').click()"); await page.wait_for_timeout(1500)
    await page.screenshot(path=OUT + f'id_{name}_7_receipt.png')
    await page.evaluate("document.querySelector('.sh-wrap').click()"); await page.wait_for_timeout(2700)
    await page.screenshot(path=OUT + f'id_{name}_8_count.png')
    await page.evaluate("document.querySelector('.sh-wrap').click()"); await page.wait_for_timeout(700)
    await page.screenshot(path=OUT + f'id_{name}_9_cards.png')
    await page.evaluate("document.querySelector('[data-id=show-close]').click()"); await page.wait_for_timeout(500)
    await done_beats(); await page.screenshot(path=OUT + f'id_{name}_a_after.png')
    await tab('music'); await page.evaluate("document.querySelector('[data-id=findme]').click()"); await page.wait_for_timeout(900)
    await page.screenshot(path=OUT + f'id_{name}_b_chart.png')
    await page.evaluate("document.querySelector('#id-panel').scrollTop=0"); await page.wait_for_timeout(100)
    await page.screenshot(path=OUT + f'id_{name}_b_chart_top.png')
    await page.evaluate("document.querySelector('.lm-list li.ours [data-id=song]').click()"); await page.wait_for_timeout(400)
    await page.evaluate("document.querySelector('.lm-song [data-id=playsong]').click()"); await page.wait_for_timeout(500)
    await page.screenshot(path=OUT + f'id_{name}_c_song.png')
    await page.evaluate("document.querySelector('#id-panel').scrollTop=600"); await page.wait_for_timeout(150)
    await page.screenshot(path=OUT + f'id_{name}_c_song2.png')
    await page.evaluate("document.querySelector('[data-id=fullplayer]').click()"); await page.wait_for_timeout(900)
    await page.screenshot(path=OUT + f'id_{name}_d_player.png')
    await page.evaluate("document.querySelector('[data-id=pl-close]').click()"); await page.wait_for_timeout(200)
    await page.evaluate("document.querySelector('.lm-tabs [data-k=new]') ? 0 : document.querySelector('[data-id=msub]').click()"); await page.wait_for_timeout(200)
    await page.evaluate("document.querySelector('[data-id=mtab][data-k=new]').click()"); await page.wait_for_timeout(300)
    await page.screenshot(path=OUT + f'id_{name}_e_new.png')
    await page.evaluate("document.querySelector('[data-id=mtab][data-k=artist]').click()"); await page.wait_for_timeout(300)
    await page.screenshot(path=OUT + f'id_{name}_e_artists.png')
    await page.evaluate("document.querySelector('[data-id=artist][data-k=LUCÉ]').click()"); await page.wait_for_timeout(300)
    await page.screenshot(path=OUT + f'id_{name}_e_rival.png')
    await tab('office'); await page.screenshot(path=OUT + f'id_{name}_f_office.png')
    await page.evaluate("document.querySelector('#id-panel').scrollTop=700"); await page.wait_for_timeout(150)
    await page.screenshot(path=OUT + f'id_{name}_f_office2.png')
    if mobile: await tab('stage')
    await T.ipc(page, 'crion:reply', {'key': 'k4', 'segs': R4, 'done': True}); await page.wait_for_timeout(1300)
    await page.screenshot(path=OUT + f'id_{name}_g_join.png')
    await page.evaluate("document.querySelector('[data-id=fx-next]') && document.querySelector('[data-id=fx-next]').click()"); await page.wait_for_timeout(400)
    await tab('team'); await page.screenshot(path=OUT + f'id_{name}_h_team.png')
    if mobile:
        await tab('stage')
        await page.evaluate("document.querySelector('.id-more').click()"); await page.wait_for_timeout(400)
        menu = await page.evaluate("[...document.querySelectorAll('.pkm-it span')].map(x=>x.textContent)")
        if '나가기' not in menu: errs.append('menu')
        await page.evaluate("document.querySelector('#layer [data-act=close-modal]') && document.querySelector('#layer [data-act=close-modal]').click()")
    songs = await page.evaluate("JSON.stringify(Object.keys(window.__pk.memory.songs))")
    print(name, '곡:', songs, '/ 오류:', errs or '없음')
    await ctx.close()
    return errs

async def main():
    only = os.environ.get('ID_ONLY')
    sizes = [('m390', {'width': 390, 'height': 844}, True), ('m360', {'width': 360, 'height': 740}, True), ('m430', {'width': 430, 'height': 932}, True), ('pc', {'width': 1360, 'height': 820}, False)]
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        bad = []
        for n, vp, m in sizes:
            if only and n != only: continue
            bad += await run(b, n, vp, m)
        await b.close()
    print('전체:', '통과' if not bad else bad)
asyncio.run(main())
