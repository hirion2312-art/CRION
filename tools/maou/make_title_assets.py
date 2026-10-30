# 「마법소녀의 최종보스」 타이틀 그림을 PC 16:9 · 폰 세로 비율로 다시 짜기
#  python3 make_title_assets.py <PC원본(가로 2040x950).png> <폰원본(세로 1080x1620).webp> <출력폴더>
#  PC: 인물 영역(x 990~)을 높이에 맞춰 오른쪽 + 흰 바탕 위 검은 제목을 밝기→알파로 떼어 왼쪽 흰 여백 가운데에 다시 앉힘
#  폰: 원본 그대로 + 원본 아래 끝색(#020202)으로 바닥을 늘려 1080x2340 (버튼은 그 바닥에)
import sys
import numpy as np
from PIL import Image
pc_src, m_src, out = sys.argv[1], sys.argv[2], sys.argv[3].rstrip('/')
A = Image.open(pc_src).convert('RGB'); B = Image.open(m_src).convert('RGB')
W, H = 1920, 1080
cv = Image.new('RGB', (W, H), (255, 255, 255))
g = A.crop((990, 0, A.width, A.height)); s = H / A.height
g = g.resize((round(g.width * s), H), Image.LANCZOS); gx = W - g.width; cv.paste(g, (gx, 0))
t = A.crop((60, 290, 990, 630)).convert('L'); a = np.array(t).astype(float)
alpha = np.clip((255 - a) * 1.15, 0, 255).astype('uint8')
ys, xs = np.where(alpha > 40)
tl = Image.new('RGBA', t.size, (10, 8, 12, 0)); tl.putalpha(Image.fromarray(alpha)); tl = tl.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
tw = 640; th = round(tl.height * tw / tl.width); tl = tl.resize((tw, th), Image.LANCZOS)
cx = round((gx + (1040 - 990) * s) / 2); ty = 300
cv.paste(tl, (cx - tw // 2, ty), tl)
cv.save(out + '/title_pc.webp', 'WEBP', quality=90)
print('PC 제목 자리(그림 비율):', (cx - tw // 2) / W, (cx + tw // 2) / W, ty / H, (ty + th) / H)
M = Image.new('RGB', (1080, 2340), tuple(int(v) for v in np.array(B)[-3:].reshape(-1, 3).mean(0))); M.paste(B, (0, 0))
M.save(out + '/title_m.webp', 'WEBP', quality=88)
