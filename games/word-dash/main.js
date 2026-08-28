(function () {
  'use strict';

  var STORAGE_KEY = 'snackplay_worddash_best_v1';
  var GAME_LENGTH = 30;
  var LEVEL_UP_STREAK = 3;

  var WORDS = [
    ['cat', 'dog', 'sun', 'run', 'big', 'red', 'top', 'cup', 'fox', 'box', 'hat', 'pen', 'key', 'jam', 'owl', 'bee', 'ice', 'egg', 'fan', 'gum'],
    ['apple', 'table', 'mouse', 'happy', 'plant', 'chair', 'light', 'water', 'music', 'tiger', 'cloud', 'bread', 'smile', 'dance', 'green', 'brave', 'quiet', 'sweet', 'quick', 'laugh'],
    ['elephant', 'computer', 'mountain', 'sandwich', 'universe', 'building', 'chocolate', 'dinosaur', 'umbrella', 'adventure', 'butterfly', 'telephone', 'wonderful', 'beautiful', 'dangerous', 'calendar', 'keyboard', 'breakfast', 'celebrate', 'discovery']
  ];

  var wordEl = document.getElementById('word');
  var typedEl = document.getElementById('typed');
  var scoreEl = document.getElementById('score');
  var timerEl = document.getElementById('timer');
  var bestEl = document.getElementById('best');
  var overlayEl = document.getElementById('overlay');
  var overlayTitleEl = document.getElementById('overlayTitle');
  var overlayMsgEl = document.getElementById('overlayMsg');
  var startBtn = document.getElementById('startBtn');

  var best = 0;
  try { best = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0; } catch (e) { /* ignore */ }
  bestEl.textContent = 'BEST ' + best;

  var STATE_READY = 'ready', STATE_PLAYING = 'playing', STATE_GAMEOVER = 'gameover';
  var state = STATE_READY;

  var wordsCompleted, streak, tierIndex, currentWord, timeLeft, intervalId;

  function pickWord() {
    var pool = WORDS[tierIndex];
    var w;
    do {
      w = pool[Math.floor(Math.random() * pool.length)];
    } while (w === currentWord && pool.length > 1);
    return w;
  }

  function reset() {
    wordsCompleted = 0;
    streak = 0;
    tierIndex = 0;
    currentWord = '';
    currentWord = pickWord();
    timeLeft = GAME_LENGTH;
    wordEl.textContent = currentWord;
    typedEl.value = '';
    typedEl.classList.remove('mismatch', 'correct');
    scoreEl.textContent = 'WORDS 0';
    timerEl.textContent = timeLeft + 's';
  }
  reset();

  function endGame() {
    state = STATE_GAMEOVER;
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    typedEl.blur();
    if (wordsCompleted > best) {
      best = wordsCompleted;
      try { localStorage.setItem(STORAGE_KEY, String(best)); } catch (e) { /* ignore */ }
    }
    overlayTitleEl.textContent = 'TIME UP';
    overlayMsgEl.textContent = wordsCompleted + ' words. Best: ' + best + '.';
    startBtn.textContent = 'Tap to try again';
    overlayEl.classList.remove('hidden');
    bestEl.textContent = 'BEST ' + best;
  }

  function startGame() {
    reset();
    state = STATE_PLAYING;
    overlayEl.classList.add('hidden');
    typedEl.focus();
    intervalId = setInterval(function () {
      timeLeft -= 1;
      timerEl.textContent = Math.max(0, timeLeft) + 's';
      if (timeLeft <= 0) endGame();
    }, 1000);
  }

  startBtn.addEventListener('click', function () {
    startGame();
  });

  typedEl.addEventListener('input', function () {
    if (state !== STATE_PLAYING) return;
    var raw = typedEl.value.toLowerCase().replace(/[^a-z]/g, '');
    if (typedEl.value !== raw) typedEl.value = raw;
    if (raw === currentWord) {
      wordsCompleted += 1;
      streak += 1;
      scoreEl.textContent = 'WORDS ' + wordsCompleted;
      if (streak % LEVEL_UP_STREAK === 0 && tierIndex < WORDS.length - 1) {
        tierIndex += 1;
      }
      currentWord = pickWord();
      wordEl.textContent = currentWord;
      typedEl.value = '';
      typedEl.classList.remove('mismatch');
      typedEl.classList.add('correct');
      setTimeout(function () { typedEl.classList.remove('correct'); }, 150);
    } else if (currentWord.indexOf(raw) !== 0) {
      typedEl.classList.add('mismatch');
    } else {
      typedEl.classList.remove('mismatch');
    }
  });

  // Enterキーでの誤送信防止(フォームがないので基本不要だが念のため)
  typedEl.addEventListener('keydown', function (e) {
    if (e.code === 'Enter') e.preventDefault();
  });
})();
