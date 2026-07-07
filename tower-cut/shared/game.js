(function () {
  const lang = window.TOWER_CUT_LANG || "en";
  const T = window.TOWER_CUT_TEXT;
  const DEFAULT_SECONDS = 60;
  const DURATIONS = [60, 180];
  const GAME_NAME = "tower-cut";
  const SCORE_SCOPE = 6;
  const SUGGEST_API = String(window.WORDSNAKE_SUGGEST_API || "").replace(/\/+$/, "");
  const playerNameKey = "towerCutPlayerName";
  const blocks = [
    { id: "square", mark: "■" },
    { id: "circle", mark: "●" },
    { id: "triangle", mark: "▲" },
    { id: "diamond", mark: "◆" }
  ];

  const els = {
    time: document.querySelector("#timeValue"),
    score: document.querySelector("#scoreValue"),
    combo: document.querySelector("#comboValue"),
    stage: document.querySelector("#stageValue"),
    target: document.querySelector("#targetTower"),
    current: document.querySelector("#currentTower"),
    targetLabels: document.querySelector("#targetLabels"),
    currentLabels: document.querySelector("#currentLabels"),
    palette: document.querySelector("#palette"),
    message: document.querySelector("#message"),
    startView: document.querySelector("#startView"),
    gameView: document.querySelector("#gameView"),
    playArea: document.querySelector(".play-area"),
    resultOverlay: document.querySelector("#resultOverlay"),
    resultEyebrow: document.querySelector("#resultEyebrow"),
    startBtn: document.querySelector("#startBtn"),
    introLeaderboardToggle: document.querySelector("#introLeaderboardToggle"),
    introLeaderboardPanel: document.querySelector("#introLeaderboardPanel"),
    introLeaderboardScope: document.querySelector("#introLeaderboardScope"),
    introLeaderboardList: document.querySelector("#introLeaderboardList"),
    introLeaderboardStatus: document.querySelector("#introLeaderboardStatus"),
    restartBtns: document.querySelectorAll("[data-action='restart']"),
    endBtn: document.querySelector("#endBtn"),
    resultTitle: document.querySelector("#resultTitle"),
    resultStats: document.querySelector("#resultStats"),
    playerName: document.querySelector("#playerNameInput"),
    submitScore: document.querySelector("#submitScoreBtn"),
    leaderboardScope: document.querySelector("#leaderboardScope"),
    leaderboardList: document.querySelector("#leaderboardList"),
    leaderboardStatus: document.querySelector("#leaderboardStatus"),
    shareX: document.querySelector("#shareXBtn"),
    shareNative: document.querySelector("#shareNativeBtn"),
    copyResult: document.querySelector("#copyResultBtn"),
    shareStatus: document.querySelector("#shareStatus"),
    durationSelect: document.querySelector("#durationSelect"),
    langSelect: document.querySelector("#langSelect")
  };

  let state;
  let timerId = 0;
  let audioCtx = null;
  let pointerDrag = null;
  let suppressPaletteClick = false;

  function rnd(max) {
    return Math.floor(Math.random() * max);
  }

  function pick(pool) {
    return pool[rnd(pool.length)];
  }

  function selectedDuration() {
    const value = Number(els.durationSelect?.value || DEFAULT_SECONDS);
    return DURATIONS.includes(value) ? value : DEFAULT_SECONDS;
  }

  function modeForDuration(seconds = selectedDuration()) {
    const value = Number(seconds);
    return String(DURATIONS.includes(value) ? value : DEFAULT_SECONDS);
  }

  function durationLabel(seconds = selectedDuration()) {
    const value = Number(seconds);
    const normalized = DURATIONS.includes(value) ? value : DEFAULT_SECONDS;
    const unit = T.seconds || "sec";
    return lang === "en" ? `${normalized} ${unit}` : `${normalized}${unit}`;
  }

  function leaderboardLabel(seconds = selectedDuration()) {
    return `${T.leaderboard || "Ranking"} · ${durationLabel(seconds)}`;
  }

  function rangeForStage(stage) {
    if (stage <= 1) return { columns: 1, minH: 2, maxH: 3, types: 2 };
    if (stage <= 2) return { columns: 1, minH: 4, maxH: 5, types: 3 };
    if (stage <= 3) return { columns: 2, minH: 2, maxH: 3, types: 3 };
    if (stage <= 4) return { columns: 2, minH: 4, maxH: 5, types: 3 };
    if (stage <= 5) return { columns: 3, minH: 2, maxH: 3, types: 3 };
    if (stage <= 10) return { columns: 3, minH: 4, maxH: 6, types: stage >= 8 ? 4 : 3 };
    if (stage <= 11) return { columns: 4, minH: 2, maxH: 3, types: 4 };
    return { columns: 4, minH: 4, maxH: 6, types: 4 };
  }

  function makeStack(height, typeCount) {
    const pool = blocks.slice(0, typeCount).map(block => block.id);
    return Array.from({ length: height }, () => pick(pool));
  }

  function towersEqual(a, b) {
    return a.length === b.length && a.every((stack, col) =>
      stack.length === b[col].length && stack.every((block, row) => block === b[col][row])
    );
  }

  function optimalClicks(target, current) {
    return target.reduce((sum, targetStack, col) => {
      const currentStack = current[col] || [];
      const keep = longestTargetPrefixSubsequence(targetStack, currentStack);
      return sum + (currentStack.length - keep) + (targetStack.length - keep);
    }, 0);
  }

  function longestTargetPrefixSubsequence(targetStack, currentStack) {
    let keep = 0;
    for (const block of currentStack) {
      if (block === targetStack[keep]) keep += 1;
      if (keep >= targetStack.length) break;
    }
    return keep;
  }

  function makeStage(stage) {
    const cfg = rangeForStage(stage);
    let target;
    let current;
    let tries = 0;
    do {
      target = Array.from({ length: cfg.columns }, () => {
        const height = cfg.minH + rnd(cfg.maxH - cfg.minH + 1);
        return makeStack(height, cfg.types);
      });
      current = target.map(stack => mutateStack(stack, cfg.types, stage));
      tries += 1;
    } while (towersEqual(target, current) && tries < 20);
    if (towersEqual(target, current)) {
      current[0].push(blocks[0].id === target[0][target[0].length - 1] ? blocks[1].id : blocks[0].id);
    }
    return {
      target,
      current,
      optimal: optimalClicks(target, current)
    };
  }

  function mutateStack(targetStack, typeCount, stage) {
    const pool = blocks.slice(0, typeCount).map(block => block.id);
    const keepMax = Math.max(0, targetStack.length - 1);
    const keepBias = stage <= 2 ? Math.max(1, targetStack.length - 2) : 0;
    const keep = keepBias + rnd(Math.max(1, keepMax - keepBias + 1));
    const stack = targetStack.slice(0, keep);
    const mode = rnd(4);
    let extra = mode === 0 ? 0 : 1 + rnd(stage >= 6 ? 3 : 2);
    if (mode === 3 && stack.length > 0) stack.pop();
    while (extra > 0 && stack.length < 6) {
      let next = pick(pool);
      const targetAt = targetStack[stack.length];
      if (next === targetAt && pool.length > 1) next = pool.find(id => id !== next) || next;
      stack.push(next);
      extra -= 1;
    }
    return stack;
  }

  function newGame() {
    clearInterval(timerId);
    const seconds = selectedDuration();
    state = {
      started: false,
      finished: false,
      selected: blocks[0].id,
      score: 0,
      stage: 1,
      combo: 0,
      maxCombo: 0,
      cleared: 0,
      perfect: 0,
      totalClicks: 0,
      stageClicks: 0,
      durationSeconds: seconds,
      timeLeft: seconds,
      stageData: makeStage(1),
      scoreUploaded: false,
      scoreId: "",
      finishType: ""
    };
    showStart(true);
    showResult(false);
    if (els.playerName) els.playerName.value = localStorage.getItem(playerNameKey) || "";
    setMessage(T.msgReady);
    render();
  }

  function startGame() {
    if (state.started) return;
    state.started = true;
    state.durationSeconds = selectedDuration();
    state.timeLeft = state.durationSeconds;
    ensureAudio();
    playSfx("start");
    showStart(false);
    timerId = setInterval(tick, 250);
    setMessage(T.msgDrag);
    trackGameEvent("game_start", { mode: modeForDuration(state.durationSeconds), durationSeconds: state.durationSeconds });
    render();
  }

  function tick() {
    if (!state.started || state.finished) return;
    state.timeLeft = Math.max(0, state.timeLeft - 0.25);
    if (state.timeLeft <= 0) finish("timeout");
    renderHud();
  }

  function finish(reason) {
    if (state.finished) return;
    state.finished = true;
    state.finishType = reason || "timeout";
    clearInterval(timerId);
    playSfx("end");
    showResult(true, reason);
    trackGameEvent("game_finish", resultPayload(reason));
    renderHud();
  }

  function clearStage() {
    const clicks = state.stageClicks;
    const optimal = state.stageData.optimal;
    const over = Math.max(0, clicks - optimal);
    const perfect = over === 0;
    if (perfect) {
      state.combo += 1;
      state.perfect += 1;
    } else {
      state.combo = 0;
    }
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    const comboBonus = perfect ? Math.min(100, state.combo * 12) : 0;
    const timeBonus = Math.ceil(state.timeLeft);
    const gained = Math.max(20, 100 + (perfect ? 50 : 0) + comboBonus + timeBonus - over * 10);
    state.score += gained;
    state.cleared += 1;
    document.querySelector(".play-area")?.classList.add("stage-flash");
    playSfx(perfect ? "perfect" : "clear");
    setMessage(perfect ? T.msgPerfect(gained) : T.msgClear(gained, over));
    setTimeout(() => document.querySelector(".play-area")?.classList.remove("stage-flash"), 420);
    setTimeout(() => {
      if (state.finished) return;
      state.stage += 1;
      state.stageClicks = 0;
      state.stageData = makeStage(state.stage);
      setMessage(T.msgNext);
      render();
    }, 680);
  }

  function addClick() {
    state.stageClicks += 1;
    state.totalClicks += 1;
  }

  function placeBlock(col, blockId = state.selected) {
    if (!state.started || state.finished) return;
    const stack = state.stageData.current[col];
    if (!stack || stack.length >= 6) {
      setMessage(T.msgFull);
      playSfx("deny");
      return;
    }
    stack.push(blockId);
    state.selected = blockId;
    addClick();
    setMessage(T.msgPlaced);
    playSfx("place");
    render();
    const placed = document.querySelector(`#currentTower [data-col="${col}"][data-row="${stack.length - 1}"]`);
    placed?.classList.add("placed");
    setTimeout(() => {
      placed?.classList.remove("placed");
      if (towersEqual(state.stageData.target, state.stageData.current)) clearStage();
    }, 130);
  }

  function cutBlock(col, row) {
    if (!state.started || state.finished) return;
    const stack = state.stageData.current[col];
    if (!stack || row < 0 || row >= stack.length) return;
    const nodes = [...document.querySelectorAll(`#currentTower [data-col="${col}"]`)]
      .filter(node => Number(node.dataset.row) === row);
    nodes.forEach((node, index) => {
      node.style.setProperty("--cut-delay", `${index * 24}ms`);
      node.classList.add("cutting");
    });
    addClick();
    setMessage(T.msgCut);
    playSfx("cut");
    setTimeout(() => {
      stack.splice(row, 1);
      render();
      if (towersEqual(state.stageData.target, state.stageData.current)) clearStage();
    }, 190);
  }

  function render() {
    renderHud();
    renderTower(els.target, els.targetLabels, state.stageData.target, false);
    renderTower(els.current, els.currentLabels, state.stageData.current, true);
    renderPalette();
  }

  function renderHud() {
    els.time.textContent = Math.ceil(state.timeLeft);
    els.score.textContent = state.score.toLocaleString(lang === "en" ? "en-US" : lang);
    els.combo.textContent = `x${Math.max(1, state.combo || 1)}`;
    els.stage.textContent = state.stage;
  }

  function blockInfo(id) {
    return blocks.find(block => block.id === id) || blocks[0];
  }

  function blockNode(id) {
    const info = blockInfo(id);
    const node = document.createElement("span");
    node.className = `block ${info.id}`;
    const mark = document.createElement("span");
    mark.textContent = info.mark;
    node.appendChild(mark);
    return node;
  }

  function renderTower(root, labelsRoot, tower, editable) {
    root.innerHTML = "";
    labelsRoot.innerHTML = "";
    root.classList.toggle("editable", editable);
    root.style.gridTemplateColumns = `repeat(${tower.length}, var(--tower-column-size))`;
    labelsRoot.style.gridTemplateColumns = `repeat(${tower.length}, var(--tower-column-size))`;
    tower.forEach((stack, col) => {
      const column = document.createElement("div");
      column.className = "column";
      column.dataset.col = String(col);
      if (editable) wireDropColumn(column, col);
      if (editable) {
        const topPad = document.createElement("button");
        topPad.className = `drop-zone ${stack.length >= 6 ? "full" : ""}`;
        topPad.type = "button";
        topPad.textContent = "+";
        topPad.setAttribute("aria-label", `${T.placeColumn} ${col + 1}`);
        topPad.addEventListener("click", event => {
          event.stopPropagation();
          placeBlock(col, state.selected);
        });
        column.appendChild(topPad);
      }
      stack.slice().reverse().forEach((id, reverseIndex) => {
        const row = stack.length - 1 - reverseIndex;
        const node = blockNode(id);
        node.dataset.col = String(col);
        node.dataset.row = String(row);
        if (editable) {
          node.addEventListener("click", event => {
            event.stopPropagation();
            cutBlock(col, row);
          });
          node.addEventListener("mouseenter", () => previewCut(column, row));
          node.addEventListener("mouseleave", () => previewCut(column, -1));
        }
        column.appendChild(node);
      });
      const base = document.createElement("div");
      base.className = "tower-base";
      column.appendChild(base);
      root.appendChild(column);
      const label = document.createElement("div");
      label.textContent = col + 1;
      labelsRoot.appendChild(label);
    });
  }

  function wireDropColumn(column, col) {
    column.addEventListener("click", event => {
      if (event.target.closest(".block") || event.target.closest(".drop-zone")) return;
      placeBlock(col, state.selected);
    });
    column.addEventListener("dragover", event => {
      event.preventDefault();
      column.classList.add("drop-hover");
    });
    column.addEventListener("dragleave", () => column.classList.remove("drop-hover"));
    column.addEventListener("drop", event => {
      event.preventDefault();
      column.classList.remove("drop-hover");
      const id = event.dataTransfer.getData("text/plain") || state.selected;
      placeBlock(col, id);
    });
  }

  function previewCut(column, row) {
    [...column.querySelectorAll(".block")].forEach(node => {
      node.classList.toggle("cut-preview", Number(node.dataset.row) === row && row >= 0);
    });
  }

  function renderPalette() {
    els.palette.innerHTML = "";
    const typeCount = rangeForStage(state.stage).types;
    blocks.slice(0, typeCount).forEach((block, index) => {
      const button = document.createElement("button");
      button.className = "palette-button";
      button.type = "button";
      button.draggable = false;
      button.setAttribute("aria-pressed", String(state.selected === block.id));
      button.setAttribute("aria-label", `${T.blockName[block.id]} ${index + 1}`);
      button.dataset.block = block.id;
      button.appendChild(blockNode(block.id));
      const shortcut = document.createElement("span");
      shortcut.className = "palette-shortcut";
      shortcut.textContent = index + 1;
      button.appendChild(shortcut);
      button.addEventListener("click", event => {
        if (suppressPaletteClick) {
          event.preventDefault();
          return;
        }
        selectBlock(block.id);
      });
      button.addEventListener("pointerdown", event => startPointerDrag(event, block.id));
      button.addEventListener("mousedown", event => startMouseDrag(event, block.id));
      els.palette.appendChild(button);
    });
  }

  function selectBlock(id) {
    state.selected = id;
    setMessage(T.msgSelected(T.blockName[id]));
    playSfx("select");
    renderPalette();
  }

  function selectBlockByShortcut(key) {
    if (!state?.started || state.finished) return;
    if (/^(input|select|textarea)$/i.test(document.activeElement?.tagName || "")) return;
    const index = Number(key) - 1;
    const available = blocks.slice(0, rangeForStage(state.stage).types);
    const block = available[index];
    if (!block) return;
    selectBlock(block.id);
  }

  function startPointerDrag(event, id) {
    if (!state.started || state.finished) return;
    if (pointerDrag) return;
    ensureAudio();
    state.selected = id;
    const ghost = blockNode(id);
    ghost.classList.add("drag-ghost");
    document.body.appendChild(ghost);
    pointerDrag = { id, ghost, startX: event.clientX, startY: event.clientY, moved: false };
    moveGhost(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function startMouseDrag(event, id) {
    if (!state.started || state.finished || pointerDrag) return;
    ensureAudio();
    state.selected = id;
    const ghost = blockNode(id);
    ghost.classList.add("drag-ghost");
    document.body.appendChild(ghost);
    pointerDrag = { id, ghost, startX: event.clientX, startY: event.clientY, moved: false };
    moveGhost(event.clientX, event.clientY);
    event.preventDefault();
  }

  function moveGhost(x, y) {
    if (!pointerDrag) return;
    pointerDrag.ghost.style.transform = `translate(${x - 28}px, ${y - 28}px)`;
  }

  window.addEventListener("pointermove", event => {
    handleDragMove(event.clientX, event.clientY);
  });

  window.addEventListener("mousemove", event => {
    handleDragMove(event.clientX, event.clientY);
  });

  function handleDragMove(clientX, clientY) {
    if (!pointerDrag) return;
    if (Math.hypot(clientX - pointerDrag.startX, clientY - pointerDrag.startY) > 8) {
      pointerDrag.moved = true;
    }
    moveGhost(clientX, clientY);
    const col = document.elementFromPoint(clientX, clientY)?.closest?.("#currentTower .column");
    document.querySelectorAll("#currentTower .column").forEach(node => node.classList.toggle("drop-hover", node === col));
  }

  window.addEventListener("pointerup", event => {
    handleDragEnd(event.clientX, event.clientY);
  });

  window.addEventListener("mouseup", event => {
    handleDragEnd(event.clientX, event.clientY);
  });

  window.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (/^[1-4]$/.test(event.key)) selectBlockByShortcut(event.key);
  });

  function handleDragEnd(clientX, clientY) {
    if (!pointerDrag) return;
    const target = document.elementFromPoint(clientX, clientY)?.closest?.("#currentTower .column");
    document.querySelectorAll("#currentTower .column").forEach(node => node.classList.remove("drop-hover"));
    const id = pointerDrag.id;
    const moved = pointerDrag.moved;
    pointerDrag.ghost.remove();
    pointerDrag = null;
    if (moved) {
      suppressPaletteClick = true;
      setTimeout(() => {
        suppressPaletteClick = false;
      }, 0);
    }
    if (target && moved) {
      placeBlock(Number(target.dataset.col), id);
    } else {
      selectBlock(id);
    }
  }

  function setMessage(text) {
    els.message.textContent = text;
  }

  function showStart(show) {
    els.startView.classList.toggle("is-hidden", !show);
    els.gameView.classList.toggle("is-hidden", show);
  }

  function showResult(show, reason) {
    els.resultOverlay?.classList.toggle("is-hidden", !show);
    els.playArea?.classList.toggle("result-open", show);
    if (!show) return;
    state.scoreUploaded = false;
    state.scoreId = "";
    if (els.submitScore) els.submitScore.disabled = false;
    if (els.resultEyebrow) els.resultEyebrow.textContent = T.leaderboard || "Tower Cut";
    els.resultTitle.textContent = reason === "manual" ? T.resultManual : T.resultTimeout;
    const payload = resultPayload(reason);
    els.resultStats.innerHTML = "";
    [
      [T.score, payload.score.toLocaleString(lang === "en" ? "en-US" : lang)],
      [T.cleared, payload.clearedTowers],
      [T.perfect, payload.perfectClears],
      [T.maxCombo, payload.maxCombo],
      [T.totalClicks, payload.totalClicks],
      [T.highestStage, payload.highestStage]
    ].forEach(([label, value]) => {
      const item = document.createElement("div");
      const small = document.createElement("span");
      const strong = document.createElement("strong");
      small.textContent = label;
      strong.textContent = value;
      item.append(small, strong);
      els.resultStats.appendChild(item);
    });
    setShareStatus("");
    loadLeaderboard(els.leaderboardList, els.leaderboardScope, setLeaderboardStatus, state.scoreId, state.durationSeconds);
  }

  function resultPayload(reason) {
    const durationSeconds = state.durationSeconds || selectedDuration();
    return {
      game: GAME_NAME,
      lang,
      mode: modeForDuration(durationSeconds),
      score: state.score,
      durationSeconds,
      finishType: reason || "timeout",
      clearedTowers: state.cleared,
      perfectClears: state.perfect,
      maxCombo: state.maxCombo,
      totalClicks: state.totalClicks,
      highestStage: state.stage,
      boardSize: SCORE_SCOPE,
      total: state.cleared,
      filled: state.cleared,
      turns: state.totalClicks,
      name: currentPlayerName()
    };
  }

  function setStatus(el, message, isError = false) {
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("error", isError);
  }

  function setLeaderboardStatus(message, isError = false) {
    setStatus(els.leaderboardStatus, message, isError);
  }

  function setIntroLeaderboardStatus(message, isError = false) {
    setStatus(els.introLeaderboardStatus, message, isError);
  }

  function setShareStatus(message, isError = false) {
    setStatus(els.shareStatus, message, isError);
  }

  function trackGameEvent(type, detail = {}) {
    if (!SUGGEST_API) return;
    const durationSeconds = Number(detail.durationSeconds || state?.durationSeconds || selectedDuration());
    const payload = {
      game: GAME_NAME,
      type,
      lang,
      boardSize: SCORE_SCOPE,
      mode: modeForDuration(durationSeconds),
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

  function renderLeaderboard(listEl, items, ownRank = null, ownItem = null) {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("li");
      empty.innerHTML = `<span class="rank">-</span><span class="name">${T.leaderboardEmpty}</span><span class="score-value">0</span>`;
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
        <span class="score-value">${Number(item.score || 0).toLocaleString(lang === "en" ? "en-US" : lang)}</span>
      `;
      row.querySelector(".name").textContent = `${item.name || T.namePlaceholder}${isOwn ? ` · ${T.myRank}` : ""}`;
      listEl.appendChild(row);
    });
    if (!ownItem || !ownRank || ownRank <= items.length) return;
    const own = document.createElement("li");
    own.classList.add("own");
    own.innerHTML = `
      <span class="rank">${ownRank}</span>
      <span class="name"></span>
      <span class="score-value">${Number(ownItem.score || 0).toLocaleString(lang === "en" ? "en-US" : lang)}</span>
    `;
    own.querySelector(".name").textContent = `${ownItem.name || T.namePlaceholder} · ${T.myRank}`;
    listEl.appendChild(own);
  }

  async function loadLeaderboard(listEl, scopeEl, statusFn, ownId = "", duration = selectedDuration()) {
    if (scopeEl) scopeEl.textContent = leaderboardLabel(duration);
    if (!SUGGEST_API) {
      renderLeaderboard(listEl, []);
      statusFn(T.rankingsUnavailable, true);
      return;
    }
    statusFn(T.rankingsLoading);
    try {
      const params = new URLSearchParams({
        game: GAME_NAME,
        boardSize: String(SCORE_SCOPE),
        limit: "10",
        lang,
        mode: modeForDuration(duration)
      });
      if (ownId) params.set("id", ownId);
      const response = await fetch(`${SUGGEST_API}/scores?${params.toString()}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || T.rankingsFailed);
      renderLeaderboard(listEl, Array.isArray(data.items) ? data.items : [], data.ownRank, data.ownItem);
      statusFn(state?.scoreUploaded ? T.scoreUploaded : "");
    } catch (error) {
      renderLeaderboard(listEl, []);
      statusFn(error.message || T.rankingsFailed, true);
    }
  }

  async function toggleIntroLeaderboard() {
    if (!els.introLeaderboardPanel) return;
    const hidden = els.introLeaderboardPanel.classList.contains("is-hidden");
    els.introLeaderboardPanel.classList.toggle("is-hidden", !hidden);
    if (hidden) await loadLeaderboard(els.introLeaderboardList, els.introLeaderboardScope, setIntroLeaderboardStatus, "", selectedDuration());
    else setIntroLeaderboardStatus("");
  }

  function currentPlayerName() {
    return String(els.playerName?.value || "").trim().slice(0, 16) || T.namePlaceholder;
  }

  async function submitScore() {
    if (!state?.finished || state.scoreUploaded || !els.submitScore) return;
    if (!SUGGEST_API) {
      setLeaderboardStatus(T.rankingsUnavailable, true);
      return;
    }
    const payload = resultPayload(state.finishType);
    if (els.playerName) {
      els.playerName.value = payload.name;
      localStorage.setItem(playerNameKey, payload.name);
    }
    els.submitScore.disabled = true;
    setLeaderboardStatus(T.uploadingScore);
    try {
      const response = await fetch(`${SUGGEST_API}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || T.uploadFailed);
      state.scoreUploaded = true;
      state.scoreId = data.item && data.item.id ? data.item.id : "";
      setLeaderboardStatus(T.scoreUploaded);
      await loadLeaderboard(els.leaderboardList, els.leaderboardScope, setLeaderboardStatus, state.scoreId, state.durationSeconds);
    } catch (error) {
      els.submitScore.disabled = false;
      setLeaderboardStatus(error.message || T.uploadFailed, true);
    }
  }

  function shareUrl() {
    if (location.protocol === "http:" || location.protocol === "https:") return `${location.origin}/tower-cut/${lang}/`;
    return `https://magentmagent.github.io/tower-cut/${lang}/`;
  }

  function shareSummary() {
    return `${durationLabel(state.durationSeconds || selectedDuration())} · ${T.score}: ${state.score.toLocaleString(lang === "en" ? "en-US" : lang)} · ${T.cleared}: ${state.cleared} · ${T.maxCombo}: ${state.maxCombo}`;
  }

  function shareText() {
    if (lang === "ko") return `타워컷 결과\n${shareSummary()}\n${shareUrl()}`;
    if (lang === "ja") return `Tower Cut 結果\n${shareSummary()}\n${shareUrl()}`;
    return `Tower Cut result\n${shareSummary()}\n${shareUrl()}`;
  }

  function shareToX() {
    if (!state?.finished) return;
    const params = new URLSearchParams({ text: shareSummary(), url: shareUrl(), hashtags: "TowerCut" });
    window.open(`https://twitter.com/intent/tweet?${params.toString()}`, "_blank", "noopener,noreferrer");
    setShareStatus(T.shareOpened);
    trackGameEvent("share_result", { score: state.score, finishType: state.finishType || "timeout", channel: "x" });
  }

  async function shareNative() {
    if (!state?.finished) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Tower Cut", text: shareText(), url: shareUrl() });
        setShareStatus(T.shareShared);
        trackGameEvent("share_result", { score: state.score, finishType: state.finishType || "timeout", channel: "native" });
      } else {
        await copyResult();
      }
    } catch (error) {
      if (error && error.name === "AbortError") return;
      setShareStatus(T.shareFailed, true);
    }
  }

  async function copyResult() {
    if (!state?.finished) return;
    try {
      await navigator.clipboard.writeText(shareText());
      setShareStatus(T.shareCopied);
      trackGameEvent("share_result", { score: state.score, finishType: state.finishType || "timeout", channel: "copy" });
    } catch {
      setShareStatus(T.shareFailed, true);
    }
  }

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function playSfx(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const out = audioCtx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(type === "perfect" ? 0.09 : 0.055, now + 0.01);
    out.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    out.connect(audioCtx.destination);
    const notes = {
      start: [330, 440],
      select: [520],
      place: [360, 520],
      cut: [240, 170],
      clear: [420, 560, 700],
      perfect: [520, 660, 880],
      deny: [120],
      end: [220, 180]
    }[type] || [300];
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type === "cut" || type === "deny" ? "square" : "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.045);
      gain.gain.setValueAtTime(0.0001, now + i * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.9, now + i * 0.045 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.045 + 0.12);
      osc.connect(gain).connect(out);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.14);
    });
  }

  function languagePath(nextLang) {
    if (nextLang === "ko") return "/tower-cut/ko/";
    if (nextLang === "ja") return "/tower-cut/ja/";
    return "/tower-cut/en/";
  }

  els.startBtn.addEventListener("click", startGame);
  els.introLeaderboardToggle?.addEventListener("click", toggleIntroLeaderboard);
  els.endBtn.addEventListener("click", () => finish("manual"));
  els.restartBtns.forEach(button => button.addEventListener("click", newGame));
  els.submitScore?.addEventListener("click", submitScore);
  els.shareX?.addEventListener("click", shareToX);
  els.shareNative?.addEventListener("click", shareNative);
  els.copyResult?.addEventListener("click", copyResult);
  els.durationSelect?.addEventListener("change", () => {
    const seconds = selectedDuration();
    if (state && !state.started) {
      state.durationSeconds = seconds;
      state.timeLeft = seconds;
      renderHud();
    }
    if (els.introLeaderboardPanel && !els.introLeaderboardPanel.classList.contains("is-hidden")) {
      loadLeaderboard(els.introLeaderboardList, els.introLeaderboardScope, setIntroLeaderboardStatus, "", seconds);
    }
  });
  els.langSelect.value = lang;
  els.langSelect.addEventListener("change", () => {
    localStorage.setItem("wordChainSnakeSiteLang", els.langSelect.value);
    location.href = languagePath(els.langSelect.value);
  });

  newGame();
  trackGameEvent("page_view", { mode: modeForDuration(selectedDuration()) });
}());
