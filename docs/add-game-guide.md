# magentmagent games 게임 추가 가이드

이 문서는 `magentmagent.github.io` 사이트에 새 브라우저 게임을 추가할 때 참고하는 작업 규칙입니다. 현재 사이트는 GitHub Pages에서 정적 파일로 배포되며, 게임별 HTML은 게임 전용 경로 아래에 둡니다.

## 기본 원칙

- 루트 `/`는 포털 페이지입니다. 실제 게임을 루트나 `/ko/`, `/en/`, `/ja/` 같은 언어 루트에 두지 않습니다.
- 새 게임은 반드시 게임 고유 slug 아래에 둡니다. 예: `/word-chain-snake/en/`, `/new-game/ko/`.
- 언어는 게임 경로의 하위 경로로 둡니다. 권장 형식은 `/{game-slug}/{lang}/`입니다.
- 기존 주소 호환이 필요하면 얇은 리다이렉트 페이지만 둡니다. 리다이렉트 페이지에는 광고 스크립트나 게임 본문을 넣지 않습니다.
- 게임은 첫 화면에서 바로 플레이 가능한 상태여야 합니다. 준비 중 페이지, 빈 페이지, 이동만 하는 페이지에 광고를 붙이지 않습니다.
- 사용자 입력, 랭킹, 제안 등 서버 기능이 없어도 기본 플레이는 가능해야 합니다.

## 현재 파일 구조

```text
/
  index.html                 # 사이트 홈
  games.html                 # 게임 목록
  about.html                 # 사이트 소개
  privacy.html               # 개인정보 안내
  terms.html                 # 이용 약관
  contact.html               # 문의 안내
  site-page.css              # 홈/콘텐츠 페이지 공통 CSS
  site-i18n.js               # 홈/콘텐츠 페이지 다국어 렌더링
  sitemap.xml                # 검색엔진용 URL 목록
  robots.txt                 # 크롤러 안내
  ads.txt                    # AdSense 판매자 정보
  favicon.svg                # 탭 아이콘
  public/                    # 공유 이미지, 사전 데이터, 설정 JS 등 공통 정적 자산
  word-chain-snake/
    en/index.html            # 영어 게임
    ko/index.html            # 한국어 게임
    ja/index.html            # 일본어 게임
  en/index.html              # 이전 주소 호환용 리다이렉트
  ko/index.html              # 이전 주소 호환용 리다이렉트
  ja/index.html              # 이전 주소 호환용 리다이렉트
```

## 새 게임 경로 규칙

새 게임 이름이 `tile-path`라면 다음처럼 만듭니다.

```text
tile-path/
  en/index.html
  ko/index.html
  ja/index.html
```

지원하지 않는 언어가 있다면 우선 영어만 만들어도 되지만, 사이트 UI의 언어 선택과 게임 목록에서는 실제 지원 언어만 연결해야 합니다. 링크가 존재하지 않는 언어 페이지로 향하면 안 됩니다.

게임 slug는 소문자 영문과 하이픈만 사용합니다.

좋은 예:

```text
word-chain-snake
tile-path
number-river
```

피해야 할 예:

```text
WordSnake
word_chain_snake
ko
game1
```

## 루트/콘텐츠 페이지 갱신

새 게임을 추가하면 다음 파일을 함께 갱신합니다.

- `games.html`: JS가 꺼진 상태에서도 보이는 정적 fallback 게임 목록
- `site-i18n.js`: 다국어 게임 목록, 버튼 링크, 설명 문구
- `sitemap.xml`: 새 게임 URL
- 필요한 경우 `index.html`: 대표 게임 또는 홈 CTA 변경

`site-i18n.js`를 바꿨다면 콘텐츠 HTML의 캐시 버전도 올립니다.

```html
<link rel="stylesheet" href="/site-page.css?v=YYYYMMDD-name">
<script src="/site-i18n.js?v=YYYYMMDD-name"></script>
```

