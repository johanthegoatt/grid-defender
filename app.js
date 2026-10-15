import { createGame, placeTurret, resetGame, sellTurret, sellValue, spawnWave, stepGame, upgradeCost, upgradeTurret, TURRET_TYPES } from "./src/gameEngine.js";

const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const feedEl = document.getElementById("feed");
const spawnBtn = document.getElementById("spawn");
const playBtn = document.getElementById("play");
const pauseBtn = document.getElementById("pause");
const tickBtn = document.getElementById("tick");
const resetBtn = document.getElementById("reset");
const waveSizeInput = document.getElementById("wave-size");
const simSpeedSelect = document.getElementById("sim-speed");
const tilePanel = document.getElementById("tile-panel");
const tileText = document.getElementById("tile-text");
const upgradeBtn = document.getElementById("upgrade");
const sellBtn = document.getElementById("sell");

const CELL = 64;
const state = createGame({ rows: 6, cols: 10 });
let loopId = 0;
const feed = [];
let selected = null;
let hover = null;
let buildType = "gun";

const TURRET_COLORS = { gun: "#2f6f58", sniper: "#5b4a8a", frost: "#2f7fae" };

const picker = document.querySelector(".turret-picker");
picker.addEventListener("click", (event) => {
  const button = event.target.closest("[data-type]");
  if (!button) return;
  buildType = button.dataset.type;
  for (const option of picker.querySelectorAll("[data-type]")) {
    option.setAttribute("aria-checked", String(option === button));
  }
  render();
});

function pushFeed(message) {
  feed.unshift(`${new Date().toLocaleTimeString()} | ${message}`);
  if (feed.length > 8) {
    feed.length = 8;
  }

  feedEl.innerHTML = "";
  for (const row of feed) {
    const item = document.createElement("li");
    item.textContent = row;
    feedEl.append(item);
  }
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(30,37,46,0.15)";
  for (let r = 0; r <= state.rows; r += 1) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(state.cols * CELL, r * CELL);
    ctx.stroke();
  }

  for (let c = 0; c <= state.cols; c += 1) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, state.rows * CELL);
    ctx.stroke();
  }
}

function drawRange(tile, range, color) {
  ctx.fillStyle = color;
  for (let r = 0; r < state.rows; r += 1) {
    for (let c = 0; c < state.cols; c += 1) {
      if (Math.abs(r - tile.row) + Math.abs(c - tile.col) <= range) {
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      }
    }
  }
}

function drawSelection() {
  if (selected) {
    const turret = state.turrets.find((t) => t.row === selected.row && t.col === selected.col);
    if (turret) drawRange(turret, turret.range, "rgba(47,111,88,0.14)");
    ctx.strokeStyle = "#1e252e";
    ctx.lineWidth = 2;
    ctx.strokeRect(selected.col * CELL + 2, selected.row * CELL + 2, CELL - 4, CELL - 4);
    ctx.lineWidth = 1;
  } else if (hover && !state.turrets.some((t) => t.row === hover.row && t.col === hover.col)) {
    // Show where a new turret would reach before you buy it.
    drawRange(hover, TURRET_TYPES[buildType].range, "rgba(47,111,88,0.08)");
  }
}

function drawTurrets() {
  for (const turret of state.turrets) {
    const type = turret.type ?? "gun";
    ctx.fillStyle = TURRET_COLORS[type];
    ctx.fillRect(turret.col * CELL + 14, turret.row * CELL + 14, CELL - 28, CELL - 28);
    // A dimmed sniper is reloading this tick.
    if ((turret.ready ?? 0) > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(turret.col * CELL + 14, turret.row * CELL + 14, CELL - 28, CELL - 28);
    }

    ctx.fillStyle = "#eef3ef";
    ctx.font = "12px Consolas";
    ctx.fillText(`${TURRET_TYPES[type].label[0]}${turret.level}`, turret.col * CELL + 22, turret.row * CELL + 38);
  }
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    ctx.fillStyle = enemy.chilled > 0 ? "#6aa7cf" : "#c54837";
    ctx.beginPath();
    ctx.arc(enemy.col * CELL + CELL / 2, enemy.row * CELL + CELL / 2, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "10px Consolas";
    ctx.fillText(
      `${Math.ceil(enemy.hp)}/${enemy.armor}`,
      enemy.col * CELL + CELL / 2 - 14,
      enemy.row * CELL + CELL / 2 + 4
    );
  }
}

function render() {
  drawGrid();
  drawSelection();
  drawTurrets();
  drawEnemies();
  const mode = loopId ? "Auto" : "Manual";
  const gameState = state.gameOver ? "GAME OVER" : "ACTIVE";
  syncTilePanel();
  statusEl.textContent = `Tick ${state.tick} | Wave ${state.wave} | Base ${state.baseHealth} HP | Credits ${state.credits} | Kills ${state.kills} | Escaped ${state.escaped} | Enemies ${state.enemies.length} | ${mode} | ${gameState}`;
}

