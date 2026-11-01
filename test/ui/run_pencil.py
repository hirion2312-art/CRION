# 온리펜슬 팩 화면 점검(폰 먼저): python3 test/ui/run_pencil.py → test/out/op_*.png
#  크랙 그림은 시험 환경에서 못 받으니 자리 그림(가로=배경, 세로=인물, 정사각=연필)을 만들어 대신 보낸다
#  OP_ONLY=m390|m360|m430|pc 로 하나만, 글꼴: NANUMPEN_TTF(손글씨) 경로
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
PK = 'hirion.onlypencil'
T.INDEX.clear(); T.INDEX.update(IDX)
T.INDEX['devPacks'] = [p for p in IDX['packs'] + IDX.get('devPacks', []) if p['id'] == PK]
T.INDEX['packs'] = []
for p in T.INDEX['devPacks']: p['workUrl'] = 'https://crack.wrtn.ai/detail/pencil'
D = json.load(open(ROOT + 'packs/' + PK + '/data.json', encoding='utf-8'))
COL = {r['name']: r['color'] for r in D['people']}
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc'
PEN = os.environ.get('NANUMPEN_TTF', '/tmp/claude-0/-home-claude/ff52d3e7-9b37-509e-8c52-2fa5470c16a0/scratchpad/gfonts/ofl/nanumpenscript/NanumPenScript-Regular.ttf')
THUMB = Image.open(ROOT + 'config/thumbs/wmvnv1588.webp').convert('RGB')
CACHE = {}
def fake(name):
    if name in CACHE: return CACHE[name]
    cat, situ = (name.split('_') + [''])[:2]
    h = int(hashlib.md5(name.encode()).hexdigest()[:6], 16)
    tw, th = THUMB.size
    if cat == '배경':
        W, H = 1344, 768
        hx = {'자취방': (60, 52, 70), '대학교': (70, 90, 110), '편의점': (40, 70, 60), '자취방복도': (55, 55, 62), '술집': (90, 50, 30)}.get(situ, (50, 50, 60))
        im = Image.new('RGB', (W, H), hx)
        dr = ImageDraw.Draw(im)
        for i in range(0, W, 96): dr.rectangle((i, H * .55, i + 60, H), fill=tuple(min(255, c + 18) for c in hx))
        dr.rectangle((0, 0, W, H * .3), fill=tuple(min(255, c + 30) for c in hx))
        im = im.filter(ImageFilter.GaussianBlur(6))
    elif cat == '온리펜슬':
        W = H = 1024
        im = Image.new('RGB', (W, H), (30, 26, 24))
        dr = ImageDraw.Draw(im)
        dr.polygon([(180, 560), (760, 400), (800, 450), (220, 610)], fill=(201, 120, 63))
        dr.polygon([(760, 400), (880, 380), (800, 450)], fill=(240, 220, 190))
    else:
        W, H = 768, 1024
        cw = int(tw * .75); x = (h % 2) * (tw - cw)
        im = THUMB.crop((x, 0, x + cw, int(cw * H / W))).resize((W, H))
        c = COL.get(cat)
        if c: im = Image.blend(im, Image.new('RGB', (W, H), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))), .35)
    dr = ImageDraw.Draw(im)
    dr.text((24, H - 60), '자리 그림 · ' + name, font=ImageFont.truetype(FONT, 30), fill=(255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0))
    b = io.BytesIO(); im.save(b, 'JPEG', quality=72); CACHE[name] = b.getvalue(); return CACHE[name]
SIZE = {'배경': (1344, 768), '온리펜슬': (1024, 1024)}
def IM(name): w, h = SIZE.get(name.split('_')[0], (768, 1024)); return {'t': 'img', 'src': 'https://img.test/op/' + name + '.jpg', 'w': w, 'h': h, 'alt': ''}
def tx(s, code=False): return {'t': 'text', 's': s, 'code': code}

