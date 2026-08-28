(function () {
  'use strict';

  var STRINGS = {
    title: 'PANCAKE TOWER',
    tapToStart: 'TAP or SPACE to start',
    controlsHint: 'Tap when aligned. Stack as high as you can.',
    score: 'SCORE',
    best: 'BEST',
    combo: 'COMBO',
    gameOver: 'GAME OVER',
    newBest: 'NEW BEST!',
    almost: function (diff) { return 'BEST ' + diff.best + ' (' + diff.gap + ' more!)'; },
    tapToRetry: 'TAP or SPACE to retry'
  };

  var STORAGE_KEY = 'snackplay_stack_best_v1';
  var BLOCK_H = 34;
  var VISIBLE_BLOCKS = 6;
  var PERFECT_PX = 4;
  var MIN_WIDTH = 20;

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

  var blocks, moving, score, combo, debris, lastTime;

  function baseWidth() {
    return Math.min(220, viewW() * 0.6);
  }

  function spawnMoving(w) {
    var fromLeft = blocks.length % 2 === 0;
    var speed = Math.min(300, 120 * Math.pow(1.08, Math.floor(blocks.length / 10)));
    moving = {
      x: fromLeft ? 0 : viewW() - w,
      w: w,
      dir: fromLeft ? 1 : -1,
      speed: speed
    };
  }

  function reset() {
    var w = baseWidth();
    blocks = [{ x: (viewW() - w) / 2, w: w, y: 0 }];
    score = 0;
    combo = 0;
    debris = [];
    spawnMoving(w);
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

  function placeBlock() {
    var top = blocks[blocks.length - 1];
    var overlapLeft = Math.max(moving.x, top.x);
    var overlapRight = Math.min(moving.x + moving.w, top.x + top.w);
    var overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) {
      // 落下エフェクト用に丸ごとdebris化
      debris.push({ x: moving.x, w: moving.w, y: blocks.length * BLOCK_H, vy: 0, alpha: 1 });
      endGame();
      return;
    }

    var diff = Math.abs(moving.x - top.x);
    var isPerfect = diff <= PERFECT_PX;
    var newX = isPerfect ? top.x : overlapLeft;
    var newW = isPerfect ? top.w : overlapWidth;

    // はみ出た部分をdebrisとして落とす(見た目のみ)
    if (!isPerfect) {
      if (moving.x < newX) {
        debris.push({ x: moving.x, w: newX - moving.x, y: blocks.length * BLOCK_H, vy: 0, alpha: 1 });
      }
      var movingRight = moving.x + moving.w;
      var newRight = newX + newW;
      if (movingRight > newRight) {
        debris.push({ x: newRight, w: movingRight - newRight, y: blocks.length * BLOCK_H, vy: 0, alpha: 1 });
      }
    }

    blocks.push({ x: newX, w: newW, y: blocks.length * BLOCK_H });

    if (isPerfect) {
      combo += 1;
    } else {
      combo = 0;
    }
    var mult = Math.min(3.0, 1 + combo * 0.5);
    score += 10 * mult;

    if (newW < MIN_WIDTH) {
      endGame();
      return;
    }
    spawnMoving(newW);
  }

  function onAction() {
    if (state !== STATE_PLAYING) {
      startGame();
      return;
    }
    placeBlock();
  }

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      onAction();
    }
  });
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); onAction(); }, { passive: false });
  canvas.addEventListener('mousedown', onAction);

  function cameraOffset() {
    return Math.max(0, (blocks.length - VISIBLE_BLOCKS) * BLOCK_H);
  }
  function screenBottomY(worldY) {
    return viewH() - 40 - (worldY - cameraOffset());
  }

  function update(dt) {
    // 往復移動
    moving.x += moving.dir * moving.speed * dt;
    if (moving.x <= 0) { moving.x = 0; moving.dir = 1; }
    if (moving.x + moving.w >= viewW()) { moving.x = viewW() - moving.w; moving.dir = -1; }

    // debris演出
    for (var i = 0; i < debris.length; i++) {
      debris[i].vy += 900 * dt;
      debris[i].y -= debris[i].vy * dt;
      debris[i].alpha -= dt * 1.2;
    }
    debris = debris.filter(function (d) { return d.alpha > 0; });
  }

  function drawBackground() {
    var t = Math.min(1, blocks.length / 20);
    var top1 = [135, 206, 250], bot1 = [255, 236, 179]; // 朝
    var top2 = [253, 224, 71], bot2 = [251, 191, 36];   // 昼
    var top3 = [76, 29, 149], bot3 = [251, 146, 60];    // 夕焼け

    var topColor, botColor;
    if (blocks.length <= 10) {
      var t1 = blocks.length / 10;
      topColor = lerpColor(top1, top2, t1);
      botColor = lerpColor(bot1, bot2, t1);
    } else {
      var t2 = Math.min(1, (blocks.length - 10) / 10);
      topColor = lerpColor(top2, top3, t2);
      botColor = lerpColor(bot2, bot3, t2);
    }
    var grad = ctx.createLinearGradient(0, 0, 0, viewH());
    grad.addColorStop(0, 'rgb(' + topColor.join(',') + ')');
    grad.addColorStop(1, 'rgb(' + botColor.join(',') + ')');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW(), viewH());
  }

  function lerpColor(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  function drawBlocks() {
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var y = screenBottomY(b.y);
      if (y < -BLOCK_H || y > viewH() + BLOCK_H) continue;
      ctx.fillStyle = i % 2 === 0 ? '#f4a460' : '#e08e45';
      ctx.fillRect(b.x, y - BLOCK_H, b.w, BLOCK_H);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.strokeRect(b.x, y - BLOCK_H, b.w, BLOCK_H);
    }
  }

  function drawMoving() {
    if (state !== STATE_PLAYING) return;
    var y = screenBottomY(blocks.length * BLOCK_H);
    ctx.fillStyle = '#fff3d6';
    ctx.fillRect(moving.x, y - BLOCK_H, moving.w, BLOCK_H);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.strokeRect(moving.x, y - BLOCK_H, moving.w, BLOCK_H);
  }

  function drawDebris() {
    for (var i = 0; i < debris.length; i++) {
      var d = debris[i];
      var y = screenBottomY(d.y);
      ctx.globalAlpha = Math.max(0, d.alpha);
      ctx.fillStyle = '#f4a460';
      ctx.fillRect(d.x, y - BLOCK_H, d.w, BLOCK_H);
      ctx.globalAlpha = 1;
    }
  }

  function drawHud() {
    ctx.fillStyle = '#1a1033';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(STRINGS.score + ' ' + Math.floor(score), 16, 36);
    ctx.textAlign = 'right';
    ctx.fillText(STRINGS.best + ' ' + best, viewW() - 16, 36);
    if (combo > 1) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(STRINGS.combo + ' x' + combo, viewW() / 2, 36);
    }
  }

  function drawCenterText(lines) {
    ctx.textAlign = 'center';
    var startY = viewH() / 2 - (lines.length - 1) * 16;
    for (var i = 0; i < lines.length; i++) {
      ctx.font = lines[i].size + 'px system-ui, sans-serif';
      ctx.fillStyle = lines[i].color || '#1a1033';
      ctx.fillText(lines[i].text, viewW() / 2, startY + i * 32);
    }
  }

  function draw() {
    drawBackground();

    if (state === STATE_READY) {
      drawCenterText([
        { text: STRINGS.title, size: 30 },
        { text: STRINGS.tapToStart, size: 16 },
        { text: STRINGS.controlsHint, size: 13, color: 'rgba(26,16,51,0.7)' }
      ]);
      return;
    }

    drawBlocks();
    drawDebris();
    drawMoving();
    drawHud();

    if (state === STATE_GAMEOVER) {
      var finalScore = Math.floor(score);
      var bestLine;
      if (finalScore >= best) {
        bestLine = { text: STRINGS.newBest, size: 20, color: '#b45309' };
      } else {
        bestLine = { text: STRINGS.almost({ best: best, gap: best - finalScore }), size: 16, color: 'rgba(26,16,51,0.7)' };
      }
      drawCenterText([
        { text: STRINGS.gameOver, size: 28 },
        { text: STRINGS.score + ' ' + finalScore, size: 18 },
        bestLine,
        { text: STRINGS.tapToRetry, size: 14, color: 'rgba(26,16,51,0.7)' }
      ]);
    }
  }

  function loop(t) {
    if (lastTime === null) lastTime = t;
    var dt = Math.min((t - lastTime) / 1000, 0.05);
    lastTime = t;
    if (state === STATE_PLAYING) update(dt);
    else if (debris.length) update(dt);
    draw();
    window.requestAnimationFrame(loop);
  }
  window.requestAnimationFrame(loop);
})();
