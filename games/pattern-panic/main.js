(function () {
  'use strict';

  var STRINGS = {
    title: 'PATTERN PANIC',
    tapToStart: 'Tap to start',
    hint: 'Watch the pattern, then repeat it. It gets faster.',
    round: 'ROUND',
    best: 'BEST',
    gameOver: 'WRONG PANEL',
    newBest: 'NEW BEST!',
    almost: function (diff) { return 'BEST ' + diff.best + ' (' + diff.gap + ' more!)'; },
    tapToRetry: 'Tap to try again'
  };

  var STORAGE_KEY = 'snackplay_patternpanic_best_v1';
  var COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308'];
  var COLORS_DIM = ['#7f1d1d', '#1e3a8a', '#14532d', '#713f12'];
  var BASE_SPEED = 600, MIN_SPEED = 200, SPEED_STEP = 20;

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

  var PHASE_READY = 'ready', PHASE_PLAYBACK = 'playback', PHASE_INPUT = 'input',
      PHASE_PAUSE = 'pause', PHASE_GAMEOVER = 'gameover';
  var phase = PHASE_READY;

  var sequence, round, inputIndex, playbackIndex, playbackSub, playbackTimer, pauseTimer;
  var flashPanel = -1, flashTimer = 0;

  function speedForRound() {
    return Math.max(MIN_SPEED, BASE_SPEED - (round - 1) * SPEED_STEP);
  }

  function beginPlayback() {
    phase = PHASE_PLAYBACK;
    playbackIndex = -1;
    playbackSub = 'off';
    playbackTimer = 0.4;
  }

  function startRound() {
    round += 1;
    sequence.push(Math.floor(Math.random() * 4));
    beginPlayback();
  }

  function startGame() {
    sequence = [];
    round = 0;
    inputIndex = 0;
    startRound();
  }

  function endGame() {
    phase = PHASE_GAMEOVER;
    var finalScore = sequence.length - 1;
    if (finalScore > best) {
      best = finalScore;
      try { localStorage.setItem(STORAGE_KEY, String(best)); } catch (e) { /* ignore */ }
    }
  }

  function panelGeometry() {
    var boardSize = Math.min(viewW(), viewH()) * 0.7;
    var gap = boardSize * 0.05;
    var cell = (boardSize - gap) / 2;
    var boardX = (viewW() - boardSize) / 2;
    var boardY = viewH() / 2 - boardSize / 2 + 20;
    return { boardSize: boardSize, gap: gap, cell: cell, boardX: boardX, boardY: boardY };
  }

  function panelAt(clientX, clientY) {
    var geo = panelGeometry();
    for (var r = 0; r < 2; r++) {
      for (var c = 0; c < 2; c++) {
        var x = geo.boardX + c * (geo.cell + geo.gap);
        var y = geo.boardY + r * (geo.cell + geo.gap);
        if (clientX >= x && clientX <= x + geo.cell && clientY >= y && clientY <= y + geo.cell) {
          return r * 2 + c;
        }
      }
    }
    return -1;
  }

  function onPanelTap(idx) {
    if (idx < 0) return;
    flashPanel = idx;
    flashTimer = 0.15;
    if (idx === sequence[inputIndex]) {
      inputIndex++;
      if (inputIndex === sequence.length) {
        phase = PHASE_PAUSE;
        pauseTimer = 0.5;
      }
    } else {
      endGame();
    }
  }

  function onTap(clientX, clientY) {
    if (phase === PHASE_READY || phase === PHASE_GAMEOVER) {
      startGame();
      return;
    }
    if (phase === PHASE_INPUT) {
      onPanelTap(panelAt(clientX, clientY));
    }
  }

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      if (phase === PHASE_READY || phase === PHASE_GAMEOVER) { e.preventDefault(); startGame(); }
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
    if (flashTimer > 0) flashTimer -= dt;

    if (phase === PHASE_PLAYBACK) {
      playbackTimer -= dt;
      if (playbackTimer <= 0) {
        var speed = speedForRound();
        if (playbackSub === 'off') {
          playbackIndex++;
          if (playbackIndex >= sequence.length) {
            phase = PHASE_INPUT;
            inputIndex = 0;
          } else {
            playbackSub = 'on';
            playbackTimer = speed * 0.6 / 1000;
          }
        } else {
          playbackSub = 'off';
          playbackTimer = speed * 0.4 / 1000;
        }
      }
    } else if (phase === PHASE_PAUSE) {
      pauseTimer -= dt;
      if (pauseTimer <= 0) startRound();
    }
  }

  function drawPanels() {
    var geo = panelGeometry();
    var highlighted = -1;
    if (phase === PHASE_PLAYBACK && playbackSub === 'on' && playbackIndex >= 0 && playbackIndex < sequence.length) {
      highlighted = sequence[playbackIndex];
    }
    for (var r = 0; r < 2; r++) {
      for (var c = 0; c < 2; c++) {
        var idx = r * 2 + c;
        var x = geo.boardX + c * (geo.cell + geo.gap);
        var y = geo.boardY + r * (geo.cell + geo.gap);
        var lit = idx === highlighted || (idx === flashPanel && flashTimer > 0);
        ctx.fillStyle = lit ? COLORS[idx] : COLORS_DIM[idx];
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, geo.cell, geo.cell, 12) : ctx.rect(x, y, geo.cell, geo.cell);
        ctx.fill();
      }
    }
  }

  function drawHud() {
    var geo = panelGeometry();
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(STRINGS.round + ' ' + Math.max(round, 0), viewW() / 2, geo.boardY - 24);
  }

  function drawCenterOverlay(lines) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
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
    ctx.fillStyle = '#1e1b2e';
    ctx.fillRect(0, 0, viewW(), viewH());

    if (phase === PHASE_READY) {
      drawPanels();
      drawCenterOverlay([
        { text: STRINGS.title, size: 26 },
        { text: STRINGS.tapToStart, size: 15 },
        { text: STRINGS.hint, size: 12, color: '#94a3b8' }
      ]);
      return;
    }

    drawPanels();
    drawHud();

    if (phase === PHASE_GAMEOVER) {
      var finalScore = sequence.length - 1;
      var bestLine;
      if (finalScore >= best) {
        bestLine = { text: STRINGS.newBest, size: 20, color: '#eab308' };
      } else {
        bestLine = { text: STRINGS.almost({ best: best, gap: best - finalScore }), size: 16 };
      }
      drawCenterOverlay([
        { text: STRINGS.gameOver, size: 24 },
        { text: STRINGS.round + ' ' + finalScore, size: 18 },
        bestLine,
        { text: STRINGS.tapToRetry, size: 13, color: '#94a3b8' }
      ]);
    }
  }

  var lastTime = null;
  function loop(t) {
    if (lastTime === null) lastTime = t;
    var dt = Math.min((t - lastTime) / 1000, 0.05);
    lastTime = t;
    if (phase === PHASE_PLAYBACK || phase === PHASE_PAUSE || phase === PHASE_INPUT) update(dt);
    else if (flashTimer > 0) update(dt);
    draw();
    window.requestAnimationFrame(loop);
  }
  window.requestAnimationFrame(loop);
})();