PRO = [IM('배경_자취방'), tx("개강 전날 밤, 뤼튼대학교 후문. 셔터를 반쯤 내린 중고 문구점 앞에 '폐업 정리, 아무거나 가져가세요' 박스가 놓여 있었다. 맨 아래에서 손끝에 걸린 건, 구릿빛으로 빛나는 낡은 연필 한 자루.\n"),
  IM('온리펜슬_연필'), tx('몸통에 희미하게 새겨진 글자. ONLY PENCIL.\n\nEPISODE. 1 | 적으면 이루어진다\n\n자취방 책상 앞. 장난삼아 연습장 귀퉁이에 적어 본다.\n\n:(사과 하나):\n\n글자가 잉크처럼 번져 종이 속으로 스며든다. 그리고 책상 위, 방금까지 없던 사과 하나. 쥐어 보면 차갑고 묵직하다. 진짜다.\n\n아침. 휴대폰 알람이 울린다. 개강 첫날, 1교시 전공 수업. 같은 과 명단에서 봤던 이름 하나가 떠오른다. 박아린. 고등학교 3년 내내 나를 \'찐따\'라고 부르던 그 금발.\n\n연필을 주머니에 넣는다. 이 힘의 정체는, 누구에게도 말할 수 없다.\n\n첫 메시지로 아래 양식을 보내면 주인공이 확정됩니다. 비워 두면 기본값(23세 평범한 대학생)으로 시작합니다.\n'),
  tx('[온리펜슬 | 주인공 등록]\n이름:\n외형:\n성격:', True)]
EX1 = [IM('배경_대학교'), tx('1교시가 끝난 계단식 강의실. 창으로 든 햇살이 뒷줄 금발 끝에 걸려 반짝인다.\n'), IM('박아린_분노'),
  tx('박아린💬 "야 찐따 ㅋㅋ 너 아직 살아 있었냐? 존나 반갑네."\n친구들이 낄낄대는 사이, 노트 귀퉁이에 적힌 낙서 한 줄이 잉크처럼 번져 스민다.\n:(아린이 3턴간 내 앞에서 말을 더듬는다):\n그 순간 아린의 혀끝이 꼬인다.\n박아린💬 "뭐, 뭘 봐… 씨, 왜 혀가…"\n"미쳤나 봐. 왜 하필 쟤 앞에서."\n'),
  tx('━━━━━━━━━━\n📅 1일차 낮 | 📍 대학교\n👤 이도윤 | 🎚 NORMAL\n🖊 잉크 65% | ⏳ 아린 말 더듬기 (3턴)\n💗 박아린 -50 (냉소)\n📜 주문 -35%\n━━━━━━━━━━')]
EX2 = [IM('배경_편의점'), tx('저녁 여섯 시, 편의점 문에 달린 종이 맑게 울린다. 교대하던 점장이 막대사탕을 문 채 고개를 든다.\n'), IM('오수진_통상'),
  tx('오수진💬 "어이 알바~ 오늘도 채아랑 붙어 있네?"\n'), IM('한채아_미소'), tx('한채아💬 "선배! 오늘 수업 힘들었죠? 얼굴에 다 써 있어요."\n[카톡] 한채아: 선배 오늘 마감 같이 해요 ㅎㅎ\n[카톡] 한채아: 바나나우유 사 놨어요!\n'),
  tx('━━━━━━━━━━\n📅 1일차 저녁 | 📍 편의점\n👤 이도윤 | 🎚 NORMAL\n🖊 잉크 65% | ⏳ 아린 말 더듬기 (1턴), 내 체력 강화 (영구)\n💗 박아린 -48 (냉소) / 한채아 +33 (우호) / 김하영 0 (냉소) / 오수진 +12 (우호)\n📜 없음\n━━━━━━━━━━')]
EX3 = [IM('배경_술집'), tx('개강총회가 끝나 갈 무렵, 시끄럽던 테이블이 하나둘 비어 간다. 친구들 앞에서 고교 시절 얘기가 나오자 아린의 귀가 붉어졌다.\n'), IM('박아린_부끄'),
  tx('박아린💬 귀걸이를 만지작거리며 "…그때 내가 좀 심했다고. 됐냐?"\n'),
  tx('━━━━━━━━━━\n📅 6일차 밤 | 📍 술집\n👤 이도윤 | 🎚 NORMAL\n🖊 잉크 100% | ⏳ 없음\n💗 박아린🔓 +52 (신뢰) / 한채아 +71 (신뢰) / 김하영 18 (우호) / 오수진 +20 (우호) / 윤세라 +8 (우호)\n📜 리필 +40%\n━━━━━━━━━━')]

