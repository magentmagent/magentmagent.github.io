(function () {
  const STORAGE_KEY = "wordChainSnakeSiteLang";
  const SUPPORTED = ["en", "ko", "ja"];

  const LANG_LABELS = {
    en: "English",
    ko: "한국어",
    ja: "日本語"
  };

  const GAME_LINKS = {
    word: { en: "/word-chain-snake/en/", ko: "/word-chain-snake/ko/", ja: "/word-chain-snake/ja/" },
    crown: { en: "/crown-chain/en/", ko: "/crown-chain/ko/", ja: "/crown-chain/ja/" },
    tower: { en: "/tower-cut/en/", ko: "/tower-cut/ko/", ja: "/tower-cut/ja/" }
  };

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

  function gamePath(game, lang) {
    return (GAME_LINKS[game] || GAME_LINKS.word)[lang] || GAME_LINKS.word.en;
  }

  function navHtml(t) {
    return `
      <nav class="top-nav" aria-label="${t.common.navLabel}">
        <strong><a class="brand-link" href="/">${t.common.brand}</a></strong>
        <a href="/">${t.common.home}</a>
        <a href="/games.html">${t.common.games}</a>
        <a href="/about.html">${t.common.about}</a>
        <a href="/privacy.html">${t.common.privacy}</a>
        <a href="/contact.html">${t.common.contact}</a>
        <label class="lang-field">${t.common.language}
          <select id="siteLangSelect">
            ${SUPPORTED.map(lang => `<option value="${lang}">${LANG_LABELS[lang]}</option>`).join("")}
          </select>
        </label>
      </nav>`;
  }

  function footerHtml(t) {
    return `
      <footer class="page-footer">
        <a href="/">${t.common.home}</a>
        <a href="/games.html">${t.common.games}</a>
        <a href="/terms.html">${t.common.terms}</a>
        <a href="/privacy.html">${t.common.privacy}</a>
        <a href="/contact.html">${t.common.contact}</a>
      </footer>`;
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
    const t = TEXT[lang] || TEXT.en;
    const renderer = PAGES[pageKey()] || PAGES.index;
    page.innerHTML = renderer(t, navHtml(t), footerHtml(t), lang);
    document.documentElement.lang = lang;
    document.title = t.meta[pageKey()] || t.meta.index;
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
      <section class="hero hero-feature">
        <div>
          <p class="eyebrow">${t.home.eyebrow}</p>
          <h1 class="feature-title">${t.home.title}</h1>
          <p class="lead">${t.home.lead}</p>
          <ul class="hero-points">
            <li>${t.home.point1}</li>
            <li>${t.home.point2}</li>
            <li>${t.home.point3}</li>
          </ul>
          <div class="button-row">
            <a class="button" href="${gamePath("word", lang)}">${t.home.playWord}</a>
            <a class="text-link" href="/games.html">${t.common.games}</a>
          </div>
        </div>
        <img class="hero-image" src="/public/social-card-v2.png" alt="${t.word.preview}">
      </section>
      <section class="grid home-grid" aria-label="${t.home.sections}">
        ${gameCard(t.crown, gamePath("crown", lang), t.home.play)}
        ${gameCard(t.tower, gamePath("tower", lang), t.home.play)}
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
        ${gameCard(t.word, gamePath("word", lang), t.home.play, "/public/social-card-v2.png")}
        ${gameCard(t.crown, gamePath("crown", lang), t.home.play, "/public/crown-chain-social.png")}
        ${gameCard(t.tower, gamePath("tower", lang), t.home.play, "/public/tower-cut-social.png")}
      </section>${footer}`,
    about: (t, nav, footer) => `${nav}
      <h1>${t.common.about}</h1>
      <p class="lead">${t.about.lead}</p>
      <section class="grid about-grid">
        <article class="card">
          <h2>${t.home.cardSiteTitle}</h2>
          <ul class="feature-list">
            <li>${t.home.feature1}</li>
            <li>${t.home.feature2}</li>
            <li>${t.home.feature3}</li>
          </ul>
        </article>
        <article class="card">
          <h2>${t.common.games}</h2>
          <p>${t.about.body1}</p>
          <p>${t.about.body2}</p>
        </article>
      </section>
      <p class="note">${t.about.body3}</p>
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

  function gameCard(game, href, button, image = "") {
    return `<article class="card game-card">
      ${image ? `<img class="game-thumb" src="${image}" alt="${game.preview}">` : ""}
      <h2>${game.title}</h2>
      <div class="description">
        <p>${game.body}</p>
        <p>${game.support}</p>
      </div>
      <a class="button cta" href="${href}">${button}</a>
    </article>`;
  }

  const TEXT = {
    en: {
      meta: {
        index: "MagentMagent Games - Free Browser Puzzle Games",
        games: "Free Browser Puzzle Games | MagentMagent Games",
        about: "About | MagentMagent Games",
        privacy: "Privacy | MagentMagent Games",
        contact: "Contact | MagentMagent Games",
        terms: "Terms | MagentMagent Games"
      },
      common: { brand: "magentmagent games", navLabel: "Site navigation", language: "Language", home: "Home", games: "Games", about: "About", privacy: "Privacy", contact: "Contact", terms: "Terms" },
      home: {
        eyebrow: "Featured browser puzzle",
        title: "Word Chain Snake",
        lead: "Connect words. Fill the board. Don't trap the snake.",
        playWord: "Play Word Chain Snake",
        play: "Play now",
        sections: "Site sections",
        point1: "No install or account required.",
        point2: "English, Korean, and Japanese word lists.",
        point3: "Classic and Snake modes with board-size rankings.",
        cardSiteTitle: "Site basics",
        feature1: "Playable on mobile and desktop.",
        feature2: "Rankings and suggestions are reviewed for abuse.",
        feature3: "Each game starts directly in the browser."
      },
      games: { lead: "Choose a free browser puzzle and start playing instantly." },
      word: {
        title: "Word Chain Snake",
        preview: "Word Chain Snake board preview",
        body: "A last-letter word-chain puzzle played across a board like a snake.",
        support: "Each word starts with the final letter of the previous word. Matching letters can cross, but reused words are blocked.",
        note: "Supports English, Korean, and Japanese, with classic mode, snake mode, and board-size leaderboards."
      },
      crown: {
        title: "Crown Chain",
        preview: "Crown Chain board preview",
        body: "A compact chess-transformation puzzle where every capture changes your current piece.",
        support: "Basic mode uses familiar chess pieces, while Chaos mode adds variant pieces as levels rise.",
        note: "Basic, Chaos, and time-attack records are ranked separately."
      },
      tower: {
        title: "Tower Cut",
        preview: "Tower Cut tower puzzle preview",
        body: "A fast stack puzzle where you cut and rebuild broken towers to match the target.",
        support: "Place blocks, cut wrong layers, and chase clean solves before time runs out.",
        note: "Score comes from speed, efficient moves, perfect clears, and combo streaks."
      },
      about: {
        lead: "magentmagent games is a small browser-game site operated as a personal web project.",
        body1: "The site provides free games that can be played without creating an account: Word Chain Snake, Crown Chain, and Tower Cut.",
        body2: "The games are designed for short sessions on mobile and desktop, with rankings, sharing, and feedback flows where they fit the game.",
        body3: "Game scores, word suggestions, and aggregate analytics may be used to operate and improve the site. User feedback is handled through the public project issue tracker."
      },
      privacy: { lead: "The games can be played without creating an account.", playerTitle: "Player entries", player: "Leaderboard submissions may include game, display name, score, board size, language, mode, finish type, and submission time. Word suggestions may include the suggested word and language.", analyticsTitle: "Analytics", analytics: "The site may use Cloudflare Web Analytics and aggregate gameplay events to improve the games. These events do not include the full words typed on the board.", adsTitle: "Advertising", ads: "If Google AdSense is enabled, Google and partners may use cookies or similar technologies according to their policies." },
      contact: { lead: "Feedback, bug reports, word issues, ranking issues, and policy concerns can be sent through GitHub.", body: "For missing words, the in-game suggestion button is preferred because it includes language context. For ranking issues, include the game and mode when possible.", button: "Open a GitHub issue" },
      terms: { lead: "This site provides free browser games for casual play.", body1: "Do not overload services, submit offensive display names, automate abusive requests, or interfere with other players.", body2: "Scores, rankings, and suggestions may be reset, filtered, or removed if spam, abuse, or technical errors are found." }
    },
    ko: {
      meta: {
        index: "MagentMagent Games - 무료 브라우저 퍼즐 게임",
        games: "무료 브라우저 퍼즐 게임 | MagentMagent Games",
        about: "소개 | MagentMagent Games",
        privacy: "개인정보 | MagentMagent Games",
        contact: "문의 | MagentMagent Games",
        terms: "약관 | MagentMagent Games"
      },
      common: { brand: "magentmagent games", navLabel: "사이트 이동", language: "언어", home: "홈", games: "게임", about: "소개", privacy: "개인정보", contact: "문의", terms: "약관" },
      home: {
        eyebrow: "대표 브라우저 퍼즐",
        title: "Word Chain Snake",
        lead: "끝말을 이어 보드를 채우는 단어 스네이크.",
        playWord: "Word Chain Snake 플레이",
        play: "플레이하기",
        sections: "사이트 섹션",
        point1: "설치와 계정 없이 바로 플레이할 수 있습니다.",
        point2: "한국어, 영어, 일본어 단어 목록을 지원합니다.",
        point3: "Classic/Snake 모드와 보드 크기별 랭킹이 있습니다.",
        cardSiteTitle: "사이트 기본 정보",
        feature1: "모바일과 데스크톱에서 플레이할 수 있습니다.",
        feature2: "랭킹과 제안은 악용 여부를 검토합니다.",
        feature3: "각 게임은 브라우저에서 바로 시작됩니다."
      },
      games: { lead: "무료 브라우저 퍼즐을 고르고 바로 플레이하세요." },
      word: {
        title: "Word Chain Snake",
        preview: "Word Chain Snake 보드 미리보기",
        body: "끝말잇기를 보드 위에서 스네이크처럼 이어 가는 단어 퍼즐입니다.",
        support: "이전 단어의 마지막 글자로 다음 단어를 시작합니다. 같은 글자는 교차할 수 있고, 이미 쓴 단어는 다시 쓸 수 없습니다.",
        note: "한국어, 영어, 일본어를 지원하며 Classic 모드, Snake 모드, 보드 크기별 랭킹이 있습니다."
      },
      crown: {
        title: "Crown Chain",
        preview: "Crown Chain 보드 미리보기",
        body: "말을 잡을 때마다 현재 말이 바뀌는 작은 체스 변형 퍼즐입니다.",
        support: "Basic은 익숙한 체스 말을 사용하고, Chaos는 레벨이 오를수록 변형 말이 추가됩니다.",
        note: "Basic, Chaos, 타임어택 기록은 서로 분리해 집계합니다."
      },
      tower: {
        title: "Tower Cut",
        preview: "Tower Cut 퍼즐 미리보기",
        body: "망가진 탑을 잘라 내고 다시 쌓아 목표 탑과 맞추는 빠른 스택 퍼즐입니다.",
        support: "블록을 놓고, 잘못된 층을 자르고, 제한 시간 안에 더 깔끔하게 완성하세요.",
        note: "속도, 효율적인 조작, PERFECT 클리어, 콤보로 점수를 얻습니다."
      },
      about: {
        lead: "magentmagent games는 개인 웹 프로젝트로 운영되는 작은 브라우저 게임 사이트입니다.",
        body1: "계정 없이 무료로 플레이할 수 있는 Word Chain Snake, Crown Chain, Tower Cut을 제공합니다.",
        body2: "각 게임은 모바일과 데스크톱에서 짧게 즐길 수 있도록 만들었고, 게임 성격에 맞춰 랭킹, 공유, 피드백 흐름을 제공합니다.",
        body3: "사이트 운영과 개선을 위해 점수, 단어 제안, 집계형 분석 정보를 사용할 수 있습니다. 피드백은 공개 프로젝트 이슈로 받습니다."
      },
      privacy: { lead: "게임은 계정 없이 플레이할 수 있습니다.", playerTitle: "사용자 입력", player: "랭킹 제출에는 게임, 표시 이름, 점수, 보드 크기, 언어, 모드, 종료 방식, 제출 시간이 포함될 수 있습니다. 단어 제안에는 제안 단어와 언어 정보가 포함될 수 있습니다.", analyticsTitle: "분석", analytics: "Cloudflare Web Analytics와 집계형 게임 이벤트를 사용할 수 있습니다. 보드에 입력한 전체 단어 목록은 이벤트에 포함하지 않습니다.", adsTitle: "광고", ads: "Google AdSense가 활성화되면 Google과 파트너가 정책에 따라 쿠키 또는 유사 기술을 사용할 수 있습니다." },
      contact: { lead: "버그, 단어 문제, 랭킹 문제, 정책 관련 문의는 GitHub로 알려주세요.", body: "누락 단어는 언어 정보가 함께 전달되는 게임 안 제안 버튼을 사용하는 편이 좋습니다. 랭킹 문제는 가능하면 게임 이름과 모드를 함께 적어 주세요.", button: "GitHub 이슈 열기" },
      terms: { lead: "이 사이트는 가볍게 즐길 수 있는 무료 브라우저 게임을 제공합니다.", body1: "서비스를 과도하게 호출하거나, 모욕적인 표시 이름을 제출하거나, 자동화된 악용 요청을 보내거나, 다른 사용자의 이용을 방해해서는 안 됩니다.", body2: "스팸, 악용, 기술적 오류가 발견되면 점수, 랭킹, 제안 단어가 초기화, 필터링, 삭제될 수 있습니다." }
    },
    ja: {
      meta: {
        index: "MagentMagent Games - 無料ブラウザパズルゲーム",
        games: "無料ブラウザパズルゲーム | MagentMagent Games",
        about: "このサイトについて | MagentMagent Games",
        privacy: "プライバシー | MagentMagent Games",
        contact: "お問い合わせ | MagentMagent Games",
        terms: "利用規約 | MagentMagent Games"
      },
      common: { brand: "magentmagent games", navLabel: "サイトナビゲーション", language: "言語", home: "ホーム", games: "ゲーム", about: "このサイトについて", privacy: "プライバシー", contact: "お問い合わせ", terms: "利用規約" },
      home: {
        eyebrow: "注目のブラウザパズル",
        title: "Word Chain Snake",
        lead: "言葉をつないで盤面を埋めるワードスネーク。",
        playWord: "Word Chain Snakeで遊ぶ",
        play: "プレイ",
        sections: "サイト内セクション",
        point1: "インストールもアカウントも不要です。",
        point2: "英語、韓国語、日本語の単語リストに対応しています。",
        point3: "Classic/Snakeモードと盤面サイズ別ランキングがあります。",
        cardSiteTitle: "サイト基本情報",
        feature1: "モバイルとデスクトップで遊べます。",
        feature2: "ランキングと提案は不正利用を確認します。",
        feature3: "各ゲームはブラウザですぐに始められます。"
      },
      games: { lead: "無料ブラウザパズルを選んですぐに遊べます。" },
      word: {
        title: "Word Chain Snake",
        preview: "Word Chain Snakeの盤面プレビュー",
        body: "しりとりを盤面上のスネーク経路としてつないでいく単語パズルです。",
        support: "前の単語の最後の文字から次の単語を始めます。同じ文字なら交差でき、同じ単語の再利用はできません。",
        note: "英語、韓国語、日本語に対応し、Classicモード、Snakeモード、盤面サイズ別ランキングがあります。"
      },
      crown: {
        title: "Crown Chain",
        preview: "Crown Chainの盤面プレビュー",
        body: "駒を取るたびに自分の駒が変化する、小さなチェス変形パズルです。",
        support: "Basicは見慣れたチェス駒を使い、Chaosではレベルが上がるほど変則駒が増えます。",
        note: "Basic、Chaos、タイムアタックの記録は分けて集計します。"
      },
      tower: {
        title: "Tower Cut",
        preview: "Tower Cutのパズルプレビュー",
        body: "崩れた塔を切って積み直し、目標の塔に合わせる短時間スタックパズルです。",
        support: "ブロックを置き、違う層を切り、制限時間内にきれいな完成を狙います。",
        note: "速さ、少ない操作、PERFECTクリア、コンボで得点が伸びます。"
      },
      about: {
        lead: "magentmagent gamesは個人のWebプロジェクトとして運営している小さなブラウザゲームサイトです。",
        body1: "アカウントなしで無料プレイできるWord Chain Snake、Crown Chain、Tower Cutを提供しています。",
        body2: "各ゲームはモバイルとデスクトップで短く遊べるように作り、ゲームに合わせてランキング、共有、フィードバックの流れを用意しています。",
        body3: "サイトの運営と改善のため、スコア、単語提案、集計型の分析情報を利用することがあります。フィードバックは公開プロジェクトのIssueで受け付けています。"
      },
      privacy: { lead: "ゲームはアカウントなしでプレイできます。", playerTitle: "プレイヤー入力", player: "ランキング送信にはゲーム、表示名、得点、盤面サイズ、言語、モード、終了種別、送信時刻が含まれる場合があります。単語提案には提案単語と言語情報が含まれる場合があります。", analyticsTitle: "分析", analytics: "Cloudflare Web Analyticsと集計型ゲームイベントを利用することがあります。盤面に入力した単語の完全な一覧はイベントに含めません。", adsTitle: "広告", ads: "Google AdSenseを有効にした場合、Googleおよびパートナーが各ポリシーに従ってCookie等を使用することがあります。" },
      contact: { lead: "不具合、単語、ランキング、ポリシーに関する連絡はGitHubから送れます。", body: "不足している単語は、言語情報も一緒に送れるゲーム内の提案ボタンを使うのがおすすめです。ランキングの問題は、可能ならゲーム名とモードも含めてください。", button: "GitHub Issueを開く" },
      terms: { lead: "このサイトは気軽に遊べる無料ブラウザゲームを提供します。", body1: "サービスへの過度なアクセス、攻撃的な表示名、不正な自動リクエスト、他のプレイヤーの妨害は禁止します。", body2: "スパム、不正利用、技術的な誤りが見つかった場合、スコア、ランキング、提案単語をリセット、フィルタ、削除することがあります。" }
    }
  };

  render(currentLang());
}());
