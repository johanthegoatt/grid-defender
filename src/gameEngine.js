// Three jobs, three trade-offs: the gun is cheap and constant, the sniper
// reaches across the board but fires every other tick, and frost does no
// damage at all, it slows what it touches so the others get more shots.
export const TURRET_TYPES = {
  gun: { label: "Gun", cost: 10, range: 2, damage: 1, cooldown: 1, chill: 0 },
  sniper: { label: "Sniper", cost: 18, range: 4, damage: 3, cooldown: 2, chill: 0 },
  frost: { label: "Frost", cost: 14, range: 2, damage: 0, cooldown: 1, chill: 2 }
};

export const TURRET_COST = TURRET_TYPES.gun.cost;
// Selling refunds this share of everything spent on the turret, the same
// rule Bloons TD 6 uses by default, so moving a turret costs something.
export const SELL_REFUND = 0.7;

export function upgradeCost(turret) {
  const base = (TURRET_TYPES[turret.type] ?? TURRET_TYPES.gun).cost;
  return Math.round(base * 0.8) + turret.level * 4;
}

export function createGame(config = {}) {
  const rows = Number(config.rows) || 6;
  const cols = Number(config.cols) || 10;
  return {
    rows,
    cols,
    credits: 30,
    baseHealth: 8,
    wave: 0,
    tick: 0,
    kills: 0,
    escaped: 0,
    enemySerial: 0,
    gameOver: false,
    turrets: [],
    enemies: []
  };
}

export function resetGame(state, config = {}) {
  const fresh = createGame({
    rows: config.rows || state.rows,
    cols: config.cols || state.cols
  });
  Object.assign(state, fresh);
  return state;
}

function inBounds(state, row, col) {
  return row >= 0 && row < state.rows && col >= 0 && col < state.cols;
}

export function placeTurret(state, row, col, type = "gun") {
  const spec = TURRET_TYPES[type];
  if (!spec) {
    throw new Error(`Unknown turret type "${type}".`);
  }

  if (!inBounds(state, row, col)) {
    throw new Error("Turret placement is outside the board.");
  }

  if (state.credits < spec.cost) {
    throw new Error(`Not enough credits: a ${spec.label.toLowerCase()} costs ${spec.cost}.`);
  }

  if (state.turrets.some((turret) => turret.row === row && turret.col === col)) {
    throw new Error("There is already a turret here.");
  }

  const turret = {
    row,
    col,
    type,
    level: 1,
    range: spec.range,
    damage: spec.damage,
    chill: spec.chill,
    cooldown: spec.cooldown,
    ready: 0,
    spent: spec.cost
  };

  state.turrets.push(turret);
  state.credits -= spec.cost;
  return turret;
}

function turretAt(state, row, col) {
  return state.turrets.find((turret) => turret.row === row && turret.col === col) || null;
}

export function upgradeTurret(state, row, col) {
  const turret = turretAt(state, row, col);
  if (!turret) {
    throw new Error("No turret here.");
  }

  if (turret.level >= 3) {
    throw new Error("This turret is already at the top level.");
  }

  const cost = upgradeCost(turret);
  if (state.credits < cost) {
    throw new Error(`Not enough credits: this upgrade costs ${cost}.`);
  }

  state.credits -= cost;
  turret.spent = (turret.spent ?? TURRET_COST) + cost;
  turret.level += 1;
  // Frost upgrades hold enemies longer instead of hitting harder.
  if (turret.type === "frost") turret.chill += 1;
  else turret.damage += 1;
  turret.range += 0.5;
  return turret;
}

export function sellValue(turret) {
  return Math.floor((turret.spent ?? TURRET_COST) * SELL_REFUND);
}

export function sellTurret(state, row, col) {
  const index = state.turrets.findIndex((turret) => turret.row === row && turret.col === col);
  if (index < 0) {
    throw new Error("No turret here.");
  }
  const [turret] = state.turrets.splice(index, 1);
  const refund = sellValue(turret);
  state.credits += refund;
  return refund;
}

