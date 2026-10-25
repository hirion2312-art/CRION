// 소환수 아카데미+ · 입학 등록 → 학생증 발급 → 소환 의식 → 결과 보내기 (입학 사이트를 클라이언트 안으로 옮김)
//  - 원본: 프로젝트 「게임제작」 소환수아카데미/08_입학사이트/index.html (데이터·확률·결과 글 형식 그대로)
//  - 결과 글은 크랙 첫 메시지로 그대로 쓰는 형식 → 플레이어가 '보내기'를 한 번 누를 때만 한 번 보낸다
(function (root) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TC = { 화: '#ff8a4c', 수: '#4cc3ff', 풍: '#7fe0b4', 지: '#d4a15a', 빛: '#ffe28a', 어둠: '#b48cff', 무: '#d6d6e6' };
  const DORM = { 화: '해', 빛: '해', 풍: '해', 수: '달', 어둠: '달', 지: '별', 무: '별' };
  const ORIGINS = {
    '아우스트라 왕국': '중앙 평원의 대륙 최대 국가. 귀족 소환사 가문이 많고 서열 의식이 강하다.',
    '실바렌 숲연방': "서부 대삼림. 소환수를 '숲의 손님'으로 대하는 오래된 숲 부족의 나라.",
    '그라움 산악국': '북부 산맥의 장인 국가. 기술 공방 교수진 대부분이 이곳 출신이다.',
    '드라칸 화산령': '남부 화산대의 무인 가문들. 에테르나 컵 우승을 국가의 명예로 여긴다.',
    '마레니아 해상연합': '동부 군도의 항구 상인들. 섬을 오가는 은빛 갈매기호를 운항한다.',
    '와일드런 부족연합': "동북 초원의 유목 부족. 계약보다 '함께 사냥하는 동료' 문화가 강하다.",
    '노크티스 밤의 공국': '북서 황혼지대. 어둠 속성 소환사 가문이 많아 은근한 편견을 받는다.'
  };
  const B = (n, t, g, race, role, base, trait, per, line, sk) => ({ n, t, g, race, role, base, trait, per, line, sk });
  const BEASTS = [
    B('위카', '화', 'f', '촛불족', '지원형', [70, 45, 70, 85, 100, 70], '머리 위 불꽃이 감정에 따라 색이 바뀌고, 촛농으로 상처를 덮어 응급 치료를 한다.', '겁 많은 울보. 울면 촛농이 흐른다.', '히, 히익…! 저, 저를 불러 주신 거예요? 열, 열심히… 할게요!', [['촛불 점화', '💫40', '15', '화상 10%'], ['촛농 붕대', '✨', '5', 'HP 25% 회복']]),
    B('플린트', '화', 'm', '화덕도마뱀족', '공격형', [65, 110, 80, 45, 55, 85], '꼬리 불로 금속을 달궈 동료의 장비를 잠시 강화한다.', '무뚝뚝한 일벌레인데 칭찬에 약하다.', '…뭘 봐. 소환했으면 일이나 시켜.', [['불씨 망치', '⚔️45', '15', '화상 10%'], ['달군 비늘', '✨', '10', '방어 +1']]),
    B('플립', '수', 'f', '샘물정령족', '지원형', [75, 45, 70, 80, 100, 70], '아카데미 분수에서 태어났다. 물로 치유하고 잠시 투명해질 수 있다.', '교내 소문을 다 꿰는 수다쟁이.', '와, 드디어! 있잖아, 너 이름 뭐야? 기숙사는? 아 잠깐, 나부터 소개할게!', [['물방울 튀기기', '💫40', '15', ''], ['맑은 샘', '✨', '5', 'HP 30% 회복']]),
    B('오토', '수', 'm', '수달족', '속도형', [60, 95, 60, 50, 60, 115], '물속 잠행에 능하고, 반짝이는 조개와 돌을 모은다.', '못 말리는 장난꾸러기.', '헤헷, 반짝이는 거 있어? 없어? 그럼 같이 찾으러 가자!', [['물살 박치기', '⚔️40', '15', '선공'], ['조개 던지기', '⚔️25×2', '10', '2회 공격']]),
    B('퀼라', '풍', 'f', '전령새족', '속도형', [55, 60, 55, 95, 60, 120], '아카데미 우편 담당 종족. 초고속 비행과 바람 칼날을 쓴다.', '늘 덜렁대는 배달부.', '배달 왔습니다~! 앗, 편지가 아니라 제가 배달된 거구나!', [['바람 칼날', '💫40', '15', ''], ['속달', '✨', '8', '속도 +1']]),
    B('월리', '풍', 'm', '풍차정령족', '균형형', [70, 85, 80, 70, 70, 75], '등의 날개바퀴로 바람을 모아 증폭한다.', '산만한 낙천가.', '와아, 바람 좋다! 우리 어디 갈까? 저기? 아니 저기!', [['회전 바람', '⚔️40', '15', ''], ['순풍', '✨', '8', '아군 속도 +1']]),
    B('퍼프캡', '지', 'f', '버섯족', '지원형', [80, 50, 80, 80, 95, 55], '포자로 잠재우거나 회복시키고, 땅속 균사로 먼 곳의 정보를 읽는다.', '늘 졸린 은둔형.', '…으음. 소환된 거야? …조금만 더 자고 시작하면 안 돼?', [['포자 뿌리기', '💫35', '15', '수면 15%'], ['회복 포자', '✨', '8', 'HP 25% 회복']]),
    B('펩스', '지', 'm', '성벽골렘족', '방어형', [80, 85, 125, 35, 80, 35], '몸의 돌을 재조립해 방벽을 쌓는다. 방어는 최고.', '고지식한 원칙주의자.', '계약자 확인. 규정에 따라 지금부터 당신을 수호하겠습니다.', [['돌주먹', '⚔️40', '15', ''], ['벽돌 쌓기', '✨', '8', '방어 +2']]),
    B('샤디', '빛', 'f', '채색유리족', '특공형', [60, 45, 65, 110, 85, 80], '몸에 스테인드글라스 무늬가 있고, 빛을 여러 색으로 쪼개 쓴다.', '낭만적인 몽상가.', '빛이 이렇게 많은 색으로 쏟아지다니… 운명적인 만남이네요!', [['색유리 빛', '💫40', '15', ''], ['분광', '✨', '8', '무작위 능력 +1']]),
    B('뱃시', '어둠', 'f', '종탑박쥐족', '속도형', [60, 85, 55, 70, 60, 120], '초음파로 주변을 탐지하고 어둠 속에서도 잘 본다.', '낮엔 잠꾸러기, 밤엔 하이텐션.', '후아암… 낮이잖아… 밤 되면 엄청 놀아 줄게… 쿨…', [['흡혈 깨물기', '⚔️40', '15', '준 피해 절반 회복'], ['초음파', '✨', '8', '혼란 30%']]),
    B('코르비', '어둠', 'm', '까마귀족', '균형형', [65, 90, 65, 80, 65, 90], '반짝이는 것을 모으고 정보를 훔치며, 깃털을 던진다.', '시니컬한 독설가.', '흥, 하필 너냐. …뭐, 반짝이는 거 몇 개 주면 따라가 줄게.', [['깃털 투척', '⚔️40', '15', ''], ['훔쳐보기', '✨', '5', '다음 공격 위력 +50%']]),
    B('램비', '무', 'f', '양족', '방어형', [85, 60, 100, 55, 100, 45], '양털 쿠션으로 막고 재운다. 기숙사 관리에 특화되어 있다.', '모두를 챙기는 잔소리꾼.', '어머, 손이 차갑잖아! 밥은 먹었니? 이제부터 내가 챙길 거야.', [['털뭉치 박치기', '⚔️40', '15', ''], ['자장가', '✨', '5', '수면 40%']]),
    B('스퀴키', '무', 'f', '열쇠쥐족', '속도형', [55, 90, 55, 55, 60, 125], '어떤 자물쇠든 열고 숨겨진 물건을 찾아낸다.', '겁 많은 수집광.', '찍, 찌익…! 무, 무서운 사람 아니죠? …그 열쇠 예쁘다.', [['앞니 깨물기', '⚔️40', '15', '선공'], ['해제', '✨', '8', '상태이상·능력 하락 해제']])
  ];
  const TRAITS = ['신중한', '열혈', '다정한', '냉철한', '장난기', '노력파', '느긋한', '호기심', '자존심', '겁쟁이', '리더형', '독서광'];
  const WISHES = [['화', '따뜻한 불꽃'], ['수', '맑은 물결'], ['풍', '자유로운 바람'], ['지', '단단한 대지'], ['빛', '눈부신 빛'], ['어둠', '고요한 밤'], ['무', '포근한 일상'], ['', '운명에 맡김']];
  const stats = (b) => { const r = b.base, L = 5; return { HP: r[0] * 2 + L * 5, 공격: r[1] + L * 2, 방어: r[2] + L * 2, 특공: r[3] + L * 2, 특방: r[4] + L * 2, 속도: r[5] + L * 2 }; };
  function pick(p) {
    const g = p.gender, female = BEASTS.filter(b => b.g === 'f'), male = BEASTS.filter(b => b.g === 'm');
    const w = BEASTS.map(b => {
      let v = 1;
      if (g === 'm') v = b.g === 'f' ? 80 / female.length : 20 / male.length;
      else if (g === 'f') v = b.g === 'm' ? 70 / male.length : 30 / female.length;
      if (p.wish && b.t === p.wish) v *= 1.5;
      return v;
    });
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < BEASTS.length; i++) { r -= w[i]; if (r <= 0) return BEASTS[i]; }
    return BEASTS[BEASTS.length - 1];
  }
  function block(S) {
    const p = S.p, b = S.beast, st = stats(b);
    const g = { m: '남성', f: '여성', x: '밝히지 않음' }[p.gender];
    return `[에테르나 소환 아카데미 | 입학 등록 결과]
이름: ${p.name}
나이: ${p.age}
성별: ${g}
출신: ${p.origin}
외형: ${p.look || '-'}
성격: ${p.traits.join(', ') || '-'}
자기소개: ${p.intro || '-'}
학번: ${S.id} · 입학 협약력 301년 봄
기숙사: ${S.dorm}의 동
파트너: ${b.n} (${b.t}·일반·${b.race}${b.g === 'f' ? '♀' : '♂'}·${b.role}) Lv 5 · XP 0/20
스탯: HP ${st.HP}/${st.HP} · 공 ${st.공격} · 방 ${st.방어} · 특공 ${st.특공} · 특방 ${st.특방} · 속 ${st.속도}
고유기: ${b.sk.map(s => `${s[0]}(${s[1]}|${s[2]}/${s[2]})${s[3] ? ' ' + s[3] : ''}`).join(' / ')}
첫 대사: "${b.line}"`;
  }

  // o: { host(요소), img(이름) → 주소, send(text) → bool, toast, bgm(id), fx([…]), onSent(S), onClose(), saved }
  function open(o) {
    const S = o.saved && o.saved.beast ? o.saved : { p: { name: '', age: '', gender: '', origin: '', look: '', traits: [], wish: '', intro: '' }, id: '', beast: null, dorm: '' };
    if (S.beast && typeof S.beast === 'string') S.beast = BEASTS.find(b => b.n === S.beast) || null;
    const host = o.host;
    host.classList.add('akr');
    const steps = ['입학 등록', '학생증 발급', '소환 의식', '계약 완료'];
    const frame = (n, body) => `<div class="akr-box"><div class="akr-top"><b>🎓 에테르나 입학 소환청</b><ol>${steps.map((s, i) => `<li class="${i === n ? 'on' : i < n ? 'done' : ''}">${['I', 'II', 'III', 'IV'][i]} · ${s}</li>`).join('')}</ol><button class="akr-x" data-r="close" title="나중에 할게요">✕</button></div><div class="akr-body">${body}</div></div>`;
    const card = (b) => `<button class="akr-mon" data-r="mon" data-n="${b.n}" style="--tc:${TC[b.t]}"><span class="im" style="background-image:url('${o.img(b.n)}')"></span><b>${b.n}</b><em>${b.t} · ${b.role}</em></button>`;
    let monSel = '';
    function monInfo(b) {
      if (!b) return '<p class="akr-hint">후보를 눌러 보면 성격과 고유기를 볼 수 있어요. 결과는 제단이 정합니다.</p>';
      const st = stats(b);
      return `<div class="akr-moninfo" style="--tc:${TC[b.t]}"><b>${b.n}</b> <em>${b.race} ${b.g === 'f' ? '♀' : '♂'} · ${b.t} · ${b.role}</em><p>${esc(b.trait)}</p><p class="akr-line">“${esc(b.line)}”</p>
        <div class="akr-st">${Object.entries(st).map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('')}</div>
        <div class="akr-sk">${b.sk.map(s => `<span>${s[0]} <i>${s[1]} | ${s[2]}회${s[3] ? ' · ' + s[3] : ''}</i></span>`).join('')}</div></div>`;
    }
    function regForm() {
      const p = S.p;
      host.innerHTML = frame(0, `<div class="akr-reg">
        <form class="akr-sheet" onsubmit="return false">
          <h3>입학 등록서</h3><p class="akr-hint">학생증에 들어갈 정보예요. 필수만 채우면 됩니다.</p>
          <div class="akr-grid">
            <label>성명 <em>필수</em><input id="rName" maxlength="16" placeholder="예: 아린" value="${esc(p.name)}"></label>
            <label>나이 <em>필수 · 19세 이상</em><input id="rAge" type="number" min="19" max="99" placeholder="19" value="${esc(p.age)}"></label>
            <div class="full"><span>성별 <em>필수</em></span><div class="akr-seg" id="rGender">${[['m', '남성'], ['f', '여성'], ['x', '밝히지 않음']].map(([v, t]) => `<button type="button" data-r="g" data-v="${v}" class="${p.gender === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
            <label class="full">출신 <em>필수</em><select id="rOrigin"><option value="">출신 지역을 고르세요</option>${Object.keys(ORIGINS).map(x => `<option ${p.origin === x ? 'selected' : ''}>${x}</option>`).join('')}</select><small id="rOnote">${esc(ORIGINS[p.origin] || '출신에 따라 동기들의 첫인상이 조금씩 달라집니다.')}</small></label>
            <label class="full">외형 <em>선택</em><input id="rLook" maxlength="60" placeholder="예: 짧은 흑발, 회색 눈, 큰 키" value="${esc(p.look)}"></label>
            <div class="full"><span>성격 <em>최대 3개</em></span><div class="akr-chips">${TRAITS.map(t => `<button type="button" data-r="t" class="${p.traits.includes(t) ? 'on' : ''}">${t}</button>`).join('')}</div></div>
            <div class="full"><span>소환진에 품을 마음 <em>선택 · 참고만 함</em></span><div class="akr-chips">${WISHES.map(([t, l]) => `<button type="button" data-r="w" data-v="${t}" class="${p.wishSet && p.wish === t ? 'on' : ''}" style="--tc:${TC[t] || '#f4dfa6'}">${t || '✦'} ${l}</button>`).join('')}</div></div>
            <label class="full">자기소개 <em>선택 · 200자</em><textarea id="rIntro" maxlength="200" rows="2" placeholder="예: 시골 서점집 막내. 책으로만 보던 소환수를 직접 만나고 싶어서 왔다.">${esc(p.intro)}</textarea></label>
          </div>
          <p class="akr-err" id="rErr"></p>
          <div class="akr-row"><button type="button" class="ak-btn" data-r="close">나중에 할게요</button><button type="button" class="ak-btn primary" data-r="submit">학생증 발급 신청</button></div>
        </form>
        <aside class="akr-dex"><h4>입학 소환 후보 · 일반 13종</h4><div class="akr-mons">${BEASTS.map(card).join('')}</div><div id="rMon">${monInfo(BEASTS.find(b => b.n === monSel))}</div></aside>
      </div>`);
      const q = (id) => host.querySelector('#' + id);
      q('rOrigin').onchange = (e) => { p.origin = e.target.value; q('rOnote').textContent = ORIGINS[p.origin] || ''; };
      ['rName', 'rAge', 'rLook', 'rIntro'].forEach((id, i) => q(id).addEventListener('input', (e) => { p[['name', 'age', 'look', 'intro'][i]] = e.target.value; }));
    }
    function idcard() {
      const p = S.p, g = { m: '남성', f: '여성', x: '밝히지 않음' }[p.gender] || '—';
      return `<div class="akr-id"><div class="h"><span>ETERNA SUMMONERS' ACADEMY</span><b>학생증</b></div>
        <div class="ph">${esc((p.name || '?').slice(0, 1))}</div>
        <dl><div class="w"><dt>성명</dt><dd class="nm">${esc(p.name)}</dd></div><div><dt>학번</dt><dd>${esc(S.id)}</dd></div><div><dt>나이</dt><dd>${esc(p.age)}</dd></div>
        <div class="w"><dt>출신</dt><dd>${esc(p.origin)}</dd></div><div><dt>성별</dt><dd>${g}</dd></div><div><dt>기숙사</dt><dd class="${S.dorm ? 'on' : ''}">${S.dorm ? S.dorm + '의 동' : '배정 전'}</dd></div></dl>
        <div class="sg">Oswald E.<small>학장 오스왈드 에버하트</small></div><div class="stamp">에테르나<br>입학 허가</div></div>`;
    }
    function issue() {
      host.innerHTML = frame(1, `<div class="akr-issue">${idcard()}<div class="akr-speech"><b>마가렛 하인즈 교수</b><p id="rSay"></p><button class="ak-btn primary" data-r="altar" disabled id="rNext">소환의 제단으로</button></div></div>`);
      const line = `${S.p.name} 학생. 학번 ${S.id}, 등록을 확인했습니다. 잃어버리면 재발급에 벌점 1점입니다. 다음은 소환의 제단입니다. 마나는 일정하게 흘려 넣으십시오. 망설임은 소환수에게 그대로 전해집니다.`;
      let i = 0; const say = host.querySelector('#rSay');
      setTimeout(() => host.querySelector('.akr-id .stamp') && host.querySelector('.akr-id .stamp').classList.add('hit'), 900);
      const iv = setInterval(() => { if (!say.isConnected) return clearInterval(iv); say.textContent = line.slice(0, ++i); if (i >= line.length) { clearInterval(iv); host.querySelector('#rNext').disabled = false; } }, 28);
    }
    function altar() {
      host.innerHTML = frame(2, `<div class="akr-altar"><div class="akr-circle" id="rCircle" style="--p:0"><i></i><i></i><i></i>${Object.keys(TC).map((t, k) => `<span style="--k:${k};--tc:${TC[t]}">${t}</span>`).join('')}
        <button class="akr-hold" id="rHold">길게 눌러<br>마나를 흘려 넣기<small>스페이스바도 돼요</small></button></div>
        <div class="akr-speech"><b>소환의 제단</b><p>소환진 중앙을 누른 채로 마나를 흘려 넣으세요. 손을 떼면 마나가 흩어집니다. 일곱 흐름이 모두 깨어나면 소환이 시작됩니다.</p><div class="akr-mana"><i id="rMana"></i></div><p class="akr-hint">입학 소환은 일반 등급만 응답합니다. 결과는 바꿀 수 없어요.</p></div></div>`);
      if (o.bgm) o.bgm('partner');
      const c = host.querySelector('#rCircle'), hold = host.querySelector('#rHold'), mana = host.querySelector('#rMana');
      let p = 0, on = false, done = false, last = performance.now();
      const loop = (now) => {
        if (!c.isConnected) return;
        const dt = Math.min(now - last, 50); last = now;
        p = on ? Math.min(1, p + dt / 2800) : Math.max(0, p - dt / 1600);
        c.style.setProperty('--p', p.toFixed(3)); mana.style.width = p * 100 + '%';
        c.querySelectorAll('span').forEach((s, k) => s.classList.toggle('lit', p > (k + 1) / 8));
        if (p >= 1 && !done) { done = true; summon(); return; }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      const down = (e) => { if (done) return; if (e && e.cancelable) e.preventDefault(); on = true; hold.classList.add('on'); };
      const up = () => { on = false; hold.classList.remove('on'); };
      hold.addEventListener('pointerdown', down); const offUp = () => { if (!hold.isConnected) { removeEventListener('pointerup', up); removeEventListener('pointercancel', up); } }; addEventListener('pointerup', up); addEventListener('pointercancel', up); hold.addEventListener('pointerup', offUp);
      hold.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.stopPropagation(); down(e); } });
      hold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.stopPropagation(); up(); } });
      hold.focus({ preventScroll: true });
      function summon() {
        S.beast = pick(S.p); S.dorm = DORM[S.beast.t];
        c.classList.add('go'); c.style.setProperty('--tc', TC[S.beast.t]);
        hold.innerHTML = `<span style="color:${TC[S.beast.t]};font-size:28px">${S.beast.t}</span>`;
        if (o.fx) o.fx(['flash', 'sparks']);
        if (o.save) o.save(S);
        removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
        setTimeout(result, 1600);
      }
    }
    function result() {
      const b = S.beast, st = stats(b);
      if (o.bgm) o.bgm('opening');
      host.innerHTML = frame(3, `<div class="akr-res" style="--tc:${TC[b.t]}">
        <article class="akr-beast"><div class="pic" style="background-image:url('${o.img(b.n)}')"></div>
          <div class="bd"><span class="tags"><i>${b.t} 속성</i><i>일반</i><i>Lv 5</i></span><h3>${b.n}</h3><em>${b.race} ${b.g === 'f' ? '♀' : '♂'} · ${b.role} · 기본체</em>
          <p class="akr-line">“${esc(b.line)}”</p><p>${esc(b.trait)}</p>
          <div class="akr-st">${Object.entries(st).map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('')}</div>
          <div class="akr-sk">${b.sk.map(s => `<span>${s[0]} <i>${s[1]} | ${s[2]}/${s[2]}${s[3] ? ' · ' + s[3] : ''}</i></span>`).join('')}</div></div></article>
        <div class="akr-side">${idcard()}<div class="akr-dorm"><b>${S.dorm}</b><span>${S.dorm}의 동 배정 · 도감 1/80 (${b.n} 기본체 첫 칸)</span></div>
          <details class="akr-text"><summary>크랙에 보낼 입학 등록 결과 보기</summary><pre>${esc(block(S))}</pre></details>
          <p class="akr-hint">보내기를 누르면 이 결과가 크랙 대화에 <b>한 번</b> 보내지고, 첫 파트너와의 이야기가 시작돼요.</p>
          <div class="akr-row"><button class="ak-btn" data-r="redo">처음부터 다시 등록</button><button class="ak-btn primary" data-r="send">입학 등록 결과 보내기</button></div></div>
      </div>`);
    }
    host.addEventListener('click', (e) => {
      const t = e.target.closest('[data-r]');
      if (!t || !host.contains(t)) return;
      e.stopPropagation();
      const k = t.dataset.r, p = S.p;
      if (k === 'close') { o.onClose && o.onClose(); return; }
      if (k === 'g') { p.gender = t.dataset.v; t.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === t)); return; }
      if (k === 't') { const v = t.textContent, has = p.traits.includes(v); if (!has && p.traits.length >= 3) { o.toast('성격은 3개까지 고를 수 있어요'); return; } p.traits = has ? p.traits.filter(x => x !== v) : p.traits.concat(v); t.classList.toggle('on', !has); return; }
      if (k === 'w') { p.wish = t.dataset.v; p.wishSet = true; t.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === t)); return; }
      if (k === 'mon') { monSel = t.dataset.n; host.querySelector('#rMon').innerHTML = monInfo(BEASTS.find(b => b.n === monSel)); return; }
      if (k === 'submit') {
        const a = parseInt(p.age, 10);
        const msg = !String(p.name).trim() ? '성명을 적어 주세요.' : !(a >= 19 && a <= 99) ? '나이는 19세부터 입력할 수 있어요.' : !p.gender ? '성별을 골라 주세요.' : !p.origin ? '출신 지역을 골라 주세요.' : '';
        host.querySelector('#rErr').textContent = msg;
        if (msg) { o.toast(msg); return; }
        S.id = 'E301-' + String(Math.floor(1000 + Math.random() * 9000));
        issue(); return;
      }
      if (k === 'altar') { altar(); return; }
      if (k === 'redo') { S.beast = null; S.dorm = ''; S.id = ''; if (o.save) o.save(null); regForm(); return; }
      if (k === 'send') { if (o.send(block(S), S)) { o.onSent && o.onSent(S); } return; }
    });
    if (S.beast) result(); else regForm();
  }
  root.CrionAcademyReg = { open, BEASTS, block, stats, pick };
  if (typeof module !== 'undefined') module.exports = root.CrionAcademyReg;
})(typeof window !== 'undefined' ? window : globalThis);
