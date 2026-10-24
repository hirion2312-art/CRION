# 테스트 화면용 임시 그림 (실제 에셋이 아님): 배경·입화·CG 몇 장
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, random
OUT = os.path.join(os.path.dirname(__file__), 'game', 'assets')
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def font(sz): return ImageFont.truetype(FONT, sz, index=2) if os.path.exists(FONT) else ImageFont.load_default()
random.seed(7)

def bg(name, top, bottom, label, extra=None):
    W,H = 1600,900
    im = Image.new('RGB',(W,H),top); d = ImageDraw.Draw(im)
    for y in range(H):
        t=y/H; c=tuple(int(top[i]*(1-t)+bottom[i]*t) for i in range(3)); d.line([(0,y),(W,y)],fill=c)
    if extra: extra(d,W,H)
    d.text((40,H-80),label,font=font(46),fill=(255,255,255,200))
    im.save(f'{OUT}/bg_{name}.webp', quality=80)

def dorm(d,W,H):
    d.rectangle([0,int(H*.68),W,H],fill=(120,82,52)); d.rectangle([180,160,520,520],fill=(230,214,170)); d.rectangle([210,190,490,490],fill=(150,200,235))
    d.rectangle([1000,300,1500,640],fill=(160,92,60)); d.ellipse([1120,200,1380,330],fill=(255,220,150))
def night(d,W,H):
    for _ in range(120):
        x,y=random.randint(0,W),random.randint(0,int(H*.6)); d.ellipse([x,y,x+3,y+3],fill=(255,255,230))
    d.ellipse([1200,100,1320,220],fill=(245,240,210)); d.rectangle([0,int(H*.72),W,H],fill=(20,22,50))
def field(d,W,H):
    d.rectangle([0,int(H*.66),W,H],fill=(86,140,70))
    for x in (260,820,1280):
        d.rectangle([x,300,x+26,int(H*.7)],fill=(235,230,215))
        for a in range(4): d.polygon([(x+13,300),(x+13+200,300-80+a*80),(x+13+180,300-40+a*80)],fill=(200,170,120))
def crisis(d,W,H):
    field(d,W,H); d.rectangle([0,0,W,H],fill=(80,0,10,)); 
def hall(d,W,H):
    d.rectangle([0,int(H*.7),W,H],fill=(130,100,70))
    for x in range(120,W,300): d.rectangle([x,260,x+90,int(H*.7)],fill=(190,160,110))

bg('기숙사',(240,214,170),(190,150,110),'기숙사',dorm)
bg('기숙사_밤',(30,36,90),(14,16,44),'기숙사 · 밤',lambda d,W,H:(night(d,W,H),dorm(d,W,H)))
bg('학생식당',(255,226,170),(200,150,100),'학생식당',hall)
bg('학생식당_저녁',(255,160,90),(120,70,90),'학생식당 · 저녁',hall)
bg('소환의제단',(60,60,130),(20,18,60),'소환의 제단',hall)
bg('야생지대',(150,200,235),(70,130,70),'야생지대',field)
bg('야생지대_위기',(160,60,60),(40,10,20),'야생지대 · 위기',field)

def sprite(name, face, color, hair):
    W,H = 520,900
    im = Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle([110,360,410,880],radius=80,fill=color)
    d.ellipse([150,60,370,330],fill=(250,226,200)); d.pieslice([140,40,380,300],180,360,fill=hair); d.rectangle([140,150,162,330],fill=hair); d.rectangle([358,150,380,330],fill=hair)
    ey=205
    if face=='웃음':
        d.arc([190,ey-14,240,ey+22],200,340,fill=(60,40,40),width=6); d.arc([280,ey-14,330,ey+22],200,340,fill=(60,40,40),width=6); d.arc([215,235,305,300],20,160,fill=(160,60,60),width=7)
    elif face=='엄격':
        d.line([190,ey-10,240,ey],fill=(60,40,40),width=7); d.line([280,ey,330,ey-10],fill=(60,40,40),width=7); d.line([220,275,300,275],fill=(160,60,60),width=7)
    else:
        d.ellipse([200,ey-10,230,ey+16],fill=(60,40,40)); d.ellipse([290,ey-10,320,ey+16],fill=(60,40,40)); d.line([225,270,295,270],fill=(160,60,60),width=6)
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    im.save(f'{OUT}/sp_{name}_{face}.png')
sprite('마가렛','기본',(70,60,120),(90,50,50)); sprite('마가렛','엄격',(70,60,120),(90,50,50))
sprite('레이먼드','기본',(60,110,150),(40,40,60)); sprite('브루노','웃음',(170,90,60),(160,90,40)); sprite('세라','기본',(200,120,150),(200,170,90))

im=Image.new('RGB',(1600,900),(40,30,90)); d=ImageDraw.Draw(im)
for r in range(380,20,-24): d.ellipse([800-r,450-r,800+r,450+r],outline=(240,210,138),width=3)
d.text((560,420),'소환 CG (임시)',font=font(80),fill=(255,244,200)); im.save(f'{OUT}/cg_summon.webp',quality=80)

def ico(name,color,txt):
    im=Image.new('RGBA',(128,128),(0,0,0,0)); d=ImageDraw.Draw(im); d.ellipse([8,8,120,120],fill=color,outline=(80,60,20),width=5); d.text((64,62),txt,font=font(48),fill=(60,40,10),anchor='mm'); im.save(f'{OUT}/ic_{name}.png')
ico('silver',(215,220,230),'은'); ico('copper',(205,140,90),'동'); ico('dorm_sun',(255,220,120),'해')
# 위카 그림(크랙이 보여 준 그림 흉내)
im=Image.new('RGB',(512,512),(255,225,190)); d=ImageDraw.Draw(im); d.ellipse([120,140,392,420],fill=(255,150,80)); d.ellipse([200,230,250,280],fill=(40,30,30)); d.ellipse([290,230,340,280],fill=(40,30,30)); d.polygon([(256,40),(300,150),(212,150)],fill=(255,90,40)); im.save(f'{OUT}/wika.png')
print(sorted(os.listdir(OUT)))