function stopLoop() {
  if (!loopId) return;
  window.clearInterval(loopId);
  loopId = 0;
}

function doStep() {
  const summary = stepGame(state);
  if (summary.defeated || summary.escaped) {
    pushFeed(`Step summary -> defeated ${summary.defeated}, escaped ${summary.escaped}, hits ${summary.hits}`);
  }

  if (summary.gameOver) {
    stopLoop();
    pushFeed("Base destroyed. Reset to start over.");
  }
  render();
}

function startLoop() {
  if (loopId || state.gameOver) return;
  const speed = Math.max(120, Number(simSpeedSelect.value) || 550);
  loopId = window.setInterval(doStep, speed);
  pushFeed(`Auto simulation started at ${speed}ms/tick.`);
  render();
}

function pauseLoop() {
  if (!loopId) return;
  stopLoop();
  pushFeed("Simulation paused.");
  render();
}

function spawnSelectedWave() {
  if (state.gameOver) {
    pushFeed("The base is down. Press Reset to play again.");
    return;
  }
  const size = Math.max(1, Math.min(12, Number(waveSizeInput.value) || 4));
  spawnWave(state, size);
  pushFeed(`Spawned wave ${state.wave} (${size} enemies).`);
  render();
}

// The canvas is drawn at 640x384 but CSS shrinks it on small screens, so
// map the click back to canvas pixels before picking a tile.
function tileFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const col = Math.floor(x / CELL);
  const row = Math.floor(y / CELL);
  if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return null;
  return { row, col };
}

function turretOn(tile) {
  return tile ? state.turrets.find((t) => t.row === tile.row && t.col === tile.col) || null : null;
}

function syncTilePanel() {
  const turret = turretOn(selected);
  if (!turret) {
    selected = null;
    tilePanel.hidden = true;
    return;
  }
  tilePanel.hidden = false;
  const atTop = turret.level >= 3;
  const label = TURRET_TYPES[turret.type ?? "gun"].label;
  const effect = turret.chill ? `slows for ${turret.chill} ticks` : `${turret.damage} damage${turret.cooldown > 1 ? ` every ${turret.cooldown} ticks` : ""}`;
  tileText.textContent = `Level ${turret.level} ${label.toLowerCase()}: ${effect}, reach ${turret.range} tiles.`;
  upgradeBtn.textContent = atTop ? "Top level" : `Upgrade (${upgradeCost(turret)})`;
  upgradeBtn.disabled = atTop || state.credits < upgradeCost(turret);
  sellBtn.textContent = `Sell (+${sellValue(turret)})`;
}

function tryAction(action) {
  try {
    action();
  } catch (error) {
    pushFeed(error.message);
  }
  render();
}

canvas.addEventListener("click", (event) => {
  const tile = tileFromEvent(event);
  if (!tile) return;

  if (turretOn(tile)) {
    // Tap a turret to select it; Shift+Click still upgrades in one go.
    if (event.shiftKey) {
      tryAction(() => {
        const upgraded = upgradeTurret(state, tile.row, tile.col);
        pushFeed(`Upgraded to level ${upgraded.level}.`);
      });
      return;
    }
    selected = tile;
    render();
    return;
  }

  selected = null;
  tryAction(() => {
    placeTurret(state, tile.row, tile.col, buildType);
    pushFeed(`Placed a ${TURRET_TYPES[buildType].label.toLowerCase()} for ${TURRET_TYPES[buildType].cost} credits.`);
  });
});

canvas.addEventListener("pointermove", (event) => {
  const tile = tileFromEvent(event);
  if (tile?.row === hover?.row && tile?.col === hover?.col) return;
  hover = tile;
  render();
});
canvas.addEventListener("pointerleave", () => {
  hover = null;
  render();
});

upgradeBtn.addEventListener("click", () => {
  if (!selected) return;
  tryAction(() => {
    const upgraded = upgradeTurret(state, selected.row, selected.col);
    pushFeed(`Upgraded to level ${upgraded.level}.`);
  });
});

sellBtn.addEventListener("click", () => {
  if (!selected) return;
  tryAction(() => {
    const refund = sellTurret(state, selected.row, selected.col);
    selected = null;
    pushFeed(`Sold for ${refund} credits.`);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    selected = null;
    render();
  }
});

spawnBtn.addEventListener("click", spawnSelectedWave);

tickBtn.addEventListener("click", doStep);
playBtn.addEventListener("click", startLoop);
pauseBtn.addEventListener("click", pauseLoop);
simSpeedSelect.addEventListener("change", () => {
  if (!loopId) return;
  pauseLoop();
  startLoop();
});

resetBtn.addEventListener("click", () => {
  stopLoop();
  resetGame(state);
  selected = null;
  feed.length = 0;
  pushFeed("Game reset.");
  render();
});

pushFeed("Pick a turret, then tap an empty tile to build it. Tap a turret to upgrade or sell it.");
render();