CSS를 바꾸지 않았더라도, 배포 캐시를 확실히 피하고 싶으면 `site-page.css`와 `site-i18n.js` 버전을 함께 올려도 됩니다.

## 게임 HTML 규칙

각 게임 페이지는 독립 실행 가능한 HTML이어야 합니다.

필수 권장 항목:

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- canonical URL
- `hreflang` alternate URL
- Open Graph/Twitter 공유 메타
- favicon 링크
- 홈/게임/소개/개인정보/약관/문의로 이동하는 footer 또는 nav
- 서버 장애 시에도 기본 플레이가 가능한 fallback

예:

```html
<link rel="canonical" href="https://magentmagent.github.io/tile-path/en/">
<link rel="alternate" hreflang="en" href="https://magentmagent.github.io/tile-path/en/">
<link rel="alternate" hreflang="ko" href="https://magentmagent.github.io/tile-path/ko/">
<link rel="alternate" hreflang="ja" href="https://magentmagent.github.io/tile-path/ja/">
<link rel="alternate" hreflang="x-default" href="https://magentmagent.github.io/">
```

게임 페이지가 `/{game}/{lang}/`에 있으면 `public` 자산은 보통 `../../public/...`로 참조합니다.

```html
<script src="../../public/suggest-config.js"></script>
```

절대경로 `/public/...`를 써도 되지만, 기존 게임은 상대 경로를 사용하고 있으므로 같은 패턴을 우선합니다.

## 다국어 규칙

사이트 콘텐츠 페이지의 언어는 `site-i18n.js`가 관리합니다.

- 기본 언어 판단은 브라우저 언어를 사용합니다.
- 한국어 브라우저는 한국어, 일본어 브라우저는 일본어, 그 외는 영어가 기본입니다.
- 사용자가 언어를 바꾸면 `localStorage`와 URL의 `lang` 파라미터로 상태를 유지합니다.

게임별 언어 전환 함수도 같은 원칙을 따릅니다.

```js
function languagePath(lang) {
  if (lang === "ko") return "/game-slug/ko/";
  if (lang === "ja") return "/game-slug/ja/";
  return "/game-slug/en/";
}
```

새 게임을 추가할 때는 `site-i18n.js` 안의 게임 목록 문구를 영어, 한국어, 일본어 모두 갱신합니다. 한 페이지 안에 3개 언어 문단을 동시에 노출하지 않습니다. 언어 선택 드롭다운으로 한 언어만 보여야 합니다.

## 디자인/UI 규칙

- 모바일 세로 화면을 우선합니다.
- PC에서는 중앙 콘텐츠 폭과 보드/패널 정렬이 깨지지 않아야 합니다.
- 첫 화면은 실제 플레이로 이어져야 하며, 긴 홍보용 랜딩만 보여주지 않습니다.
- 텍스트가 카드나 버튼 밖으로 넘치지 않도록 합니다.
- 게임 조작 UI는 해당 게임 플레이에 필요한 것만 둡니다.
- “준비 중”, “곧 공개” 같은 내용 없는 페이지는 만들지 않습니다.
- 페이지가 단순 이동용이면 `noindex`를 붙이고 광고 코드를 넣지 않습니다.

## 광고/정책 관련 규칙

AdSense 심사를 고려해 다음을 지킵니다.

- 게임 또는 실질 콘텐츠가 없는 화면에 광고를 넣지 않습니다.
- 이동용 페이지, 오류 페이지, 알림만 있는 페이지에는 광고를 넣지 않습니다.
- 자동 리디렉트 페이지에는 광고 스크립트를 넣지 않습니다.
- 게임 페이지는 충분한 자체 기능과 설명, 정책 페이지 링크를 가져야 합니다.
- `privacy.html`, `terms.html`, `contact.html`, `about.html`, `ads.txt`를 유지합니다.

