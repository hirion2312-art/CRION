# '처음 시작'이 엉뚱한 작품(앞서 본 소환수 아카데미)을 여는 문제 점검: python3 test/ui/run_detail.py
#  1) 예전에 팩이 잘못 기억한 작품 화면 주소(아카데미)가 남아 있어도 → 공유 링크로 연다
#  2) 공유 링크를 연 뒤 처음 나온 작품 화면만 이 작품 주소로 기억 → 다음 '처음 시작'은 그 주소
#  3) 다른 작품 화면 신호(문을 여는 중 앞 화면)는 기억하지 않는다
import asyncio, sys
sys.path.insert(0, '/home/claude/crion/test/ui')
import run_safehouse_new as N
import run_safehouse as T
from playwright.async_api import async_playwright
ACAD = 'https://crack.wrtn.ai/detail/academy-wrong'
DETAIL = 'https://crack.wrtn.ai/detail/safehouse-right'

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        page = await b.new_page(viewport={'width': 1440, 'height': 900})
        errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
        await page.add_init_script(f"localStorage.setItem('crion.pk.hirion.safehouse.detail.safehouse', JSON.stringify('{ACAD}'))")
        await N.open_pack(page)
        share = await page.evaluate("window.__crion.S.play.work.url")
        # 문을 여는 중(막힘) 앞 작품 화면 신호 → 무시돼야
        await page.evaluate("window.__crion.S.play.gate = true; window.__crion.S.play.shareLoad = true")
        await N.st(page, {'page': 'detail', 'url': ACAD, 'actions': [N.NEW]})
        await page.evaluate("window.__loads = []")
        await page.evaluate("(()=>{const b=document.createElement('button');b.dataset.sh='t-new';document.querySelector('.sh').appendChild(b);b.click();b.remove();})()"); await page.wait_for_timeout(200)
        l1 = await page.evaluate("window.__loads.slice()")
        print('1) 처음 시작이 연 주소:', l1, '(공유 링크:', share, ')')
        if l1 != [share]: fails.append('1 ' + str(l1))
        # 공유 링크가 열린 뒤 첫 작품 화면 = 이 작품
        await page.evaluate("""(()=>{const w=document.querySelector('#crack');w.dispatchEvent(new Event('dom-ready'));})()""")
        await N.st(page, {'page': 'detail', 'url': DETAIL, 'actions': [N.NEW]}); await page.wait_for_timeout(150)
        kept = await page.evaluate("localStorage.getItem('crion.detail.safehouse')")
        print('2) 기억한 작품 화면:', kept)
        if kept != DETAIL: fails.append('2 ' + str(kept))
        # 다시 처음 시작 → 기억한 작품 화면
        await page.evaluate("window.__pk.state.mode='title'; window.__loads = []")
        await page.evaluate("(()=>{const b=document.createElement('button');b.dataset.sh='t-new';document.querySelector('.sh').appendChild(b);b.click();b.remove();})()"); await page.wait_for_timeout(200)
        l2 = await page.evaluate("window.__loads.slice()")
        print('3) 두 번째 처음 시작:', l2)
        if l2 != [DETAIL]: fails.append('3 ' + str(l2))
        # 막힌 동안(새 주소 여는 중) 온 다른 작품 화면은 기억 안 함
        await N.st(page, {'page': 'detail', 'url': ACAD, 'actions': [N.NEW]}); await page.wait_for_timeout(100)
        k2 = await page.evaluate("localStorage.getItem('crion.detail.safehouse')")
        if k2 != DETAIL: fails.append('4 ' + str(k2))
        await b.close()
    print('\n오류:', errs or '없음', '/ 실패:', fails or '없음')
    sys.exit(1 if fails or errs else 0)

asyncio.run(main())
