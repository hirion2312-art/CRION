# 「아포칼립스 안전지대의 관리자」 BGM 프롬프트 (16곡)

음악 AI(Suno 등)에 넣는 스타일 문구. 모두 **연주곡(Instrumental 켜기)**, 2~3분, 처음과 끝이 이어지게(루프).
만든 mp3는 아래 **파일 이름**으로 저장해 보내 주면 `packs/hirion.safehouse/assets/bgm/`에 넣고 장면에 연결한다.
(지금 안전지대 실행기에는 음악 기능이 아직 없다 → 곡이 들어오면 아카데미처럼 `bgm`·`bgmByLoc` 방식으로 추가)

공통 꼬리말(각 프롬프트 끝에 붙여도 됨): `instrumental, no vocals, seamless loop, game soundtrack`

| # | 파일 이름 | 언제 | 연결할 크랙 그림·상황 |
|---|---|---|---|
| 1 | title.mp3 | 타이틀·세이브 화면 | — |
| 2 | morning.mp3 | 로비 · 아침 | 상태창 시간대 아침 |
| 3 | day.mp3 | 로비 · 낮 | 낮 |
| 4 | evening.mp3 | 로비 · 저녁, 식당 | 저녁, `식당` |
| 5 | night.mp3 | 로비 · 밤 | 밤, `빌라밤` |
| 6 | rollcall.mp3 | 아침점호 카드 | 날짜 바뀜 |
| 7 | visitor.mp3 | 철문 방문자·면접 | `철문`, `계단`, 대기 인원 있음 |
| 8 | outside.mp3 | 근거리 파견·바깥 | `편의점`, `해령시`, `봉쇄선` |
| 9 | deepzone.mp3 | 원거리·미지 구역 | 바이오센터·지하철 등 미지 |
| 10 | wave.mp3 | 웨이브·습격 | `빌라웨이브` |
| 11 | fall.mp3 | 함락·사망·이별 | `빌라함락`, 📦 사망·전환 |
| 12 | rooftop.mp3 | 옥상 | `옥상`, `옥상밤`, `해령시밤` |
| 13 | lab.mp3 | 연구실·의무실·격리실·발전기실 | `연구실`, `의무실`, `격리실`, `발전기실` |
| 14 | raiders.mp3 | 약탈자 「검은 비」 | 약탈자·검은 비 언급 |
| 15 | hope.mp3 | 입주·생환·잔치 | 📦 입주·귀환, 잔치 |
| 16 | ending.mp3 | D100 엔딩 | D100 |

## 프롬프트

1. title.mp3 — 메인 테마
```
cinematic post-apocalyptic main theme, slow melancholic solo piano, low cello swells, faint radio static texture, distant wind, hopeful major-key turn at the end, sparse and lonely, 70 bpm
```

2. morning.mp3 — 아침 로비
```
quiet post-apocalyptic morning, warm fingerpicked acoustic guitar, soft felt piano, light ambient pad, cautious hope, gentle and unhurried, 80 bpm
```

3. day.mp3 — 낮 로비 (일과)
```
lo-fi survival daily life, muted electric piano, brushed drums, warm bass, light tape hiss, focused and steady, small chores in a fortified apartment, 88 bpm
```

4. evening.mp3 — 저녁·식당
```
cozy evening meal in a shelter, upright piano and music box, soft string quartet, warm and bittersweet, quiet gratitude, campfire feeling, 76 bpm
```

5. night.mp3 — 밤 로비
```
dark ambient night, low drone pads, slow heartbeat-like sub pulse, sparse detuned piano notes, distant metallic creaks, uneasy and tense but quiet, 60 bpm
```

6. rollcall.mp3 — 아침점호
```
short morning roll call cue, light military snare, steady low piano chords, resolute and sober, a new day of survival begins, 90 bpm
```

7. visitor.mp3 — 철문 방문자·면접
```
suspenseful minimal interrogation music, plucked pizzicato strings, ticking clock percussion, soft low synth, mysterious and wary, who can you trust, 84 bpm
```

8. outside.mp3 — 근거리 파견
```
stealth scavenging in an abandoned city, pulsing analog synth arpeggio, muffled percussion, tense low strings, careful footsteps feeling, rising danger, 100 bpm
```

9. deepzone.mp3 — 원거리·미지 구역
```
eerie industrial horror ambience, abandoned bio research facility, metallic scrapes, deep sub drones, glitchy electronic textures, dissonant string clusters, oppressive dread, 70 bpm
```

10. wave.mp3 — 웨이브·습격
```
intense zombie horde siege, heavy taiko and industrial drums, distorted cello ostinato, aggressive brass stabs, relentless and frantic, defending the barricade, 140 bpm
```

11. fall.mp3 — 함락·사망·이별
```
sorrowful elegy, solo cello and soft piano, slow and heavy grief, sparse reverb, losing someone in the apocalypse, quiet and devastating, 58 bpm
```

12. rooftop.mp3 — 옥상
```
lonely rooftop at dusk over a ruined port city, ambient electric guitar with long reverb, soft wind texture, wide atmospheric pads, reflective and nostalgic, 72 bpm
```

13. lab.mp3 — 연구실·의무실·발전기실
```
clinical underground lab ambience, soft electrical hum, glassy synth tones, slow minimal piano, sterile and curious, faint generator rhythm, 75 bpm
```

14. raiders.mp3 — 약탈자 「검은 비」
```
menacing raider gang theme, dark trap-influenced beat, low distorted bass, ominous brass, gritty and threatening, rain-soaked tension, 85 bpm
```

15. hope.mp3 — 입주·생환·잔치
```
uplifting survivor community theme, warm acoustic guitar and piano, gentle strings building, soft hand claps, small victory and togetherness, hopeful major key, 96 bpm
```

16. ending.mp3 — D100 엔딩
```
emotional orchestral finale, sunrise after 100 days of survival, full strings and piano, swelling choir pad without lyrics, rescue helicopters far away, tears and relief, 74 bpm
```

## 만들 때 팁
- 같은 곡을 2~3번 뽑아서 **처음 10초가 조용히 시작하는 것**을 고르면 장면이 바뀔 때 덜 튀어요.
- 웨이브·약탈자는 너무 시끄러우면 대사 읽기가 힘들어요. 둘 다 뽑아서 덜 시끄러운 쪽을 골라 주세요.
- 먼저 1~5번(타이틀 + 시간대 4곡)만 있어도 팩에 넣을 수 있어요. 나머지는 생기는 대로 추가.
