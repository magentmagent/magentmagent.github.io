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
      boardPanel: document.querySelector(".board-panel"),
      score: document.querySelector("#scoreValue"),
      best: document.querySelector("#bestValue"),
      life: document.querySelector("#lifeValue"),
      level: document.querySelector("#levelValue"),
      combo: document.querySelector("#comboValue"),
      bestCombo: document.querySelector("#bestComboValue"),
      spawn: document.querySelector("#spawnValue"),
      bag: document.querySelector("#bagValue"),
      current: document.querySelector("#currentValue"),
      legal: document.querySelector("#legalValue"),
      mode: document.querySelector("#modeSelect"),
      newGame: document.querySelector("#newGameBtn"),
      endTurn: document.querySelector("#endTurnBtn"),
      restart: document.querySelector("#restartBtn"),
      message: document.querySelector("#message"),
      pieceList: document.querySelector("#pieceList"),
      playerName: document.querySelector("#playerNameInput"),
      submitScore: document.querySelector("#submitScoreBtn"),
      leaderboardScope: document.querySelector("#leaderboardScope"),
      leaderboardList: document.querySelector("#leaderboardList"),
      leaderboardStatus: document.querySelector("#leaderboardStatus"),
      leaderboardHint: document.querySelector("#leaderboardHint")
    };

    const stats = {
      score: els.score ? els.score.closest(".stat") : null,
      life: els.life ? els.life.closest(".stat") : null,
      combo: els.combo ? els.combo.closest(".stat") : null,
      current: els.current ? els.current.closest(".stat") : null
    };

    const playerNameKey = `crownChainPlayerName:${lang}`;
    let state = null;
    let legalCaptures = [];
    let legalMoves = [];
    let legalActions = [];
    let selectedPiece = null;
    let rafId = 0;
    let audioContext = null;
    const sfxGainScale = 3.1;
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
      return mode === "chaos" ? "chaos" : "basic";
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

    function setLeaderboardStatus(message, isError = false) {
      if (!els.leaderboardStatus) return;
      els.leaderboardStatus.textContent = message;
      els.leaderboardStatus.classList.toggle("error", isError);
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

    function leaderboardModeLabel(mode) {
      return `${modeLabel(t, mode)} ${t.leaderboard}`;
    }

    function renderLeaderboard(items, ownRank = null, ownItem = null) {
      if (!els.leaderboardList) return;
      els.leaderboardList.innerHTML = "";
      if (!items.length) {
        const empty = document.createElement("li");
        empty.innerHTML = `<span class="rank">-</span><span class="name">${t.leaderboardEmpty}</span><span class="score-value">0</span>`;
        els.leaderboardList.appendChild(empty);
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
        els.leaderboardList.appendChild(row);
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
      els.leaderboardList.appendChild(row);
    }

    async function loadLeaderboard(mode = state?.mode || els.mode.value || "basic", ownId = "") {
      if (els.leaderboardScope) els.leaderboardScope.textContent = leaderboardModeLabel(mode);
      if (!SUGGEST_API) {
        renderLeaderboard([]);
        setLeaderboardStatus(t.rankingsUnavailable, true);
        return;
      }
      setLeaderboardStatus(t.rankingsLoading);
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
        renderLeaderboard(Array.isArray(data.items) ? data.items : [], data.ownRank, data.ownItem);
        setLeaderboardStatus(state?.scoreUploaded ? t.scoreUploaded : state?.gameOver ? t.gameOverToSubmit : t.submitHint);
      } catch (error) {
        renderLeaderboard([]);
        setLeaderboardStatus(error.message || t.rankingsFailed, true);
      }
    }

    function currentPlayerName() {
      return String(els.playerName?.value || "").trim().slice(0, 16) || t.namePlaceholder;
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
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: "application/json" });
          if (navigator.sendBeacon(`${SUGGEST_API}/events`, blob)) return;
        }
        fetch(`${SUGGEST_API}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true
        }).catch(() => {});
      } catch {
        // Analytics should never interrupt play.
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
        await loadLeaderboard(state.mode, state.scoreId);
      } catch (error) {
        setLeaderboardStatus(error.message || t.uploadFailed, true);
      } finally {
        els.submitScore.disabled = state.scoreUploaded;
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
      return !!(fx.playerMotion || fx.enemyAttackMotion || fx.spawnMotions.length || fx.pulseCells.length || fx.particles.length || fx.floatingTexts.length || fx.captureGhosts.length || fx.clearBurst || (state && state.combo >= 2));
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
        clearBurst: fx.clearBurst
      });
      renderStats();
      renderPieceList();
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
      restartClass(stats.life, "stat-damage");
      restartClass(els.boardPanel, "board-damage");
      playDamageSfx();
      if (navigator.vibrate) navigator.vibrate(24);
      startEffectLoop();
    }

    function triggerEnemyHitFeedback(attacker) {
      animateEnemyAttack(attacker, 240);
      addPulseCell(state.player, "#c44536", false, 260);
      addParticles(state.player, "#c44536", 7, 0.2, 2.8, 300);
      restartClass(stats.life, "stat-damage");
      restartClass(els.boardPanel, "board-damage");
      playEnemyAttackSfx();
      startEffectLoop();
    }

    function triggerLifeHealFeedback() {
      addPulseCell(state.player, "rgba(25, 114, 120, 0.18)", true, 220);
      addPulseCell(state.player, "#197278", false, 260);
      addParticles(state.player, "#197278", 6, 0.16, 2.4, 280);
      addFloatingText(state.player, "+1 LIFE", "#197278", 0.18, 520);
      restartClass(stats.life, "stat-heal");
      playHealSfx();
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
      for (let i = 0; i < 28; i += 1) {
        const angle = (Math.PI * 2 * i) / 28;
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
        state.life -= 1;
        triggerLifeLossFeedback();
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
        if (state.life <= 0) break;
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
      const lifeBonus = state.life * 100;
      const comboBonus = state.bestCombo * 50;
      state.score += clearBonus + lifeBonus + comboBonus;
      triggerBoardClearFeedback();
      state.level += 1;
      state.spawnCount = getSpawnCount(state.level);
      state.bag.drawPile = buildLevelBag(MODES[state.mode], state.level);
      spawnFromBag(Math.min(10, state.spawnCount + 4));
      setMessage(`${t.boardClear}: +${clearBonus + lifeBonus + comboBonus}`, false, "pulse-combo");
    }

    function endGame() {
      state.gameOver = true;
      saveBest();
      trackGameEvent("game_finish", {
        mode: state.mode,
        finishType: "gameover",
        score: state.score,
        level: state.level,
        turns: state.turn,
        bestCombo: state.bestCombo
      });
      setMessage(`${t.gameOver}. ${t.score}: ${state.score.toLocaleString()}`, true, "pulse-damage");
      setLeaderboardStatus(t.gameOverToSubmit);
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
      els.life.textContent = `${state.life}/${state.maxLife}`;
      if (els.level) els.level.textContent = String(state.level);
      if (els.combo) els.combo.textContent = String(state.combo);
      if (els.bestCombo) els.bestCombo.textContent = String(state.bestCombo);
      if (els.spawn) els.spawn.textContent = String(state.spawnCount);
      if (els.bag) els.bag.textContent = String(state.bag.drawPile.length);
      if (els.current) els.current.textContent = state.player.type === "bigrook"
        ? displayName(state.player.type)
        : `${currentDef.label} ${displayName(state.player.type)}`;
      if (els.legal) els.legal.textContent = String(legalCaptures.length || legalMoves.length);
      els.mode.disabled = !state.gameOver && state.turn > 0;
      if (els.submitScore) els.submitScore.disabled = !state.gameOver || !!state.scoreUploaded;
    }

    function renderPieceList() {
      if (!els.pieceList) return;
      const visible = state.mode === "chaos" ? Object.keys(PIECES) : ["pawn", "king", "rook", "bishop", "knight", "queen"];
      els.pieceList.innerHTML = "";
      for (const type of visible) {
        const def = Rules.getPieceDef(type);
        const chip = document.createElement("span");
        chip.textContent = type === "bigrook"
          ? `${displayName(type)} ${def.score}`
          : `${def.label} ${def.score}`;
        els.pieceList.appendChild(chip);
      }
    }

    function newGame(mode = els.mode.value || "basic") {
      const debugConfig = parseDebugConfig();
      const selectedMode = debugConfig.mode || (MODES[mode] ? mode : "basic");
      state = {
        mode: selectedMode,
        board: Array(SIZE * SIZE).fill(null),
        player: { type: "king", x: 3, y: 4 },
        playerMeta: {},
        life: 3,
        maxLife: 3,
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
        scoreUploaded: false,
        scoreId: ""
      };
      fx.playerMotion = null;
      fx.enemyAttackMotion = null;
      fx.spawnMotions = [];
      fx.pulseCells = [];
      fx.particles = [];
      fx.floatingTexts = [];
      fx.captureGhosts = [];
      fx.clearBurst = null;
      els.mode.value = selectedMode;
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
      loadLeaderboard(selectedMode);
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

      let healed = false;
      if (state.life < state.maxLife) {
        state.life += 1;
        healed = true;
      } else {
        state.score += 25 * state.combo;
      }

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
      if (healed) triggerLifeHealFeedback();
      if (healed) {
        setMessage(`${t.captured}: ${capturedNames.join("+")} +${gained} / +1 life`, false, state.combo > 1 ? "pulse-combo" : "pulse-heal");
      } else {
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
      }

      if (Rules.isBoardClear(state)) awardClearBonus();
      if (state.life <= 0) endGame();
      else render();
    }

    function moveTo(x, y) {
      if (state.gameOver || state.phaseLocked || !state.freeMoveAvailable) return;
      const move = legalMoves.find(item => item.x === x && item.y === y);
      if (!move) {
        playBlockedSfx();
        setMessage(t.blocked, true, "pulse-damage");
        return;
      }
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
      if (!attackers.length) return 0;
      let hits = 0;
      for (const attacker of attackers) {
        clearPieceFromBoard(state.board, attacker);
        render();
        triggerEnemyHitFeedback(attacker);
        await waitMs(260);
        state.life -= 1;
        hits += 1;
        setMessage(`Under attack: ${Rules.getPieceDef(attacker.type).label} -1 life`, true, "pulse-damage");
        render();
        if (state.life <= 0) break;
        await waitMs(120);
      }
      return hits;
    }

    async function endTurn() {
      if (state.gameOver || state.phaseLocked) return;
      ensureAudio();
      state.phaseLocked = true;
      selectedPiece = null;
      updateLegal();
      setMessage(t.turnEnded, false, "pulse-note");
      const pendingAttackers = getEnemyAttackersCompat(state).map(attacker => ({ ...attacker }));
      state.combo = 0;
      state.freeMoveAvailable = true;
      state.turn += 1;
      state.turnActionTaken = false;
      spawnFromBag(state.spawnCount);
      const hits = await resolveEnemyAttacks(pendingAttackers);
      if (state.life <= 0) {
        endGame();
      } else if (hits === 0) {
        setMessage("No enemy could reach you.", false, "pulse-note");
      }
      state.phaseLocked = false;
      render();
    }

    canvas.addEventListener("click", event => {
      const cell = Renderer.cellFromPointer(canvas, event);
      if (cell) handleBoardClick(cell.x, cell.y);
    });

    window.addEventListener("resize", () => {
      if (state) render();
    });

    els.newGame.addEventListener("click", () => {
      ensureAudio();
      newGame(els.mode.value);
    });
    els.restart.addEventListener("click", () => {
      ensureAudio();
      newGame(els.mode.value);
    });
    els.endTurn.addEventListener("click", endTurn);
    els.mode.addEventListener("change", () => {
      if (!state || state.gameOver || state.turn === 0) newGame(els.mode.value);
    });
    if (els.playerName) {
      els.playerName.addEventListener("change", () => {
        localStorage.setItem(playerNameKey, currentPlayerName());
        els.playerName.value = currentPlayerName();
      });
    }
    if (els.submitScore) els.submitScore.addEventListener("click", submitScore);

    trackGameEvent("page_view", { mode: els.mode.value || "basic" });
    newGame(els.mode.value || "basic");
  }

  window.CrownChainGame = { init };
}());
