(function () {
  'use strict';

  var STRINGS = {
    title: 'NUMBER SPRINT',
    tapToStart: 'Swipe or press an arrow key to start',
    howToPlay1: 'Slide all tiles at once.',
    howToPlay2: 'Same numbers merge into one.',
    howToPlay3: '30 moves — go for the highest score.',
    score: 'SCORE',
    best: 'BEST',
    moves: 'MOVES',
    maxTile: 'MAX',
    gameOver: 'OUT OF MOVES',
    newBest: 'NEW BEST!',
    almost: function (diff) { return 'BEST ' + diff.best + ' (' + diff.gap + ' more!)'; },
    tapToRetry: 'TAP or press an arrow key to retry'
  };

  var STORAGE_KEY = 'snackplay_numbersprint_best_v1';
  var SIZE = 4;
  var MOVE_BUDGET = 30;
  var SWIPE_THRESHOLD = 24;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function resize() {
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function viewW() { return window.innerWidth; }
  function viewH() { return window.innerHeight; }

  var best = 0;
  try {
    best = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
  } catch (e) { /* storage unavailable: fall back to 0 */ }

  var STATE_READY = 'ready';
  var STATE_PLAYING = 'playing';
  var STATE_GAMEOVER = 'gameover';
  var state = STATE_READY;

  var grid, score, maxTile, movesLeft;

  function emptyGrid() {
    var g = [];
    for (var r = 0; r < SIZE; r++) {
      var row = [];
      for (var c = 0; c < SIZE; c++) row.push(0);
      g.push(row);
    }
    return g;
  }

  function emptyCells(g) {
    var cells = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (g[r][c] === 0) cells.push([r, c]);
      }
    }
    return cells;
  }

  function spawnTile(g) {
    var cells = emptyCells(g);
    if (cells.length === 0) return;
    var pick = cells[Math.floor(Math.random() * cells.length)];
    g[pick[0]][pick[1]] = Math.random() < 0.9 ? 2 : 4;
  }

  function slideAndMergeRow(row) {
    var original = row.slice();
    var compact = row.filter(function (v) { return v !== 0; });
    var merged = [];
    var gained = 0;
    for (var i = 0; i < compact.length; i++) {
      if (i < compact.length - 1 && compact[i] === compact[i + 1]) {
        var mergedVal = compact[i] * 2;
        merged.push(mergedVal);
        gained += mergedVal;
        i++;
      } else {
        merged.push(compact[i]);
      }
    }
    while (merged.length < SIZE) merged.push(0);
    var moved = false;
    for (var j = 0; j < SIZE; j++) {
      if (merged[j] !== original[j]) { moved = true; break; }
    }
    return { row: merged, gained: gained, moved: moved };
  }

  function moveLeft(g) {
    var newGrid = [], gained = 0, moved = false;
    for (var r = 0; r < SIZE; r++) {
      var res = slideAndMergeRow(g[r]);
      newGrid.push(res.row);
      gained += res.gained;
      if (res.moved) moved = true;
    }
    return { grid: newGrid, gained: gained, moved: moved };
  }

  function reverseRow(row) { return row.slice().reverse(); }

  function moveRight(g) {
    var reversed = g.map(reverseRow);
    var res = moveLeft(reversed);
    return { grid: res.grid.map(reverseRow), gained: res.gained, moved: res.moved };
  }

  function transpose(g) {
    var t = [];
    for (var c = 0; c < SIZE; c++) {
      var col = [];
      for (var r = 0; r < SIZE; r++) col.push(g[r][c]);
      t.push(col);
    }
    return t;
  }

  function moveUp(g) {
    var t = transpose(g);
    var res = moveLeft(t);
    return { grid: transpose(res.grid), gained: res.gained, moved: res.moved };
  }

  function moveDown(g) {
    var t = transpose(g);
    var res = moveRight(t);
    return { grid: transpose(res.grid), gained: res.gained, moved: res.moved };
  }

  function anyMoveAvailable(g) {
    return moveLeft(g).moved || moveRight(g).moved || moveUp(g).moved || moveDown(g).moved;
  }

  function currentMaxTile(g) {
    var m = 0;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (g[r][c] > m) m = g[r][c];
      }
    }
    return m;
  }

  function reset() {
    grid = emptyGrid();
    spawnTile(grid);
    spawnTile(grid);
    score = 0;
    maxTile = currentMaxTile(grid);
    movesLeft = MOVE_BUDGET;
  }
  reset();

  function startGame() {
    reset();
    state = STATE_PLAYING;
  }

  function endGame() {
    state = STATE_GAMEOVER;
    var finalScore = Math.floor(score);
    if (finalScore > best) {
      best = finalScore;
      try { localStorage.setItem(STORAGE_KEY, String(best)); } catch (e) { /* ignore */ }
    }
  }

  function applyMove(direction) {
    var result;
    if (direction === 'left') result = moveLeft(grid);
    else if (direction === 'right') result = moveRight(grid);
    else if (direction === 'up') result = moveUp(grid);
    else result = moveDown(grid);

    if (!result.moved) return;

    grid = result.grid;
    score += result.gained;
    var m = currentMaxTile(grid);
    if (m > maxTile) maxTile = m;
    spawnTile(grid);
    movesLeft -= 1;

    if (movesLeft <= 0 || !anyMoveAvailable(grid)) {
      endGame();
    }
  }

  function onDirectionInput(direction) {
    if (state !== STATE_PLAYING) {
      startGame();
      return;
    }
    applyMove(direction);
  }

  window.addEventListener('keydown', function (e) {
    var map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[e.code]) {
      e.preventDefault();
      onDirectionInput(map[e.code]);
      return;
    }
    if (e.code === 'Space' || e.code === 'Enter') {
      if (state !== STATE_PLAYING) { e.preventDefault(); startGame(); }
    }
  });

  var touchStartX = 0, touchStartY = 0, touchTracking = false;
  canvas.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    if (!t) return;
    if (state !== STATE_PLAYING) { startGame(); return; }
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchTracking = true;
  }, { passive: true });

  canvas.addEventListener('touchend', function (e) {
    if (!touchTracking) return;
    touchTracking = false;
    var t = e.changedTouches[0];
    if (!t) return;
    var dx = t.clientX - touchStartX;
    var dy = t.clientY - touchStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      onDirectionInput(dx > 0 ? 'right' : 'left');
    } else {
      onDirectionInput(dy > 0 ? 'down' : 'up');
    }
  }, { passive: true });

  canvas.addEventListener('mousedown', function () {
    if (state !== STATE_PLAYING) startGame();
  });

  var TILE_COLORS = {
    0: '#cdc1b4', 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563',
    32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61',
    512: '#edc850', 1024: '#edc53f', 2048: '#edc22e'
  };
  function tileColor(v) {
    return TILE_COLORS[v] || '#3c3a32';
  }
  function tileTextColor(v) {
    return v <= 4 ? '#776e65' : '#f9f6f2';
  }

  function boardGeometry() {
    var boardSize = Math.min(viewW(), viewH()) * 0.85;
    var gap = boardSize * 0.03;
    var cell = (boardSize - gap * (SIZE + 1)) / SIZE;
    var boardX = (viewW() - boardSize) / 2;
    var boardY = viewH() / 2 - boardSize / 2 + 20;
    return { boardSize: boardSize, gap: gap, cell: cell, boardX: boardX, boardY: boardY };
  }

  function drawBoard() {
    var geo = boardGeometry();
    ctx.fillStyle = '#bbada0';
    roundRect(geo.boardX, geo.boardY, geo.boardSize, geo.boardSize, 8);
    ctx.fill();

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = grid[r][c];
        var x = geo.boardX + geo.gap + c * (geo.cell + geo.gap);
        var y = geo.boardY + geo.gap + r * (geo.cell + geo.gap);
        ctx.fillStyle = tileColor(v);
        roundRect(x, y, geo.cell, geo.cell, 6);
        ctx.fill();
        if (v !== 0) {
          ctx.fillStyle = tileTextColor(v);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          var fontSize = v >= 1024 ? geo.cell * 0.32 : geo.cell * 0.4;
          ctx.font = 'bold ' + fontSize + 'px system-ui, sans-serif';
          ctx.fillText(String(v), x + geo.cell / 2, y + geo.cell / 2 + 2);
        }
      }
    }
    ctx.textBaseline = 'alphabetic';
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawHud() {
    var geo = boardGeometry();
    ctx.fillStyle = '#776e65';
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(STRINGS.score + ' ' + Math.floor(score), geo.boardX, geo.boardY - 24);
    ctx.textAlign = 'right';
    ctx.fillText(STRINGS.best + ' ' + best, geo.boardX + geo.boardSize, geo.boardY - 24);

    ctx.textAlign = 'left';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(STRINGS.moves + ' ' + movesLeft, geo.boardX, geo.boardY - 4);
    ctx.textAlign = 'right';
    ctx.fillText(STRINGS.maxTile + ' ' + maxTile, geo.boardX + geo.boardSize, geo.boardY - 4);
  }

  function drawCenterOverlay(lines) {
    ctx.fillStyle = 'rgba(250,248,239,0.9)';
    ctx.fillRect(0, 0, viewW(), viewH());
    ctx.textAlign = 'center';
    var startY = viewH() / 2 - (lines.length - 1) * 18;
    for (var i = 0; i < lines.length; i++) {
      ctx.font = lines[i].size + 'px system-ui, sans-serif';
      ctx.fillStyle = lines[i].color || '#776e65';
      ctx.fillText(lines[i].text, viewW() / 2, startY + i * 36);
    }
  }

  function draw() {
    ctx.fillStyle = '#faf8ef';
    ctx.fillRect(0, 0, viewW(), viewH());

    if (state === STATE_READY) {
      drawBoard();
      drawHud();
      drawCenterOverlay([
        { text: STRINGS.title, size: 26, color: '#3c3a32' },
        { text: STRINGS.howToPlay1, size: 14 },
        { text: STRINGS.howToPlay2, size: 14 },
        { text: STRINGS.howToPlay3, size: 14 },
        { text: STRINGS.tapToStart, size: 13, color: '#a39890' }
      ]);
      return;
    }

    drawBoard();
    drawHud();

    if (state === STATE_GAMEOVER) {
      var finalScore = Math.floor(score);
      var bestLine;
      if (finalScore >= best) {
        bestLine = { text: STRINGS.newBest, size: 20, color: '#edc22e' };
      } else {
        bestLine = { text: STRINGS.almost({ best: best, gap: best - finalScore }), size: 15 };
      }
      drawCenterOverlay([
        { text: STRINGS.gameOver, size: 26, color: '#3c3a32' },
        { text: STRINGS.score + ' ' + finalScore + '  ·  ' + STRINGS.maxTile + ' ' + maxTile, size: 17 },
        bestLine,
        { text: STRINGS.tapToRetry, size: 13 }
      ]);
    }
  }

  function loop() {
    draw();
    window.requestAnimationFrame(loop);
  }
  window.requestAnimationFrame(loop);
})();
