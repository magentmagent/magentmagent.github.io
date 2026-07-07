(function () {
  const lang = window.TOWER_CUT_LANG || "en";
  const T = window.TOWER_CUT_TEXT;
  const GAME_SECONDS = 60;
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
    startModal: document.querySelector("#startModal"),
    resultModal: document.querySelector("#resultModal"),
    startBtn: document.querySelector("#startBtn"),
    restartBtns: document.querySelectorAll("[data-action='restart']"),
    endBtn: document.querySelector("#endBtn"),
    resultTitle: document.querySelector("#resultTitle"),
    resultStats: document.querySelector("#resultStats"),
    langSelect: document.querySelector("#langSelect")
  };

  let state;
  let timerId = 0;

  function rnd(max) {
    return Math.floor(Math.random() * max);
  }

  function pick(pool) {
    return pool[rnd(pool.length)];
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

  function cloneTower(tower) {
    return tower.map(stack => stack.slice());
  }

  function towersEqual(a, b) {
    return a.length === b.length && a.every((stack, col) =>
      stack.length === b[col].length && stack.every((block, row) => block === b[col][row])
    );
  }

  function commonPrefix(a, b) {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
    return i;
  }

  function optimalClicks(target, current) {
    return target.reduce((sum, targetStack, col) => {
      const currentStack = current[col] || [];
      const keep = commonPrefix(targetStack, currentStack);
      const cut = currentStack.length > keep ? 1 : 0;
      const place = targetStack.length - keep;
      return sum + cut + place;
    }, 0);
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
    if (towersEqual(target, current)) current[0].push(blocks[0].id === target[0][target[0].length - 1] ? blocks[1].id : blocks[0].id);
    return {
      target,
      current,
      optimal: optimalClicks(target, current),
      maxHeight: Math.max(...target.map(s => s.length), ...current.map(s => s.length), cfg.maxH)
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
      timeLeft: GAME_SECONDS,
      stageData: makeStage(1)
    };
    showStart(true);
    showResult(false);
    render();
  }

  function startGame() {
    if (state.started) return;
    state.started = true;
    showStart(false);
    timerId = setInterval(tick, 250);
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
    clearInterval(timerId);
    showResult(true, reason);
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
    setMessage(perfect ? T.msgPerfect(gained) : T.msgClear(gained, over));
    setTimeout(() => {
      if (state.finished) return;
      state.stage += 1;
      state.stageClicks = 0;
      state.stageData = makeStage(state.stage);
      setMessage(T.msgNext);
      render();
    }, 520);
  }

  function addClick() {
    state.stageClicks += 1;
    state.totalClicks += 1;
  }

  function placeBlock(col) {
    if (!state.started || state.finished) return;
    const stack = state.stageData.current[col];
    if (!stack || stack.length >= 6) {
      setMessage(T.msgFull);
      return;
    }
    stack.push(state.selected);
    addClick();
    setMessage(T.msgPlaced);
    afterMove();
  }

  function cutBlock(col, row) {
    if (!state.started || state.finished) return;
    const stack = state.stageData.current[col];
    if (!stack || row < 0 || row >= stack.length) return;
    stack.splice(row);
    addClick();
    setMessage(T.msgCut);
    afterMove();
  }

  function afterMove() {
    render();
    if (towersEqual(state.stageData.target, state.stageData.current)) clearStage();
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
    root.style.gridTemplateColumns = `repeat(${tower.length}, minmax(42px, 64px))`;
    labelsRoot.style.gridTemplateColumns = `repeat(${tower.length}, minmax(42px, 64px))`;
    tower.forEach((stack, col) => {
      const column = document.createElement("div");
      column.className = "column";
      if (editable) {
        column.classList.toggle("can-place", Boolean(state.selected));
        column.addEventListener("click", () => placeBlock(col));
      }
      stack.forEach((id, row) => {
        const node = blockNode(id);
        node.dataset.row = row;
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
      if (editable) {
        const drop = document.createElement("button");
        drop.className = `drop-zone ${stack.length >= 6 ? "full" : ""}`;
        drop.type = "button";
        drop.textContent = "+";
        drop.setAttribute("aria-label", `${T.placeColumn} ${col + 1}`);
        drop.addEventListener("click", event => {
          event.stopPropagation();
          placeBlock(col);
        });
        column.appendChild(drop);
      }
      root.appendChild(column);
      const label = document.createElement("div");
      label.textContent = col + 1;
      labelsRoot.appendChild(label);
    });
  }

  function previewCut(column, row) {
    [...column.querySelectorAll(".block")].forEach(node => {
      node.classList.toggle("cut-preview", Number(node.dataset.row) >= row && row >= 0);
    });
  }

  function renderPalette() {
    els.palette.innerHTML = "";
    const typeCount = rangeForStage(state.stage).types;
    blocks.slice(0, typeCount).forEach(block => {
      const button = document.createElement("button");
      button.className = "palette-button";
      button.type = "button";
      button.setAttribute("aria-pressed", String(state.selected === block.id));
      button.setAttribute("aria-label", T.blockName[block.id]);
      button.appendChild(blockNode(block.id));
      button.addEventListener("click", () => {
        state.selected = block.id;
        setMessage(T.msgSelected(T.blockName[block.id]));
        renderPalette();
        renderTower(els.current, els.currentLabels, state.stageData.current, true);
      });
      els.palette.appendChild(button);
    });
  }

  function setMessage(text) {
    els.message.textContent = text;
  }

  function showStart(show) {
    els.startModal.classList.toggle("show", show);
  }

  function showResult(show, reason) {
    els.resultModal.classList.toggle("show", show);
    if (!show) return;
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
  }

  function resultPayload(reason) {
    return {
      game: "tower-cut",
      lang,
      mode: "classic",
      score: state.score,
      finishType: reason || "timeout",
      clearedTowers: state.cleared,
      perfectClears: state.perfect,
      maxCombo: state.maxCombo,
      totalClicks: state.totalClicks,
      highestStage: state.stage
    };
  }

  function languagePath(nextLang) {
    if (nextLang === "ko") return "/tower-cut/ko/";
    if (nextLang === "ja") return "/tower-cut/ja/";
    return "/tower-cut/en/";
  }

  els.startBtn.addEventListener("click", startGame);
  els.endBtn.addEventListener("click", () => finish("manual"));
  els.restartBtns.forEach(button => button.addEventListener("click", newGame));
  els.langSelect.value = lang;
  els.langSelect.addEventListener("change", () => {
    localStorage.setItem("wordChainSnakeSiteLang", els.langSelect.value);
    location.href = languagePath(els.langSelect.value);
  });

  newGame();
}());
