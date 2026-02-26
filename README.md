# Grid Defender

## Description
Grid Defender is a local browser strategy project where you place turrets on a grid to defend your base from wave-based enemies.

## Features
- Tile-based turret placement with credit economy
- Wave spawning with per-tick enemy movement
- Turret range and damage simulation
- Base health loss when enemies escape
- Canvas-rendered game board with manual and auto simulation modes
- Adjustable simulation speed and wave size controls
- Event feed with combat summaries (hits, defeated, escaped)
- Game-over handling and full reset flow

## Run
```bash
cd grid-defender
npm run dev
```
Open `http://127.0.0.1:8094/grid-defender/index.html`.

## Test
```bash
cd grid-defender
npm test
```

## Project Structure
```text
grid-defender/
  index.html
  styles.css
  app.js
  src/
    gameEngine.js
  tests/
    gameEngine.test.js
  package.json
  README.md
```
