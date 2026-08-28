(function () {
  'use strict';

  var STRINGS = {
    title: 'FRUIT DROP',
    tapToStart: 'Tap a column to start',
    hint: 'Same fruit stacks and merges. Chain merges for bonus points.',
    score: 'SCORE',
    best: 'BEST',
    gameOver: 'BOARD FULL',
    newBest: 'NEW BEST!',
    almost: function (diff) { return 'BEST ' + diff.best + ' (' + diff.gap + ' more!)'; },
    tapToRetry: 'Tap to play again'
  };

  var STORAGE_KEY = 'snackplay_fruitdrop_best_v1';
  var COLUMNS = 5;
  var MAX_ROWS = 6;
  var FRUIT_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a78bfa'];

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
  try { best = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0; } catch (e) { /* ignore */ }

  var STATE_READY = 'ready', STATE_PLAYING = 'playing', STATE_GAMEOVER = 'gameover';
  var state = STATE_READY;

  var grid, score, lastChainText, lastChainTimer;

  function reset() {
    grid = [];
    for (var i = 0; i < COLUMNS; i++) grid.push([]);
    score = 0;
    lastChainText = '';
    lastChainTimer = 0;
  }
  reset();

  function startGame() {
    reset();
    state = STATE_PLAYING;
  }

  function boardAllFull() {
    for (var i = 0; i < COLUMNS; i++) if (grid[i].length < MAX_ROWS) return false;
    return true;
  }

  function endGame() {
    state = STATE_GAMEOVER;
    var finalScore = Math.floor(score);
    if (finalScore > best) {
      best = finalScore;
      try { localStorage.setItem(STORAGE_KEY, String(best)); } catch (e) { /* ignore */ }
    }
  }

  function dropInColumn(col) {
    if (grid[col].length >= MAX_ROWS) return;
    var tier = Math.random() < 0.5 ? 1 : 2;
    grid[col].push(tier);

    var chain = 0;
    while (grid[col].length >= 2 && grid[col][grid[col].length - 1] === grid[col][grid[col].length - 2]) {
      var t = grid[col].pop();
      grid[col].pop();
      var newTier = t + 1;
      grid[col].push(newTier);
      chain++;
      score += newTier * 10 * (1 + chain * 0.5);
    }
    if (chain >= 2) {
      lastChainText = chain + 'x CHAIN!';
      lastChainTimer = 1.2;
    }

    if (boardAllFull()) endGame();
  }

  function boardGeometry() {
    var boardW = Math.min(viewW() * 0.9, 420);
    var boardH = viewH() * 0.7;
    var colW = boardW / COLUMNS;
    var rowH = boardH / MAX_ROWS;
    var boardX = (viewW() - boardW) / 2;
    var boardY = viewH() * 0.5 - boardH / 2 + 10;
    return { boardW: boardW, boardH: boardH, colW: colW, rowH: rowH, boardX: boardX, boardY: boardY };
  }

  function columnAt(clientX) {
    var geo = boardGeometry();
    if (clientX < geo.boardX || clientX > geo.boardX + geo.boardW) return -1;
    return Math.floor((clientX - geo.boardX) / geo.colW);
  }

  function onTap(clientX) {
    if (state !== STATE_PLAYING) { startGame(); return; }
    var col = columnAt(clientX);
    if (col >= 0 && col < COLUMNS) dropInColumn(col);
  }

  canvas.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    if (!t) return;
    e.preventDefault();
    onTap(t.clientX);
  }, { passive: false });
  canvas.addEventListener('mousedown', function (e) { onTap(e.clientX); });
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      if (state !== STATE_PLAYING) { e.preventDefault(); startGame(); }
    }
  });

  function drawBoard() {
    var geo = boardGeometry();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.strokeRect(geo.boardX, geo.boardY, geo.boardW, geo.boardH);

    for (var c = 1; c < COLUMNS; c++) {
      var x = geo.boardX + c * geo.colW;
      ctx.beginPath();
      ctx.moveTo(x, geo.boardY);
      ctx.lineTo(x, geo.boardY + geo.boardH);
      ctx.strokeStyle = 'rgba(217,119,6,0.3)';
      ctx.stroke();
    }

    for (var col = 0; col < COLUMNS; col++) {
      for (var row = 0; row < grid[col].length; row++) {
        var tier = grid[col][row];
        var cx = geo.boardX + col * geo.colW + geo.colW / 2;
        var cy = geo.boardY + geo.boardH - row * geo.rowH - geo.rowH / 2;
        var radius = geo.rowH * 0.4;
        ctx.fillStyle = FRUIT_COLORS[(tier - 1) % FRUIT_COLORS.length];
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawHud() {
    var geo = boardGeometry();
    ctx.fillStyle = '#7c2d12';
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(STRINGS.score + ' ' + Math.floor(score), geo.boardX, geo.boardY - 20);
    ctx.textAlign = 'right';
    ctx.fillText(STRINGS.best + ' ' + best, geo.boardX + geo.boardW, geo.boardY - 20);

    if (lastChainTimer > 0) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillStyle = '#ea580c';
      ctx.fillText(lastChainText, viewW() / 2, geo.boardY - 20);
    }
  }

  function drawCenterOverlay(lines) {
    ctx.fillStyle = 'rgba(255,247,237,0.92)';
    ctx.fillRect(0, 0, viewW(), viewH());
    ctx.textAlign = 'center';
    var startY = viewH() / 2 - (lines.length - 1) * 16;
    for (var i = 0; i < lines.length; i++) {
      ctx.font = lines[i].size + 'px system-ui, sans-serif';
      ctx.fillStyle = lines[i].color || '#7c2d12';
      ctx.fillText(lines[i].text, viewW() / 2, startY + i * 34);
    }
  }

  function draw() {
    ctx.fillStyle = '#fff7ed';
    ctx.fillRect(0, 0, viewW(), viewH());
    drawBoard();

    if (state === STATE_READY) {
      drawCenterOverlay([
        { text: STRINGS.title, size: 28 },
        { text: STRINGS.tapToStart, size: 15 },
        { text: STRINGS.hint, size: 12, color: '#92400e' }
      ]);
      return;
    }

    drawHud();

    if (state === STATE_GAMEOVER) {
      var finalScore = Math.floor(score);
      var bestLine;
      if (finalScore >= best) {
        bestLine = { text: STRINGS.newBest, size: 20, color: '#ea580c' };
      } else {
        bestLine = { text: STRINGS.almost({ best: best, gap: best - finalScore }), size: 16 };
      }
      drawCenterOverlay([
        { text: STRINGS.gameOver, size: 26 },
        { text: STRINGS.score + ' ' + finalScore, size: 18 },
        bestLine,
        { text: STRINGS.tapToRetry, size: 13, color: '#92400e' }
      ]);
    }
  }

  var lastTime = null;
  function loop(t) {
    if (lastTime === null) lastTime = t;
    var dt = Math.min((t - lastTime) / 1000, 0.05);
    lastTime = t;
    if (lastChainTimer > 0) lastChainTimer -= dt;
    draw();
    window.requestAnimationFrame(loop);
  }
  window.requestAnimationFrame(loop);
})();
