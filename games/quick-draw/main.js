(function () {
  'use strict';

  var STRINGS = {
    title: 'QUICK DRAW',
    tapToStart: 'Tap to test your reaction time',
    hint: '3 rounds. Wait for green, then tap as fast as you can.',
    wait: 'WAIT...',
    go: 'TAP!',
    tooSoon: 'TOO SOON!',
    tooSoonHint: 'Tap to try this round again',
    roundResult: function (ms) { return ms + ' ms'; },
    nextRound: 'Tap for the next round',
    finalTitle: 'YOUR AVERAGE',
    bestLabel: 'BEST AVG',
    tapToRestart: 'Tap to test again',
    fact: 'The average human reaction time is about 250ms.'
  };

  var STORAGE_KEY = 'snackplay_quickdraw_best_v1';
  var ROUNDS = 3;

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

  var bestAvg = null;
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) bestAvg = parseInt(raw, 10);
  } catch (e) { /* ignore */ }

  var PHASE_TITLE = 'title', PHASE_WAITING = 'waiting', PHASE_GO = 'go',
      PHASE_TOO_SOON = 'toosoon', PHASE_RESULT = 'result', PHASE_FINAL = 'final';
  var phase = PHASE_TITLE;

  var currentRound = 0;
  var times = [];
  var goStartTime = 0;
  var token = 0;
  var lastRoundMs = 0;
  var finalAvg = 0;

  function beginWaiting() {
    phase = PHASE_WAITING;
    token++;
    var myToken = token;
    var delay = 1000 + Math.random() * 2000;
    setTimeout(function () {
      if (myToken !== token) return;
      phase = PHASE_GO;
      goStartTime = performance.now();
    }, delay);
  }

  function startTest() {
    currentRound = 1;
    times = [];
    beginWaiting();
  }

  function finalizeTest() {
    var sum = times.reduce(function (a, b) { return a + b; }, 0);
    finalAvg = Math.round(sum / times.length);
    if (bestAvg === null || finalAvg < bestAvg) {
      bestAvg = finalAvg;
      try { localStorage.setItem(STORAGE_KEY, String(bestAvg)); } catch (e) { /* ignore */ }
    }
  }

  function onAction() {
    if (phase === PHASE_TITLE || phase === PHASE_FINAL) {
      startTest();
      return;
    }
    if (phase === PHASE_WAITING) {
      token++;
      phase = PHASE_TOO_SOON;
      return;
    }
    if (phase === PHASE_TOO_SOON) {
      beginWaiting();
      return;
    }
    if (phase === PHASE_GO) {
      lastRoundMs = Math.round(performance.now() - goStartTime);
      times.push(lastRoundMs);
      phase = PHASE_RESULT;
      return;
    }
    if (phase === PHASE_RESULT) {
      if (currentRound < ROUNDS) {
        currentRound++;
        beginWaiting();
      } else {
        phase = PHASE_FINAL;
        finalizeTest();
      }
      return;
    }
  }

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); onAction(); }
  });
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); onAction(); }, { passive: false });
  canvas.addEventListener('mousedown', onAction);

  function ratingFor(ms) {
    if (ms < 250) return 'Elite reflexes';
    if (ms < 350) return 'Above average';
    return 'Average';
  }

  function bgColor() {
    if (phase === PHASE_WAITING) return '#7f1d1d';
    if (phase === PHASE_GO) return '#166534';
    if (phase === PHASE_TOO_SOON) return '#7c2d12';
    return '#111111';
  }

  function drawCenterText(lines) {
    ctx.textAlign = 'center';
    var startY = viewH() / 2 - (lines.length - 1) * 16;
    for (var i = 0; i < lines.length; i++) {
      ctx.font = lines[i].size + 'px system-ui, sans-serif';
      ctx.fillStyle = lines[i].color || '#f8fafc';
      ctx.fillText(lines[i].text, viewW() / 2, startY + i * 34);
    }
  }

  function draw() {
    ctx.fillStyle = bgColor();
    ctx.fillRect(0, 0, viewW(), viewH());

    if (phase === PHASE_TITLE) {
      drawCenterText([
        { text: STRINGS.title, size: 30 },
        { text: STRINGS.tapToStart, size: 15 },
        { text: STRINGS.hint, size: 12, color: '#94a3b8' }
      ]);
    } else if (phase === PHASE_WAITING) {
      drawCenterText([
        { text: 'Round ' + currentRound + '/' + ROUNDS, size: 14, color: '#fca5a5' },
        { text: STRINGS.wait, size: 32 }
      ]);
    } else if (phase === PHASE_GO) {
      drawCenterText([{ text: STRINGS.go, size: 40 }]);
    } else if (phase === PHASE_TOO_SOON) {
      drawCenterText([
        { text: STRINGS.tooSoon, size: 28 },
        { text: STRINGS.tooSoonHint, size: 14, color: '#fdba74' }
      ]);
    } else if (phase === PHASE_RESULT) {
      var lines = [
        { text: 'Round ' + currentRound + '/' + ROUNDS, size: 14, color: '#94a3b8' },
        { text: STRINGS.roundResult(lastRoundMs), size: 34 }
      ];
      lines.push({ text: currentRound < ROUNDS ? STRINGS.nextRound : 'Tap to see your average', size: 14, color: '#94a3b8' });
      drawCenterText(lines);
    } else if (phase === PHASE_FINAL) {
      var finalLines = [
        { text: STRINGS.finalTitle, size: 16, color: '#94a3b8' },
        { text: finalAvg + ' ms', size: 36 },
        { text: ratingFor(finalAvg), size: 16, color: '#fef08a' },
        { text: STRINGS.bestLabel + ' ' + bestAvg + ' ms', size: 14, color: '#94a3b8' },
        { text: STRINGS.fact, size: 12, color: '#64748b' },
        { text: STRINGS.tapToRestart, size: 13, color: '#94a3b8' }
      ];
      drawCenterText(finalLines);
    }
  }

  function loop() {
    draw();
    window.requestAnimationFrame(loop);
  }
  window.requestAnimationFrame(loop);
})();
