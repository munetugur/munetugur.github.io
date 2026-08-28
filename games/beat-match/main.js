(function () {
  'use strict';

  var STRINGS = {
    title: 'BEAT MATCH',
    tapToStart: 'Tap in rhythm to start',
    hint: 'Tap when the note hits the line. 3 misses and it\'s over.',
    score: 'SCORE',
    best: 'BEST',
    misses: 'MISS',
    gameOver: 'OFF BEAT',
    newBest: 'NEW BEST!',
    almost: function (diff) { return 'BEST ' + diff.best + ' (' + diff.gap + ' more!)'; },
    tapToRetry: 'Tap to try again'
  };

  var STORAGE_KEY = 'snackplay_beatmatch_best_v1';
  var FALL_DURATION = 1200; // ms
  var INITIAL_INTERVAL = 600; // ms, ~100 BPM
  var MIN_INTERVAL = 260;
  var TEMPO_STEP_EVERY = 10; // notes
  var TEMPO_STEP_FACTOR = 0.95;
  var PERFECT_MS = 80, GOOD_MS = 150, MISS_MS = 220;
  var MAX_MISSES = 3;

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
  function hitZoneY() { return viewH() * 0.75; }
  function spawnY() { return viewH() * 0.05; }

  var best = 0;
  try { best = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0; } catch (e) { /* ignore */ }

  var STATE_READY = 'ready', STATE_PLAYING = 'playing', STATE_GAMEOVER = 'gameover';
  var state = STATE_READY;

  var notes, score, combo, misses, notesHit, spawnInterval, spawnTimer, judgeFlash, judgeFlashTimer;

  function reset() {
    notes = [];
    score = 0;
    combo = 0;
    misses = 0;
    notesHit = 0;
    spawnInterval = INITIAL_INTERVAL;
    spawnTimer = 0;
    judgeFlash = '';
    judgeFlashTimer = 0;
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

  function spawnNote(now) {
    notes.push({ spawnTime: now, hitTime: now + FALL_DURATION, judged: false });
  }

  function flash(text) {
    judgeFlash = text;
    judgeFlashTimer = 0.4;
  }

  function onTap() {
    if (state !== STATE_PLAYING) { startGame(); return; }
    var now = performance.now();
    var best_i = -1, bestDiff = Infinity;
    for (var i = 0; i < notes.length; i++) {
      if (notes[i].judged) continue;
      var diff = Math.abs(now - notes[i].hitTime);
      if (diff < bestDiff) { bestDiff = diff; best_i = i; }
    }
    if (best_i === -1 || bestDiff > MISS_MS) return; // no note in range, ignore tap

    var note = notes[best_i];
    note.judged = true;
    notesHit += 1;
    if (bestDiff <= PERFECT_MS) {
      combo += 1;
      var mult = Math.min(3, 1 + combo * 0.1);
      score += 20 * mult;
      flash('PERFECT');
    } else if (bestDiff <= GOOD_MS) {
      combo += 1;
      var mult2 = Math.min(3, 1 + combo * 0.1);
      score += 10 * mult2;
      flash('GOOD');
    } else {
      combo = 0;
      misses += 1;
      flash('MISS');
      if (misses >= MAX_MISSES) endGame();
    }

    if (notesHit % TEMPO_STEP_EVERY === 0) {
      spawnInterval = Math.max(MIN_INTERVAL, spawnInterval * TEMPO_STEP_FACTOR);
    }
  }

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); onTap(); }
  });
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); onTap(); }, { passive: false });
  canvas.addEventListener('mousedown', onTap);

  function update(dtMs, now) {
    spawnTimer -= dtMs;
    if (spawnTimer <= 0) {
      spawnNote(now);
      spawnTimer = spawnInterval;
    }

    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (!n.judged && now - n.hitTime > MISS_MS) {
        n.judged = true;
        combo = 0;
        misses += 1;
        flash('MISS');
        if (misses >= MAX_MISSES) { endGame(); return; }
      }
    }
    notes = notes.filter(function (n) { return now - n.hitTime < 2000; });

    if (judgeFlashTimer > 0) judgeFlashTimer -= dtMs / 1000;
  }

  function noteY(note, now) {
    var frac = (now - note.spawnTime) / FALL_DURATION;
    return spawnY() + frac * (hitZoneY() - spawnY());
  }

  function drawHitZone() {
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, hitZoneY());
    ctx.lineTo(viewW(), hitZoneY());
    ctx.stroke();
  }

  function drawNotes(now) {
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (n.judged && now - n.hitTime > 0) continue;
      var y = noteY(n, now);
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(viewW() / 2, y, 16, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHud() {
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(STRINGS.score + ' ' + Math.floor(score), 16, 36);
    ctx.textAlign = 'right';
    ctx.fillText(STRINGS.best + ' ' + best, viewW() - 16, 36);
    ctx.textAlign = 'center';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(STRINGS.misses + ' ' + misses + '/' + MAX_MISSES, viewW() / 2, 36);

    if (judgeFlashTimer > 0) {
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillStyle = judgeFlash === 'MISS' ? '#f87171' : (judgeFlash === 'PERFECT' ? '#fde68a' : '#a7f3d0');
      ctx.fillText(judgeFlash, viewW() / 2, hitZoneY() - 40);
    }
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

  function draw(now) {
    ctx.fillStyle = '#0b0b1a';
    ctx.fillRect(0, 0, viewW(), viewH());
    drawHitZone();

    if (state === STATE_READY) {
      drawCenterOverlay([
        { text: STRINGS.title, size: 28 },
        { text: STRINGS.tapToStart, size: 15 },
        { text: STRINGS.hint, size: 12, color: '#94a3b8' }
      ]);
      return;
    }

    drawNotes(now);
    drawHud();

    if (state === STATE_GAMEOVER) {
      var finalScore = Math.floor(score);
      var bestLine;
      if (finalScore >= best) {
        bestLine = { text: STRINGS.newBest, size: 20, color: '#fde68a' };
      } else {
        bestLine = { text: STRINGS.almost({ best: best, gap: best - finalScore }), size: 16 };
      }
      drawCenterOverlay([
        { text: STRINGS.gameOver, size: 26 },
        { text: STRINGS.score + ' ' + finalScore, size: 18 },
        bestLine,
        { text: STRINGS.tapToRetry, size: 13, color: '#94a3b8' }
      ]);
    }
  }

  var lastTime = null;
  function loop(t) {
    if (lastTime === null) lastTime = t;
    var dt = Math.min(t - lastTime, 50);
    lastTime = t;
    var now = performance.now();
    if (state === STATE_PLAYING) update(dt, now);
    else if (judgeFlashTimer > 0) judgeFlashTimer -= dt / 1000;
    draw(now);
    window.requestAnimationFrame(loop);
  }
  window.requestAnimationFrame(loop);
})();
