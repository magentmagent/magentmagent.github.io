(function () {
  const STORAGE_KEY = "wordChainSnakeSiteLang";
  const SUPPORTED = ["en", "ko", "ja"];

  function browserLang() {
    const lang = String(navigator.language || "").toLowerCase();
    if (lang.startsWith("ko")) return "ko";
    if (lang.startsWith("ja")) return "ja";
    return "en";
  }

  function currentLang() {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get("lang");
    if (SUPPORTED.includes(fromUrl)) {
      localStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED.includes(saved)) return saved;
    return browserLang();
  }

  function pageKey() {
    const name = location.pathname.split("/").filter(Boolean).pop() || "index.html";
    return name.replace(/\.html$/, "") || "index";
  }

  function gamePath(lang) {
    if (lang === "ko") return "/word-chain-snake/ko/";
    if (lang === "ja") return "/word-chain-snake/ja/";
    return "/word-chain-snake/en/";
  }

  function crownChainPath(lang) {
    if (lang === "ko") return "/crown-chain/ko/";
    if (lang === "ja") return "/crown-chain/ja/";
    return "/crown-chain/en/";
  }

  function content(lang, key) {
    const t = TEXT[lang] || TEXT.en;
    const common = t.common;
    const nav = `
      <nav class="top-nav" aria-label="${common.navLabel}">
        <strong><a class="brand-link" href="/">${common.brand}</a></strong>
        <a href="/">${common.home}</a>
        <a href="/games.html">${common.games}</a>
        <a href="/about.html">${common.about}</a>
        <a href="/privacy.html">${common.privacy}</a>
        <a href="/contact.html">${common.contact}</a>
        <label class="lang-field">${common.language}
          <select id="siteLangSelect">
            <option value="en">English</option>
            <option value="ko">한국어</option>
            <option value="ja">日本語</option>
          </select>
        </label>
      </nav>`;
    const footer = `
      <footer class="page-footer">
        <a href="/">${common.home}</a>
        <a href="/terms.html">${common.terms}</a>
        <a href="/privacy.html">${common.privacy}</a>
        <a href="/contact.html">${common.contact}</a>
      </footer>`;
    return (PAGES[key] || PAGES.index)(t, nav, footer, lang);
  }

  function setLinks(lang) {
    document.querySelectorAll("a[href$='.html'], a[href='/']").forEach(link => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("http")) return;
      const url = new URL(href, location.origin);
      if (url.pathname.endsWith(".html") || url.pathname === "/") {
        url.searchParams.set("lang", lang);
        link.setAttribute("href", url.pathname + url.search);
      }
    });
  }

  function render(lang) {
    const page = document.querySelector(".page");
    if (!page) return;
    page.innerHTML = content(lang, pageKey());
    document.documentElement.lang = lang;
    const select = document.querySelector("#siteLangSelect");
    if (select) {
      select.value = lang;
      select.addEventListener("change", () => {
        localStorage.setItem(STORAGE_KEY, select.value);
        const url = new URL(location.href);
        url.searchParams.set("lang", select.value);
        history.replaceState({}, "", url.pathname + url.search + url.hash);
        render(select.value);
      });
    }
    setLinks(lang);
  }

  const PAGES = {
    index: (t, nav, footer, lang) => `${nav}
      <section class="hero">
        <div>
          <p class="eyebrow">${t.home.eyebrow}</p>
          <h1 class="stack-title"><span>magent</span><span>magent</span><span>games</span></h1>
          <p class="lead">${t.home.lead}</p>
          <div class="button-row">
            <a class="button" href="${crownChainPath(lang)}">${t.home.play}</a>
            <a class="button secondary" href="/games.html">${t.common.games}</a>
          </div>
        </div>
        <img class="hero-image" src="/public/crown-chain-social.svg" alt="${CROWN_TEXT[lang].preview}">
      </section>
      <section class="grid home-grid" aria-label="${t.home.sections}">
        <article class="card">
          <h2>Crown Chain</h2>
          <p>${CROWN_TEXT[lang].body}</p>
          <a href="${crownChainPath(lang)}">${t.home.play}</a>
        </article>
        <article class="card">
          <h2>word chain snake</h2>
          <p>${t.home.cardGame}</p>
          <a href="${gamePath(lang)}">${t.home.play}</a>
        </article>
        <article class="card">
          <h2>${t.home.cardSiteTitle}</h2>
          <ul class="feature-list">
            <li>${t.home.feature1}</li>
            <li>${t.home.feature2}</li>
            <li>${t.home.feature3}</li>
          </ul>
        </article>
      </section>${footer}`,
    games: (t, nav, footer, lang) => `${nav}
      <h1>${t.common.games}</h1>
      <p class="lead">${t.games.lead}</p>
      <section class="grid" aria-label="${t.common.games}">
        <article class="card">
          <img class="game-thumb" src="/public/crown-chain-social.svg" alt="${CROWN_TEXT[lang].preview}">
          <h2>Crown Chain</h2>
          <p>${CROWN_TEXT[lang].body}</p>
          <p>${CROWN_TEXT[lang].support}</p>
          <p>${CROWN_TEXT[lang].note}</p>
          <a class="button" href="${crownChainPath(lang)}">${t.home.play}</a>
        </article>
        <article class="card">
          <img class="game-thumb" src="/public/social-card-v2.png" alt="${t.home.preview}">
          <h2>word chain snake</h2>
          <p>${t.games.gameBody}</p>
          <p>${t.games.gameSupport}</p>
          <p>${t.games.dictionaryNote}</p>
          <a class="button" href="${gamePath(lang)}">${t.home.play}</a>
        </article>
      </section>${footer}`,
    about: (t, nav, footer) => `${nav}
      <h1>${t.common.about}</h1>
      <p class="lead">${t.about.lead}</p>
      <p>${t.about.body1}</p>
      <p>${t.about.body2}</p>
      ${footer}`,
    privacy: (t, nav, footer) => `${nav}
      <h1>${t.common.privacy}</h1>
      <p class="lead">${t.privacy.lead}</p>
      <h2>${t.privacy.playerTitle}</h2><p>${t.privacy.player}</p>
      <h2>${t.privacy.analyticsTitle}</h2><p>${t.privacy.analytics}</p>
      <h2>${t.privacy.adsTitle}</h2><p>${t.privacy.ads}</p>
      ${footer}`,
    contact: (t, nav, footer) => `${nav}
      <h1>${t.common.contact}</h1>
      <p class="lead">${t.contact.lead}</p>
      <p>${t.contact.body}</p>
      <p><a class="button" href="https://github.com/magentmagent/wordsnake/issues/new">${t.contact.button}</a></p>
      ${footer}`,
    terms: (t, nav, footer) => `${nav}
      <h1>${t.common.terms}</h1>
      <p class="lead">${t.terms.lead}</p>
      <p>${t.terms.body1}</p>
      <p>${t.terms.body2}</p>
      ${footer}`
  };

  const TEXT = {
    en: {
      common: { brand: "magentmagent games", navLabel: "Site navigation", language: "Language", home: "Home", games: "Games", about: "About", privacy: "Privacy", contact: "Contact", terms: "Terms" },
      home: { eyebrow: "Browser game site", lead: "A small site for quick browser play on mobile or desktop.", play: "Play now", preview: "word chain snake board preview", sections: "Site sections", cardGame: "Build a continuous snake of words. Longer words, new tiles, and matching crossings earn more points.", cardSiteTitle: "Site basics", feature1: "No account is required to play.", feature2: "Rankings and suggestions are reviewed for abuse.", feature3: "The interface is tuned for mobile play." },
      games: { lead: "Choose a game and start playing in the browser.", gameBody: "A word-chain puzzle where each submitted word becomes a path on the board.", gameSupport: "Supports English, Korean, and Japanese, with board-size rankings and snake mode.", dictionaryNote: "Word lists are filtered for playability, and missing words can be suggested in the game for review." },
      about: { lead: "magentmagent games is a small browser-game site operated as a personal web project.", body1: "The site provides free games that can be played without creating an account. It also maintains pages for privacy information, contact, terms, and feedback.", body2: "Game scores, suggestions, and aggregate analytics may be used to operate and improve the site. User feedback is handled through the public project issue tracker." },
      privacy: { lead: "The games can be played without creating an account.", playerTitle: "Player entries", player: "Leaderboard submissions may include display name, score, board size, language, mode, finish type, and submission time. Word suggestions may include the suggested word and language.", analyticsTitle: "Analytics", analytics: "The site may use Cloudflare Web Analytics and aggregate gameplay events to improve the game. These events do not include the full words typed on the board.", adsTitle: "Advertising", ads: "If Google AdSense is enabled, Google and partners may use cookies or similar technologies according to their policies." },
      contact: { lead: "Feedback, bug reports, word issues, ranking issues, and policy concerns can be sent through GitHub.", body: "For missing words, the in-game suggestion button is preferred because it includes language context.", button: "Open a GitHub issue" },
      terms: { lead: "This site provides free browser games for casual play.", body1: "Do not overload services, submit offensive display names, automate abusive requests, or interfere with other players.", body2: "Scores, rankings, and suggestions may be reset, filtered, or removed if spam, abuse, or technical errors are found." }
    },
    ko: {
      common: { brand: "magentmagent games", navLabel: "사이트 이동", language: "언어", home: "홈", games: "게임", about: "소개", privacy: "개인정보", contact: "문의", terms: "약관" },
      home: { eyebrow: "브라우저 게임 사이트", lead: "모바일과 데스크톱에서 짧게 즐길 수 있는 작은 브라우저 게임 사이트입니다.", play: "플레이하기", preview: "word chain snake 게임판 미리보기", sections: "사이트 섹션", cardGame: "단어를 이어 하나의 스네이크 경로를 만듭니다. 긴 단어, 새 칸, 교차 배치로 더 높은 점수를 얻습니다.", cardSiteTitle: "사이트 기본 정보", feature1: "계정 없이 플레이할 수 있습니다.", feature2: "랭킹과 제안은 악용 여부를 검토합니다.", feature3: "모바일 플레이에 맞춰 구성했습니다." },
      games: { lead: "게임을 선택하고 브라우저에서 바로 시작하세요.", gameBody: "제출한 단어가 보드 위의 경로가 되는 끝말잇기 퍼즐입니다.", gameSupport: "한국어, 영어, 일본어를 지원하며 보드 크기별 랭킹과 스네이크 모드가 있습니다.", dictionaryNote: "단어 목록은 플레이에 맞게 필터링되며, 누락 단어는 게임 안에서 제안하고 검토 후 반영할 수 있습니다." },
      about: { lead: "magentmagent games는 개인 웹 프로젝트로 운영되는 작은 브라우저 게임 사이트입니다.", body1: "이 사이트는 계정 없이 플레이할 수 있는 무료 게임을 제공하며, 개인정보 안내, 문의, 약관, 피드백 페이지를 함께 운영합니다.", body2: "사이트 운영과 개선을 위해 랭킹, 단어 제안, 집계된 분석 정보를 사용할 수 있습니다. 피드백은 공개 프로젝트 이슈를 통해 받습니다." },
      privacy: { lead: "게임은 계정 없이 플레이할 수 있습니다.", playerTitle: "사용자 입력", player: "랭킹 제출 시 표시 이름, 점수, 보드 크기, 언어, 모드, 종료 방식, 제출 시간이 저장될 수 있습니다. 단어 제안에는 제안 단어와 언어 정보가 포함될 수 있습니다.", analyticsTitle: "분석", analytics: "Cloudflare Web Analytics와 집계된 게임 이벤트를 사용할 수 있습니다. 전체 입력 단어 목록은 이벤트에 포함하지 않습니다.", adsTitle: "광고", ads: "Google AdSense가 활성화되면 Google 및 파트너가 정책에 따라 쿠키 등을 사용할 수 있습니다." },
      contact: { lead: "버그, 단어 문제, 랭킹 문제, 정책 관련 문의는 GitHub로 알려주세요.", body: "누락 단어는 언어 정보가 함께 전달되는 게임 내 제안 버튼을 사용하는 편이 좋습니다.", button: "GitHub 이슈 열기" },
      terms: { lead: "이 사이트는 무료 브라우저 게임을 제공합니다.", body1: "서비스를 과도하게 호출하거나, 모욕적인 표시 이름을 제출하거나, 다른 사용자의 이용을 방해해서는 안 됩니다.", body2: "스팸, 악용, 기술적 오류가 발견되면 점수와 제안 단어는 수정되거나 삭제될 수 있습니다." }
    },
    ja: {
      common: { brand: "magentmagent games", navLabel: "サイトナビゲーション", language: "言語", home: "ホーム", games: "ゲーム", about: "概要", privacy: "プライバシー", contact: "連絡", terms: "利用規約" },
      home: { eyebrow: "ブラウザゲームサイト", lead: "モバイルでもデスクトップでも短時間で遊べる小さなブラウザゲームサイトです。", play: "プレイする", preview: "word chain snake 盤面プレビュー", sections: "サイト項目", cardGame: "単語をつなげて一つのスネーク経路を作ります。長い単語、新しいマス、交差で得点が増えます。", cardSiteTitle: "サイト基本情報", feature1: "アカウントなしで遊べます。", feature2: "ランキングと提案は不正利用を確認します。", feature3: "モバイルプレイ向けに調整しています。" },
      games: { lead: "ゲームを選んでブラウザですぐに始められます。", gameBody: "入力した単語が盤面上の経路になる、しりとりパズルです。", gameSupport: "英語、韓国語、日本語に対応し、盤面サイズ別ランキングとスネークモードがあります。", dictionaryNote: "単語リストは遊びやすさのためにフィルターされ、不足語はゲーム内で提案して確認後に追加できます。" },
      about: { lead: "magentmagent games は個人ウェブプロジェクトとして運営されている小さなブラウザゲームサイトです。", body1: "このサイトはアカウントなしで遊べる無料ゲームを提供し、プライバシー、連絡、利用規約、フィードバックのページを運営しています。", body2: "サイト運営と改善のため、ランキング、単語提案、集計された分析情報を利用する場合があります。フィードバックは公開プロジェクトの issue で受け付けます。" },
      privacy: { lead: "ゲームはアカウントなしで遊べます。", playerTitle: "プレイヤー入力", player: "ランキング送信時に表示名、得点、盤面サイズ、言語、モード、終了方法、送信時刻が保存される場合があります。単語提案には提案語と言語情報が含まれます。", analyticsTitle: "分析", analytics: "Cloudflare Web Analytics と集計されたゲームイベントを利用する場合があります。入力した全単語の一覧はイベントに含めません。", adsTitle: "広告", ads: "Google AdSense を有効にした場合、Google とパートナーがポリシーに従って Cookie などを使用する場合があります。" },
      contact: { lead: "不具合、単語、ランキング、ポリシーに関する連絡は GitHub で受け付けます。", body: "不足語は、言語情報も送れるゲーム内の提案ボタンを使うのがおすすめです。", button: "GitHub issue を開く" },
      terms: { lead: "このサイトは無料のブラウザゲームを提供します。", body1: "サービスへの過剰なアクセス、不適切な表示名、他のプレイヤーの妨害は禁止です。", body2: "スパム、不正利用、技術的な問題が見つかった場合、スコアや提案語は修正または削除されることがあります。" }
    }
  };

  const CROWN_TEXT = {
    en: {
      preview: "Crown Chain board preview",
      body: "A compact chess-chain puzzle where every capture transforms your current piece.",
      support: "Play Basic mode with standard chess pieces or Chaos mode with variant pieces that appear as levels rise.",
      note: "Runs entirely in the browser and saves your best score locally."
    },
    ko: {
      preview: "크라운 체인 보드 미리보기",
      body: "말을 잡을 때마다 현재 말이 바뀌는 짧은 체스 연쇄 퍼즐입니다.",
      support: "표준 말만 나오는 기본 모드와 레벨이 오르며 변형 말이 추가되는 카오스 모드를 제공합니다.",
      note: "브라우저 안에서 바로 실행되며 최고 점수는 로컬에 저장됩니다."
    },
    ja: {
      preview: "クラウンチェーン盤面プレビュー",
      body: "駒を取るたびに現在の駒が変わる、短く遊べるチェス連鎖パズルです。",
      support: "標準駒だけの基本モードと、レベルに応じて変則駒が増えるカオスモードがあります。",
      note: "ブラウザ内だけで動作し、最高得点はローカルに保存されます。"
    }
  };

  render(currentLang());
}());
