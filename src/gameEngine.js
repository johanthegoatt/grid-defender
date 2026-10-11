export const TURRET_COST = 10;
// Selling refunds this share of everything spent on the turret, the same
// rule Bloons TD 6 uses by default, so moving a turret costs something.
export const SELL_REFUND = 0.7;

export function upgradeCost(turret) {
  return 8 + turret.level * 4;
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

export function placeTurret(state, row, col) {
  if (!inBounds(state, row, col)) {
    throw new Error("Turret placement is outside the board.");
  }

  if (state.credits < TURRET_COST) {
    throw new Error(`Not enough credits: a turret costs ${TURRET_COST}.`);
  }

  if (state.turrets.some((turret) => turret.row === row && turret.col === col)) {
    throw new Error("There is already a turret here.");
  }

  const turret = {
    row,
    col,
    level: 1,
    range: 2,
    damage: 1,
    spent: TURRET_COST
  };

  state.turrets.push(turret);
  state.credits -= TURRET_COST;
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
  turret.damage += 1;
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
    const targets = state.enemies
      .filter((enemy) => enemy.hp > 0 && distance(turret, enemy) <= turret.range)
      .sort((left, right) => left.col - right.col || left.hp - right.hp);
    const target = targets[0];
    if (!target) continue;
    target.hp -= damageTo(turret, target);
    hitCount += 1;
  }
  return hitCount;
}

function moveEnemies(state) {
  for (const enemy of state.enemies) {
    enemy.col -= Number(enemy.speed || 1);
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