export function spawnWave(state, count = 4) {
  if (state.gameOver) {
    throw new Error("Cannot spawn wave after game over.");
  }

  const size = Math.max(1, Math.min(12, Number(count) || 1));
  const hp = 3 + Math.floor(state.wave / 3);
  const armor = Math.min(3, Math.floor(state.wave / 4));
  state.wave += 1;
  for (let i = 0; i < size; i += 1) {
    const speed = state.wave >= 3 && i % 3 === 0 ? 2 : 1;
    state.enemySerial += 1;
    state.enemies.push({
      id: `${state.wave}-${state.enemySerial}`,
      row: i % state.rows,
      col: state.cols - 1,
      hp: hp + (speed === 2 ? 1 : 0),
      armor,
      speed
    });
  }
  return state.enemies.length;
}

function distance(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function damageTo(turret, enemy) {
  if (!turret.damage) return 0;
  const mitigation = Number(enemy.armor || 0) * 0.5;
  return Math.max(1, turret.damage - mitigation);
}

// Each turret shoots the enemy closest to the base that is still alive this
// tick. Before, turrets later in the list kept firing at an enemy an earlier
// turret had already killed, so whole volleys were wasted while the next
// enemy walked past.
function turretFire(state) {
  let hitCount = 0;
  for (const turret of state.turrets) {
    if ((turret.ready ?? 0) > 0) {
      turret.ready -= 1;
      continue;
    }
    // Frost prefers enemies it hasn't chilled yet, so two frosts spread out.
    const targets = state.enemies
      .filter((enemy) => enemy.hp > 0 && distance(turret, enemy) <= turret.range)
      .sort((left, right) =>
        (turret.chill ? (left.chilled > 0) - (right.chilled > 0) : 0) || left.col - right.col || left.hp - right.hp
      );
    const target = targets[0];
    if (!target) continue;
    target.hp -= damageTo(turret, target);
    if (turret.chill) target.chilled = Math.max(target.chilled || 0, turret.chill);
    turret.ready = (turret.cooldown ?? 1) - 1;
    hitCount += 1;
  }
  return hitCount;
}

// A chilled enemy moves one tile slower; at speed 1 that means it only
// moves every other tick while the chill lasts.
function moveEnemies(state) {
  for (const enemy of state.enemies) {
    const speed = Number(enemy.speed || 1);
    let step = speed;
    if (enemy.chilled > 0) {
      step = speed > 1 ? speed - 1 : state.tick % 2;
      enemy.chilled -= 1;
    }
    enemy.col -= step;
  }
}

function settleState(state) {
  let escaped = 0;
  let defeated = 0;

  state.enemies = state.enemies.filter((enemy) => {
    if (enemy.hp <= 0) {
      state.credits += 2;
      state.kills += 1;
      defeated += 1;
      return false;
    }
    if (enemy.col < 0) {
      escaped += 1;
      return false;
    }
    return true;
  });

  state.baseHealth -= escaped;
  state.escaped += escaped;
  if (state.baseHealth <= 0) {
    state.baseHealth = 0;
    state.gameOver = true;
  }

  return {
    escaped,
    defeated,
    gameOver: state.gameOver
  };
}

export function stepGame(state) {
  if (state.gameOver) {
    return {
      escaped: 0,
      defeated: 0,
      gameOver: true,
      hits: 0
    };
  }
  state.tick += 1;
  const hits = turretFire(state);
  moveEnemies(state);
  const settled = settleState(state);
  return {
    ...settled,
    hits
  };
}

// Save and load as plain JSON. Anything malformed loads as null so a bad
// or old save starts a fresh game instead of breaking the board.
export const SAVE_VERSION = 1;

export function serializeGame(state) {
  return JSON.stringify({ v: SAVE_VERSION, state });
}

export function deserializeGame(text) {
  try {
    const parsed = JSON.parse(text);
    const state = parsed?.state;
    if (parsed?.v !== SAVE_VERSION || !state || !Array.isArray(state.turrets) || !Array.isArray(state.enemies)) {
      return null;
    }
    const numbers = ["rows", "cols", "credits", "baseHealth", "wave", "tick", "kills", "escaped", "enemySerial"];
    if (!numbers.every((key) => Number.isFinite(state[key]))) return null;
    if (state.turrets.some((t) => !TURRET_TYPES[t.type ?? "gun"] || !inBounds(state, t.row, t.col))) return null;
    return { ...createGame({ rows: state.rows, cols: state.cols }), ...state };
  } catch {
    return null;
  }
}