현재 사이트는 광고 스크립트가 아니라 AdSense 계정 확인용 메타 중심으로 관리되어 왔습니다. 광고를 실제로 넣을 때는 게임 화면의 조작을 가리지 않는 위치인지 별도로 검토합니다.

## 서버 기능 연동 규칙

현재 게임은 Cloudflare Worker 기반 API를 사용할 수 있습니다.

주요 기능:

- 단어 제안
- 승인된 추가 단어 불러오기
- 점수 업로드
- 보드 크기/언어/모드별 랭킹
- 집계용 게임 이벤트

프론트엔드에서는 `../../public/suggest-config.js` 또는 유사 설정 파일을 통해 API URL을 읽습니다. 서버가 없거나 실패해도 기본 플레이는 막지 않는 것이 원칙입니다.

새 게임이 랭킹을 쓴다면 점수 payload에 최소한 다음 정보를 포함합니다.

```js
{
  game: "game-slug",
  lang: "en",
  boardSize: 8,
  mode: "classic",
  score: 123,
  finishType: "clear",
  name: "Player"
}
```

기존 서버가 `game` 필드를 아직 사용하지 않는다면, 새 게임 추가 전에 서버 저장 키와 조회 API가 게임별로 분리되는지 확인해야 합니다.

## 공유 이미지/소셜 메타

새 게임은 가능하면 `public/` 아래에 공유 이미지를 둡니다.

권장:

```text
public/tile-path-social.png
```

각 게임 HTML의 OG/Twitter 이미지를 해당 이미지로 연결합니다.

```html
<meta property="og:image" content="https://magentmagent.github.io/public/tile-path-social.png">
<meta name="twitter:image" content="https://magentmagent.github.io/public/tile-path-social.png">
```

공유 문구는 기본 영어를 우선하고, 한국어/일본어 게임에서 공유할 때만 해당 언어 문구를 사용합니다. 공유 URL은 언어별로 달라도 되지만, 불필요하게 이미지 생성 URL을 따로 만들지 않습니다.

## 새 게임 추가 체크리스트

1. 게임 slug를 정한다.
2. `/{game-slug}/{lang}/index.html` 구조를 만든다.
3. 게임이 정적 파일만으로 기본 플레이 가능한지 확인한다.
4. `games.html` fallback 목록에 추가한다.
5. `site-i18n.js`의 게임 목록과 링크를 3개 언어로 갱신한다.
6. `sitemap.xml`에 새 URL을 추가한다.
7. 공유 이미지가 필요하면 `public/`에 추가하고 메타 태그를 연결한다.
8. 랭킹/분석/제안 API를 쓴다면 게임별 구분 키를 확인한다.
9. `node`로 HTML 안의 inline script 문법을 확인한다.
10. GitHub Pages 배포 후 라이브 URL 200 응답을 확인한다.

검사용 예:

```powershell
node -e "const fs=require('fs'), vm=require('vm'); for (const f of ['new-game/en/index.html','new-game/ko/index.html','new-game/ja/index.html']) { const s=fs.readFileSync(f,'utf8'); const blocks=[...s.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]); blocks.forEach((code,i)=>new vm.Script(code,{filename:f+':script'+i})); console.log(f, 'ok'); }"
```

## 배포 확인

커밋 후 `main` 브랜치에 push하면 GitHub Pages가 자동 배포합니다.

확인할 것:

- Actions의 `pages build and deployment`가 success인지
- 새 게임 URL이 200으로 열리는지
- 잘못된 자산 경로가 없는지
- 언어 전환 링크가 실제 존재하는 페이지로 가는지
- 콘텐츠 없는 페이지나 이동용 페이지에 광고 코드가 없는지

Pages deploy 단계만 실패하고 build가 성공한 경우에는 GitHub Pages 일시 실패일 수 있습니다. 이전에는 작은 sitemap 갱신으로 재시도해 성공한 적이 있습니다. 다만 같은 실패가 반복되면 Actions 로그를 먼저 확인합니다.

