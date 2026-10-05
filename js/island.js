/* Word Buddy — Word Island build-a-scene game (v2) */
(function () {
  "use strict";

  var UNIT_COLORS = {
    1: { name: "blue", fill: "#5B9BD5", deep: "#2E6FA8" },
    2: { name: "green", fill: "#6BBF6B", deep: "#3A8F3A" },
    3: { name: "gold", fill: "#E0B040", deep: "#B88418" },
    4: { name: "purple", fill: "#9B7AD8", deep: "#6A4AAD" },
    5: { name: "rose", fill: "#E07A9A", deep: "#B84868" }
  };

  /* Felt/cardboard beach stickers — warm craft style */
  var SCENE_OBJECTS = [
    { id: "sun", label: "sun", svg: '<g class="sticker-sun"><circle cx="40" cy="40" r="22" fill="#FFC84A" stroke="#C48820" stroke-width="3"/><g stroke="#E0A030" stroke-width="3" stroke-linecap="round"><line x1="40" y1="6" x2="40" y2="14"/><line x1="40" y1="66" x2="40" y2="74"/><line x1="6" y1="40" x2="14" y2="40"/><line x1="66" y1="40" x2="74" y2="40"/><line x1="14" y1="14" x2="20" y2="20"/><line x1="60" y1="60" x2="66" y2="66"/><line x1="66" y1="14" x2="60" y2="20"/><line x1="14" y1="66" x2="20" y2="60"/></g><circle cx="32" cy="36" r="3" fill="#8B5A20"/><circle cx="48" cy="36" r="3" fill="#8B5A20"/><path d="M30 48 Q40 56 50 48" fill="none" stroke="#8B5A20" stroke-width="2.5" stroke-linecap="round"/></g>' },
    { id: "cloud", label: "cloud", svg: '<g class="sticker-cloud"><ellipse cx="40" cy="42" rx="28" ry="16" fill="#FFF8F0" stroke="#C8B8A0" stroke-width="2.5"/><circle cx="24" cy="38" r="14" fill="#FFF8F0" stroke="#C8B8A0" stroke-width="2.5"/><circle cx="48" cy="32" r="16" fill="#FFF8F0" stroke="#C8B8A0" stroke-width="2.5"/><circle cx="58" cy="42" r="12" fill="#FFF8F0"/></g>' },
    { id: "fish", label: "fish", svg: '<g class="sticker-fish"><ellipse cx="38" cy="40" rx="24" ry="14" fill="#FF8A6A" stroke="#C45038" stroke-width="2.5"/><path d="M14 40 L2 28 L2 52 Z" fill="#FFB090" stroke="#C45038" stroke-width="2"/><circle cx="48" cy="36" r="4" fill="#FFF"/><circle cx="49" cy="36" r="2" fill="#333"/><path d="M30 40 Q38 46 46 40" fill="none" stroke="#C45038" stroke-width="2"/><ellipse cx="28" cy="28" rx="6" ry="4" fill="#FFB090" stroke="#C45038" stroke-width="1.5"/></g>' },
    { id: "shell", label: "shell", svg: '<g class="sticker-shell"><path d="M40 62 Q18 48 22 28 Q40 12 58 28 Q62 48 40 62 Z" fill="#F0C8B0" stroke="#C48870" stroke-width="2.5"/><path d="M40 58 L40 22 M28 52 L36 24 M52 52 L44 24" fill="none" stroke="#C48870" stroke-width="2"/><circle cx="40" cy="30" r="4" fill="#E8A888"/></g>' },
    { id: "boat", label: "boat", svg: '<g class="sticker-boat"><path d="M12 48 L20 62 L60 62 L68 48 Z" fill="#C49050" stroke="#6A3A18" stroke-width="2.5"/><rect x="36" y="18" width="4" height="30" fill="#8B5A2B"/><path d="M40 20 L58 36 L40 36 Z" fill="#FFF4E0" stroke="#A88860" stroke-width="2"/><circle cx="28" cy="54" r="2.5" fill="#5C3418"/></g>' },
    { id: "crab", label: "crab", svg: '<g class="sticker-crab"><ellipse cx="40" cy="42" rx="18" ry="12" fill="#E07050" stroke="#A04028" stroke-width="2.5"/><circle cx="32" cy="36" r="4" fill="#FFF"/><circle cx="48" cy="36" r="4" fill="#FFF"/><circle cx="33" cy="36" r="2" fill="#333"/><circle cx="49" cy="36" r="2" fill="#333"/><path d="M22 40 Q8 28 12 20 M22 44 Q6 48 10 58 M58 40 Q72 28 68 20 M58 44 Q74 48 70 58" fill="none" stroke="#E07050" stroke-width="3" stroke-linecap="round"/><path d="M30 50 L28 60 M36 52 L36 62 M44 52 L44 62 M50 50 L52 60" fill="none" stroke="#C45038" stroke-width="2.5" stroke-linecap="round"/></g>' },
    { id: "sandcastle", label: "sandcastle", svg: '<g class="sticker-castle"><rect x="22" y="36" width="36" height="28" rx="3" fill="#E8C890" stroke="#B89050" stroke-width="2.5"/><rect x="18" y="28" width="12" height="16" fill="#E0B878" stroke="#B89050" stroke-width="2"/><rect x="50" y="28" width="12" height="16" fill="#E0B878" stroke="#B89050" stroke-width="2"/><rect x="34" y="20" width="12" height="20" fill="#E8C890" stroke="#B89050" stroke-width="2"/><rect x="36" y="48" width="8" height="16" fill="#8B5A2B"/><circle cx="28" cy="24" r="3" fill="#E07060"/><circle cx="56" cy="24" r="3" fill="#E07060"/><circle cx="40" cy="16" r="3" fill="#E07060"/></g>' },
    { id: "starfish", label: "starfish", svg: '<g class="sticker-star"><path d="M40 12 L46 30 L66 30 L50 42 L56 60 L40 48 L24 60 L30 42 L14 30 L34 30 Z" fill="#FF9A6A" stroke="#C45830" stroke-width="2.5"/><circle cx="40" cy="36" r="5" fill="#FFC0A0"/></g>' },
    { id: "palm", label: "palm", svg: '<g class="sticker-palm"><path d="M38 70 Q40 40 42 22" fill="none" stroke="#A07040" stroke-width="6" stroke-linecap="round"/><path d="M42 24 Q20 18 12 28 M42 24 Q28 8 18 12 M42 24 Q56 8 66 14 M42 24 Q64 20 70 32" fill="none" stroke="#4A9A50" stroke-width="5" stroke-linecap="round"/><ellipse cx="36" cy="68" rx="14" ry="5" fill="#D8B878" opacity="0.5"/></g>' },
    { id: "bucket", label: "bucket", svg: '<g class="sticker-bucket"><path d="M26 30 L30 62 L50 62 L54 30 Z" fill="#5BA8D8" stroke="#2E6FA8" stroke-width="2.5"/><ellipse cx="40" cy="30" rx="14" ry="5" fill="#7EC0E8" stroke="#2E6FA8" stroke-width="2"/><path d="M28 38 Q40 44 52 38" fill="none" stroke="#2E6FA8" stroke-width="2"/><path d="M40 18 Q52 22 40 30" fill="none" stroke="#C49050" stroke-width="3"/></g>' },
    { id: "seagull", label: "seagull", svg: '<g class="sticker-gull"><path d="M10 40 Q28 28 40 40 Q52 28 70 40" fill="none" stroke="#555" stroke-width="3.5" stroke-linecap="round"/><circle cx="40" cy="42" r="5" fill="#FFF8F0" stroke="#888" stroke-width="1.5"/><circle cx="42" cy="41" r="1.5" fill="#333"/></g>' },
    { id: "jellyfish", label: "jellyfish", svg: '<g class="sticker-jelly"><ellipse cx="40" cy="28" rx="18" ry="14" fill="#D8A0E8" stroke="#9860B0" stroke-width="2.5"/><path d="M28 38 Q26 55 24 68 M36 40 Q36 58 34 70 M44 40 Q46 58 48 70 M52 38 Q56 55 58 68" fill="none" stroke="#C080D8" stroke-width="2.5" stroke-linecap="round"/><circle cx="34" cy="26" r="2.5" fill="#FFF"/><circle cx="46" cy="26" r="2.5" fill="#FFF"/></g>' },
    { id: "lighthouse", label: "lighthouse", svg: '<g class="sticker-light"><path d="M32 66 L36 28 L44 28 L48 66 Z" fill="#F0E8E0" stroke="#888" stroke-width="2"/><rect x="34" y="18" width="12" height="12" fill="#E07060" stroke="#A04038" stroke-width="2"/><polygon points="30,18 50,18 40,8" fill="#E07060" stroke="#A04038" stroke-width="2"/><rect x="30" y="66" width="20" height="6" fill="#888"/><rect x="36" y="36" width="8" height="6" fill="#5BA8D8"/></g>' },
    { id: "wave", label: "wave", svg: '<g class="sticker-wave"><path d="M8 50 Q20 30 32 50 Q44 30 56 50 Q68 35 74 48" fill="none" stroke="#5BA8D8" stroke-width="6" stroke-linecap="round"/><path d="M8 58 Q22 42 34 58 Q48 40 62 56" fill="none" stroke="#A8D8F0" stroke-width="4" stroke-linecap="round"/></g>' },
    { id: "shovel", label: "shovel", svg: '<g class="sticker-shovel"><rect x="36" y="10" width="8" height="36" rx="2" fill="#C49050" stroke="#6A3A18" stroke-width="2"/><path d="M28 46 L52 46 L48 68 L32 68 Z" fill="#E07060" stroke="#A04038" stroke-width="2.5"/></g>' },
    { id: "treasure", label: "treasure", svg: '<g class="sticker-chest"><rect x="18" y="36" width="44" height="28" rx="3" fill="#C49050" stroke="#6A3A18" stroke-width="2.5"/><path d="M18 36 Q40 18 62 36" fill="#E0B878" stroke="#6A3A18" stroke-width="2.5"/><rect x="36" y="44" width="8" height="10" rx="1" fill="#FFC84A" stroke="#C48820" stroke-width="1.5"/><circle cx="40" cy="30" r="3" fill="#FFC84A"/></g>' }
  ];

  /* Placement slots on the beach scene (percent of scene box) */
  var SLOTS = [
    { x: 78, y: 10, s: 1.0 },   /* sun */
    { x: 18, y: 8, s: 0.9 },    /* cloud */
    { x: 55, y: 12, s: 0.75 },  /* cloud2 */
    { x: 12, y: 48, s: 0.85 },  /* fish */
    { x: 70, y: 55, s: 0.7 },   /* shell */
    { x: 50, y: 42, s: 1.0 },   /* boat */
    { x: 28, y: 62, s: 0.8 },   /* crab */
    { x: 82, y: 58, s: 0.95 },  /* sandcastle */
    { x: 40, y: 68, s: 0.7 },   /* starfish */
    { x: 8, y: 28, s: 1.05 },   /* palm */
    { x: 62, y: 68, s: 0.75 },  /* bucket */
    { x: 88, y: 22, s: 0.8 },   /* seagull */
    { x: 35, y: 38, s: 0.7 },   /* jellyfish */
    { x: 90, y: 40, s: 0.9 },   /* lighthouse */
    { x: 22, y: 52, s: 0.8 },   /* wave */
    { x: 48, y: 72, s: 0.7 },   /* shovel */
    { x: 75, y: 72, s: 0.8 },   /* treasure */
    { x: 5, y: 62, s: 0.65 },
    { x: 58, y: 28, s: 0.7 },
    { x: 15, y: 72, s: 0.7 }
  ];

  var island = {
    levelId: null,
    words: [],
    queue: [],
    index: 0,
    placed: [],
    busy: false,
    current: null,
    choices: []
  };

  function $(id) { return document.getElementById(id); }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function displayWord(w) {
    if (w === "i") return "I";
    return w;
  }

  function getHost() {
    return window.WordBuddy || {};
  }

  function wordsForLevel(levelId) {
    var host = getHost();
    if (host.wordsForLevel) return host.wordsForLevel(levelId);
    return [];
  }

  function markComplete(levelId) {
    var host = getHost();
    if (host.markLevelComplete) host.markLevelComplete("island", levelId);
  }

  function speak(word) {
    var host = getHost();
    if (host.speakWord) host.speakWord(word);
  }

  function playCorrect() {
    var host = getHost();
    if (host.playCorrect) host.playCorrect();
  }

  function playMiss() {
    var host = getHost();
    if (host.playMiss) host.playMiss();
  }

  function playWin() {
    var host = getHost();
    if (host.playWin) host.playWin();
  }

  function unlockAudio() {
    var host = getHost();
    if (host.unlockAudio) host.unlockAudio();
  }

  function updateProgress() {
    var fill = $("island-progress-fill");
    var wrap = $("island-progress");
    if (!fill || !wrap) return;
    var total = island.words.length;
    var done = island.placed.length;
    var pct = total ? Math.round((done / total) * 100) : 0;
    fill.style.width = pct + "%";
    wrap.setAttribute("aria-valuenow", String(done));
    wrap.setAttribute("aria-valuemax", String(total));
  }

  function pickDistractors(target, count) {
    var pool = island.words.filter(function (w) {
      return w.toLowerCase() !== target.toLowerCase();
    });
    /* nearby levels if short */
    if (pool.length < count) {
      var host = getHost();
      var levels = (window.WORD_BUDDY_LEVELS && window.WORD_BUDDY_LEVELS.levels) || [];
      var cur = levels.find ? levels.find(function (L) { return L.id === island.levelId; }) : null;
      if (!cur) {
        for (var i = 0; i < levels.length; i++) {
          if (levels[i].id === island.levelId) { cur = levels[i]; break; }
        }
      }
      if (cur && host.wordsForLevel) {
        var extras = [];
        levels.forEach(function (L) {
          if (L.unit === cur.unit && L.id !== cur.id) {
            extras = extras.concat(host.wordsForLevel(L.id));
          }
        });
        extras.forEach(function (w) {
          if (w.toLowerCase() === target.toLowerCase()) return;
          if (pool.some(function (p) { return p.toLowerCase() === w.toLowerCase(); })) return;
          pool.push(w);
        });
      }
    }
    return shuffle(pool).slice(0, count);
  }

  function renderChoices() {
    var box = $("island-cards");
    if (!box) return;
    box.innerHTML = "";
    var cards = shuffle(island.choices.slice());
    cards.forEach(function (word) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "island-card";
      btn.textContent = displayWord(word);
      btn.setAttribute("data-word", word);
      btn.addEventListener("click", function () {
        onPick(word, btn);
      });
      box.appendChild(btn);
    });
  }

  function addSticker(wordIndex) {
    var scene = $("island-stickers");
    if (!scene) return;
    var obj = SCENE_OBJECTS[wordIndex % SCENE_OBJECTS.length];
    var slot = SLOTS[wordIndex % SLOTS.length];
    var wrap = document.createElement("div");
    wrap.className = "island-sticker fly-in";
    wrap.style.left = slot.x + "%";
    wrap.style.top = slot.y + "%";
    wrap.style.transform = "translate(-50%,-50%) scale(" + (slot.s * 0.2) + ")";
    wrap.innerHTML = '<svg viewBox="0 0 80 80" width="72" height="72" aria-hidden="true">' + obj.svg + "</svg>";
    wrap.setAttribute("data-obj", obj.id);
    scene.appendChild(wrap);
    requestAnimationFrame(function () {
      wrap.style.transform = "translate(-50%,-50%) scale(" + slot.s + ")";
    });
    setTimeout(function () {
      wrap.classList.remove("fly-in");
      wrap.classList.add("settled");
    }, 550);
  }

  function animateSceneAlive() {
    var scene = $("island-stickers");
    if (!scene) return;
    var kids = scene.children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.add("alive");
      kids[i].style.animationDelay = (i * 0.08) + "s";
    }
  }

  function showLevelDone() {
    animateSceneAlive();
    playWin();
    markComplete(island.levelId);
    var host = getHost();
    if (host.burstConfetti) host.burstConfetti();
    var overlay = $("island-done");
    if (overlay) overlay.classList.remove("hidden");
  }

  function startRound(speakNow) {
    island.busy = false;
    if (island.index >= island.queue.length) {
      showLevelDone();
      return;
    }
    island.current = island.queue[island.index];
    /* 3–4 big cards: target + distractors from same (or nearby) level */
    var totalCards = Math.min(4, Math.max(2, island.words.length));
    if (island.words.length === 1) totalCards = 1;
    var nDist = Math.max(0, totalCards - 1);
    var dist = pickDistractors(island.current, nDist);
    island.choices = [island.current].concat(dist).slice(0, totalCards);
    renderChoices();
    updateProgress();
    var hint = $("island-listen-hint");
    if (hint) hint.classList.remove("hidden");
    if (speakNow) speak(island.current);
  }

  function onPick(word, btn) {
    if (island.busy || !island.current) return;
    unlockAudio();
    if (word.toLowerCase() === island.current.toLowerCase()) {
      island.busy = true;
      btn.classList.add("correct");
      playCorrect();
      addSticker(island.placed.length);
      island.placed.push(island.current);
      island.index++;
      updateProgress();
      setTimeout(function () {
        startRound(true);
      }, 650);
    } else {
      btn.classList.add("wiggle");
      playMiss();
      speak(island.current);
      setTimeout(function () {
        btn.classList.remove("wiggle");
      }, 450);
    }
  }

  function clearScene() {
    var scene = $("island-stickers");
    if (scene) scene.innerHTML = "";
    var overlay = $("island-done");
    if (overlay) overlay.classList.add("hidden");
  }

  function startLevel(levelId) {
    island.levelId = levelId;
    island.words = wordsForLevel(levelId);
    island.queue = shuffle(island.words);
    island.index = 0;
    island.placed = [];
    island.busy = false;
    island.current = null;
    clearScene();
    updateProgress();
    var title = $("island-level-label");
    var levels = (window.WORD_BUDDY_LEVELS && window.WORD_BUDDY_LEVELS.levels) || [];
    var L = null;
    for (var i = 0; i < levels.length; i++) {
      if (levels[i].id === levelId) { L = levels[i]; break; }
    }
    if (title && L) {
      title.textContent = "Unit " + L.unit + " · Week " + L.week;
    }
    /* First speak happens in the tap that opened the level (caller should speak after startRound) */
    startRound(false);
  }

  function replay() {
    unlockAudio();
    if (island.current) speak(island.current);
  }

  function bind() {
    var speakBtn = $("island-speak");
    if (speakBtn) speakBtn.addEventListener("click", replay);
    var again = $("island-again");
    if (again) again.addEventListener("click", function () {
      unlockAudio();
      clearScene();
      island.queue = shuffle(island.words);
      island.index = 0;
      island.placed = [];
      var overlay = $("island-done");
      if (overlay) overlay.classList.add("hidden");
      startRound(true);
    });
    var backMap = $("island-back-map");
    if (backMap) backMap.addEventListener("click", function () {
      var host = getHost();
      if (host.showMap) host.showMap("island");
    });
    var doneHome = $("island-done-home");
    if (doneHome) doneHome.addEventListener("click", function () {
      var host = getHost();
      if (host.showHome) host.showHome();
    });
    var doneMap = $("island-done-map");
    if (doneMap) doneMap.addEventListener("click", function () {
      var host = getHost();
      if (host.showMap) host.showMap("island");
    });
  }

  window.IslandGame = {
    UNIT_COLORS: UNIT_COLORS,
    startLevel: startLevel,
    replay: replay,
    bind: bind,
    getCurrentWord: function () { return island.current; },
    speakCurrent: function () {
      if (island.current) speak(island.current);
    }
  };
})();
