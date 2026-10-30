# data.json 처음 만들 때 쓴 스크립트 (인물·장소·단축어·엔딩·그림 주소표). 주의: 지금 data.json 에는 이후 손으로 넣은 prologue(연출 장면) 칸이 있으니
#  다시 돌리면 prologue 를 덮어쓴다 → 다시 돌릴 땐 기존 data.json 의 prologue 를 옮겨 붙일 것
import json, re
M='/home/claude/CRION/materials/magical-girl-final-boss/'
imgs={}
for line in open(M+'image_urls.txt',encoding='utf-8'):
    line=line.strip()
    if ' | ' not in line: continue
    n,u=line.split(' | ',1); imgs[n.strip()]=u.strip()
sc={}
txt=open(M+'prompts/shortcuts.txt',encoding='utf-8').read()
for m in re.finditer(r'\[단축어 (/\S+)\][^\n]*설명\(\d+/\d+\):\s*([^\n]*)\n본문\(\d+/\d+\):\n(.*?)(?=\n\n\[단축어|\Z)', txt, re.S):
    sc[m.group(1)]={'desc':m.group(2).strip(),'body':m.group(3).strip()}
print(list(sc))
data={
 'version':1,
 'title':'마법소녀의 최종보스',
 'oseong':[
  {'name':'서하린','key':'하린','age':29,'power':'군림','job':'협회 대표 얼굴 · 광고·예능 MC','look':'다정하고 책임감 강한 완벽주의자. 부드러운 존댓말','color':'#7fb7ff','route':'예능국 AD · 협회 파견 로드매니저'},
  {'name':'한세라','key':'세라','age':32,'power':'파쇄','job':'액션 배우 · 협회 토벌대 에이스','look':'무뚝뚝하고 직설적인 츤데레','color':'#ff7a7a','route':'액션/스턴트 보조'},
  {'name':'윤채아','key':'채아','age':28,'power':'환영','job':'예능 인기인 · SNS 스타','look':'밝고 장난기 많고 눈치가 빠르다','color':'#ffb36b','route':'예능국 AD'},
  {'name':'백설아','key':'설아','age':31,'power':'심연','job':'음악방송 · OST 가수','look':'담담하고 시적인 관찰자. 조용한 존댓말','color':'#b9a6ff','route':'음악방송 스태프'},
  {'name':'오하나','key':'하나','age':30,'power':'재생','job':'드라마 배우','look':'따뜻하고 순진하며 남을 잘 믿는다. 다정한 존댓말','color':'#8fe0b0','route':'드라마/영화 세트 스태프'}
 ],
 'kanbu':[
  {'name':'세이렌','role':'집사장','job':'새벽 식당 설거지·청소','look':'정중하고 애틋하다. “폐하”','part':'마왕의 컨디션 · 과거 이야기','color':'#d7b4ff'},
  {'name':'바르크','role':'군단장','job':'건설 현장 일용직','look':'쾌활하고 털털하다. “폐하”','part':'전투 조언 · 훈련','color':'#ffb07a'},
  {'name':'리제','role':'참모','job':'편의점·콜센터 야간 알바','look':'무뚝뚝·계산적, 돈에 집착, 다이소 애용. “마왕님”','part':'자금 · 위장 서류','color':'#9fd3ff'},
  {'name':'모르페','role':'마력 연구관','job':'고물상 수리','look':'느긋하지만 가장 똑똑하다. 리제에게 잔소리를 듣는다','part':'권능 분석 · 마력 연구','color':'#a7e3c4'},
  {'name':'노엘','role':'첩보관','job':'배달 앱 라이더','look':'밝고 명랑하며 발이 빠르다','part':'정보 수집 · 오성 일정','color':'#ffe08a'}
 ],
 'extra':[{'name':'협회장','role':'마법소녀 협회장'},{'name':'방송국 면접관','role':'방송국'}],
 'powers':[['군림','서하린','마족 군세 소환·지휘'],['파쇄','한세라','파괴력·전투 마력'],['환영','윤채아','인지 조작·변신·허상'],['심연','백설아','공간의 틈과 게이트 연결'],['재생','오하나','치유·생명력']],
 'stages':[[0,'적대·경계'],[20,'무관심·거리두기'],[40,'호의·친근'],[60,'신뢰'],[80,'깊은 유대']],
 'places':{
  '허름한 반지하':['반지하','원룸','지하동','본거지','마왕군 아지트'],
  '도심':['도심','거리','시내','번화가','광장','현장','골목'],
  '방송국로비':['방송국 로비','로비','방송국 예능국','방송국','예능국','면접'],
  '스튜디오':['스튜디오','촬영장','세트장','녹화','무대','대기실','음악방송'],
  '협회':['협회 본부','협회 건물','마법소녀 협회','협회'],
  '협회지하':['지하 시설','지하시설','협회 지하','격리 구역'],
  '협회집무실':['집무실','협회장실']
 },
 'shortcuts':[{'key':k,'desc':v['desc'],'body':v['body']} for k,v in sc.items()],
 'endings':[
  {'name':'되찾은 왕국','grade':'N','hint':'힘은 되찾았지만, 진실은 아직'},
  {'name':'다섯별의 마왕','grade':'R','hint':'모든 것을 사랑으로 되찾다'},
  {'name':'타락한 오성','grade':'R','hint':'모든 것을 무너뜨리고 되찾다'},
  {'name':'제압된 별들','grade':'R','hint':'힘으로 모든 것을 되찾다'},
  {'name':'그림자 왕국의 진실','grade':'SR','hint':'별과 그림자, 같은 방향을 보다'}
 ],
 'endingFrom':30,
 'tips':[
  '권능은 사랑·흑화·전투 세 가지 방법으로 되찾을 수 있어요. 전투는 권능 3개를 되찾은 뒤부터예요.',
  '호감도와 마음의 균열은 서로 따로 움직여요.',
  '정체 발각 위험이 100이 되면 위기가 찾아와요. 마왕은 죽지 않지만 신분을 다시 만들어야 할 수도 있어요.',
  '간부들에게 자주 말을 걸어 보세요. 「간부보고」로 한 번에 들을 수도 있어요.',
  'AI가 내 대사를 대신 쓰면 「사칭금지」를 눌러 보세요.',
  '방송국 면접에서는 내 재능을 자유롭게 적어요. 떨어져도 다른 직군으로 다시 도전할 수 있어요.',
  '엔딩은 30턴부터 볼 수 있어요.',
  '위쪽 ⋯ 메뉴에서 언제든 크랙 원래 화면을 볼 수 있어요.'
 ],
 'hideImgs':['성행위1_오하나'],
 'imgs':imgs
}
json.dump(data,open('/home/claude/CRION/packs/hirion.magical-boss/data.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(imgs), len(data['shortcuts']))
