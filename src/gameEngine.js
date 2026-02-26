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

  if (state.credits < 10) {
    throw new Error("Insufficient credits.");
  }

  if (state.turrets.some((turret) => turret.row === row && turret.col === col)) {
    throw new Error("Turret already placed on this tile.");
  }

  const turret = {
    row,
    col,
    level: 1,
    range: 2,
    damage: 1
  };

  state.turrets.push(turret);
  state.credits -= 10;
  return turret;
}

function turretAt(state, row, col) {
  return state.turrets.find((turret) => turret.row === row && turret.col === col) || null;
}

export function upgradeTurret(state, row, col) {
  const turret = turretAt(state, row, col);
  if (!turret) {
    throw new Error("No turret found on this tile.");
  }

  if (turret.level >= 3) {
    throw new Error("Turret is already at max level.");
  }

  const cost = 8 + turret.level * 4;
  if (state.credits < cost) {
    throw new Error("Insufficient credits for upgrade.");
  }

  state.credits -= cost;
  turret.level += 1;
  turret.damage += 1;
  turret.range += 0.5;
  return turret;
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

function turretFire(state) {
  let hitCount = 0;
  for (const turret of state.turrets) {
    const targets = state.enemies
      .filter((enemy) => distance(turret, enemy) <= turret.range)
      .sort((left, right) => left.col - right.col || left.hp - right.hp);
    const target = targets[0];
    if (!target) continue;
    const mitigation = Number(target.armor || 0) * 0.5;
    const effectiveDamage = Math.max(1, turret.damage - mitigation);
    target.hp -= effectiveDamage;
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
