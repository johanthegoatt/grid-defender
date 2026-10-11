import test from "node:test";
import assert from "node:assert/strict";

import { createGame, placeTurret, resetGame, spawnWave, stepGame, upgradeTurret } from "../src/gameEngine.js";

test("placeTurret consumes credits", () => {
  const game = createGame();
  const turret = placeTurret(game, 0, 0);

  assert.equal(game.turrets.length, 1);
  assert.equal(game.credits, 20);
  assert.equal(turret.level, 1);
});

test("upgradeTurret increases level and stats", () => {
  const game = createGame();
  placeTurret(game, 0, 0);
  const upgraded = upgradeTurret(game, 0, 0);

  assert.equal(upgraded.level, 2);
  assert.equal(upgraded.damage, 2);
  assert.equal(upgraded.range, 2.5);
  assert.equal(game.credits, 8);
});

test("enemy escape reduces base health", () => {
  const game = createGame({ rows: 1, cols: 1 });
  game.enemies.push({ row: 0, col: 0, hp: 3 });

  stepGame(game);
  assert.equal(game.baseHealth, 7);
});

test("turrets damage enemies over steps", () => {
  const game = createGame({ rows: 1, cols: 4 });
  placeTurret(game, 0, 1);
  spawnWave(game, 1);

  stepGame(game);
  stepGame(game);
  stepGame(game);

  assert.equal(game.enemies.length <= 1, true);
  assert.equal(game.tick, 3);
});

test("spawnWave includes armored and faster enemies at later waves", () => {
  const game = createGame({ rows: 2, cols: 5 });
  game.wave = 3;
  spawnWave(game, 4);

  const speedy = game.enemies.some((enemy) => enemy.speed === 2);
  const armored = game.enemies.every((enemy) => Number.isFinite(enemy.armor));
  assert.equal(speedy, true);
  assert.equal(armored, true);
});

test("stepGame reports game over when base health reaches zero", () => {
  const game = createGame({ rows: 1, cols: 1 });
  game.baseHealth = 1;
  game.enemies.push({ id: "e", row: 0, col: 0, hp: 2 });

  const summary = stepGame(game);
  assert.equal(summary.gameOver, true);
  assert.equal(game.gameOver, true);
  assert.equal(game.baseHealth, 0);
});

test("resetGame restores initial state", () => {
  const game = createGame();
  placeTurret(game, 0, 0);
  spawnWave(game, 2);
  stepGame(game);
  resetGame(game);

  assert.equal(game.tick, 0);
  assert.equal(game.wave, 0);
  assert.equal(game.turrets.length, 0);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.credits, 30);
});

test("turrets do not waste shots on an enemy already killed this tick", async () => {
  const state = createGame({ rows: 3, cols: 6 });
  state.credits = 100;
  placeTurret(state, 0, 2);
  placeTurret(state, 1, 2);
  state.enemies = [
    { id: "a", row: 0, col: 3, hp: 1, armor: 0, speed: 1 },
    { id: "b", row: 1, col: 4, hp: 1, armor: 0, speed: 1 },
  ];
  const summary = stepGame(state);
  assert.equal(summary.defeated, 2);
  assert.equal(state.enemies.length, 0);
});

test("selling refunds 70% of everything spent on the turret", async () => {
  const { sellTurret, sellValue } = await import("../src/gameEngine.js");
  const state = createGame();
  state.credits = 100;
  placeTurret(state, 2, 2);
  upgradeTurret(state, 2, 2);
  // 10 to place + 12 to upgrade = 22 spent, 70% back rounds down to 15.
  assert.equal(sellValue(state.turrets[0]), 15);
  const before = state.credits;
  assert.equal(sellTurret(state, 2, 2), 15);
  assert.equal(state.credits, before + 15);
  assert.equal(state.turrets.length, 0);
  assert.throws(() => sellTurret(state, 2, 2), /No turret here/);
});

test("errors say what went wrong in plain words", () => {
  const state = createGame();
  state.credits = 5;
  assert.throws(() => placeTurret(state, 0, 0), /a turret costs 10/);
});
