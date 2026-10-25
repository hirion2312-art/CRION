// 작가 프로필 자동 수집은 0.4에서 중단했다 (실제 크랙 프로필에서 다른 작가 작품을 섞어 와서).
// 작품 목록은 관리 페이지(config/works.json)만 쓴다. 예전 코드: archive/common-game-ui/renderer/catalog-extract.js
// 앱 본체(0.3.x)가 이 파일을 실행하므로 빈 결과를 돌려준다 → 본체가 아무것도 저장하지 않는다.
({ works: [], page: location.href, title: document.title, method: 'off', log: '자동 수집 꺼짐' });