async def run(b, name, vp, mobile):
    errs = []
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
    page = await ctx.new_page()
    page.on('pageerror', lambda e: errs.append(str(e)))
    await page.add_init_script("window.__engineVersion='0.13.0'")
    await T.setup(page)
    await page.add_init_script("try{localStorage.setItem('crion.kit.coach.hirion.onlypencil','1')}catch(e){}")
    async def img(route):
        n = unquote(route.request.url).split('/op/')[-1].replace('.jpg', '')
        await route.fulfill(body=fake(n), content_type='image/jpeg')
    await page.route('https://img.test/op/**', img)
    if os.path.isfile(PEN):
        async def gcss(route):
            u = route.request.url
            if 'Nanum+Pen' in u: return await route.fulfill(body="@font-face{font-family:'Nanum Pen Script';src:url(https://fonts.gstatic.com/nanumpen.ttf) format('truetype')}", content_type='text/css')
            await route.fulfill(body='', content_type='text/css')
        await page.route('https://fonts.googleapis.com/**', gcss)
        await page.route('https://fonts.gstatic.com/nanumpen.ttf', lambda r: r.fulfill(path=PEN, content_type='font/ttf'))
    await page.goto(T.BASE); await page.evaluate("localStorage.setItem('crion.tut4','1');localStorage.setItem('crion.prefs',JSON.stringify({adult:true}))"); await page.reload(); await page.wait_for_timeout(1500)
    await page.evaluate("window.__crion.S.dev.repo = { loadWorks: async () => ({ data: { works: [], hidden: [] } }), lastDeploy: async () => null }")
    await page.click('.nav [data-v=store]'); await page.wait_for_timeout(700)
    await page.click('.pcard [data-act=pack]'); await page.wait_for_timeout(500)
    if name == 'pc': await page.screenshot(path=OUT + f'op_{name}_0_store.png')
    await page.click('.modal [data-act=pack-install]')
    for _ in range(80):
        await page.wait_for_timeout(300)
        if await page.evaluate(f"!!JSON.parse(localStorage.getItem('crion.packs')||'{{}}')['{PK}']"): break
    await page.wait_for_timeout(300); await page.click('.modal [data-act=pack-play]'); await page.wait_for_timeout(1400)
    await page.evaluate("(()=>{const w=document.querySelector('#crack');w.dispatchEvent(new Event('dom-ready'));w.dispatchEvent(new Event('did-stop-loading'));})()")
    await page.wait_for_function("!!document.querySelector('.op')"); await page.wait_for_timeout(1200)
    print(name, '손글씨 글꼴:', await page.evaluate("document.fonts.load('30px \"Nanum Pen Script\"','가').then(f=>f.length)"))
    await page.screenshot(path=OUT + f'op_{name}_1_title.png')
    # 타이틀에서 '정식 시작' → 크랙 시작 설정에서 그 이름을 골라 누르는지
    await page.click('.op-tmode.m-normal'); await page.wait_for_timeout(200)
    await T.ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/pencil', 'actions': [{'id': 0, 'kind': 'new', 'label': '새로하기'}]}); await page.wait_for_timeout(150)
    await T.ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/pencil', 'actions': [{'id': 1, 'kind': 'mode', 'label': '정식 시작'}, {'id': 2, 'kind': 'mode', 'label': 'GOD 모드'}, {'id': 3, 'kind': 'mode', 'label': 'HARD 모드'}, {'id': 4, 'kind': 'confirm', 'label': '시작하기'}]}); await page.wait_for_timeout(150)
    await T.ipc(page, 'crion:state', {'page': 'detail', 'url': 'https://crack.wrtn.ai/detail/pencil', 'actions': [{'id': 4, 'kind': 'confirm', 'label': '시작하기'}]}); await page.wait_for_timeout(150)
    sent = await page.evaluate("JSON.stringify(window.__sent.filter(x=>x[0]==='crion:click'))")
    print(name, '크랙에 누른 것:', sent)
    if '"id":1' not in sent.replace(' ', '') and '1' not in sent: errs.append('mode not clicked ' + sent)
    await T.ipc(page, 'crion:url', {'url': 'https://crack.wrtn.ai/u/me/c/p1', 'chat': True})
    await T.ipc(page, 'crion:state', {'page': 'chat', 'input': True, 'url': 'https://crack.wrtn.ai/u/me/c/p1', 'msgs': 1, 'users': 0, 'actions': []}); await page.wait_for_timeout(300)
    if await page.evaluate("window.__pk.state.mode") != 'play': errs.append('not play')
    await T.ipc(page, 'crion:reply', {'key': 'k0', 'segs': PRO, 'done': True}); await page.wait_for_timeout(900)
    await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.wait_for_timeout(300)
    await page.screenshot(path=OUT + f'op_{name}_2_pro.png')
    shot_cast = False
    for k in range(30):
        if await page.evaluate("!document.querySelector('#op-reg').hidden"): break
        if not shot_cast and await page.evaluate("!document.querySelector('#op-cast').hidden"):
            await page.wait_for_timeout(700); await page.screenshot(path=OUT + f'op_{name}_3_cast_write.png')
            await page.wait_for_timeout(900); await page.screenshot(path=OUT + f'op_{name}_3_cast_bleed.png'); shot_cast = True
            await page.wait_for_timeout(1200); continue
        await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()")
        await page.evaluate("document.querySelector('#op-dlg').click()"); await page.wait_for_timeout(120)
    await page.wait_for_timeout(700)
    if not shot_cast: errs.append('no cast')
    if await page.evaluate("document.querySelector('#op-reg').hidden"): errs.append('reg card not shown')
    await page.screenshot(path=OUT + f'op_{name}_4_reg.png')
    await page.fill('#op-rname', '이도윤'); await page.click('[data-op=reg-chip][data-f=op-rlook]'); await page.click('[data-op=reg-chip][data-f=op-rmind]')
    await page.click('[data-op=reg-fill]'); await page.wait_for_timeout(300)
    v = await page.evaluate("document.querySelector('#op-in').value")
    if not v.startswith('[온리펜슬 | 주인공 등록]\n이름: 이도윤'): errs.append('reg fill ' + v[:40])
    await page.evaluate("document.querySelector('#op-in').value='';document.activeElement.blur()")
    # 펜슬 노트: 주문 → 잉크 예상
    await page.click('.op-penbtn'); await page.wait_for_timeout(400)
    await page.fill('#op-spell', '3턴간 시간이 멈춘다'); await page.dispatch_event('#op-spell', 'input'); await page.wait_for_timeout(200)
    await page.evaluate("document.activeElement.blur()")
    await page.screenshot(path=OUT + f'op_{name}_5_note.png')
    await page.fill('#op-spell', '아린이 영원히 나를 사랑하게 된다'); await page.dispatch_event('#op-spell', 'input'); await page.wait_for_timeout(200)
    await page.evaluate("document.activeElement.blur()")
    await page.screenshot(path=OUT + f'op_{name}_5_note_warn.png')
    await page.fill('#op-spell', '아린이 내 앞에서 말을 더듬는다'); await page.dispatch_event('#op-spell', 'input')
    await page.click('[data-op=n-turn][data-v="3턴"]'); await page.wait_for_timeout(150)
    sp = await page.evaluate("document.querySelector('#op-spell').value")
    print(name, '지속 칩:', sp)
    if sp != '아린이 3턴간 내 앞에서 말을 더듬는다': errs.append('turn chip ' + sp)
    await page.click('[data-op=note-fill]'); await page.wait_for_timeout(300)
    v = await page.evaluate("document.querySelector('#op-in').value")
    if v != ':(아린이 3턴간 내 앞에서 말을 더듬는다):': errs.append('note fill ' + v)
    await page.screenshot(path=OUT + f'op_{name}_6_typing.png')
    if mobile:
        th = await page.evaluate("getComputedStyle(document.querySelector('#op-tabs')).display==='none'")
        pb = await page.evaluate("getComputedStyle(document.querySelector('.pbar')).display==='none'")
        print(name, '입력 중 탭 숨김:', th, '/ CRION 머리줄 숨김:', pb)
        if not th or not pb: errs.append('typing/pbar')
    await page.click('[data-op=send]'); await page.wait_for_timeout(200)
    await page.evaluate("document.activeElement && document.activeElement.blur()")
    await page.screenshot(path=OUT + f'op_{name}_6b_wait.png')
    await T.ipc(page, 'crion:reply', {'key': 'k1', 'segs': EX1, 'done': True}); await page.wait_for_timeout(700)
    for k in range(14):
        if await page.evaluate("!document.querySelector('#op-cast').hidden"):
            await page.wait_for_timeout(600); await page.screenshot(path=OUT + f'op_{name}_7_cast.png'); await page.wait_for_timeout(2600); break
        await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.evaluate("document.querySelector('#op-dlg').click()"); await page.wait_for_timeout(150)
    for k in range(3):
        await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.evaluate("document.querySelector('#op-dlg').click()"); await page.wait_for_timeout(150)
    await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.wait_for_timeout(300)
    await page.screenshot(path=OUT + f'op_{name}_8_arin.png')
    led = await page.evaluate("JSON.stringify(window.__pk.memory.spells)")
    print(name, '주문 장부:', led)
    if '"cost":35' not in led: errs.append('ledger')
    await T.ipc(page, 'crion:reply', {'key': 'k2', 'segs': EX2, 'done': True}); await page.wait_for_timeout(500)
    await page.screenshot(path=OUT + f'op_{name}_9_pops.png')
    for k in range(3): await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.evaluate("document.querySelector('#op-dlg').click()"); await page.wait_for_timeout(150)
    await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.wait_for_timeout(300)
    await page.screenshot(path=OUT + f'op_{name}_9b_kakao.png')
    await T.ipc(page, 'crion:reply', {'key': 'k3', 'segs': EX3, 'done': True}); await page.wait_for_timeout(900)
    await page.evaluate("window.__pk.state.typing && window.__pk.state.typing.finish()"); await page.wait_for_timeout(400)
    await page.screenshot(path=OUT + f'op_{name}_a_unlock.png')
    sel = '#op-tabs' if mobile else '#op-stabs'
    for t in ['heart', 'phone', 'note', 'log']:
        await page.evaluate(f"document.querySelector('{sel} [data-k={t}]').click()"); await page.wait_for_timeout(350)
        await page.screenshot(path=OUT + f'op_{name}_b_{t}.png')
        if t == 'note': await page.evaluate("document.querySelector('#op-panel').scrollTop=700"); await page.wait_for_timeout(150); await page.screenshot(path=OUT + f'op_{name}_b_note2.png')
    await page.evaluate(f"document.querySelector('{sel} [data-k=heart]').click()"); await page.wait_for_timeout(200)
    await page.evaluate("document.querySelector('[data-op=who][data-k=박아린]').click()"); await page.wait_for_timeout(350)
    await page.screenshot(path=OUT + f'op_{name}_c_person.png')
    await page.evaluate(f"document.querySelector('{sel} [data-k=phone]').click()"); await page.wait_for_timeout(200)
    await page.evaluate("document.querySelector('[data-op=chat][data-k=한채아]').click()"); await page.wait_for_timeout(350)
    await page.screenshot(path=OUT + f'op_{name}_c_chat.png')
    if mobile:
        await page.evaluate("document.querySelector('#op-tabs [data-k=stage]').click()"); await page.wait_for_timeout(200)
        await page.evaluate("document.querySelector('.op-more').click()"); await page.wait_for_timeout(400)
        menu = await page.evaluate("[...document.querySelectorAll('.pkm-it span')].map(x=>x.textContent)")
        print(name, '⋯ 메뉴:', menu)
        if '나가기' not in menu: errs.append('menu')
        await page.screenshot(path=OUT + f'op_{name}_d_menu.png')
    print(name, '오류:', errs or '없음')
    await ctx.close()
    return errs

async def main():
    only = os.environ.get('OP_ONLY')
    sizes = [('m390', {'width': 390, 'height': 844}, True), ('m360', {'width': 360, 'height': 740}, True), ('m430', {'width': 430, 'height': 932}, True), ('pc', {'width': 1360, 'height': 820}, False)]
    async with async_playwright() as p:
        b = await p.chromium.launch()
        bad = []
        for n, vp, m in sizes:
            if only and n != only: continue
            bad += await run(b, n, vp, m)
        await b.close()
    print('전체:', '통과' if not bad else bad)
asyncio.run(main())
