(function () {
  const { PIECES, MODES } = window.CrownChainPieces;
  const Rules = window.CrownChainRules;
  const Renderer = window.CrownChainRenderer;
  const I18n = window.CrownChainI18n;
  const SIZE = Rules.SIZE;
  let nextPieceId = 1;

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function getSpawnCount(level) {
    return Math.min(8, 2 + Math.floor((level - 1) / 1.5));
  }

  function createBagFromComposition(composition) {
    const pile = [];
    for (const [type, count] of Object.entries(composition)) {
      for (let i = 0; i < count; i += 1) pile.push(type);
    }
    return shuffle(pile);
  }

  function activeWeights(mode, level) {
    const weights = {};
    for (const pool of mode.addPools) {
      if (level < pool.minLevel) continue;
      for (const [type, weight] of Object.entries(pool.weights)) {
        weights[type] = (weights[type] || 0) + weight;
      }
    }
    return weights;
  }

  function pickWeighted(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, item) => sum + item[1], 0);
    let roll = Math.random() * total;
    for (const [type, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return type;
    }
    return entries[0] ? entries[0][0] : "pawn";
  }

  function buildLevelBag(mode, level) {
    const weights = activeWeights(mode, level);
    const pile = [];
    const size = Math.min(24, 12 + Math.floor(level * 1.5));
    for (let i = 0; i < size; i += 1) pile.push(pickWeighted(weights));
    return shuffle(pile);
  }

  function createPiece(type, x, y) {
    const def = Rules.getPieceDef(type);
    const piece = { id: `piece-${nextPieceId++}`, type, sprite: def.sprite, x, y, anchorX: x, anchorY: y };
    if (type === "bigrook") piece.segments = { left: true, right: true };
    return piece;
  }

  function pieceFootprint(piece) {
    if (piece.type === "bigrook" && piece.segments) {
      const cells = [];
      if (piece.segments.left) {
        cells.push({ x: piece.anchorX, y: piece.anchorY }, { x: piece.anchorX, y: piece.anchorY + 1 });
      }
      if (piece.segments.right) {
        cells.push({ x: piece.anchorX + 1, y: piece.anchorY }, { x: piece.anchorX + 1, y: piece.anchorY + 1 });
      }
      return cells;
    }
    const def = Rules.getPieceDef(piece.type);
    const size = def.size || { w: 1, h: 1 };
    const cells = [];
    for (let dy = 0; dy < size.h; dy += 1) {
      for (let dx = 0; dx < size.w; dx += 1) {
        cells.push({ x: piece.anchorX + dx, y: piece.anchorY + dy });
      }
    }
    return cells;
  }

  function placePieceOnBoard(board, piece) {
    piece.x = piece.anchorX;
    piece.y = piece.anchorY;
    pieceFootprint(piece).forEach((cell) => {
      board[Rules.idx(cell.x, cell.y)] = piece;
    });
  }

  function clearPieceFromBoard(board, piece) {
    pieceFootprint(piece).forEach((cell) => {
      board[Rules.idx(cell.x, cell.y)] = null;
    });
  }

  function modeLabel(t, mode) {
    if (mode === "basic-time") return t.basicTime || "Basic Time Attack";
    if (mode === "chaos-time") return t.chaosTime || "Chaos Time Attack";
    return mode === "chaos" ? t.chaos : t.basic;
  }

  function displayName(type) {
    if (type === "bigrook") return "Big Rook";
    if (type === "assassin") return "Assassin";
    return type;
  }

  function getEnemyAttackersCompat(state) {
    if (typeof Rules.getEnemyAttackers === "function") return Rules.getEnemyAttackers(state);
    const attackers = [];
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const piece = state.board[Rules.idx(x, y)];
        if (!piece) continue;
        const previewState = {
          ...state,
          player: { type: piece.type, x, y }
        };
        const attacks = Rules.getLegalCaptures(previewState);
        if (attacks.some(cell => cell.x === state.player.x && cell.y === state.player.y)) {
          attackers.push(piece);
        }
      }
    }
    return attackers;
  }

  function init(options) {
    const lang = options.lang || "en";
    const t = I18n.t(lang);
    const canvas = document.querySelector("#boardCanvas");
    const SUGGEST_API = String(window.WORDSNAKE_SUGGEST_API || "").trim();
    const GAME_NAME = "crown-chain";
    const els = {
      introScreen: document.querySelector("#introScreen"),
      gameScreen: document.querySelector("#gameScreen"),
      boardPanel: document.querySelector("#boardPanel"),
      score: document.querySelector("#scoreValue"),
      introBest: document.querySelector("#introBestValue"),
      best: document.querySelector("#bestValue"),
      level: document.querySelector("#levelValue"),
      timerStat: document.querySelector("#timerStat"),
      timer: document.querySelector("#timerValue"),
      combo: document.querySelector("#comboValue"),
      current: document.querySelector("#currentValue"),
      mode: document.querySelector("#introModeSelect"),
      startGame: document.querySelector("#startGameBtn"),
      endTurn: document.querySelector("#endTurnBtn"),
      restart: document.querySelector("#restartBtn"),
      overlayRestart: document.querySelector("#overlayRestartBtn"),
      menu: document.querySelector("#menuBtn"),
      menuSecondary: document.querySelector("#menuBtnSecondary"),
      message: document.querySelector("#message"),
      introLeaderboardToggle: document.querySelector("#introLeaderboardToggle"),
      introLeaderboardPanel: document.querySelector("#introLeaderboardPanel"),
      introLeaderboardScope: document.querySelector("#introLeaderboardScope"),
      introLeaderboardList: document.querySelector("#introLeaderboardList"),
      introLeaderboardStatus: document.querySelector("#introLeaderboardStatus"),
      resultEyebrow: document.querySelector("#resultEyebrow"),
      resultTitle: document.querySelector("#resultTitle"),
      resultSummary: document.querySelector("#resultSummary"),
      gameOverOverlay: document.querySelector("#gameOverOverlay"),
      playerName: document.querySelector("#playerNameInput"),
      submitScore: document.querySelector("#submitScoreBtn"),
      shareX: document.querySelector("#shareXBtn"),
      shareNative: document.querySelector("#shareNativeBtn"),
      copyResult: document.querySelector("#copyResultBtn"),
      shareStatus: document.querySelector("#shareStatus"),
      leaderboardScope: document.querySelector("#leaderboardScope"),
      leaderboardList: document.querySelector("#leaderboardList"),
      leaderboardStatus: document.querySelector("#leaderboardStatus")
    };

    const stats = {
      score: els.score ? els.score.closest(".stat") : null,
      combo: els.combo ? els.combo.closest(".stat") : null,
      current: els.current ? els.current.closest(".stat") : null
    };

    const TIME_ATTACK_LIMIT_MS = 3000;
    const playerNameKey = `crownChainPlayerName:${lang}`;
    let state = null;
    let legalCaptures = [];
    let legalMoves = [];
    let legalActions = [];
    let selectedPiece = null;
    let rafId = 0;
    let turnTimerId = 0;
    let turnTimerDeadline = 0;
    let audioContext = null;
    const sfxGainScale = 3.1;
    const prefersReducedEffects = () => ((window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || window.innerWidth < 520);
    const fx = {
      playerMotion: null,
      enemyAttackMotion: null,
      spawnMotions: [],
      pulseCells: [],
      particles: [],
      floatingTexts: [],
      captureGhosts: [],
      clearBurst: null
    };
    window.__crownChainGameDebug = {
      getState: () => ({
        combo: state?.combo,
        player: state?.player,
        freeMoveAvailable: state?.freeMoveAvailable,
        turn: state?.turn,
        effectCounts: {
          pulseCells: fx.pulseCells.length,
          particles: fx.particles.length,
          floatingTexts: fx.floatingTexts.length,
          captureGhosts: fx.captureGhosts.length,
          hasPlayerMotion: !!fx.playerMotion,
          hasClearBurst: !!fx.clearBurst
        }
      }),
      restartWithQueryDebug: () => newGame(els.mode.value || "basic")
    };

    if (els.playerName) els.playerName.value = localStorage.getItem(playerNameKey) || "";

    function normalizedMode(mode) {
      return MODES[mode] ? mode : "basic";
    }

    function isTimeAttackMode(mode = state?.mode || selectedMode()) {
      return !!MODES[normalizedMode(mode)]?.timeAttack;
    }

    function bestStorageKey(mode = "basic") {
      return `crownChainBest:${lang}:${normalizedMode(mode)}`;
    }

    function isLocalDebugAllowed() {
      const host = String(window.location.hostname || "").toLowerCase();
      const protocol = String(window.location.protocol || "").toLowerCase();
      return protocol === "file:" || host === "localhost" || host === "127.0.0.1";
    }

    function parseDebugConfig() {
      if (!isLocalDebugAllowed()) {
        return {
          enabled: false,
          playerType: "",
          mode: "",
          spawn: []
        };
      }
      const params = new URLSearchParams(window.location.search);
      const enabled = params.get("debug") === "1";
      const playerType = (params.get("debugPlayer") || "").trim().toLowerCase();
      const mode = (params.get("debugMode") || "").trim().toLowerCase();
      const spawn = (params.get("debugSpawn") || "")
        .split(",")
        .map(item => item.trim().toLowerCase())
        .filter(Boolean);
      return {
        enabled,
        playerType: PIECES[playerType] ? playerType : "",
        mode: MODES[mode] ? mode : "",
        spawn: spawn.filter(type => PIECES[type])
      };
    }

    function debugPlayerStart(type) {
      if (type === "bigrook") return { x: 3, y: 3 };
      return { x: 3, y: 4 };
    }

    function playerFootprintCells(player) {
      const def = Rules.getPieceDef(player.type);
      const size = def.size || { w: 1, h: 1 };
      const cells = [];
      for (let dy = 0; dy < size.h; dy += 1) {
        for (let dx = 0; dx < size.w; dx += 1) {
          cells.push({ x: player.x + dx, y: player.y + dy });
        }
      }
      return cells;
    }

    function applyDebugConfig(config) {
      if (!config.enabled) return false;
      if (config.playerType) {
        const start = debugPlayerStart(config.playerType);
        state.player = { type: config.playerType, x: start.x, y: start.y };
        state.playerMeta = config.playerType === "bigrook" ? { bigRookNonPawn: 0 } : {};
      }
      if (config.spawn.length) {
        state.board.fill(null);
        const blocked = new Set(playerFootprintCells(state.player).map((cell) => `${cell.x},${cell.y}`));
        const slots = [
          { x: 1, y: 1 }, { x: 5, y: 1 }, { x: 1, y: 6 }, { x: 5, y: 6 },
          { x: 0, y: 3 }, { x: 6, y: 3 }, { x: 2, y: 0 }, { x: 4, y: 7 },
          { x: 7, y: 2 }, { x: 0, y: 7 }, { x: 7, y: 7 }, { x: 0, y: 0 }
        ];
        let slotIndex = 0;
        config.spawn.forEach((type) => {
          while (slotIndex < slots.length && blocked.has(`${slots[slotIndex].x},${slots[slotIndex].y}`)) slotIndex += 1;
          if (slotIndex >= slots.length) return;
          const cell = slots[slotIndex];
          placePieceOnBoard(state.board, createPiece(type, cell.x, cell.y));
          slotIndex += 1;
        });
      }
      return true;
    }

    function now() {
      return performance.now();
    }

    function bestScore(mode = state?.mode || els.mode.value || "basic") {
      return Number(localStorage.getItem(bestStorageKey(mode)) || "0");
    }

    function saveBest() {
      const key = bestStorageKey(state.mode);
      if (state.score > bestScore(state.mode)) localStorage.setItem(key, String(state.score));
    }

    function selectedMode() {
      return normalizedMode(els.mode?.value || "basic");
    }

    function setTimerVisible(visible) {
      els.timerStat?.classList.toggle("hidden", !visible);
    }

    function renderTimer(ms = TIME_ATTACK_LIMIT_MS) {
      if (!els.timer) return;
      els.timer.textContent = (Math.max(0, ms) / 1000).toFixed(1);
      els.timerStat?.classList.toggle("timer-warning", ms <= 1000);
    }

    function clearTurnTimer() {
      if (turnTimerId) window.clearInterval(turnTimerId);
      turnTimerId = 0;
      turnTimerDeadline = 0;
      if (els.timerStat) els.timerStat.classList.remove("timer-warning");
    }

    function armTurnTimer() {
      clearTurnTimer();
      if (!state || state.gameOver || state.phaseLocked || !isTimeAttackMode(state.mode)) {
        setTimerVisible(isTimeAttackMode(state?.mode || selectedMode()));
        return;
      }
      setTimerVisible(true);
      turnTimerDeadline = performance.now() + TIME_ATTACK_LIMIT_MS;
      renderTimer(TIME_ATTACK_LIMIT_MS);
      turnTimerId = window.setInterval(() => {
        if (!state || state.gameOver || state.phaseLocked) {
          clearTurnTimer();
          return;
        }
        const remaining = turnTimerDeadline - performance.now();
        renderTimer(remaining);
        if (remaining <= 0) {
          clearTurnTimer();
          selectedPiece = null;
          void endTurn("timeout");
        }
      }, 80);
    }

    function setStatusText(el, message, isError = false) {
      if (!el) return;
      el.textContent = message;
      el.classList.toggle("error", isError);
    }

    function setLeaderboardStatus(message, isError = false) {
      setStatusText(els.leaderboardStatus, message, isError);
    }

    function setIntroLeaderboardStatus(message, isError = false) {
      setStatusText(els.introLeaderboardStatus, message, isError);
    }

    function setShareStatus(message, isError = false) {
      setStatusText(els.shareStatus, message, isError);
    }

    function restartClass(el, className) {
      if (!el) return;
      el.classList.remove(className);
      void el.offsetWidth;
      el.classList.add(className);
    }

    function setMessage(message, isError = false, tone = null) {
      els.message.textContent = message;
      els.message.classList.toggle("error", isError);
      els.message.classList.remove("pulse-note", "pulse-combo", "pulse-heal", "pulse-damage");
      const effectClass = tone || (isError ? "pulse-damage" : "pulse-note");
      if (effectClass) restartClass(els.message, effectClass);
    }

    function enemyAttackMessage(pieceLabel) {
      if (lang === "ko") return `공격당했습니다: ${pieceLabel}`;
      if (lang === "ja") return `攻撃されました: ${pieceLabel}`;
      return `Under attack: ${pieceLabel}`;
    }

    function noEnemyReachMessage() {
      if (lang === "ko") return "이번 턴에는 즉시 공격해 올 적이 없습니다.";
      if (lang === "ja") return "このターンはすぐに攻撃してくる敵がいません。";
      return "No enemy could reach you.";
    }

    function leaderboardModeLabel(mode) {
      return `${modeLabel(t, mode)} ${t.leaderboard}`;
    }

    function renderLeaderboard(listEl, items, ownRank = null, ownItem = null) {
      if (!listEl) return;
      listEl.innerHTML = "";
      if (!items.length) {
        const empty = document.createElement("li");
        empty.innerHTML = `<span class="rank">-</span><span class="name">${t.leaderboardEmpty}</span><span class="score-value">0</span>`;
        listEl.appendChild(empty);
        return;
      }
      items.forEach((item, index) => {
        const row = document.createElement("li");
        const isOwn = ownItem && item.id === ownItem.id;
        if (isOwn) row.classList.add("own");
        row.innerHTML = `
          <span class="rank">${index + 1}</span>
          <span class="name"></span>
          <span class="score-value">${Number(item.score || 0).toLocaleString()}</span>
        `;
        row.querySelector(".name").textContent = `${item.name || t.namePlaceholder}${isOwn ? ` · ${t.myRank}` : ""}`;
        listEl.appendChild(row);
      });
      if (!ownItem || !ownRank || ownRank <= items.length) return;
      const row = document.createElement("li");
      row.classList.add("own");
      row.innerHTML = `
        <span class="rank">${ownRank}</span>
        <span class="name"></span>
        <span class="score-value">${Number(ownItem.score || 0).toLocaleString()}</span>
      `;
      row.querySelector(".name").textContent = `${ownItem.name || t.namePlaceholder} · ${t.myRank}`;
      listEl.appendChild(row);
    }

    async function loadLeaderboardInto(listEl, scopeEl, statusFn, mode = state?.mode || selectedMode(), ownId = "") {
      if (scopeEl) scopeEl.textContent = leaderboardModeLabel(mode);
      if (!SUGGEST_API) {
        renderLeaderboard(listEl, []);
        statusFn(t.rankingsUnavailable, true);
        return;
      }
      statusFn(t.rankingsLoading);
      try {
        const params = new URLSearchParams({
          game: GAME_NAME,
          boardSize: String(SIZE),
          limit: "10",
          lang,
          mode: normalizedMode(mode)
        });
        if (ownId) params.set("id", ownId);
        const response = await fetch(`${SUGGEST_API}/scores?${params.toString()}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || t.rankingsFailed);
        renderLeaderboard(listEl, Array.isArray(data.items) ? data.items : [], data.ownRank, data.ownItem);
        statusFn(state?.scoreUploaded ? t.scoreUploaded : state?.gameOver ? t.gameOverToSubmit : "");
      } catch (error) {
        renderLeaderboard(listEl, []);
        statusFn(error.message || t.rankingsFailed, true);
      }
    }

    async function loadIntroLeaderboard(mode = selectedMode()) {
      if (els.introBest) els.introBest.textContent = bestScore(mode).toLocaleString();
      await loadLeaderboardInto(els.introLeaderboardList, els.introLeaderboardScope, setIntroLeaderboardStatus, mode, "");
    }

    function refreshIntroBest(mode = selectedMode()) {
      if (els.introBest) els.introBest.textContent = bestScore(mode).toLocaleString();
    }

    async function toggleIntroLeaderboard() {
      if (!els.introLeaderboardPanel) return;
      const isHidden = els.introLeaderboardPanel.classList.contains("hidden");
      if (!isHidden) {
        els.introLeaderboardPanel.classList.add("hidden");
        setIntroLeaderboardStatus("");
        return;
      }
      els.introLeaderboardPanel.classList.remove("hidden");
      setIntroLeaderboardStatus(t.rankingsLoading);
      await loadIntroLeaderboard(selectedMode());
    }

    async function loadGameOverLeaderboard(mode = state?.mode || selectedMode(), ownId = "") {
      await loadLeaderboardInto(els.leaderboardList, els.leaderboardScope, setLeaderboardStatus, mode, ownId);
    }

    function currentPlayerName() {
      return String(els.playerName?.value || "").trim().slice(0, 16) || t.namePlaceholder;
    }

    function hideGameOverOverlay() {
      els.gameOverOverlay?.classList.add("hidden");
      els.boardPanel?.classList.remove("game-over");
      setShareStatus("");
    }

    function showGameOverOverlay() {
      if (els.resultEyebrow) els.resultEyebrow.textContent = modeLabel(t, state.mode);
      if (els.resultTitle) els.resultTitle.textContent = state.finishType === "timeout" ? (t.timeOver || "Time over") : t.gameOver;
      if (els.resultSummary) {
        els.resultSummary.textContent = `${t.score}: ${state.score.toLocaleString()} · ${t.level}: ${state.level} · ${t.bestCombo}: ${state.bestCombo}`;
      }
      els.gameOverOverlay?.classList.remove("hidden");
      els.boardPanel?.classList.add("game-over");
    }

    function showIntroScreen() {
      clearTurnTimer();
      setTimerVisible(false);
      hideGameOverOverlay();
      els.gameScreen?.classList.add("hidden");
      els.introScreen?.classList.remove("hidden");
    }

    function showGameScreen() {
      els.introScreen?.classList.add("hidden");
      els.gameScreen?.classList.remove("hidden");
      setTimerVisible(isTimeAttackMode(selectedMode()));
    }

    async function returnToIntro() {
      showIntroScreen();
      refreshIntroBest(selectedMode());
      if (els.introLeaderboardPanel && !els.introLeaderboardPanel.classList.contains("hidden")) {
        await loadIntroLeaderboard(selectedMode());
      }
    }

    function trackGameEvent(type, detail = {}) {
      if (!SUGGEST_API) return;
      const payload = {
        game: GAME_NAME,
        type,
        lang,
        boardSize: SIZE,
        mode: normalizedMode(detail.mode || state?.mode || els.mode.value || "basic"),
        ...detail
      };
      const body = JSON.stringify(payload);
      const sendBeaconFallback = () => {
        if (!navigator.sendBeacon) return false;
        return navigator.sendBeacon(`${SUGGEST_API}/events`, new Blob([body], { type: "text/plain" }));
      };
      try {
        fetch(`${SUGGEST_API}/events`, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body,
          keepalive: true
        }).catch(sendBeaconFallback);
      } catch {
        sendBeaconFallback();
      }
    }

    function scorePayload() {
      return {
        game: GAME_NAME,
        lang,
        mode: normalizedMode(state.mode),
        score: state.score,
        boardSize: SIZE,
        total: SIZE * SIZE,
        filled: SIZE * SIZE,
        turns: state.turn,
        finishType: "gameover",
        level: state.level,
        bestCombo: state.bestCombo,
        name: currentPlayerName()
      };
    }

    async function submitScore() {
      if (!state?.gameOver || state.scoreUploaded || !els.submitScore) return;
      if (!SUGGEST_API) {
        setLeaderboardStatus(t.rankingsUnavailable, true);
        return;
      }
      const payload = scorePayload();
      if (els.playerName) {
        els.playerName.value = payload.name;
        localStorage.setItem(playerNameKey, payload.name);
      }
      els.submitScore.disabled = true;
      setLeaderboardStatus(t.uploadingScore);
      try {
        const response = await fetch(`${SUGGEST_API}/scores`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || t.uploadFailed);
        state.scoreUploaded = true;
        state.scoreId = data.item && data.item.id ? data.item.id : "";
        setLeaderboardStatus(t.scoreUploaded);
        await loadGameOverLeaderboard(state.mode, state.scoreId);
        if (els.introBest) els.introBest.textContent = bestScore(state.mode).toLocaleString();
      } catch (error) {
        setLeaderboardStatus(error.message || t.uploadFailed, true);
      } finally {
        els.submitScore.disabled = state.scoreUploaded;
      }
    }

    function shareUrl() {
      if (location.protocol === "http:" || location.protocol === "https:") {
        return `${location.origin}/crown-chain/${lang}/`;
      }
      return `https://magentmagent.github.io/crown-chain/${lang}/`;
    }

    function shareSummary() {
      return `${modeLabel(t, state.mode)} · ${t.score}: ${state.score.toLocaleString()} · ${t.level}: ${state.level} · ${t.bestCombo}: ${state.bestCombo}`;
    }

    function shareText() {
      if (lang === "ko") return `Crown Chain 결과\n${shareSummary()}\n${shareUrl()}`;
      if (lang === "ja") return `Crown Chain 結果\n${shareSummary()}\n${shareUrl()}`;
      return `Crown Chain result\n${shareSummary()}\n${shareUrl()}`;
    }

    function xShareText() {
      if (lang === "ko") return `${shareSummary()}\n말을 잡을 때마다 변신하는 체스 체인 게임`;
      if (lang === "ja") return `${shareSummary()}\n駒を取るたびに変身するチェス連鎖ゲーム`;
      return `${shareSummary()}\nA chess-chain game where every capture transforms you`;
    }

    function trackShare(channel) {
      trackGameEvent("share_result", {
        mode: state.mode,
        score: state.score,
        level: state.level,
        bestCombo: state.bestCombo,
        channel
      });
    }

    function drawRoundedRect(ctx, x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
      const words = String(text).split(/\s+/);
      let line = "";
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > maxWidth) {
          ctx.fillText(line, x, y);
          line = word;
          y += lineHeight;
        } else {
          line = next;
        }
      }
      if (line) ctx.fillText(line, x, y);
      return y + lineHeight;
    }

    function resultImageCanvas() {
      render();
      const scale = 3;
      const pad = 34;
      const boardPx = 560;
      const width = boardPx + (pad * 2);
      const height = pad + 92 + boardPx + 88;
      const out = document.createElement("canvas");
      out.width = width * scale;
      out.height = height * scale;
      const ctx = out.getContext("2d");
      ctx.scale(scale, scale);

      ctx.fillStyle = "#f6f3ea";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#202327";
      ctx.font = "900 28px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText("Crown Chain", pad, pad + 30);
      ctx.fillStyle = "#5f6872";
      ctx.font = "800 17px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(shareSummary(), pad, pad + 60);

      const boardY = pad + 92;
      ctx.fillStyle = "#5e6472";
      drawRoundedRect(ctx, pad - 6, boardY - 6, boardPx + 12, boardPx + 12, 12);
      ctx.fill();
      ctx.drawImage(canvas, pad, boardY, boardPx, boardPx);

      ctx.fillStyle = "#202327";
      ctx.font = "900 19px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(`${t.score}: ${state.score.toLocaleString()} · ${t.level}: ${state.level} · ${t.combo}: ${state.bestCombo}`, pad, boardY + boardPx + 38);
      ctx.fillStyle = "#68707a";
      ctx.font = "800 14px system-ui, -apple-system, Segoe UI, sans-serif";
      drawWrappedText(ctx, shareUrl(), pad, boardY + boardPx + 66, width - pad * 2, 18);
      return out;
    }

    function canvasToBlob(sourceCanvas) {
      return new Promise((resolve, reject) => {
        sourceCanvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("image")), "image/png");
      });
    }

    async function resultImageFile() {
      const blob = await canvasToBlob(resultImageCanvas());
      return new File([blob], "crown-chain-result.png", { type: "image/png" });
    }

    async function copyResultImage() {
      const file = await resultImageFile();
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ [file.type]: file })]);
        return true;
      }
      return false;
    }

    function shareToX() {
      if (!state?.gameOver) return;
      const params = new URLSearchParams({
        text: xShareText(),
        url: shareUrl(),
        hashtags: "CrownChain"
      });
      window.open(`https://twitter.com/intent/tweet?${params.toString()}`, "_blank", "noopener,noreferrer");
      copyResultImage()
        .then(copied => setShareStatus(copied ? shareMessage("xCopied") : shareMessage("xOpened")))
        .catch(() => setShareStatus(shareMessage("xOpened")));
      trackShare("x");
    }

    function shareMessage(type) {
      const messages = {
        en: {
          xOpened: "Opened X share window.",
          xCopied: "Opened X share window and copied the image.",
          shared: "Shared.",
          imageCopied: "Result image copied to clipboard.",
          textCopied: "Result copied to clipboard.",
          failed: "Could not share."
        },
        ko: {
          xOpened: "X 공유 창을 열었습니다.",
          xCopied: "X 공유 창을 열고 이미지를 복사했습니다.",
          shared: "공유했습니다.",
          imageCopied: "결과 이미지를 클립보드에 복사했습니다.",
          textCopied: "결과를 클립보드에 복사했습니다.",
          failed: "공유할 수 없습니다."
        },
        ja: {
          xOpened: "Xの共有画面を開きました。",
          xCopied: "Xの共有画面を開き、画像をコピーしました。",
          shared: "共有しました。",
          imageCopied: "結果画像をクリップボードにコピーしました。",
          textCopied: "結果をクリップボードにコピーしました。",
          failed: "共有できませんでした。"
        }
      };
      return (messages[lang] || messages.en)[type] || messages.en.failed;
    }

    async function shareNative() {
      if (!state?.gameOver) return;
      try {
        const file = await resultImageFile();
        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
          await navigator.share({ title: "Crown Chain", text: shareText(), url: shareUrl(), files: [file] });
          setShareStatus(shareMessage("shared"));
        } else if (navigator.share) {
          await navigator.share({ title: "Crown Chain", text: shareText(), url: shareUrl() });
          setShareStatus(shareMessage("shared"));
        } else {
          await copyResult();
          return;
        }
        trackShare("native");
      } catch (error) {
        if (error && error.name === "AbortError") return;
        setShareStatus(shareMessage("failed"), true);
      }
    }

    async function copyResult() {
      if (!state?.gameOver) return;
      try {
        const copiedImage = await copyResultImage();
        if (copiedImage) {
          setShareStatus(shareMessage("imageCopied"));
        } else {
          await navigator.clipboard.writeText(shareText());
          setShareStatus(shareMessage("textCopied"));
        }
        trackShare("copy");
      } catch {
        setShareStatus(shareMessage("failed"), true);
      }
    }

    function ensureAudio() {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      if (!audioContext) audioContext = new AudioCtor();
      if (audioContext.state === "suspended") audioContext.resume();
      return audioContext;
    }

    function playTone({ frequency, toFrequency, duration = 0.08, gain = 0.028, type = "triangle", when = 0 }) {
      const ctx = ensureAudio();
      if (!ctx) return;
      const start = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      const finalGain = Math.min(0.24, gain * sfxGainScale);
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, start);
      if (toFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(24, toFrequency), start + duration);
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(finalGain, start + 0.008);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(amp);
      amp.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.03);
    }

    function playMoveSfx() {
      playTone({ frequency: 330, toFrequency: 410, duration: 0.075, gain: 0.048, type: "sine" });
      playTone({ frequency: 510, toFrequency: 600, duration: 0.06, gain: 0.022, type: "triangle", when: 0.018 });
      playTone({ frequency: 240, toFrequency: 270, duration: 0.08, gain: 0.016, type: "sine", when: 0.01 });
    }

    function playCaptureSfx(combo) {
      const heat = Math.min(combo, 8);
      playTone({
        frequency: 250 + (heat * 8),
        toFrequency: 220 + (heat * 10),
        duration: 0.1 + (heat * 0.004),
        gain: 0.05 + (heat * 0.004),
        type: "triangle"
      });
      playTone({
        frequency: 520 + (heat * 24),
        toFrequency: 430 + (heat * 30),
        duration: 0.1 + (heat * 0.004),
        gain: 0.034 + (heat * 0.003),
        type: "sine",
        when: 0.018
      });
      playTone({
        frequency: 340 + (heat * 10),
        toFrequency: 280 + (heat * 14),
        duration: 0.11 + (heat * 0.004),
        gain: 0.024 + (heat * 0.002),
        type: "triangle",
        when: 0.008
      });
      if (combo > 1) {
        playTone({
          frequency: 690 + (heat * 30),
          toFrequency: 860 + (heat * 36),
          duration: 0.09 + (heat * 0.004),
          gain: 0.03 + (heat * 0.003),
          type: "triangle",
          when: 0.055
        });
      }
      if (combo >= 4) {
        playTone({
          frequency: 840 + (heat * 28),
          toFrequency: 980 + (heat * 32),
          duration: 0.08 + (heat * 0.004),
          gain: 0.016 + (heat * 0.002),
          type: "sine",
          when: 0.072
        });
      }
    }

    function playComboSfx(combo) {
      const bonus = Math.min(combo, 6);
      playTone({ frequency: 500 + (bonus * 34), toFrequency: 660 + (bonus * 42), duration: 0.11, gain: 0.036, type: "sine" });
      playTone({ frequency: 300 + (bonus * 18), toFrequency: 420 + (bonus * 28), duration: 0.13, gain: 0.022, type: "triangle", when: 0.02 });
      if (combo >= 5) {
        playTone({
          frequency: 760 + (bonus * 22),
          toFrequency: 980 + (bonus * 34),
          duration: 0.11,
          gain: 0.018 + (bonus * 0.002),
          type: "sine",
          when: 0.06
        });
      }
    }

    function playDamageSfx() {
      playTone({ frequency: 180, toFrequency: 120, duration: 0.16, gain: 0.032, type: "triangle" });
      playTone({ frequency: 130, toFrequency: 92, duration: 0.18, gain: 0.028, type: "sine", when: 0.02 });
      playTone({ frequency: 86, toFrequency: 72, duration: 0.2, gain: 0.02, type: "triangle", when: 0.028 });
    }

    function playTimeoutSfx() {
      playTone({ frequency: 620, toFrequency: 420, duration: 0.09, gain: 0.042, type: "square" });
      playTone({ frequency: 310, toFrequency: 210, duration: 0.12, gain: 0.03, type: "triangle", when: 0.035 });
      playTone({ frequency: 170, toFrequency: 120, duration: 0.11, gain: 0.022, type: "sine", when: 0.085 });
    }

    function playEnemyAttackSfx() {
      playTone({ frequency: 220, toFrequency: 160, duration: 0.11, gain: 0.04, type: "triangle" });
      playTone({ frequency: 460, toFrequency: 300, duration: 0.08, gain: 0.028, type: "sine", when: 0.015 });
    }

    function playHealSfx() {
      playTone({ frequency: 390, toFrequency: 540, duration: 0.09, gain: 0.03, type: "sine" });
      playTone({ frequency: 580, toFrequency: 760, duration: 0.1, gain: 0.028, type: "triangle", when: 0.03 });
      playTone({ frequency: 760, toFrequency: 920, duration: 0.08, gain: 0.018, type: "sine", when: 0.07 });
    }

    function playBlockedSfx() {
      playTone({ frequency: 180, toFrequency: 150, duration: 0.06, gain: 0.018, type: "triangle" });
    }

    function playClearSfx() {
      playTone({ frequency: 360, toFrequency: 520, duration: 0.12, gain: 0.04, type: "sine" });
      playTone({ frequency: 520, toFrequency: 760, duration: 0.13, gain: 0.036, type: "triangle", when: 0.04 });
      playTone({ frequency: 720, toFrequency: 960, duration: 0.15, gain: 0.032, type: "sine", when: 0.085 });
      playTone({ frequency: 250, toFrequency: 320, duration: 0.14, gain: 0.024, type: "triangle", when: 0.02 });
    }

    function playSpawnSfx() {
      playTone({ frequency: 300, toFrequency: 380, duration: 0.07, gain: 0.024, type: "sine" });
      playTone({ frequency: 470, toFrequency: 540, duration: 0.06, gain: 0.018, type: "triangle", when: 0.018 });
    }

    function addPulseCell(cell, color, fill = false, duration = 240) {
      fx.pulseCells.push({ cell: { x: cell.x, y: cell.y }, color, fill, startedAt: now(), duration });
    }

    function addParticles(cell, color, count = 6, speed = 0.24, radius = 3.2, duration = 340) {
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.4);
        const drift = speed * (0.6 + (Math.random() * 0.8));
        fx.particles.push({
          cell: { x: cell.x, y: cell.y },
          color,
          vx: Math.cos(angle) * drift,
          vy: Math.sin(angle) * drift,
          radius: radius * (0.75 + (Math.random() * 0.6)),
          rotation: Math.random() * Math.PI,
          startedAt: now(),
          duration
        });
      }
    }

    function addFloatingText(cell, text, color, scale = 0.22, duration = 560) {
      fx.floatingTexts.push({
        cell: { x: cell.x, y: cell.y },
        text,
        color,
        scale,
        startedAt: now(),
        duration
      });
    }

    function addCaptureGhost(cell, piece, color = "#c44536", duration = 220) {
      fx.captureGhosts.push({
        cell: { x: cell.x, y: cell.y },
        piece: { type: piece.type },
        color,
        startedAt: now(),
        duration
      });
    }

    function animatePlayer(from, to, pieceType, duration = 180, color = "rgba(25, 114, 120, 0.38)") {
      fx.playerMotion = {
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        piece: { type: pieceType },
        startedAt: now(),
        duration,
        color
      };
    }

    function animateEnemyAttack(attacker, duration = 240) {
      fx.enemyAttackMotion = {
        from: { x: attacker.x, y: attacker.y },
        to: { x: state.player.x, y: state.player.y },
        piece: { type: attacker.type },
        startedAt: now(),
        duration
      };
    }

    function animateSpawn(piece, duration = 220) {
      fx.spawnMotions.push({
        cell: { x: piece.x, y: piece.y },
        piece: { type: piece.type },
        startedAt: now(),
        duration
      });
    }

    function pruneEffects(time) {
      const active = item => (time - item.startedAt) < item.duration;
      fx.pulseCells = fx.pulseCells.filter(active);
      fx.particles = fx.particles.filter(active);
      fx.floatingTexts = fx.floatingTexts.filter(active);
      fx.captureGhosts = fx.captureGhosts.filter(active);
      fx.spawnMotions = fx.spawnMotions.filter(active);
      if (fx.enemyAttackMotion && (time - fx.enemyAttackMotion.startedAt) >= fx.enemyAttackMotion.duration) fx.enemyAttackMotion = null;
      if (fx.clearBurst && (time - fx.clearBurst.startedAt) >= fx.clearBurst.duration) fx.clearBurst = null;
      if (fx.playerMotion && (time - fx.playerMotion.startedAt) >= fx.playerMotion.duration) fx.playerMotion = null;
    }

    function hasActiveEffects() {
      return !!(fx.playerMotion || fx.enemyAttackMotion || fx.spawnMotions.length || fx.pulseCells.length || fx.particles.length || fx.floatingTexts.length || fx.captureGhosts.length || fx.clearBurst || (state && state.combo >= 2 && !prefersReducedEffects()));
    }

    function render(renderTime = now()) {
      updateLegal();
      Renderer.drawBoard(canvas, state, legalActions, {
        now: renderTime,
        playerMotion: fx.playerMotion,
        enemyAttackMotion: fx.enemyAttackMotion,
        spawnMotions: fx.spawnMotions,
        pulseCells: fx.pulseCells,
        particles: fx.particles,
        floatingTexts: fx.floatingTexts,
        captureGhosts: fx.captureGhosts,
        clearBurst: fx.clearBurst,
        reducedEffects: prefersReducedEffects()
      });
      renderStats();
    }

    function startEffectLoop() {
      if (rafId) return;
      console.info("[CrownChain] effect loop start");
      const frame = () => {
        rafId = 0;
        try {
          const time = now();
          pruneEffects(time);
          render(time);
          if (hasActiveEffects()) {
            rafId = window.requestAnimationFrame(frame);
            return;
          }
          console.info("[CrownChain] effect loop stop");
          render(time);
        } catch (error) {
          console.error("Crown Chain effect loop error", error);
          rafId = 0;
        }
      };
      rafId = window.requestAnimationFrame(frame);
    }

    function triggerMoveFeedback(from, to) {
      animatePlayer(from, to, state.player.type, 170, "rgba(25, 114, 120, 0.34)");
      addPulseCell(to, "rgba(25, 114, 120, 0.85)", false, 210);
      addParticles(to, "#197278", 5, 0.16, 2.5, 260);
      playMoveSfx();
      restartClass(stats.current, "stat-soft");
      startEffectLoop();
    }

    function triggerCaptureFeedback(from, to, target, gained) {
      animatePlayer(from, to, state.player.type, 210, "rgba(246, 189, 96, 0.44)");
      addPulseCell(to, "#c44536", false, 280);
      addParticles(to, "#f6bd60", 8, 0.26, 3.1, 340);
      addParticles(to, "#c44536", 5, 0.18, 2.5, 280);
      addFloatingText(to, `+${gained}`, "#202327", 0.22, 620);
      if (state.combo > 1) addFloatingText(to, `x${state.combo}`, "#197278", 0.18, 520);
      restartClass(stats.score, "stat-pop");
      restartClass(stats.combo, "stat-pop");
      restartClass(els.boardPanel, "board-flash");
      playCaptureSfx(state.combo);
      if (state.combo > 1) {
        playComboSfx(state.combo);
        setMessage(`${t.captured}: +${gained} x${state.combo}`, false, "pulse-combo");
      }
      startEffectLoop();
    }

    function triggerLifeLossFeedback() {
      addPulseCell(state.player, "rgba(196, 69, 54, 0.22)", true, 220);
      addPulseCell(state.player, "#c44536", false, 280);
      addParticles(state.player, "#c44536", 6, 0.18, 2.7, 300);
      restartClass(els.boardPanel, "board-damage");
      playDamageSfx();
      if (navigator.vibrate) navigator.vibrate(24);
      startEffectLoop();
    }

    function triggerTimeoutFeedback() {
      addPulseCell(state.player, "rgba(196, 69, 54, 0.26)", true, 260);
      addPulseCell(state.player, "#c44536", false, 330);
      addParticles(state.player, "#f6bd60", 8, 0.2, 2.6, 320);
      addParticles(state.player, "#c44536", 5, 0.16, 2.2, 280);
      addFloatingText(state.player, "TIME", "#c44536", 0.18, 520);
      restartClass(els.boardPanel, "board-damage");
      playTimeoutSfx();
      if (navigator.vibrate) navigator.vibrate(18);
      startEffectLoop();
    }

    function triggerEnemyHitFeedback(attacker) {
      animateEnemyAttack(attacker, 240);
      addPulseCell(state.player, "#c44536", false, 260);
      addParticles(state.player, "#c44536", 7, 0.2, 2.8, 300);
      restartClass(els.boardPanel, "board-damage");
      playEnemyAttackSfx();
      startEffectLoop();
    }

    function triggerBoardClearFeedback() {
      const burstTime = now();
      fx.clearBurst = { startedAt: burstTime, duration: 760, hue: Math.floor(Math.random() * 360) };
      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          if ((x + y) % 2 === 0) {
            fx.pulseCells.push({
              cell: { x, y },
              color: `hsla(${(x * 28 + y * 20 + fx.clearBurst.hue) % 360} 88% 68% / 0.9)`,
              fill: false,
              startedAt: burstTime + ((x + y) * 10),
              duration: 340
            });
          }
        }
      }
      const particleCount = prefersReducedEffects() ? 14 : 28;
      for (let i = 0; i < particleCount; i += 1) {
        const angle = (Math.PI * 2 * i) / particleCount;
        fx.particles.push({
          cell: { x: 3.5, y: 3.5 },
          color: `hsl(${(fx.clearBurst.hue + i * 12) % 360} 88% 64%)`,
          vx: Math.cos(angle) * (0.3 + Math.random() * 0.25),
          vy: Math.sin(angle) * (0.3 + Math.random() * 0.25),
          radius: 2.6 + Math.random() * 1.6,
          startedAt: burstTime,
          duration: 620
        });
      }
      restartClass(stats.score, "stat-pop");
      restartClass(els.boardPanel, "board-flash");
      playClearSfx();
      startEffectLoop();
    }

    function refillBagIfNeeded() {
      if (state.bag.drawPile.length > 0) return;
      state.level += 1;
      state.spawnCount = getSpawnCount(state.level);
      state.bag.drawPile = buildLevelBag(MODES[state.mode], state.level);
    }

    function drawType() {
      refillBagIfNeeded();
      return state.bag.drawPile.pop() || "pawn";
    }

    function spawnOne(type) {
      const cells = Rules.getEmptyCellsExceptPlayer(state, type);
      if (!cells.length) {
        triggerLifeLossFeedback();
        endGame();
        return false;
      }
      const cell = cells[Math.floor(Math.random() * cells.length)];
      const spawned = createPiece(type, cell.x, cell.y);
      placePieceOnBoard(state.board, spawned);
      animateSpawn(spawned, 220);
      addPulseCell(cell, "rgba(25, 114, 120, 0.75)", false, 180);
      addParticles(cell, "#197278", 4, 0.12, 2.1, 220);
      playSpawnSfx();
      startEffectLoop();
      return true;
    }

    function spawnFromBag(count) {
      for (let i = 0; i < count; i += 1) {
        spawnOne(drawType());
        if (state.gameOver) break;
      }
    }

    function ensureOpeningCapture() {
      if (Rules.getLegalCaptures(state).length > 0) return;
      const neighbors = [
        { x: state.player.x - 1, y: state.player.y - 1 },
        { x: state.player.x, y: state.player.y - 1 },
        { x: state.player.x + 1, y: state.player.y - 1 },
        { x: state.player.x - 1, y: state.player.y },
        { x: state.player.x + 1, y: state.player.y },
        { x: state.player.x - 1, y: state.player.y + 1 },
        { x: state.player.x, y: state.player.y + 1 },
        { x: state.player.x + 1, y: state.player.y + 1 }
      ].filter(cell => Rules.inBounds(cell.x, cell.y) && !state.board[Rules.idx(cell.x, cell.y)]);
      if (!neighbors.length) return;
      const cell = neighbors[Math.floor(Math.random() * neighbors.length)];
      placePieceOnBoard(state.board, createPiece("pawn", cell.x, cell.y));
    }

    function awardClearBonus() {
      const clearBonus = 500 * state.level;
      const comboBonus = state.bestCombo * 50;
      state.score += clearBonus + comboBonus;
      triggerBoardClearFeedback();
      state.level += 1;
      state.spawnCount = getSpawnCount(state.level);
      state.bag.drawPile = buildLevelBag(MODES[state.mode], state.level);
      spawnFromBag(Math.min(10, state.spawnCount + 4));
      setMessage(`${t.boardClear}: +${clearBonus + comboBonus}`, false, "pulse-combo");
    }

    function endGame(finishType = "gameover") {
      clearTurnTimer();
      state.gameOver = true;
      state.finishType = finishType;
      saveBest();
      trackGameEvent("game_finish", {
        mode: state.mode,
        finishType,
        score: state.score,
        level: state.level,
        turns: state.turn,
        bestCombo: state.bestCombo
      });
      const finishMessage = finishType === "timeout" ? (t.timeOver || "Time over") : t.gameOver;
      setMessage(`${finishMessage}. ${t.score}: ${state.score.toLocaleString()}`, true, "pulse-damage");
      showGameOverOverlay();
      setLeaderboardStatus(t.gameOverToSubmit);
      loadGameOverLeaderboard(state.mode, state.scoreId || "");
      render();
    }

    function updateLegal() {
      legalCaptures = Rules.getLegalCaptures(state);
      legalMoves = state.freeMoveAvailable ? Rules.getLegalMoves(state) : [];
      const preview = selectedPiece ? Rules.getPiecePreview(state, selectedPiece.piece) : [];
      legalActions = [
        ...preview,
        ...legalMoves.map(cell => ({ ...cell, kind: "move" })),
        ...legalCaptures.map(cell => ({ ...cell, kind: "capture" }))
      ];
    }

    function renderStats() {
      const currentDef = Rules.getPieceDef(state.player.type);
      els.score.textContent = state.score.toLocaleString();
      els.best.textContent = Math.max(bestScore(state.mode), state.score).toLocaleString();
      if (els.level) els.level.textContent = String(state.level);
      if (els.combo) els.combo.textContent = String(state.combo);
      if (els.current) els.current.textContent = state.player.type === "bigrook"
        ? displayName(state.player.type)
        : `${currentDef.label} ${displayName(state.player.type)}`;
      if (els.submitScore) els.submitScore.disabled = !state.gameOver || !!state.scoreUploaded;
    }

    function newGame(mode = selectedMode()) {
      const debugConfig = parseDebugConfig();
      const selectedMode = debugConfig.mode || (MODES[mode] ? mode : "basic");
      state = {
        mode: selectedMode,
        board: Array(SIZE * SIZE).fill(null),
        player: { type: "king", x: 3, y: 4 },
        playerMeta: {},
        score: 0,
        combo: 0,
        bestCombo: 0,
        level: 1,
        spawnCount: 2,
        turn: 0,
        phaseLocked: false,
        turnActionTaken: false,
        freeMoveAvailable: true,
        bag: { drawPile: createBagFromComposition(MODES[selectedMode].startingBag) },
        gameOver: false,
        finishType: "",
        scoreUploaded: false,
        scoreId: ""
      };
      clearTurnTimer();
      fx.playerMotion = null;
      fx.enemyAttackMotion = null;
      fx.spawnMotions = [];
      fx.pulseCells = [];
      fx.particles = [];
      fx.floatingTexts = [];
      fx.captureGhosts = [];
      fx.clearBurst = null;
      if (els.mode) els.mode.value = selectedMode;
      showGameScreen();
      hideGameOverOverlay();
      spawnFromBag(8);
      ensureOpeningCapture();
      const debugApplied = applyDebugConfig(debugConfig);
      selectedPiece = null;
      if (debugApplied) {
        const parts = [];
        if (debugConfig.playerType) parts.push(`player=${debugConfig.playerType}`);
        if (debugConfig.spawn.length) parts.push(`spawn=${debugConfig.spawn.join(",")}`);
        setMessage(`DEBUG - ${parts.join(" / ") || "custom start"}`, false, "pulse-note");
      } else {
        setMessage(`${t.title} - ${modeLabel(t, selectedMode)}`);
      }
      render();
      armTurnTimer();
      trackGameEvent("game_start", { mode: selectedMode, level: 1 });
    }

    function finishCaptureAt(x, y) {
      if (state.gameOver || state.phaseLocked) return;
      const capture = legalCaptures.find(item => item.x === x && item.y === y);
      if (!capture) {
        playBlockedSfx();
        setMessage(t.blocked, true, "pulse-damage");
        return;
      }
      clearTurnTimer();

      const from = { x: state.player.x, y: state.player.y };
      const destination = { x: capture.anchorX ?? x, y: capture.anchorY ?? y };
      const clickedTarget = state.board[Rules.idx(x, y)];
      let capturedEntities = [];
      if (clickedTarget && clickedTarget.type === "bigrook" && clickedTarget.segments && clickedTarget.segments.left && clickedTarget.segments.right) {
        capturedEntities = [{
          x,
          y,
          target: clickedTarget,
          partial: true,
          segment: x <= clickedTarget.anchorX ? "left" : "right",
          scoreOverride: Math.floor(Rules.getPieceDef("bigrook").score / 2)
        }];
      } else {
        const capturedCells = capture.targets || [{ x, y, target: clickedTarget }];
        const capturedSeen = new Set();
        capturedCells.forEach((cell) => {
          const target = cell.target;
          if (!target) return;
          const key = target.id || `${target.type}:${target.anchorX ?? target.x},${target.anchorY ?? target.y}`;
          if (capturedSeen.has(key)) return;
          capturedSeen.add(key);
          capturedEntities.push({
            x: cell.x,
            y: cell.y,
            target
          });
        });
      }
      const capturedDefs = capturedEntities.map((cell) => Rules.getPieceDef(cell.target.type));
      const capturedNames = capturedEntities.map((cell) => cell.target.type === "bigrook" ? displayName(cell.target.type) : Rules.getPieceDef(cell.target.type).label);
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      const gained = capturedEntities.reduce((sum, cell) => sum + (cell.scoreOverride || Rules.getPieceDef(cell.target.type).score), 0) * state.combo;
      state.score += gained;

      capturedEntities.forEach((cell) => {
        clearPieceFromBoard(state.board, cell.target);
        if (cell.partial && cell.target.type === "bigrook" && cell.segment) {
          cell.target.segments[cell.segment] = false;
          placePieceOnBoard(state.board, cell.target);
        }
      });

      let nextType = state.player.type;
      let nextPos = { x, y };
      let meta = { ...state.playerMeta };
      const nonPawnTargets = capturedEntities.filter((cell) => cell.target.type !== "pawn");
      const lastNonPawn = nonPawnTargets.length
        ? nonPawnTargets.reduce((best, cell) => {
          if (!best) return cell;
          return Rules.getPieceDef(cell.target.type).score >= Rules.getPieceDef(best.target.type).score ? cell : best;
        }, null)
        : null;

      if (state.player.type === "bigrook") {
        const count = (state.playerMeta.bigRookNonPawn || 0) + nonPawnTargets.length;
        if (count >= 2 && lastNonPawn) {
          nextType = lastNonPawn.target.type;
          nextPos = { x: lastNonPawn.target.anchorX ?? lastNonPawn.x, y: lastNonPawn.target.anchorY ?? lastNonPawn.y };
          meta = {};
        } else {
          meta.bigRookNonPawn = count;
        }
      } else {
        const primary = capturedEntities[0].target;
        if (primary.type === "bigrook") {
          const count = (state.playerMeta.bigRookCaptured || 0) + 1;
          if (count >= 2) {
            nextType = "bigrook";
            nextPos = { x: primary.anchorX ?? destination.x, y: primary.anchorY ?? destination.y };
            meta = { bigRookNonPawn: 0 };
          } else {
            meta.bigRookCaptured = count;
          }
        } else if (primary.type !== "pawn") {
          nextType = primary.type;
        }
      }

      state.player = { type: nextType, x: nextPos.x, y: nextPos.y };
      state.playerMeta = nextType === "bigrook" ? { bigRookNonPawn: meta.bigRookNonPawn || 0 } : meta;
      state.turnActionTaken = true;
      selectedPiece = null;
      state.freeMoveAvailable = true;
      state.turn += 1;

      triggerCaptureFeedback(from, nextPos, capturedEntities[0].target, gained);
      const bigRookNote = state.player.type === "bigrook" && state.playerMeta.bigRookNonPawn
        ? ` / Big Rook ${state.playerMeta.bigRookNonPawn}/2`
        : "";
      const pendingBigRookNote = state.playerMeta.bigRookCaptured
        ? ` / Big Rook ${state.playerMeta.bigRookCaptured}/2`
        : "";
      const keptNote = state.player.type !== "bigrook" && capturedEntities.length === 1 && capturedEntities[0].target.type === "pawn"
        ? ` / ${t.pawnBonus || "Piece kept."}`
        : "";
      setMessage(`${t.captured}: ${capturedNames.join("+")} +${gained}${keptNote}${bigRookNote}${pendingBigRookNote}`, false, state.combo > 1 ? "pulse-combo" : "pulse-note");

      if (Rules.isBoardClear(state)) awardClearBonus();
      render();
      armTurnTimer();
    }

    function moveTo(x, y) {
      if (state.gameOver || state.phaseLocked || !state.freeMoveAvailable) return;
      const move = legalMoves.find(item => item.x === x && item.y === y);
      if (!move) {
        playBlockedSfx();
        setMessage(t.blocked, true, "pulse-damage");
        return;
      }
      clearTurnTimer();
      const from = { x: state.player.x, y: state.player.y };
      const destination = { x: move.anchorX ?? x, y: move.anchorY ?? y };
      state.player = { ...state.player, x: destination.x, y: destination.y };
      state.turnActionTaken = true;
      selectedPiece = null;
      state.freeMoveAvailable = false;
      state.turn += 1;
      triggerMoveFeedback(from, destination);
      const held = state.combo > 0 ? ` Combo x${state.combo} held.` : "";
      setMessage(`${t.moved || "Moved."}${held}`, false, "pulse-note");
      render();
      armTurnTimer();
    }

    function selectPiece(x, y, piece, canCapture) {
      const previewOrigin = { x: piece.anchorX ?? x, y: piece.anchorY ?? y };
      const previewPiece = canCapture && piece.type === "pawn"
        ? { type: state.player.type, x: previewOrigin.x, y: previewOrigin.y }
        : { ...piece, x: previewOrigin.x, y: previewOrigin.y };
      selectedPiece = { x, y, piece: previewPiece };
      if (canCapture) {
        const def = Rules.getPieceDef(piece.type);
        const suffix = piece.type === "pawn" ? ` / ${t.pawnBonus || "Piece kept."}` : "";
        setMessage(`${def.label}: ${t.selectAgain || "Tap again to capture."}${suffix}`);
      } else {
        setMessage(t.preview || "Move preview.");
      }
      render();
    }

    function handleBoardClick(x, y) {
      if (state.gameOver || state.phaseLocked) return;
      ensureAudio();
      const target = state.board[Rules.idx(x, y)];
      const capture = legalCaptures.find(item => item.x === x && item.y === y);

      if (target) {
        if (capture && selectedPiece && selectedPiece.x === x && selectedPiece.y === y) {
          finishCaptureAt(x, y);
          return;
        }
        selectPiece(x, y, target, !!capture);
        return;
      }

      moveTo(x, y);
      if (!state.freeMoveAvailable) return;

      selectedPiece = null;
      playBlockedSfx();
      setMessage(t.blocked, true, "pulse-damage");
      render();
    }

    function waitMs(ms) {
      return new Promise(resolve => window.setTimeout(resolve, ms));
    }

    async function resolveEnemyAttacks(attackers) {
      if (!attackers.length) return false;
      for (const attacker of attackers) {
        clearPieceFromBoard(state.board, attacker);
        render();
        triggerEnemyHitFeedback(attacker);
        await waitMs(260);
        setMessage(enemyAttackMessage(Rules.getPieceDef(attacker.type).label), true, "pulse-damage");
        render();
        await waitMs(140);
        return true;
      }
      return false;
    }

    async function endTurn(reason = "manual") {
      if (state.gameOver || state.phaseLocked) return;
      ensureAudio();
      clearTurnTimer();
      state.phaseLocked = true;
      selectedPiece = null;
      updateLegal();
      if (reason === "timeout") triggerTimeoutFeedback();
      setMessage(reason === "timeout" ? (t.timeOverTurn || "Time over. Turn ended.") : t.turnEnded, reason === "timeout", reason === "timeout" ? "pulse-damage" : "pulse-note");
      const pendingAttackers = getEnemyAttackersCompat(state).map(attacker => ({ ...attacker }));
      state.combo = 0;
      state.freeMoveAvailable = true;
      state.turn += 1;
      state.turnActionTaken = false;
      spawnFromBag(state.spawnCount);
      if (state.gameOver) {
        state.phaseLocked = false;
        render();
        return;
      }
      const defeated = await resolveEnemyAttacks(pendingAttackers);
      if (defeated) {
        endGame();
      } else {
        setMessage(noEnemyReachMessage(), false, "pulse-note");
      }
      state.phaseLocked = false;
      render();
      armTurnTimer();
    }

    canvas.addEventListener("click", event => {
      const cell = Renderer.cellFromPointer(canvas, event);
      if (cell) handleBoardClick(cell.x, cell.y);
    });

    window.addEventListener("resize", () => {
      if (state) render();
    });

    els.startGame?.addEventListener("click", () => {
      ensureAudio();
      newGame(selectedMode());
    });
    els.restart.addEventListener("click", () => {
      ensureAudio();
      newGame(state?.mode || selectedMode());
    });
    els.overlayRestart?.addEventListener("click", () => {
      ensureAudio();
      newGame(state?.mode || selectedMode());
    });
    els.endTurn.addEventListener("click", () => endTurn());
    els.menu?.addEventListener("click", returnToIntro);
    els.menuSecondary?.addEventListener("click", returnToIntro);
    els.introLeaderboardToggle?.addEventListener("click", toggleIntroLeaderboard);
    els.mode?.addEventListener("change", () => {
      refreshIntroBest(selectedMode());
      if (els.introLeaderboardPanel && !els.introLeaderboardPanel.classList.contains("hidden")) {
        loadIntroLeaderboard(selectedMode());
      }
    });
    if (els.playerName) {
      els.playerName.addEventListener("change", () => {
        localStorage.setItem(playerNameKey, currentPlayerName());
        els.playerName.value = currentPlayerName();
      });
    }
    if (els.submitScore) els.submitScore.addEventListener("click", submitScore);
    els.shareX?.addEventListener("click", shareToX);
    els.shareNative?.addEventListener("click", shareNative);
    els.copyResult?.addEventListener("click", copyResult);

    trackGameEvent("page_view", { mode: selectedMode() });
    showIntroScreen();
    refreshIntroBest(selectedMode());
  }

  window.CrownChainGame = { init };
}());
