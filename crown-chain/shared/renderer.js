(function () {
  const { SIZE, idx, getPieceDef } = window.CrownChainRules;
  const SPRITE_NAMES = [
    "king", "queen", "rook", "bishop",
    "knight", "pawn", "camel", "prince",
    "archbishop", "general", "amazon", "jester"
  ];
  const SPRITE_ASSET_FILES = {
    chancellor: "general.png",
    wazir: "wazir.svg",
    ferz: "ferz.svg",
    dabbaba: "dabbaba.svg",
    alfil: "alfil.svg",
    zebra: "zebra.svg",
    giraffe: "giraffe.svg",
    antelope: "antelope.svg",
    elephant: "elephant.svg",
    kirin: "kirin.svg",
    wizard: "wizard.svg",
    champion: "champion.svg",
    dragonking: "dragonking.svg",
    dragonhorse: "dragonhorse.svg",
    nightrider: "nightrider.svg",
    gryphon: "gryphon.svg",
    ship: "ship.svg",
    assassin: "assassin.svg",
    bigrook: "bigrook.svg"
  };

  const COLORS = {
    boardA: "#fffaf0",
    boardB: "#eadfca",
    line: "#776d5f",
    player: "#197278",
    target: "#f6bd60",
    targetLine: "#c44536",
    moveLine: "#197278",
    previewLine: "#4968a8",
    text: "#202327",
    icon: "#25292f",
    muted: "#68707a",
    shadow: "rgba(32, 35, 39, 0.22)"
  };

  const spriteImages = new Map();
  let spriteReady = false;
  let spriteLoadStarted = false;
  const tintCache = new Map();
  const renderDebug = {
    spriteReady: false,
    playerFallbackCount: 0,
    lastPlayerFallbackAt: 0
  };
  window.__crownChainRenderDebug = renderDebug;

  function ensureSpriteImages() {
    if (spriteLoadStarted) return;
    spriteLoadStarted = true;
    const allNames = Array.from(new Set([...SPRITE_NAMES, ...Object.keys(SPRITE_ASSET_FILES)]));
    let loaded = 0;
    allNames.forEach((name) => {
      const image = new Image();
      image.addEventListener("load", () => {
        loaded += 1;
        if (loaded === allNames.length) {
          spriteReady = true;
          renderDebug.spriteReady = true;
          console.info("[CrownChain] sprites ready");
          window.dispatchEvent(new Event("resize"));
        }
      });
      image.src = `../shared/pieces/${SPRITE_ASSET_FILES[name] || `${name}.png`}`;
      spriteImages.set(name, image);
    });
  }

  function resizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const size = Math.max(280, Math.floor(rect.width));
    const scale = window.devicePixelRatio || 1;
    if (canvas.width !== Math.floor(size * scale)) {
      canvas.width = Math.floor(size * scale);
      canvas.height = Math.floor(size * scale);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    return { ctx, size };
  }

  function cellFromPointer(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * SIZE);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * SIZE);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
    return { x, y };
  }

  function roundedRect(ctx, x, y, width, height, radius) {
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

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function easeOutCubic(value) {
    const p = clamp01(value);
    return 1 - ((1 - p) ** 3);
  }

  function easeOutBack(value) {
    const p = clamp01(value);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + (c3 * ((p - 1) ** 3)) + (c1 * ((p - 1) ** 2));
  }

  function easeInOutQuad(value) {
    const p = clamp01(value);
    return p < 0.5 ? 2 * p * p : 1 - (((-2 * p) + 2) ** 2) / 2;
  }

  function mix(a, b, t) {
    return a + ((b - a) * t);
  }

  function hsla(h, s, l, a) {
    return `hsla(${h} ${s}% ${l}% / ${a})`;
  }

  function comboHue(combo, index = 0) {
    const base = [0, 28, 52, 122, 198, 252, 286];
    if (combo >= 8) return base[index % base.length];
    const clamped = Math.max(0, Math.min(base.length - 1, combo - 1));
    return base[clamped];
  }

  function cellCenter(cell, tile, pad) {
    return {
      x: pad + (cell.x * tile) + (tile / 2),
      y: pad + (cell.y * tile) + (tile / 2)
    };
  }

  function drawSpriteToken(ctx, spriteName, radius, iconColor) {
    const sprite = spriteImages.get(spriteName);
    if (!spriteReady || !sprite || !sprite.complete) return false;
    const cacheKey = `${spriteName}:${iconColor}`;
    let tinted = tintCache.get(cacheKey);
    if (!tinted) {
      tinted = document.createElement("canvas");
      tinted.width = sprite.naturalWidth;
      tinted.height = sprite.naturalHeight;
      const tctx = tinted.getContext("2d");
      tctx.clearRect(0, 0, tinted.width, tinted.height);
      tctx.drawImage(sprite, 0, 0);
      tctx.globalCompositeOperation = "source-in";
      tctx.fillStyle = iconColor;
      tctx.fillRect(0, 0, tinted.width, tinted.height);
      tctx.globalCompositeOperation = "source-over";
      tintCache.set(cacheKey, tinted);
    }
    const iconSize = radius * 2.52;
    ctx.drawImage(tinted, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
    return true;
  }

  function drawPieceAt(ctx, cx, cy, tile, piece, options = {}) {
    const def = getPieceDef(piece.type);
    const size = def.size || { w: 1, h: 1 };
    const radius = tile * (Math.max(size.w, size.h) > 1 ? 0.62 : 0.34);
    const scale = options.scale || 1;
    const alpha = options.alpha == null ? 1 : options.alpha;
    const iconColor = options.iconColor || (options.player ? COLORS.player : COLORS.icon);
    const auraColor = options.auraColor || null;
    const suppressFallback = options.noFallback || (options.player && spriteReady);
    const spriteName = piece.sprite || def.sprite || piece.type;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    if (auraColor) {
      ctx.fillStyle = auraColor;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.88, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowColor = options.shadowColor === undefined ? COLORS.shadow : options.shadowColor;
    ctx.shadowBlur = options.shadowBlur === undefined ? (options.player ? 10 : 4) : options.shadowBlur;
    ctx.shadowOffsetY = options.shadowOffsetY === undefined ? 1.5 : options.shadowOffsetY;
    const drewSprite = drawSpriteToken(ctx, spriteName, radius, iconColor);
    ctx.shadowColor = "transparent";
    if (!drewSprite && suppressFallback) {
      if (options.player) {
        renderDebug.playerFallbackCount += 1;
        renderDebug.lastPlayerFallbackAt = Date.now();
        console.warn("[CrownChain] player sprite fallback suppressed", {
          type: piece.type,
          spriteName,
          spriteReady,
          hasImage: !!spriteImages.get(spriteName)
        });
      }
      ctx.restore();
      return;
    }
    if (!drewSprite) {
      ctx.fillStyle = options.player ? COLORS.player : "#fffdf8";
      ctx.strokeStyle = options.player ? "#0d4f54" : "#b9ae9f";
      ctx.lineWidth = Math.max(2, tile * 0.035);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = iconColor;
      ctx.font = `900 ${Math.max(14, tile * (def.label.length > 1 ? 0.29 : 0.42))}px system-ui, -apple-system, Segoe UI, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.label, 0, 1);
    }
    ctx.restore();
  }

  function drawPiece(ctx, cell, piece, tile, pad, options = {}) {
    const def = getPieceDef(piece.type);
    const size = def.size || { w: 1, h: 1 };
    const center = {
      x: pad + ((cell.x + (size.w / 2)) * tile),
      y: pad + ((cell.y + (size.h / 2)) * tile)
    };
    if (options.player && (size.w > 1 || size.h > 1)) {
      ctx.save();
      ctx.fillStyle = "rgba(25, 114, 120, 0.09)";
      ctx.strokeStyle = "rgba(25, 114, 120, 0.32)";
      ctx.lineWidth = Math.max(2, tile * 0.04);
      roundedRect(ctx, pad + (cell.x * tile) + 4, pad + (cell.y * tile) + 4, (tile * size.w) - 8, (tile * size.h) - 8, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    const partialBigRook = piece.type === "bigrook" && piece.segments && !(piece.segments.left && piece.segments.right);
    if (partialBigRook) {
      ctx.save();
      ctx.beginPath();
      const left = pad + (piece.anchorX * tile);
      const top = pad + (piece.anchorY * tile);
      if (piece.segments.left) {
        ctx.rect(left, top, tile, tile * 2);
      }
      if (piece.segments.right) {
        ctx.rect(left + tile, top, tile, tile * 2);
      }
      ctx.clip();
      drawPieceAt(ctx, center.x, center.y, tile, piece, options);
      ctx.restore();
      return;
    }
    drawPieceAt(ctx, center.x, center.y, tile, piece, options);
  }

  function drawPulseCell(ctx, effect, tile, pad, now) {
    const progress = clamp01((now - effect.startedAt) / effect.duration);
    if (progress >= 1) return;
    const center = cellCenter(effect.cell, tile, pad);
    const box = tile * mix(0.28, 0.82, easeOutBack(progress));
    ctx.save();
    ctx.globalAlpha = (1 - progress) * (effect.fill ? 0.28 : 0.95);
    if (effect.fill) {
      ctx.fillStyle = effect.color;
      roundedRect(ctx, center.x - (box / 2), center.y - (box / 2), box, box, tile * 0.12);
      ctx.fill();
    } else {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = Math.max(2, tile * 0.06 * (1 - progress * 0.35));
      roundedRect(ctx, center.x - (box / 2), center.y - (box / 2), box, box, tile * 0.13);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticle(ctx, effect, tile, pad, now) {
    const progress = clamp01((now - effect.startedAt) / effect.duration);
    if (progress >= 1) return;
    const origin = cellCenter(effect.cell, tile, pad);
    const eased = easeOutCubic(progress);
    const x = origin.x + (effect.vx * eased * tile);
    const y = origin.y + (effect.vy * eased * tile);
    const size = effect.radius * (1 - progress * 0.3);
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = effect.color;
    ctx.translate(x, y);
    ctx.rotate((effect.rotation || 0) + (progress * 1.2));
    ctx.fillRect(-size, -size, size * 2, size * 2);
    ctx.restore();
  }

  function drawFloatingText(ctx, effect, tile, pad, now) {
    const progress = clamp01((now - effect.startedAt) / effect.duration);
    if (progress >= 1) return;
    const center = cellCenter(effect.cell, tile, pad);
    const rise = mix(0, tile * 0.34, easeOutCubic(progress));
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = effect.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.max(13, tile * (effect.scale || 0.22))}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.fillText(effect.text, center.x, center.y - rise);
    ctx.restore();
  }

  function drawCaptureGhost(ctx, effect, tile, pad, now) {
    const progress = clamp01((now - effect.startedAt) / effect.duration);
    if (progress >= 1) return;
    const center = cellCenter(effect.cell, tile, pad);
    drawPieceAt(ctx, center.x, center.y, tile, effect.piece, {
      alpha: 1 - progress,
      scale: mix(1, 1.18, easeOutCubic(progress)),
      iconColor: effect.color || COLORS.targetLine
    });
  }

  function drawComboField(ctx, state, size, tile, pad, now) {
    if (!state.combo || state.combo < 2) return;
    const energy = Math.min(1, (state.combo - 1) / 6);
    const rainbowMode = state.combo >= 8;
    const hue = rainbowMode ? (now * 0.08) % 360 : comboHue(state.combo);
    const boardPulse = 0.04 + (Math.sin(now / 220) * 0.02) + (energy * 0.04);

    ctx.save();
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, hsla(hue, 88, 72, boardPulse));
    gradient.addColorStop(0.5, hsla(rainbowMode ? ((hue + 120) % 360) : hue, 82, 70, boardPulse * 0.75));
    gradient.addColorStop(1, hsla(rainbowMode ? ((hue + 240) % 360) : hue, 86, 72, boardPulse));
    ctx.fillStyle = gradient;
    roundedRect(ctx, 0, 0, size, size, 10);
    ctx.fill();
    ctx.restore();

    const shimmer = 0.14 + (energy * 0.08);
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const px = pad + (x * tile);
        const py = pad + (y * tile);
        const cellHue = rainbowMode ? ((hue + ((x + (y * 2)) * 18)) % 360) : hue;
        ctx.save();
        ctx.globalAlpha = shimmer * (0.4 + ((x + y) % 2) * 0.3);
        ctx.strokeStyle = hsla(cellHue, 82, 62, 0.75);
        ctx.lineWidth = Math.max(1.5, tile * 0.018);
        roundedRect(ctx, px + 3, py + 3, tile - 6, tile - 6, 7);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawComboAfterglow(ctx, piece, center, tile, pad, combo, now, motion = null) {
    if (!combo || combo < 2) return;
    const energy = Math.min(1, (combo - 1) / 6);
    const rainbowMode = combo >= 8;
    const hue = rainbowMode ? (now * 0.12) % 360 : comboHue(combo);
    const echoes = Math.min(6, combo + 1);
    const motionDx = motion ? (motion.to.x - motion.from.x) : 0;
    const motionDy = motion ? (motion.to.y - motion.from.y) : 0;
    const motionDistance = motion ? Math.max(1, Math.hypot(motionDx, motionDy)) : 1;
    const hasDirection = !!motion && motionDistance > 0.01;
    const dirX = hasDirection ? (motionDx / motionDistance) : 0;
    const dirY = hasDirection ? (motionDy / motionDistance) : 0;
    const motionProgress = hasDirection
      ? clamp01((now - motion.startedAt) / motion.duration)
      : 0;

    for (let i = echoes - 1; i >= 0; i -= 1) {
      const step = i / Math.max(1, echoes - 1);
      const angle = (now / 260) + (i * 0.55);
      const distanceBoost = hasDirection ? ((motionDistance - 1) * tile * 0.22) : 0;
      const offset = (tile * 0.11) + (step * (tile * (0.28 + (energy * 0.2)) + distanceBoost));
      let echoX;
      let echoY;
      if (hasDirection) {
        const delay = 0.08 + (step * 0.36);
        const echoProgress = Math.max(0, motionProgress - delay);
        const fromX = motion.from.x + 0.5;
        const fromY = motion.from.y + 0.5;
        const toX = motion.to.x + 0.5;
        const toY = motion.to.y + 0.5;
        const lagX = (mix(fromX, toX, echoProgress) * tile) + pad;
        const lagY = (mix(fromY, toY, echoProgress) * tile) + pad;
        echoX = lagX - (dirX * offset * 0.34);
        echoY = lagY - (dirY * offset * 0.34);
      } else {
        echoX = center.x - (Math.cos(angle) * offset * 0.95);
        echoY = center.y - (Math.sin(angle) * offset * 1.28);
      }
      drawPieceAt(ctx, echoX, echoY, tile, piece, {
        player: true,
        noFallback: true,
        alpha: 0.07 + ((1 - step) * 0.3 * energy),
        scale: 0.82 + ((1 - step) * 0.18),
        shadowColor: "transparent",
        shadowBlur: 0,
        shadowOffsetY: 0,
        iconColor: hsla(rainbowMode ? comboHue(combo, i) : hue, 90, 60, 1)
      });
    }
  }

  function drawBoardClearCelebration(ctx, clearBurst, size, now) {
    if (!clearBurst) return;
    const progress = clamp01((now - clearBurst.startedAt) / clearBurst.duration);
    if (progress >= 1) return;
    const alpha = (1 - progress) * 0.42;
    const center = size / 2;

    ctx.save();
    ctx.globalAlpha = alpha * 0.82;
    const burst = ctx.createRadialGradient(center, center, size * 0.08, center, center, size * 0.78);
    burst.addColorStop(0, hsla(clearBurst.hue, 96, 80, 0.9));
    burst.addColorStop(0.55, hsla((clearBurst.hue + 90) % 360, 92, 72, 0.34));
    burst.addColorStop(1, hsla((clearBurst.hue + 160) % 360, 92, 70, 0));
    ctx.fillStyle = burst;
    roundedRect(ctx, 0, 0, size, size, 10);
    ctx.fill();
    ctx.restore();

    const textPop = easeOutBack(Math.min(1, progress * 1.25));
    const textFade = progress > 0.72 ? (1 - ((progress - 0.72) / 0.28)) : 1;
    ctx.save();
    ctx.globalAlpha = alpha * textFade;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fffdf8";
    ctx.strokeStyle = hsla(clearBurst.hue, 90, 34, 0.65);
    ctx.lineWidth = Math.max(4, size * 0.008);
    ctx.font = `900 ${Math.max(28, size * 0.085 * textPop)}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.shadowColor = hsla(clearBurst.hue, 96, 72, 0.45);
    ctx.shadowBlur = size * 0.05;
    ctx.strokeText("BOARD CLEAR", center, center);
    ctx.fillText("BOARD CLEAR", center, center);
    ctx.restore();
  }

  function drawEnemyAttackMotion(ctx, motion, tile, pad, now) {
    if (!motion) return;
    const progress = clamp01((now - motion.startedAt) / motion.duration);
    if (progress >= 1) return;
    const from = cellCenter(motion.from, tile, pad);
    const to = cellCenter(motion.to, tile, pad);
    const eased = easeInOutQuad(progress);
    const x = mix(from.x, to.x, eased);
    const y = mix(from.y, to.y, eased);
    drawPieceAt(ctx, x, y, tile, motion.piece, {
      noFallback: true,
      alpha: 0.3 + ((1 - progress) * 0.35),
      scale: 0.9 + (Math.sin(progress * Math.PI) * 0.08),
      iconColor: "#c44536",
      shadowColor: "transparent",
      shadowBlur: 0,
      shadowOffsetY: 0
    });
  }

  function drawSpawnMotion(ctx, motion, tile, pad, now) {
    if (!motion) return;
    const progress = clamp01((now - motion.startedAt) / motion.duration);
    if (progress >= 1) return;
    const center = cellCenter(motion.cell, tile, pad);
    const rise = mix(tile * 0.18, 0, easeOutBack(progress));
    const scale = mix(0.72, 1.02, easeOutBack(progress));
    const alpha = mix(0.24, 0.96, easeOutCubic(progress));

    ctx.save();
    ctx.globalAlpha = (1 - progress) * 0.22;
    ctx.fillStyle = "rgba(25, 114, 120, 0.22)";
    roundedRect(ctx, center.x - (tile * 0.32), center.y - (tile * 0.32), tile * 0.64, tile * 0.64, tile * 0.12);
    ctx.fill();
    ctx.restore();

    drawPieceAt(ctx, center.x, center.y + rise, tile, motion.piece, {
      alpha,
      scale,
      shadowColor: "transparent",
      shadowBlur: 0,
      shadowOffsetY: 0
    });
  }

  function drawBoard(canvas, state, legalActions, fx = {}) {
    ensureSpriteImages();
    const { ctx, size } = resizeCanvas(canvas);
    const pad = 8;
    const boardSize = size - (pad * 2);
    const tile = boardSize / SIZE;
    const legal = new Map(legalActions.map(cell => [`${cell.x},${cell.y}`, cell.kind || "capture"]));
    const now = fx.now || performance.now();

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#5e6472";
    roundedRect(ctx, 0, 0, size, size, 10);
    ctx.fill();
    drawComboField(ctx, state, size, tile, pad, now);

    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const px = pad + (x * tile);
        const py = pad + (y * tile);
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.boardA : COLORS.boardB;
        roundedRect(ctx, px + 2, py + 2, tile - 4, tile - 4, 7);
        ctx.fill();
        if (legal.has(`${x},${y}`)) {
          const kind = legal.get(`${x},${y}`);
          ctx.strokeStyle = kind === "move" ? COLORS.moveLine : (kind === "preview" || kind === "previewCapture" ? COLORS.previewLine : COLORS.targetLine);
          ctx.lineWidth = Math.max(3, tile * (kind === "move" || kind === "preview" ? 0.045 : 0.065));
          if (kind === "move" || kind === "preview") ctx.setLineDash([tile * 0.14, tile * 0.1]);
          roundedRect(ctx, px + 5, py + 5, tile - 10, tile - 10, 7);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    for (const effect of fx.pulseCells || []) drawPulseCell(ctx, effect, tile, pad, now);

    const drawnPieceIds = new Set();
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const piece = state.board[idx(x, y)];
        if (!piece) continue;
        const key = piece.id || `${piece.type}:${piece.anchorX ?? x},${piece.anchorY ?? y}`;
        if (drawnPieceIds.has(key)) continue;
        drawnPieceIds.add(key);
        drawPiece(ctx, { x: piece.anchorX ?? x, y: piece.anchorY ?? y }, piece, tile, pad);
      }
    }

    for (const effect of fx.captureGhosts || []) drawCaptureGhost(ctx, effect, tile, pad, now);
    for (const effect of fx.particles || []) drawParticle(ctx, effect, tile, pad, now);
    drawBoardClearCelebration(ctx, fx.clearBurst, size, now);
    drawEnemyAttackMotion(ctx, fx.enemyAttackMotion, tile, pad, now);
    for (const effect of fx.spawnMotions || []) drawSpawnMotion(ctx, effect, tile, pad, now);

    if (fx.playerMotion) {
      const progress = clamp01((now - fx.playerMotion.startedAt) / fx.playerMotion.duration);
      const from = cellCenter(fx.playerMotion.from, tile, pad);
      const to = cellCenter(fx.playerMotion.to, tile, pad);
      const eased = easeInOutQuad(progress);
      const currentCenter = { x: mix(from.x, to.x, eased), y: mix(from.y, to.y, eased) };
      drawComboAfterglow(ctx, fx.playerMotion.piece, currentCenter, tile, pad, state.combo, now, fx.playerMotion);
      drawPiece(ctx, state.player, state.player, tile, pad, {
        player: true,
        scale: 1
      });
      drawPieceAt(ctx, currentCenter.x, currentCenter.y, tile, fx.playerMotion.piece, {
        player: true,
        noFallback: true,
        alpha: 0.38,
        scale: mix(0.95, 1.03, Math.sin(progress * Math.PI))
      });
    } else {
      drawComboAfterglow(ctx, state.player, cellCenter(state.player, tile, pad), tile, pad, state.combo, now);
      drawPiece(ctx, state.player, state.player, tile, pad, {
        player: true,
        scale: 1
      });
    }

    for (const effect of fx.floatingTexts || []) drawFloatingText(ctx, effect, tile, pad, now);
  }

  window.CrownChainRenderer = { drawBoard, cellFromPointer };
}());
