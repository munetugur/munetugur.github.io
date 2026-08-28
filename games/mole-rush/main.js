(function () {
  'use strict';

  var STRINGS = {
    title: 'MOLE RUSH',
    tapToStart: 'Tap to start (20 seconds)',
    hint: 'Whack moles as they pop up. Gold ones are worth 5x.',
    score: 'SCORE',
    best: 'BEST',
    time: 'TIME',
    gameOver: "TIME'S UP",
    newBest: 'NEW BEST!',
    almost: function (diff) { return 'BEST ' + diff.best + ' (' + diff.gap + ' more!)'; },
    tapToRetry: 'Tap to play again'
  };

  var STORAGE_KEY = 'snackplay_molerush_best_v1';
  var GRID = 3;
  var GAME_LENGTH = 20;
  var SPAWN_MIN = 0.6, SPAWN_MAX = 1.0;
  var UP_TIME_NORMAL = 0.7, UP_TIME_GOLD = 0.4;
  var GOLD_CHANCE = 0.1;

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

  var holes, score, timeLeft, spawnTimer, lastTime;

  function reset() {
    holes = [];
    for (var i = 0; i < GRID * GRID; i++) holes.push({ up: false, golden: false, timeLeft: 0 });
    score = 0;
    timeLeft = GAME_LENGTH;
    spawnTimer = 0.4;
    lastTime = null;
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

  function boardGeometry() {
    var boardSize = Math.min(viewW(), viewH()) * 0.8;
    var gap = boardSize * 0.04;
    var cell = (boardSize - gap * (GRID + 1)) / GRID;
    var boardX = (viewW() - boardSize) / 2;
    var boardY = viewH() / 2 - boardSize / 2 + 10;
    return { boardSize: boardSize, gap: gap, cell: cell, boardX: boardX, boardY: boardY };
  }

  function holeAt(clientX, clientY) {
    var geo = boardGeometry();
    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        var x = geo.boardX + geo.gap + c * (geo.cell + geo.gap);
        var y = geo.boardY + geo.gap + r * (geo.cell + geo.gap);
        if (clientX >= x && clientX <= x + geo.cell && clientY >= y && clientY <= y + geo.cell) {
          return r * GRID + c;
        }
      }
    }
    return -1;
  }

  function whack(index) {
    if (index < 0) return;
    var h = holes[index];
    if (!h.up) return;
    score += h.golden ? 5 : 1;
    h.up = false;
    h.golden = false;
    h.timeLeft = 0;
  }

  function onTap(clientX, clientY) {
    if (state !== STATE_PLAYING) {
      startGame();
      return;
    }
    whack(holeAt(clientX, clientY));
  }

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      if (state !== STATE_PLAYING) { e.preventDefault(); startGame(); }
    }
  });
  canvas.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    if (!t) return;
    e.preventDefault();
    onTap(t.clientX, t.clientY);
  }, { passive: false });
  canvas.addEventListener('mousedown', function (e) { onTap(e.clientX, e.clientY); });

  function update(dt) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endGame();
      return;
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      var emptyIdx = [];
      for (var i = 0; i < holes.length; i++) if (!holes[i].up) emptyIdx.push(i);
      if (emptyIdx.length > 0) {
        var pick = emptyIdx[Math.floor(Math.random() * emptyIdx.length)];
        var golden = Math.random() < GOLD_CHANCE;
        holes[pick].up = true;
        holes[pick].golden = golden;
        holes[pick].timeLeft = golden ? UP_TIME_GOLD : UP_TIME_NORMAL;
      }
      spawnTimer = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
    }

    for (var j = 0; j < holes.length; j++) {
      if (holes[j].up) {
        holes[j].timeLeft -= dt;
        if (holes[j].timeLeft <= 0) {
          holes[j].up = false;
          holes[j].golden = false;
        }
      }
    }
  }

  function drawHoles() {
    var geo = boardGeometry();
    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        var idx = r * GRID + c;
        var h = holes[idx];
        var x = geo.boardX + geo.gap + c * (geo.cell + geo.gap);
        var y = geo.boardY + geo.gap + r * (geo.cell + geo.gap);

        ctx.fillStyle = '#3f2a14';
        ctx.beginPath();
        ctx.ellipse(x + geo.cell / 2, y + geo.cell * 0.8, geo.cell * 0.42, geo.cell * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        if (h.up) {
          ctx.fillStyle = h.golden ? '#facc15' : '#a16207';
          ctx.beginPath();
          ctx.ellipse(x + geo.cell / 2, y + geo.cell * 0.45, geo.cell * 0.32, geo.cell * 0.38, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawHud() {
    var geo = boardGeometry();
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(STRINGS.score + ' ' + Math.floor(score), geo.boardX, geo.boardY - 20);
    ctx.textAlign = 'right';
    ctx.fillText(STRINGS.time + ' ' + Math.ceil(timeLeft), geo.boardX + geo.boardSize, geo.boardY - 20);
  }

  function drawCenterOverlay(lines) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, viewW(), viewH());
    ctx.textAlign = 'center';
    var startY = viewH() / 2 - (lines.length - 1) * 16;
    for (var i = 0; i < lines.length; i++) {
      ctx.font = lines[i].size + 'px system-ui, sans-serif';
      ctx.fillStyle = lines[i].color || '#f8fafc';
      ctx.fillText(lines[i].text, viewW() / 2, startY + i * 34);
    }
  }

  function draw() {
    ctx.fillStyle = '#4d7c0f';
    ctx.fillRect(0, 0, viewW(), viewH());
    drawHoles();

    if (state === STATE_READY) {
      drawHud();
      drawCenterOverlay([
        { text: STRINGS.title, size: 28 },
        { text: STRINGS.tapToStart, size: 15 },
        { text: STRINGS.hint, size: 12, color: '#d1d5db' }
      ]);
      return;
    }

    drawHud();

    if (state === STATE_GAMEOVER) {
      var finalScore = Math.floor(score);
      var bestLine;
      if (finalScore >= best) {
        bestLine = { text: STRINGS.newBest, size: 20, color: '#facc15' };
      } else {
        bestLine = { text: STRINGS.almost({ best: best, gap: best - finalScore }), size: 16 };
      }
      drawCenterOverlay([
        { text: STRINGS.gameOver, size: 26 },
        { text: STRINGS.score + ' ' + finalScore, size: 18 },
        bestLine,
        { text: STRINGS.tapToRetry, size: 13, color: '#d1d5db' }
      ]);
    }
  }

  function loop(t) {
    if (lastTime === null) lastTime = t;
    var dt = Math.min((t - lastTime) / 1000, 0.05);
    lastTime = t;
    if (state === STATE_PLAYING) update(dt);
    draw();
    window.requestAnimationFrame(loop);
  }
  window.requestAnimationFrame(loop);
})();
