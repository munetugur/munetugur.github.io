(function () {
  'use strict';

  // 画面内テキストはこのオブジェクトに集約(将来の多言語対応を見据えた分離)。
  // 現状は英語のみ。日本語版が必要になったら STRINGS.ja を追加し、
  // navigator.language を見て切り替える形に拡張する。
  var STRINGS = {
    title: 'ASTEROID DASH',
    tapToStart: 'TAP or SPACE to start',
    controlsHint: 'Move: drag / arrow keys',
    score: 'SCORE',
    best: 'BEST',
    gameOver: 'GAME OVER',
    newBest: 'NEW BEST!',
    almost: function (diff) { return 'BEST ' + diff.best + ' (' + diff.gap + ' more!)'; },
    tapToRetry: 'TAP or SPACE to retry'
  };

  var STORAGE_KEY = 'snackplay_asteroid_best_v1';

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
  } catch (e) { /* storage unavailable (e.g. private mode): fall back to 0 */ }

  var STATE_READY = 'ready';
  var STATE_PLAYING = 'playing';
  var STATE_GAMEOVER = 'gameover';
  var state = STATE_READY;

  var ship, bullets, asteroids, score, elapsed, spawnTimer, fireTimer, lastTime;
  var stars = [];

  function initStars() {
    stars = [];
    var n = 60;
    for (var i = 0; i < n; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.4 + 0.3,
        speed: 20 + Math.random() * 40
      });
    }
  }
  initStars();

  function reset() {
    ship = {
      x: viewW() / 2,
      y: viewH() - 70,
      w: 26,
      h: 30,
      speed: 340
    };
    bullets = [];
    asteroids = [];
    score = 0;
    elapsed = 0;
    spawnTimer = 0;
    fireTimer = 0;
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
      try { localStorage.setItem(STORAGE_KEY, String(best)); } catch (e) { /* storage unavailable: ignore */ }
    }
  }

  // --- 入力 ---
  var keys = {};
  window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (state !== STATE_PLAYING && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      startGame();
    }
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });

  var touchDir = 0;
  var touchActive = false;

  function onPointerDown(clientX) {
    if (state !== STATE_PLAYING) {
      startGame();
      return;
    }
    touchActive = true;
    touchDir = clientX < viewW() / 2 ? -1 : 1;
  }
  function onPointerMove(clientX) {
    if (!touchActive || state !== STATE_PLAYING) return;
    touchDir = clientX < viewW() / 2 ? -1 : 1;
  }
  function onPointerUp() {
    touchActive = false;
    touchDir = 0;
  }

  canvas.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    if (t) onPointerDown(t.clientX);
  }, { passive: true });
  canvas.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (t) onPointerMove(t.clientX);
  }, { passive: true });
  canvas.addEventListener('touchend', onPointerUp, { passive: true });
  canvas.addEventListener('touchcancel', onPointerUp, { passive: true });

  canvas.addEventListener('mousedown', function (e) { onPointerDown(e.clientX); });
  canvas.addEventListener('mousemove', function (e) { onPointerMove(e.clientX); });
  window.addEventListener('mouseup', onPointerUp);

  // --- ゲームロジック ---
  function currentFallSpeedMul() {
    var steps = Math.floor(elapsed / 10);
    return Math.pow(1.05, steps);
  }
  function currentSpawnInterval() {
    var steps = Math.floor(elapsed / 10);
    return Math.max(0.5, 1.2 * Math.pow(0.97, steps));
  }

  function spawnAsteroid() {
    var size = 20 + Math.random() * 26;
    asteroids.push({
      x: Math.random() * (viewW() - size) + size / 2,
      y: -size,
      size: size,
      hp: size > 34 ? 2 : 1,
      speed: 100 * currentFallSpeedMul() * (0.85 + Math.random() * 0.3)
    });
  }

  function update(dt) {
    elapsed += dt;
    score += dt * 10;

    // 移動(慣性なし、ダイレクト操作)
    var dir = touchDir;
    if (keys.ArrowLeft || keys.KeyA) dir = -1;
    if (keys.ArrowRight || keys.KeyD) dir = 1;
    ship.x += dir * ship.speed * dt;
    ship.x = Math.max(ship.w / 2, Math.min(viewW() - ship.w / 2, ship.x));

    // 自動発射(0.3秒間隔)
    fireTimer -= dt;
    if (fireTimer <= 0) {
      bullets.push({ x: ship.x, y: ship.y - ship.h / 2, speed: 480 });
      fireTimer = 0.3;
    }

    // 隕石の出現
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnAsteroid();
      spawnTimer = currentSpawnInterval();
    }

    // 弾の移動
    for (var i = 0; i < bullets.length; i++) bullets[i].y -= bullets[i].speed * dt;
    bullets = bullets.filter(function (b) { return b.y > -20; });

    // 隕石の移動
    for (var j = 0; j < asteroids.length; j++) asteroids[j].y += asteroids[j].speed * dt;

    // 当たり判定: 弾 vs 隕石
    for (var a = 0; a < asteroids.length; a++) {
      var ast = asteroids[a];
      for (var b2 = 0; b2 < bullets.length; b2++) {
        var bullet = bullets[b2];
        if (bullet.hit) continue;
        var dx = ast.x - bullet.x, dy = ast.y - bullet.y;
        if (Math.sqrt(dx * dx + dy * dy) < ast.size / 2 + 4) {
          bullet.hit = true;
          ast.hp -= 1;
        }
      }
    }
    bullets = bullets.filter(function (b) { return !b.hit; });

    for (var k = 0; k < asteroids.length; k++) {
      if (asteroids[k].hp <= 0 && !asteroids[k].destroyed) {
        asteroids[k].destroyed = true;
        score += 5;
      }
    }
    asteroids = asteroids.filter(function (ast2) {
      return !ast2.destroyed && ast2.y - ast2.size / 2 < viewH();
    });

    // 当たり判定: 自機 vs 隕石(耐久力1、被弾即終了)
    for (var m = 0; m < asteroids.length; m++) {
      var a2 = asteroids[m];
      var ddx = a2.x - ship.x, ddy = a2.y - ship.y;
      if (Math.sqrt(ddx * ddx + ddy * ddy) < a2.size / 2 + ship.w / 2) {
        endGame();
        return;
      }
    }

    // 星の流れ(演出)
    for (var s = 0; s < stars.length; s++) {
      stars[s].y += (stars[s].speed * dt) / viewH();
      if (stars[s].y > 1) { stars[s].y = 0; stars[s].x = Math.random(); }
    }
  }

  // --- 描画 ---
  function drawStars() {
    ctx.fillStyle = '#9fb3d6';
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(st.x * viewW(), st.y * viewH(), st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawShip() {
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.moveTo(ship.x, ship.y - ship.h / 2);
    ctx.lineTo(ship.x - ship.w / 2, ship.y + ship.h / 2);
    ctx.lineTo(ship.x + ship.w / 2, ship.y + ship.h / 2);
    ctx.closePath();
    ctx.fill();
  }

  function drawBullets() {
    ctx.fillStyle = '#fef08a';
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      ctx.fillRect(b.x - 2, b.y - 8, 4, 8);
    }
  }

  function drawAsteroids() {
    ctx.fillStyle = '#94a3b8';
    for (var i = 0; i < asteroids.length; i++) {
      var a = asteroids[i];
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHud() {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(STRINGS.score + ' ' + Math.floor(score), 16, 32);
    ctx.textAlign = 'right';
    ctx.fillText(STRINGS.best + ' ' + best, viewW() - 16, 32);
  }

  function drawCenterText(lines) {
    ctx.textAlign = 'center';
    var startY = viewH() / 2 - (lines.length - 1) * 16;
    for (var i = 0; i < lines.length; i++) {
      ctx.font = lines[i].size + 'px system-ui, sans-serif';
      ctx.fillStyle = lines[i].color || '#e2e8f0';
      ctx.fillText(lines[i].text, viewW() / 2, startY + i * 34);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, viewW(), viewH());
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, viewW(), viewH());
    drawStars();

    if (state === STATE_READY) {
      drawCenterText([
        { text: STRINGS.title, size: 30 },
        { text: STRINGS.tapToStart, size: 16 },
        { text: STRINGS.controlsHint, size: 14, color: '#94a3b8' }
      ]);
      return;
    }

    drawShip();
    drawBullets();
    drawAsteroids();
    drawHud();

    if (state === STATE_GAMEOVER) {
      var finalScore = Math.floor(score);
      var bestLine;
      if (finalScore >= best) {
        bestLine = { text: STRINGS.newBest, size: 20, color: '#fef08a' };
      } else {
        bestLine = { text: STRINGS.almost({ best: best, gap: best - finalScore }), size: 18, color: '#94a3b8' };
      }
      drawCenterText([
        { text: STRINGS.gameOver, size: 30 },
        { text: STRINGS.score + ' ' + finalScore, size: 20 },
        bestLine,
        { text: STRINGS.tapToRetry, size: 15, color: '#94a3b8' }
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
