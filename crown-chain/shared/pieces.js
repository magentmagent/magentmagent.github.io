(function () {
  const DIRS = {
    orthogonal: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    diagonal: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    all: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
  };

  const PIECES = {
    king: { label: "K", score: 15, movement: { type: "step", dirs: "all", range: 1 }, sprite: "king" },
    queen: { label: "Q", score: 40, movement: { type: "ray", dirs: "all" }, sprite: "queen" },
    rook: { label: "R", score: 25, movement: { type: "ray", dirs: "orthogonal" }, sprite: "rook" },
    bishop: { label: "B", score: 20, movement: { type: "ray", dirs: "diagonal" }, sprite: "bishop" },
    knight: { label: "N", score: 20, movement: { type: "leap", offsets: "knight" }, sprite: "knight" },
    pawn: { label: "P", score: 10, movement: { type: "pawnCapture" }, sprite: "pawn" },
    camel: { label: "Ca", score: 35, movement: { type: "leap", offsets: "camel" }, sprite: "camel" },
    prince: { label: "Pr", score: 35, movement: { type: "compound", parts: ["king", "knight"] }, sprite: "prince" },
    archbishop: { label: "Ar", score: 50, movement: { type: "compound", parts: ["bishop", "knight"] }, sprite: "archbishop" },
    chancellor: { label: "Ch", score: 50, movement: { type: "compound", parts: ["rook", "knight"] }, sprite: "general" },
    amazon: { label: "Am", score: 80, movement: { type: "compound", parts: ["queen", "knight"] }, sprite: "amazon" },
    jester: { label: "Je", score: 45, movement: { type: "leap", offsets: "jester" }, sprite: "jester" },
    wazir: { label: "Wa", score: 12, movement: { type: "leap", offsets: "wazir" }, sprite: "wazir" },
    ferz: { label: "Fe", score: 12, movement: { type: "leap", offsets: "ferz" }, sprite: "ferz" },
    dabbaba: { label: "Da", score: 16, movement: { type: "leap", offsets: "dabbaba" }, sprite: "dabbaba" },
    alfil: { label: "Al", score: 16, movement: { type: "leap", offsets: "alfil" }, sprite: "alfil" },
    zebra: { label: "Ze", score: 28, movement: { type: "leap", offsets: "zebra" }, sprite: "zebra" },
    giraffe: { label: "Gi", score: 30, movement: { type: "leap", offsets: "giraffe" }, sprite: "giraffe" },
    antelope: { label: "An", score: 34, movement: { type: "leap", offsets: "antelope" }, sprite: "antelope" },
    elephant: { label: "El", score: 26, movement: { type: "compound", parts: ["alfil", "dabbaba"] }, sprite: "elephant" },
    kirin: { label: "Ki", score: 24, movement: { type: "compound", parts: ["ferz", "dabbaba"] }, sprite: "kirin" },
    wizard: { label: "Wi", score: 34, movement: { type: "compound", parts: ["camel", "ferz"] }, sprite: "wizard" },
    champion: { label: "Ch", score: 38, movement: { type: "compound", parts: ["wazir", "alfil", "dabbaba"] }, sprite: "champion" },
    dragonking: { label: "Dk", score: 44, movement: { type: "compound", parts: ["rook", "ferz"] }, sprite: "dragonking" },
    dragonhorse: { label: "Dh", score: 44, movement: { type: "compound", parts: ["bishop", "wazir"] }, sprite: "dragonhorse" },
    nightrider: { label: "Nr", score: 42, movement: { type: "rider", offsets: "knight" }, sprite: "nightrider" },
    gryphon: { label: "Gr", score: 40, movement: { type: "gryphon" }, sprite: "gryphon" },
    ship: { label: "Sh", score: 40, movement: { type: "ship" }, sprite: "ship" },
    assassin: { label: "As", score: 60, movement: { type: "assassin" }, sprite: "assassin" },
    bigrook: { label: "Br", score: 56, movement: { type: "bigrook" }, sprite: "rook", size: { w: 2, h: 2 } }
  };

  const OFFSETS = {
    knight: [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]],
    camel: [[1, 3], [3, 1], [-1, 3], [-3, 1], [1, -3], [3, -1], [-1, -3], [-3, -1]],
    jester: [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [2, -2], [-2, 2], [-2, -2], [1, 1], [1, -1], [-1, 1], [-1, -1]],
    wazir: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    ferz: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    dabbaba: [[2, 0], [-2, 0], [0, 2], [0, -2]],
    alfil: [[2, 2], [2, -2], [-2, 2], [-2, -2]],
    zebra: [[2, 3], [3, 2], [-2, 3], [-3, 2], [2, -3], [3, -2], [-2, -3], [-3, -2]],
    giraffe: [[1, 4], [4, 1], [-1, 4], [-4, 1], [1, -4], [4, -1], [-1, -4], [-4, -1]],
    antelope: [[3, 4], [4, 3], [-3, 4], [-4, 3], [3, -4], [4, -3], [-3, -4], [-4, -3]]
  };

  const MODES = {
    basic: {
      id: "basic",
      startingBag: { pawn: 4, king: 2, rook: 2, bishop: 2, knight: 2, queen: 1 },
      addPools: [
        { minLevel: 1, weights: { pawn: 30, king: 20, rook: 15, bishop: 15, knight: 15, queen: 5 } }
      ]
    },
    chaos: {
      id: "chaos",
      startingBag: {
        pawn: 3, king: 1, rook: 1, bishop: 1, knight: 1, queen: 1,
        wazir: 1, ferz: 1, dabbaba: 1, alfil: 1,
        camel: 1, zebra: 1
      },
      addPools: [
        {
          minLevel: 1,
          weights: {
            pawn: 24, king: 14, rook: 10, bishop: 10, knight: 10, queen: 4,
            wazir: 9, ferz: 9, dabbaba: 7, alfil: 7, camel: 7, zebra: 5
          }
        },
        { minLevel: 4, weights: { camel: 10, prince: 10 } },
        { minLevel: 5, weights: { zebra: 8, giraffe: 8, antelope: 5 } },
        { minLevel: 7, weights: { archbishop: 8, chancellor: 8, elephant: 7, kirin: 7, wizard: 6, champion: 5, bigrook: 2 } },
        { minLevel: 9, weights: { dragonking: 6, dragonhorse: 6, nightrider: 5, assassin: 1 } },
        { minLevel: 10, weights: { amazon: 4, jester: 6 } },
        { minLevel: 11, weights: { gryphon: 5, ship: 5 } }
      ]
    }
  };
  MODES["basic-time"] = { ...MODES.basic, id: "basic-time", timeAttack: true };
  MODES["chaos-time"] = { ...MODES.chaos, id: "chaos-time", timeAttack: true };

  window.CrownChainPieces = { DIRS, OFFSETS, PIECES, MODES };
}());
