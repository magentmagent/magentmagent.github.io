(function () {
  const SIZE = 8;
  const { DIRS, OFFSETS, PIECES } = window.CrownChainPieces;

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  }

  function idx(x, y) {
    return y * SIZE + x;
  }

  function pieceAt(board, x, y) {
    return inBounds(x, y) ? board[idx(x, y)] : null;
  }

  function isAnchorCell(piece, x, y) {
    return !piece || piece.anchorX == null || piece.anchorY == null || (piece.anchorX === x && piece.anchorY === y);
  }

  function getPieceDef(type) {
    return PIECES[type] || PIECES.king;
  }

  function getPieceSize(type) {
    const size = getPieceDef(type).size;
    return size ? { w: size.w || 1, h: size.h || 1 } : { w: 1, h: 1 };
  }

  function footprintCells(anchor, type) {
    const size = getPieceSize(type);
    const cells = [];
    for (let dy = 0; dy < size.h; dy += 1) {
      for (let dx = 0; dx < size.w; dx += 1) {
        cells.push({ x: anchor.x + dx, y: anchor.y + dy });
      }
    }
    return cells;
  }

  function footprintInBounds(anchor, type) {
    const size = getPieceSize(type);
    return anchor.x >= 0 && anchor.y >= 0 && (anchor.x + size.w - 1) < SIZE && (anchor.y + size.h - 1) < SIZE;
  }

  function playerOccupies(state, x, y) {
    return footprintCells(state.player, state.player.type).some((cell) => cell.x === x && cell.y === y);
  }

  function footprintOccupants(board, anchor, type) {
    return footprintCells(anchor, type)
      .map((cell) => ({ ...cell, target: pieceAt(board, cell.x, cell.y) }))
      .filter((cell) => !!cell.target);
  }

  function emptyCellsForType(state, type = state.player.type) {
    const size = getPieceSize(type);
    const cells = [];
    for (let y = 0; y <= SIZE - size.h; y += 1) {
      for (let x = 0; x <= SIZE - size.w; x += 1) {
        const anchor = { x, y };
        if (footprintOccupants(state.board, anchor, type).length > 0) continue;
        const overlapsPlayer = footprintCells(anchor, type).some((cell) => playerOccupies(state, cell.x, cell.y));
        if (!overlapsPlayer) cells.push(anchor);
      }
    }
    return cells;
  }

  function uniqueCells(cells) {
    const seen = new Set();
    return cells.filter(cell => {
      const key = `${cell.x},${cell.y}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function rayCaptures(state, dirs) {
    const captures = [];
    for (const [dx, dy] of dirs) {
      let x = state.player.x + dx;
      let y = state.player.y + dy;
      while (inBounds(x, y)) {
        const target = pieceAt(state.board, x, y);
        if (target) {
          captures.push({ x, y, target });
          break;
        }
        x += dx;
        y += dy;
      }
    }
    return captures;
  }

  function rayMoves(state, dirs) {
    const moves = [];
    for (const [dx, dy] of dirs) {
      let x = state.player.x + dx;
      let y = state.player.y + dy;
      while (inBounds(x, y)) {
        const target = pieceAt(state.board, x, y);
        if (target) break;
        moves.push({ x, y });
        x += dx;
        y += dy;
      }
    }
    return moves;
  }

  function stepCaptures(state, dirs, range = 1) {
    const captures = [];
    for (const [dx, dy] of dirs) {
      for (let step = 1; step <= range; step += 1) {
        const x = state.player.x + (dx * step);
        const y = state.player.y + (dy * step);
        if (!inBounds(x, y)) break;
        const target = pieceAt(state.board, x, y);
        if (target) captures.push({ x, y, target });
        if (target) break;
      }
    }
    return captures;
  }

  function stepMoves(state, dirs, range = 1) {
    const moves = [];
    for (const [dx, dy] of dirs) {
      for (let step = 1; step <= range; step += 1) {
        const x = state.player.x + (dx * step);
        const y = state.player.y + (dy * step);
        if (!inBounds(x, y)) break;
        if (pieceAt(state.board, x, y)) break;
        moves.push({ x, y });
      }
    }
    return moves;
  }

  function leapCaptures(state, offsets) {
    const captures = [];
    for (const [dx, dy] of offsets) {
      const x = state.player.x + dx;
      const y = state.player.y + dy;
      const target = pieceAt(state.board, x, y);
      if (target) captures.push({ x, y, target });
    }
    return captures;
  }

  function leapMoves(state, offsets) {
    const moves = [];
    for (const [dx, dy] of offsets) {
      const x = state.player.x + dx;
      const y = state.player.y + dy;
      if (inBounds(x, y) && !pieceAt(state.board, x, y)) moves.push({ x, y });
    }
    return moves;
  }

  function riderCaptures(state, offsets) {
    const captures = [];
    for (const [dx, dy] of offsets) {
      let x = state.player.x + dx;
      let y = state.player.y + dy;
      while (inBounds(x, y)) {
        const target = pieceAt(state.board, x, y);
        if (target) {
          captures.push({ x, y, target });
          break;
        }
        x += dx;
        y += dy;
      }
    }
    return captures;
  }

  function riderMoves(state, offsets) {
    const moves = [];
    for (const [dx, dy] of offsets) {
      let x = state.player.x + dx;
      let y = state.player.y + dy;
      while (inBounds(x, y)) {
        const target = pieceAt(state.board, x, y);
        if (target) break;
        moves.push({ x, y });
        x += dx;
        y += dy;
      }
    }
    return moves;
  }

  function bentRayTargets(state, starters, rayFactory, wantCaptures) {
    const cells = [];
    for (const [dx, dy] of starters) {
      const sx = state.player.x + dx;
      const sy = state.player.y + dy;
      if (!inBounds(sx, sy) || pieceAt(state.board, sx, sy)) continue;
      const rays = rayFactory(dx, dy);
      for (const [rdx, rdy] of rays) {
        let x = sx + rdx;
        let y = sy + rdy;
        while (inBounds(x, y)) {
          const target = pieceAt(state.board, x, y);
          if (target) {
            if (wantCaptures) cells.push({ x, y, target });
            break;
          }
          if (!wantCaptures) cells.push({ x, y });
          x += rdx;
          y += rdy;
        }
      }
    }
    return cells;
  }

  function gryphonCaptures(state) {
    return bentRayTargets(
      state,
      DIRS.diagonal,
      (dx, dy) => [[dx, 0], [0, dy]],
      true
    );
  }

  function gryphonMoves(state) {
    return bentRayTargets(
      state,
      DIRS.diagonal,
      (dx, dy) => [[dx, 0], [0, dy]],
      false
    );
  }

  function shipCaptures(state) {
    return bentRayTargets(
      state,
      DIRS.orthogonal,
      (dx, dy) => {
        if (dx !== 0) return [[dx, 1], [dx, -1]];
        return [[1, dy], [-1, dy]];
      },
      true
    );
  }

  function shipMoves(state) {
    return bentRayTargets(
      state,
      DIRS.orthogonal,
      (dx, dy) => {
        if (dx !== 0) return [[dx, 1], [dx, -1]];
        return [[1, dy], [-1, dy]];
      },
      false
    );
  }

  function pawnCaptures(state) {
    return leapCaptures(state, [[-1, -1], [1, -1], [-1, 1], [1, 1]]);
  }

  function pawnMoves(state) {
    return [
      { x: state.player.x, y: state.player.y - 1 },
      { x: state.player.x, y: state.player.y + 1 }
    ].filter(cell => inBounds(cell.x, cell.y) && !pieceAt(state.board, cell.x, cell.y));
  }

  function assassinCaptures(state) {
    const cells = [];
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const target = pieceAt(state.board, x, y);
        if (target) cells.push({ x, y, target });
      }
    }
    return cells;
  }

  function assassinMoves(state) {
    return emptyCellsForType(state, "assassin");
  }

  function frontEdgeCells(anchor, dir, type) {
    const size = getPieceSize(type);
    if (dir.x > 0) return Array.from({ length: size.h }, (_, i) => ({ x: anchor.x + size.w - 1, y: anchor.y + i }));
    if (dir.x < 0) return Array.from({ length: size.h }, (_, i) => ({ x: anchor.x, y: anchor.y + i }));
    if (dir.y > 0) return Array.from({ length: size.w }, (_, i) => ({ x: anchor.x + i, y: anchor.y + size.h - 1 }));
    return Array.from({ length: size.w }, (_, i) => ({ x: anchor.x + i, y: anchor.y }));
  }

  function expandBigRookMove(anchor) {
    return footprintCells(anchor, "bigrook").map((cell) => ({ x: cell.x, y: cell.y, anchorX: anchor.x, anchorY: anchor.y }));
  }

  function expandBigRookCapture(anchor, targets) {
    return targets.map((cell) => ({
      x: cell.x,
      y: cell.y,
      anchorX: anchor.x,
      anchorY: anchor.y,
      targets: targets.map((targetCell) => ({
        x: targetCell.x,
        y: targetCell.y,
        target: targetCell.target
      }))
    }));
  }

  function bigRookMoves(state) {
    const moves = [];
    const dirs = DIRS.orthogonal.map(([dx, dy]) => ({ x: dx, y: dy }));
    for (const dir of dirs) {
      let step = 1;
      while (true) {
        const anchor = { x: state.player.x + (dir.x * step), y: state.player.y + (dir.y * step) };
        if (!footprintInBounds(anchor, "bigrook")) break;
        if (footprintOccupants(state.board, anchor, "bigrook").length > 0) break;
        moves.push(...expandBigRookMove(anchor));
        step += 1;
      }
    }
    return moves;
  }

  function bigRookCaptures(state) {
    const captures = [];
    const dirs = DIRS.orthogonal.map(([dx, dy]) => ({ x: dx, y: dy }));
    for (const dir of dirs) {
      let step = 1;
      while (true) {
        const anchor = { x: state.player.x + (dir.x * step), y: state.player.y + (dir.y * step) };
        if (!footprintInBounds(anchor, "bigrook")) break;
        const frontCells = frontEdgeCells(anchor, dir, "bigrook");
        const occupied = footprintOccupants(state.board, anchor, "bigrook");
        if (!occupied.length) {
          step += 1;
          continue;
        }
        const frontKeys = new Set(frontCells.map((cell) => `${cell.x},${cell.y}`));
        const blockedInside = occupied.some((cell) => !frontKeys.has(`${cell.x},${cell.y}`));
        if (blockedInside) break;
        const seen = new Set();
        const targets = frontCells
          .map((cell) => ({ ...cell, target: pieceAt(state.board, cell.x, cell.y) }))
          .filter((cell) => {
            if (!cell.target) return false;
            const key = cell.target.id || `${cell.target.type}:${cell.target.x},${cell.target.y}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        if (targets.length) captures.push(...expandBigRookCapture(anchor, targets));
        break;
      }
    }
    return captures;
  }

  function capturesForMovement(state, movement) {
    if (movement.type === "ray") return rayCaptures(state, DIRS[movement.dirs] || DIRS.all);
    if (movement.type === "step") return stepCaptures(state, DIRS[movement.dirs] || DIRS.all, movement.range || 1);
    if (movement.type === "leap") return leapCaptures(state, OFFSETS[movement.offsets] || OFFSETS.knight);
    if (movement.type === "rider") return riderCaptures(state, OFFSETS[movement.offsets] || OFFSETS.knight);
    if (movement.type === "pawnCapture") return pawnCaptures(state);
    if (movement.type === "gryphon") return gryphonCaptures(state);
    if (movement.type === "ship") return shipCaptures(state);
    if (movement.type === "assassin") return assassinCaptures(state);
    if (movement.type === "bigrook") return bigRookCaptures(state);
    if (movement.type === "compound") {
      const combined = [];
      for (const part of movement.parts || []) {
        combined.push(...getLegalCaptures({ ...state, player: { ...state.player, type: part } }));
      }
      return uniqueCells(combined);
    }
    return [];
  }

  function movesForMovement(state, movement) {
    if (movement.type === "ray") return rayMoves(state, DIRS[movement.dirs] || DIRS.all);
    if (movement.type === "step") return stepMoves(state, DIRS[movement.dirs] || DIRS.all, movement.range || 1);
    if (movement.type === "leap") return leapMoves(state, OFFSETS[movement.offsets] || OFFSETS.knight);
    if (movement.type === "rider") return riderMoves(state, OFFSETS[movement.offsets] || OFFSETS.knight);
    if (movement.type === "pawnCapture") return pawnMoves(state);
    if (movement.type === "gryphon") return gryphonMoves(state);
    if (movement.type === "ship") return shipMoves(state);
    if (movement.type === "assassin") return assassinMoves(state);
    if (movement.type === "bigrook") return bigRookMoves(state);
    if (movement.type === "compound") {
      const combined = [];
      for (const part of movement.parts || []) {
        combined.push(...getLegalMoves({ ...state, player: { ...state.player, type: part } }));
      }
      return uniqueCells(combined);
    }
    return [];
  }

  function getLegalCaptures(state) {
    if (!state || state.gameOver) return [];
    const def = getPieceDef(state.player.type);
    return uniqueCells(capturesForMovement(state, def.movement));
  }

  function getLegalMoves(state) {
    if (!state || state.gameOver) return [];
    const def = getPieceDef(state.player.type);
    return uniqueCells(movesForMovement(state, def.movement));
  }

  function getPiecePreview(state, piece) {
    if (!state || !piece) return [];
    const previewState = {
      ...state,
      player: { type: piece.type, x: piece.x, y: piece.y }
    };
    return uniqueCells([
      ...getLegalMoves(previewState).map(cell => ({ ...cell, kind: "preview" })),
      ...getLegalCaptures(previewState).map(cell => ({ ...cell, kind: "previewCapture" }))
    ]);
  }

  function isBoardClear(state) {
    return state.board.every(piece => !piece);
  }

  function rayAttacksSquare(board, from, target, dirs) {
    for (const [dx, dy] of dirs) {
      let x = from.x + dx;
      let y = from.y + dy;
      while (inBounds(x, y)) {
        if (x === target.x && y === target.y) return true;
        if (pieceAt(board, x, y)) break;
        x += dx;
        y += dy;
      }
    }
    return false;
  }

  function stepAttacksSquare(from, target, dirs, range = 1) {
    for (const [dx, dy] of dirs) {
      for (let step = 1; step <= range; step += 1) {
        const x = from.x + (dx * step);
        const y = from.y + (dy * step);
        if (!inBounds(x, y)) break;
        if (x === target.x && y === target.y) return true;
      }
    }
    return false;
  }

  function leapAttacksSquare(from, target, offsets) {
    return offsets.some(([dx, dy]) => (from.x + dx) === target.x && (from.y + dy) === target.y);
  }

  function pawnAttacksSquare(from, target) {
    const offsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    return offsets.some(([dx, dy]) => (from.x + dx) === target.x && (from.y + dy) === target.y);
  }

  function pieceAttacksSquare(board, piece, target) {
    const def = getPieceDef(piece.type);
    const movement = def.movement;
    if (movement.type === "ray") return rayAttacksSquare(board, piece, target, DIRS[movement.dirs] || DIRS.all);
    if (movement.type === "step") return stepAttacksSquare(piece, target, DIRS[movement.dirs] || DIRS.all, movement.range || 1);
    if (movement.type === "leap") return leapAttacksSquare(piece, target, OFFSETS[movement.offsets] || OFFSETS.knight);
    if (movement.type === "pawnCapture") return pawnAttacksSquare(piece, target);
    if (movement.type === "rider") return rayAttacksSquare(board, piece, target, OFFSETS[movement.offsets] || OFFSETS.knight);
    if (movement.type === "gryphon") {
      const previewState = { board, player: { type: piece.type, x: piece.x, y: piece.y } };
      return gryphonCaptures(previewState).some((cell) => cell.x === target.x && cell.y === target.y);
    }
    if (movement.type === "ship") {
      const previewState = { board, player: { type: piece.type, x: piece.x, y: piece.y } };
      return shipCaptures(previewState).some((cell) => cell.x === target.x && cell.y === target.y);
    }
    if (movement.type === "assassin") return true;
    if (movement.type === "bigrook") {
      const cells = [];
      const anchorX = piece.anchorX ?? piece.x;
      const anchorY = piece.anchorY ?? piece.y;
      const hasSegments = !!piece.segments;
      if (!hasSegments || piece.segments.left) {
        cells.push({ x: anchorX, y: anchorY }, { x: anchorX, y: anchorY + 1 });
      }
      if (!hasSegments || piece.segments.right) {
        cells.push({ x: anchorX + 1, y: anchorY }, { x: anchorX + 1, y: anchorY + 1 });
      }
      if (!cells.length) cells.push({ x: piece.x, y: piece.y });
      return cells.some((origin) => rayAttacksSquare(board, origin, target, DIRS.orthogonal));
    }
    if (movement.type === "compound") {
      return (movement.parts || []).some((part) => pieceAttacksSquare(board, { ...piece, type: part }, target));
    }
    return false;
  }

  function getEnemyAttackers(state) {
    if (!state || state.gameOver) return [];
    const attackers = [];
    const seen = new Set();
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const piece = pieceAt(state.board, x, y);
        if (!piece) continue;
        const key = piece.id || `${piece.type}:${piece.x},${piece.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (footprintCells(state.player, state.player.type).some((cell) => pieceAttacksSquare(state.board, piece, cell))) attackers.push(piece);
      }
    }
    return attackers;
  }

  function getEmptyCellsExceptPlayer(state, type = "pawn") {
    return emptyCellsForType(state, type);
  }

  window.CrownChainRules = { SIZE, idx, inBounds, pieceAt, isAnchorCell, getPieceDef, getLegalCaptures, getLegalMoves, getPiecePreview, isBoardClear, getEmptyCellsExceptPlayer, getEnemyAttackers };
}());
