(function () {
  'use strict';

  var STRINGS = {
    title: 'FLAP',
    tapToStart: 'Tap or press Space to fly',
    hint: 'Squeeze close to the edges for a near-miss bonus.',
    score: 'SCORE',
    best: 'BEST',
    gameOver: 'GAME OVER',
    newBest: 'NEW BEST!',
    almost: function (diff) { return 'BEST ' + diff.best + ' (' + diff.gap + ' more!)'; },
    tapToRetry: 'Tap or press Space to retry',
    nearMiss: 'NEAR MISS! +1'
  };

  var STORAGE_KEY = 'snackplay_flap_best_v1';
  var GRAVITY = 900;
  var FLAP_VY = -320;
  var PIPE_SPEED = 180;
  var PIPE_INTERVAL = 280;
  var GAP_HEIGHT = 170;
  var PIPE_WIDTH = 60;
  var BIRD_R = 14;
  var NEAR_MISS_PX = 20;

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

  var bird, pipes, score, lastTime, flashText, flashTimer;

  function reset() {
    bird = { x: 0, y: 0, vy: 0 };
    bird.x = viewW() * 0.3;
    bird.y = viewH() / 2;
    pipes = [];
    score = 0;
    lastTime = null;
    flashText = '';
    flashTimer = 0;
    spawnPipe(viewW() + 100);
  }
  reset();

  function spawnPipe(x) {
    var margin = 60;
    var gapY = margin + Math.random() * (viewH() - margin * 2 - GAP_HEIGHT) + GAP_HEIGHT / 2;
    pipes.push({ x: x, gapY: gapY, passed: false, bonusChecked: false });
  }

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

  function onAction() {
    if (state !== STATE_PLAYING) { startGame(); return; }
    bird.vy = FLAP_VY;
  }
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); onAction(); }
  });
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); onAction(); }, { passive: false });
  canvas.addEventListener('mousedown', onAction);

  function update(dt) {
    bird.vy += GRAVITY * dt;
    bird.y += bird.vy * dt;

    if (bird.y - BIRD_R < 0 || bird.y + BIRD_R > viewH()) {
      endGame();
      return;
    }

    for (var i = 0; i < pipes.length; i++) pipes[i].x -= PIPE_SPEED * dt;

    if (pipes.length === 0 || pipes[pipes.length - 1].x < viewW() - PIPE_INTERVAL) {
      spawnPipe(viewW() + PIPE_WIDTH);
    }
    pipes = pipes.filter(function (p) { return p.x > -PIPE_WIDTH; });

    for (var j = 0; j < pipes.length; j++) {
      var p = pipes[j];
      var topEdge = p.gapY - GAP_HEIGHT / 2;
      var botEdge = p.gapY + GAP_HEIGHT / 2;

      var overlapsX = bird.x + BIRD_R > p.x && bird.x - BIRD_R < p.x + PIPE_WIDTH;
      if (overlapsX) {
        if (bird.y - BIRD_R < topEdge || bird.y + BIRD_R > botEdge) {
          endGame();
          return;
        }
        if (!p.bonusChecked) {
          var distToEdge = Math.min(Math.abs(bird.y - BIRD_R - topEdge), Math.abs(botEdge - (bird.y + BIRD_R)));
          if (distToEdge <= NEAR_MISS_PX) {
            score += 1;
            flashText = STRINGS.nearMiss;
            flashTimer = 1.0;
          }
          p.bonusChecked = true;
        }
      }

      if (!p.passed && p.x + PIPE_WIDTH < bird.x - BIRD_R) {
        p.passed = true;
        score += 1;
      }
    }

    if (flashTimer > 0) flashTimer -= dt;
  }

  function drawBird() {
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, BIRD_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawPipes() {
    ctx.fillStyle = '#3fae55';
    for (var i = 0; i < pipes.length; i++) {
      var p = pipes[i];
      var topEdge = p.gapY - GAP_HEIGHT / 2;
      var botEdge = p.gapY + GAP_HEIGHT / 2;
      ctx.fillRect(p.x, 0, PIPE_WIDTH, topEdge);
      ctx.fillRect(p.x, botEdge, PIPE_WIDTH, viewH() - botEdge);
    }
  }

  function drawHud() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.floor(score)), viewW() / 2, 60);

    if (flashTimer > 0) {
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.fillText(flashText, viewW() / 2, 90);
    }
  }

  function drawCenterText(lines) {
    ctx.textAlign = 'center';
    var startY = viewH() / 2 - (lines.length - 1) * 16;
    for (var i = 0; i < lines.length; i++) {
      ctx.font = lines[i].size + 'px system-ui, sans-serif';
      ctx.fillStyle = lines[i].color || '#ffffff';
      ctx.fillText(lines[i].text, viewW() / 2, startY + i * 32);
    }
  }

  function draw() {
    ctx.fillStyle = '#4ec0ca';
    ctx.fillRect(0, 0, viewW(), viewH());

    if (state === STATE_READY) {
      drawCenterText([
        { text: STRINGS.title, size: 30 },
        { text: STRINGS.tapToStart, size: 15 },
        { text: STRINGS.hint, size: 12, color: 'rgba(255,255,255,0.8)' }
      ]);
      return;
    }

    drawPipes();
    drawBird();
    drawHud();

    if (state === STATE_GAMEOVER) {
      var finalScore = Math.floor(score);
      var bestLine;
      if (finalScore >= best) {
        bestLine = { text: STRINGS.newBest, size: 20, color: '#fef08a' };
      } else {
        bestLine = { text: STRINGS.almost({ best: best, gap: best - finalScore }), size: 16 };
      }
      drawCenterText([
        { text: STRINGS.gameOver, size: 28 },
        { text: STRINGS.score + ' ' + finalScore, size: 18 },
        bestLine,
        { text: STRINGS.tapToRetry, size: 14, color: 'rgba(255,255,255,0.8)' }
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
