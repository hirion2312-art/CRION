# 프롤로그 웹툰 컷(1080x3000 세로 5장)에서 그림만 잘라 assets/pro/*.webp 로 저장
#  python3 crop_prologue.py <웹툰1> <웹툰2> <웹툰3> <웹툰4> <웹툰5> <출력폴더>
#  말풍선 상자가 그림에 걸치는 곳은 상자 위에서 끊었다(문장은 data.json prologue.shots 의 자막으로 다시 씀)
#  잘라낼 자리는 줄마다 색 편차(std>40)로 그림 구간을 찾은 뒤 눈으로 맞춘 값
import sys
import numpy as np
from PIL import Image
*src, out = sys.argv[1:]
P = [Image.open(f).convert('RGB') for f in src]
g = np.array(P[0]).astype(int)
gate_top = next(y for y in range(2300, 2420) if g[y, 400:1080].std() > 30)
C = {'castle': (0, (0, 485, 1080, 1110)), 'gate': (0, (0, gate_top, 1080, 3000)),
     'stars': (1, (0, 30, 1080, 682)), 'girl': (1, (0, 1040, 1080, 1470)),
     'five': (3, (0, 55, 1080, 590)),
     'blue': (3, (49, 909, 622, 1282)), 'green': (3, (112, 1309, 377, 1781)), 'red': (3, (409, 1309, 1001, 1582)),
     'purple': (3, (409, 1609, 658, 2006)), 'gold': (3, (676, 1609, 1042, 2119)),
     'city': (4, (0, 929, 1080, 1566)), 'room': (4, (0, 2040, 1080, 2535))}
for k, (i, b) in C.items():
    P[i].crop(b).save(f'{out.rstrip("/")}/{k}.webp', 'WEBP', quality=84)
    print(k, b)
