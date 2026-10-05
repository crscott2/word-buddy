/* Word Buddy — Parrot Spell: hear a word, tap letter tiles to spell it (v2.1) */
(function () {
  "use strict";

  var DISTRACTOR_POOL = "abcdefghijklmnoprstuwy".split("");
  var REWARDS = ["hop", "flip", "cracker", "dance"];
  var NEXT_WORD_MS = 2100;

  var sp = {
    source: "level", /* "level" | "library" */
    levelId: null,
    words: [],
    queue: [],
    index: 0,
    current: null,
    slots: [], /* { ch, fixed, filled } */
    pos: 0,
    tiles: [], /* { id, ch, used, el } */
    slotMisses: 0,
    busy: false,
    done: 0,
    rewardN: 0,
    nextTimer: null,
    levelDone: false
  };

  function $(id) { return document.getElementById(id); }
  function host() { return window.WordBuddy || {}; }
  function call(name, arg) {
    var h = host();
    if (typeof h[name] === "function") return h[name](arg);
    return undefined;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Never play in storage order: reshuffle until order differs (when possible) */
  function randomOrder(words) {
    var q = shuffle(words);
    if (words.length > 1) {
      var guard = 0;
      while (guard++ < 8 && q.join("|") === words.join("|")) q = shuffle(words);
    }
    return q;
  }

  function isLetter(ch) { return /^[a-z]$/.test(ch); }

  function showChar(ch, word) {
    if (word === "i" && ch === "i") return "I";
    return ch;
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) { return false; }
  }

  function clearTimers() {
    if (sp.nextTimer) { clearTimeout(sp.nextTimer); sp.nextTimer = null; }
  }

  function updateProgress() {
    var fill = $("spell-progress-fill");
    var wrap = $("spell-progress");
    if (!fill || !wrap) return;
    var total = sp.queue.length;
    var pct = total ? Math.round((sp.done / total) * 100) : 0;
    fill.style.width = pct + "%";
    wrap.setAttribute("aria-valuenow", String(sp.done));
    wrap.setAttribute("aria-valuemax", String(total));
  }

  function distractorCount(nLetters) {
    return nLetters <= 3 ? 2 : 3;
  }

  function pickDistractors(word, count) {
    var inWord = {};
    for (var i = 0; i < word.length; i++) inWord[word.charAt(i)] = true;
    var pool = DISTRACTOR_POOL.filter(function (c) { return !inWord[c]; });
    return shuffle(pool).slice(0, count);
  }

  function sizeBoard() {
    var slotsBox = $("spell-slots");
    var tilesBox = $("spell-tiles");
    var play = $("spell-play");
    if (!slotsBox || !tilesBox || !play) return;
    var w = play.clientWidth || 600;
    var h = play.clientHeight || 400;
    var n = Math.max(1, sp.slots.length);
    var gap = 8;
    var slot = Math.floor((w - 16 - gap * (n - 1)) / n);
    slot = Math.max(30, Math.min(96, slot, Math.floor(h * 0.3)));
    slotsBox.style.setProperty("--slot", slot + "px");
    var t = Math.max(1, sp.tiles.length);
    var tile = 92;
    /* fit tiles in up to 2 rows (3 for very long custom words) */
    var rows = t > 14 ? 3 : (t > 6 ? 2 : 1);
    var perRow = Math.ceil(t / rows);
    tile = Math.floor((w - 16 - 12 * (perRow - 1)) / perRow);
    var maxByH = Math.floor((h - slot - 60) / rows) - 12;
    tile = Math.max(44, Math.min(96, tile, maxByH > 44 ? maxByH : 44));
    tilesBox.style.setProperty("--tile", tile + "px");
  }

  function renderSlots() {
    var box = $("spell-slots");
    if (!box) return;
    box.innerHTML = "";
    sp.slots.forEach(function (s, i) {
      var el = document.createElement("span");
      el.className = "spell-slot" + (s.fixed ? " is-fixed is-filled" : "");
      el.setAttribute("data-i", String(i));
      if (s.ch === " ") el.className += " is-space";
      el.textContent = s.fixed ? (s.ch === " " ? "" : s.ch) : "";
      s.el = el;
      box.appendChild(el);
    });
    markNextSlot();
  }

  function markNextSlot() {
    sp.slots.forEach(function (s, i) {
      if (s.el) s.el.classList.toggle("is-next", i === sp.pos && !s.filled && !s.fixed);
    });
  }

  function renderTiles() {
    var box = $("spell-tiles");
    if (!box) return;
    box.innerHTML = "";
    sp.tiles.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "spell-tile";
      b.setAttribute("data-ch", t.ch);
      b.setAttribute("data-id", String(t.id));
      b.setAttribute("aria-label", "letter " + t.ch);
      b.textContent = showChar(t.ch, sp.current);
      b.style.setProperty("--tilt", (Math.random() * 6 - 3).toFixed(1) + "deg");
      b.addEventListener("click", function () { onTile(t); });
      t.el = b;
      box.appendChild(b);
    });
  }

  function skipFixed() {
    while (sp.pos < sp.slots.length && sp.slots[sp.pos].fixed) sp.pos++;
  }

  function clearHint() {
    sp.tiles.forEach(function (t) { if (t.el) t.el.classList.remove("hint-glow"); });
  }

  function showHint() {
    var need = sp.slots[sp.pos] && sp.slots[sp.pos].ch;
    if (!need) return;
    clearHint();
    for (var i = 0; i < sp.tiles.length; i++) {
      var t = sp.tiles[i];
      if (!t.used && t.ch === need) {
        if (t.el) t.el.classList.add("hint-glow");
        return;
      }
    }
  }

  function flyTile(tile, slot, done) {
    var from = tile.el && tile.el.getBoundingClientRect();
    var to = slot.el && slot.el.getBoundingClientRect();
    if (!from || !to || prefersReducedMotion() || !from.width) { done(); return; }
    var fly = document.createElement("span");
    fly.className = "spell-fly";
    fly.textContent = tile.el.textContent;
    fly.style.left = from.left + "px";
    fly.style.top = from.top + "px";
    fly.style.width = from.width + "px";
    fly.style.height = from.height + "px";
    fly.style.fontSize = window.getComputedStyle(tile.el).fontSize;
    document.body.appendChild(fly);
    var dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    var dy = (to.top + to.height / 2) - (from.top + from.height / 2);
    var sc = to.width / from.width;
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      if (fly.parentNode) fly.parentNode.removeChild(fly);
      done();
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        fly.style.transform = "translate(" + dx + "px," + dy + "px) scale(" + sc + ") rotate(360deg)";
      });
    });
    fly.addEventListener("transitionend", finish);
    setTimeout(finish, 520);
  }

  function onTile(tile) {
    if (sp.busy || sp.levelDone || !sp.current || tile.used) return;
    call("unlockAudio");
    var slot = sp.slots[sp.pos];
    if (!slot) return;
    if (tile.ch === slot.ch) {
      tile.used = true;
      slot.filled = true;
      sp.slotMisses = 0;
      clearHint();
      call("playCorrect");
      slot.el.textContent = showChar(slot.ch, sp.current);
      slot.el.classList.add("is-filled", "incoming");
      tile.el.classList.add("is-used");
      tile.el.disabled = true;
      sp.pos++;
      skipFixed();
      markNextSlot();
      var complete = sp.pos >= sp.slots.length;
      if (complete) sp.busy = true;
      flyTile(tile, slot, function () {
        slot.el.classList.remove("incoming");
        slot.el.classList.add("pop");
      });
      if (complete) wordComplete();
    } else {
      sp.slotMisses++;
      call("playMiss");
      var el = tile.el;
      el.classList.remove("wiggle");
      void el.offsetWidth;
      el.classList.add("wiggle");
      setTimeout(function () { el.classList.remove("wiggle"); }, 520);
      if (sp.slotMisses >= 2) showHint();
    }
  }

  function wordComplete() {
    /* Say the word again in this same tap (keeps iOS speech unlocked) */
    call("speakWord", sp.current);
    sp.done++;
    updateProgress();
    var slotsBox = $("spell-slots");
    if (slotsBox) slotsBox.classList.add("is-complete");
    playReward();
    clearTimers();
    sp.nextTimer = setTimeout(function () {
      sp.nextTimer = null;
      if (slotsBox) slotsBox.classList.remove("is-complete");
      sp.index++;
      if (sp.index >= sp.queue.length) {
        showLevelDone();
      } else {
        startRound(true);
      }
    }, NEXT_WORD_MS);
  }

  function playReward() {
    var stage = $("spell-polly-stage");
    if (!stage) return;
    var kind = REWARDS[sp.rewardN % REWARDS.length];
    sp.rewardN++;
    REWARDS.forEach(function (r) { stage.classList.remove("reward-" + r); });
    void stage.offsetWidth;
    stage.classList.add("reward-" + kind);
    stage.setAttribute("data-reward", kind);
    /* felt feathers + stars puff */
    var burst = $("spell-burst");
    if (burst) {
      burst.innerHTML = "";
      var colors = ["#E0503A", "#3CB54A", "#FFC84A", "#4D96FF", "#FF8FAB"];
      for (var i = 0; i < 12; i++) {
        var p = document.createElement("span");
        p.className = i % 3 === 0 ? "spell-burst-star" : "spell-burst-feather";
        p.style.setProperty("--a", (i * 30 + Math.random() * 14) + "deg");
        p.style.setProperty("--d", (60 + Math.random() * 50) + "px");
        p.style.background = i % 3 === 0 ? "" : colors[i % colors.length];
        if (i % 3 === 0) p.textContent = "★";
        p.style.animationDelay = (Math.random() * 0.12) + "s";
        burst.appendChild(p);
      }
    }
    setTimeout(function () {
      stage.classList.remove("reward-" + kind);
      if (burst) burst.innerHTML = "";
    }, NEXT_WORD_MS - 150);
  }

  function showLevelDone() {
    sp.levelDone = true;
    sp.current = null;
    call("playWin");
    if (sp.source === "level" && sp.levelId) {
      var h = host();
      if (h.markLevelComplete) h.markLevelComplete("spell", sp.levelId);
    }
    call("burstConfetti");
    var stage = $("spell-polly-stage");
    if (stage) stage.classList.add("party");
    var overlay = $("spell-done");
    if (overlay) overlay.classList.remove("hidden");
  }

  function buildWord(word) {
    sp.current = word;
    sp.slots = [];
    var letters = [];
    for (var i = 0; i < word.length; i++) {
      var ch = word.charAt(i);
      var fixed = !isLetter(ch); /* apostrophe, hyphen, space: pre-filled */
      sp.slots.push({ ch: ch, fixed: fixed, filled: fixed, el: null });
      if (!fixed) letters.push(ch);
    }
    var all = letters.concat(pickDistractors(word, distractorCount(letters.length)));
    var mixed = shuffle(all);
    /* avoid tiles reading the word in order */
    var guard = 0;
    while (guard++ < 6 && letters.length > 1 && mixed.slice(0, letters.length).join("") === letters.join("")) {
      mixed = shuffle(all);
    }
    sp.tiles = mixed.map(function (ch, idx) { return { id: idx, ch: ch, used: false, el: null }; });
    sp.pos = 0;
    skipFixed();
    sp.slotMisses = 0;
  }

  function startRound(speakNow) {
    clearTimers();
    sp.busy = false;
    var overlay = $("spell-done");
    if (overlay) overlay.classList.add("hidden");
    var stage = $("spell-polly-stage");
    if (stage) stage.classList.remove("party");
    if (!sp.queue.length) {
      sp.current = null;
      renderEmpty();
      return;
    }
    var empty = $("spell-empty");
    if (empty) empty.classList.add("hidden");
    buildWord(sp.queue[sp.index]);
    renderSlots();
    renderTiles();
    sizeBoard();
    updateProgress();
    if (speakNow) call("speakWord", sp.current);
  }

  function renderEmpty() {
    var s = $("spell-slots"); if (s) s.innerHTML = "";
    var t = $("spell-tiles"); if (t) t.innerHTML = "";
    var empty = $("spell-empty");
    if (empty) empty.classList.remove("hidden");
    updateProgress();
  }

  function begin(words) {
    clearTimers();
    sp.words = words.slice();
    sp.queue = randomOrder(sp.words);
    sp.index = 0;
    sp.done = 0;
    sp.levelDone = false;
    sp.busy = false;
    startRound(false);
  }

  function setLabel(text) {
    var el = $("spell-level-label");
    if (el) el.textContent = text;
  }

  function startLevel(levelId) {
    sp.source = "level";
    sp.levelId = levelId;
    var levels = (window.WORD_BUDDY_LEVELS && window.WORD_BUDDY_LEVELS.levels) || [];
    var L = null;
    for (var i = 0; i < levels.length; i++) if (levels[i].id === levelId) { L = levels[i]; break; }
    setLabel(L ? "Unit " + L.unit + " · Week " + L.week : "");
    var h = host();
    begin(h.spellWordsForLevel ? h.spellWordsForLevel(levelId) : []);
  }

  function startLibrary() {
    sp.source = "library";
    sp.levelId = null;
    setLabel("My words");
    var h = host();
    begin(h.libraryWords ? h.libraryWords() : []);
  }

  function replay() {
    call("unlockAudio");
    if (sp.current) call("speakWord", sp.current);
  }

  function stop() {
    clearTimers();
    sp.busy = false;
  }

  function isVisible() {
    var scr = $("screen-spell");
    return !!(scr && !scr.classList.contains("hidden"));
  }

  function bind() {
    var speakBtn = $("spell-speak");
    if (speakBtn) speakBtn.addEventListener("click", replay);
    var polly = $("spell-polly-stage");
    if (polly) polly.addEventListener("click", replay);
    var again = $("spell-again");
    if (again) again.addEventListener("click", function () {
      call("unlockAudio");
      begin(sp.words);
      if (sp.current) call("speakWord", sp.current);
    });
    function toMap() { stop(); var h = host(); if (h.showMap) h.showMap("spell"); }
    var backMap = $("spell-back-map");
    if (backMap) backMap.addEventListener("click", toMap);
    var doneMap = $("spell-done-map");
    if (doneMap) doneMap.addEventListener("click", toMap);
    var doneHome = $("spell-done-home");
    if (doneHome) doneHome.addEventListener("click", function () {
      stop(); var h = host(); if (h.showHome) h.showHome();
    });
    window.addEventListener("resize", function () { if (isVisible()) sizeBoard(); });
    /* Hardware keyboard: type a letter = tap a matching unused tile */
    window.addEventListener("keydown", function (e) {
      if (!isVisible()) return;
      var gate = $("parent-gate");
      if (gate && !gate.classList.contains("hidden")) return;
      var k = (e.key || "").toLowerCase();
      if (!/^[a-z]$/.test(k)) return;
      var need = sp.slots[sp.pos] && sp.slots[sp.pos].ch;
      var pick = null;
      for (var i = 0; i < sp.tiles.length; i++) {
        var t = sp.tiles[i];
        if (!t.used && t.ch === k) { pick = t; break; }
      }
      if (pick) { e.preventDefault(); onTile(pick); }
      else if (need) { call("playMiss"); }
    });
  }

  window.SpellGame = {
    name: "Parrot Spell",
    bind: bind,
    startLevel: startLevel,
    startLibrary: startLibrary,
    replay: replay,
    stop: stop,
    getCurrentWord: function () { return sp.current; },
    speakCurrent: function () { if (sp.current) call("speakWord", sp.current); },
    /* test/debug view of the round */
    getState: function () {
      return {
        word: sp.current,
        pos: sp.pos,
        need: sp.slots[sp.pos] ? sp.slots[sp.pos].ch : null,
        filled: sp.slots.map(function (s) { return s.filled ? s.ch : "_"; }).join(""),
        queue: sp.queue.slice(),
        index: sp.index,
        done: sp.done,
        busy: sp.busy,
        levelDone: sp.levelDone,
        source: sp.source,
        tiles: sp.tiles.map(function (t) { return t.ch; }).join("")
      };
    }
  };
})();
