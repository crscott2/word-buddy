(function () {
  "use strict";

  var STORAGE_KEY = "spellBuddy.words.v2";
  var STORAGE_KEY_V1 = "spellBuddy.words.v1";


  var MUTE_KEY = "spellBuddy.audioMuted.v1";
  var SETTINGS_KEY = "spellBuddy.settings.v1";
  var PROGRESS_KEY = "spellBuddy.progress.v1";
  var APP_VERSION = "2.1";

  /**
   * v2.1: Parrot Spell (third game): hear a word, tap shuffled letter tiles into slots; stars per game
   * v2.0: Home menu + Savvas myView levels + Word Island build-a-scene; Hangman unchanged
   * v1.30: Auto-speak word when win/lose popup shows; speak button icon-only (en-US speechSynthesis)
   * - HTMLAudioElement (playsInline) = primary audible path (survives iPhone ringer switch)
   * Bundled WAVs: miss / correct / win / lose / blip (unmute)
   * Unlock on tap: prime HTML players + AudioContext resume + silent buffer
   * spellBuddy.* localStorage keys preserved
   */
  var audio = {
    ctx: null,
    muted: false,
    unlocked: false,
    unlockArmed: false,
    unlockHandler: null,
    visibilityBound: false,
    html: {
      miss: null,
      correct: null,
      win: null,
      lose: null,
      blip: null,
      primed: false
    },
    preferHtml: true
  };

  var AUDIO_URLS = {
    miss: "audio/miss.wav",
    correct: "audio/correct.wav",
    win: "audio/win.wav",
    lose: "audio/lose.wav",
    blip: "audio/blip.wav"
  };

  function loadMutePref() {
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function saveMutePref(muted) {
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch (e) {}
  }

  function getAudioCtx() {
    if (audio.ctx) return audio.ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      audio.ctx = new AC();
    } catch (e) {
      return null;
    }
    return audio.ctx;
  }

  function makeHtmlAudio(src, loop) {
    var el = new Audio();
    el.preload = "auto";
    el.loop = !!loop;
    el.muted = false;
    el.volume = 1;
    /* iOS Safari: inline playback, not fullscreen takeover */
    try {
      el.setAttribute("playsinline", "true");
      el.setAttribute("webkit-playsinline", "true");
      el.playsInline = true;
    } catch (e) {}
    el.src = src;
    try {
      el.load();
    } catch (e2) {}
    return el;
  }

  function ensureHtmlPlayers() {
    if (!audio.html.miss) {
      audio.html.miss = makeHtmlAudio(AUDIO_URLS.miss, false);
      audio.html.miss.volume = 0.65;
    }
    if (!audio.html.correct) {
      audio.html.correct = makeHtmlAudio(AUDIO_URLS.correct, false);
      audio.html.correct.volume = 0.85;
    }
    if (!audio.html.win) {
      audio.html.win = makeHtmlAudio(AUDIO_URLS.win, false);
      audio.html.win.volume = 0.95;
    }
    if (!audio.html.lose) {
      audio.html.lose = makeHtmlAudio(AUDIO_URLS.lose, false);
      audio.html.lose.volume = 0.9;
    }
    if (!audio.html.blip) {
      audio.html.blip = makeHtmlAudio(AUDIO_URLS.blip, false);
      audio.html.blip.volume = 1;
    }
    return audio.html;
  }

  /** Play HTML element from a user gesture; returns true if play() was invoked */
  function htmlPlay(el) {
    if (!el) return false;
    try {
      el.muted = false;
      var p = el.play();
      if (p && typeof p.then === "function") {
        p.catch(function () {});
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function htmlPause(el) {
    if (!el) return;
    try {
      el.pause();
    } catch (e) {}
  }

  function htmlRestart(el, volume) {
    if (!el) return false;
    try {
      el.pause();
      el.currentTime = 0;
    } catch (e) {}
    el.muted = false;
    if (typeof volume === "number") el.volume = volume;
    return htmlPlay(el);
  }

  /** Classic iOS Web Audio unlock: tiny near-silent buffer in the gesture */
  function playSilentUnlockBuffer(ctx) {
    if (!ctx) return;
    try {
      var frames = Math.max(1, Math.floor((ctx.sampleRate || 44100) * 0.01));
      var buf = ctx.createBuffer(1, frames, ctx.sampleRate || 44100);
      var data = buf.getChannelData(0);
      for (var i = 0; i < frames; i++) data[i] = 0;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var g = ctx.createGain();
      g.gain.value = 0.0001;
      src.connect(g);
      g.connect(ctx.destination);
      if (typeof src.start === "function") src.start(0);
      else if (typeof src.noteOn === "function") src.noteOn(0);
    } catch (e) {}
  }

  function stopAllHtmlSfx() {
    htmlPause(audio.html.miss);
    htmlPause(audio.html.correct);
    htmlPause(audio.html.win);
    htmlPause(audio.html.lose);
    htmlPause(audio.html.blip);
  }

  /** Quiet play+pause kick so later one-shots work after unmute / cold start */
  function primeHtmlPlayersQuiet() {
    ensureHtmlPlayers();
    var kick = audio.html.blip;
    if (!kick) return;
    try {
      var prevVol = kick.volume;
      kick.volume = 0.01;
      var p = kick.play();
      function restore() {
        try {
          kick.pause();
          kick.currentTime = 0;
          kick.volume = prevVol;
        } catch (e) {}
        audio.html.primed = true;
      }
      if (p && typeof p.then === "function") {
        p.then(restore).catch(function () {
          try {
            kick.volume = prevVol;
          } catch (e2) {}
        });
      } else {
        restore();
      }
    } catch (e3) {}
  }

  /** Audible unmute confirmation — MUST be called inside the unmute tap */
  function playUnmuteBlip() {
    if (audio.muted) return;
    ensureHtmlPlayers();
    htmlRestart(audio.html.blip, 1);
    audio.html.primed = true;
  }

  function audioIsReady() {
    if (audio.muted) return true;
    if (audio.unlocked) return true;
    if (audio.html.primed) return true;
    return !!(audio.ctx && audio.ctx.state === "running");
  }

  function syncSoundHint() {
    var hint = els.soundHint || $("sound-unlock-hint");
    if (!hint) return;
    var show = !audio.muted && !audio.unlocked && !audioIsReady();
    hint.classList.toggle("hidden", !show);
    hint.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function markUnlockProgress() {
    var ready = audioIsReady();
    if (ready) audio.unlocked = true;
    syncSoundHint();
    if (audio.unlocked || audio.muted) disarmAudioUnlock();
  }

  /**
   * iOS-safe unlock — MUST run synchronously inside a user gesture.
   * 1) Quiet-prime HTMLAudioElements (no looping ambience)
   * 2) AudioContext + resume + silent buffer
   */
  function unlockAudio() {
    ensureHtmlPlayers();

    if (!audio.muted) {
      /* Prefer marking unlocked after a real play in-gesture when possible */
      if (!audio.html.primed) primeHtmlPlayersQuiet();
    } else {
      primeHtmlPlayersQuiet();
    }

    var ctx = getAudioCtx();
    if (ctx) {
      try {
        if (typeof ctx.resume === "function") ctx.resume();
      } catch (e) {}
      playSilentUnlockBuffer(ctx);
    }

    function afterRunning() {
      if (audio.html.primed || (ctx && ctx.state === "running")) {
        audio.unlocked = true;
      }
      markUnlockProgress();
    }

    if (ctx && ctx.state === "running") {
      afterRunning();
    } else if (ctx && typeof ctx.resume === "function") {
      ctx
        .resume()
        .then(afterRunning)
        .catch(function () {
          markUnlockProgress();
        });
      setTimeout(afterRunning, 120);
    } else {
      afterRunning();
    }
  }

  function onUnlockGesture() {
    unlockAudio();
  }

  function disarmAudioUnlock() {
    if (!audio.unlockArmed || !audio.unlockHandler) return;
    var h = audio.unlockHandler;
    document.removeEventListener("touchstart", h, true);
    document.removeEventListener("pointerdown", h, true);
    document.removeEventListener("click", h, true);
    audio.unlockArmed = false;
    audio.unlockHandler = null;
  }

  function armAudioUnlock() {
    if (audio.unlockArmed) return;
    audio.unlockArmed = true;
    audio.unlockHandler = onUnlockGesture;
    document.addEventListener("touchstart", onUnlockGesture, true);
    document.addEventListener("pointerdown", onUnlockGesture, true);
    document.addEventListener("click", onUnlockGesture, true);
  }

  function bindAudioVisibility() {
    if (audio.visibilityBound) return;
    audio.visibilityBound = true;
    function tryResume() {
      if (audio.muted) return;
      var ctx = audio.ctx;
      if (ctx && ctx.state === "suspended") {
        try {
          ctx.resume().then(function () {
            markUnlockProgress();
            if (!audioIsReady()) armAudioUnlock();
          }).catch(function () {
            armAudioUnlock();
            syncSoundHint();
          });
        } catch (e) {
          armAudioUnlock();
          syncSoundHint();
        }
      }
      if (!audio.unlocked) {
        armAudioUnlock();
        syncSoundHint();
      }
    }
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") tryResume();
    });
    window.addEventListener("pageshow", tryResume);
    window.addEventListener("focus", tryResume);
    window.addEventListener("pagehide", function () {
      if (audio.muted) return;
      if (!audio.unlocked && (!audio.ctx || audio.ctx.state !== "running")) {
        audio.unlocked = false;
        armAudioUnlock();
        syncSoundHint();
      }
    });
  }

  function playWebToneBurst(opts) {
    var ctx = audio.ctx || getAudioCtx();
    if (!ctx || ctx.state === "suspended") return false;
    opts = opts || {};
    try {
      var t0 = ctx.currentTime;
      var freqs = opts.freqs || [660];
      var dur = opts.dur || 0.2;
      var type = opts.type || "sine";
      var peak = opts.peak || 0.28;
      var master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
      master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      master.connect(ctx.destination);
      for (var i = 0; i < freqs.length; i++) {
        var osc = ctx.createOscillator();
        osc.type = type;
        var f0 = freqs[i];
        var f1 = opts.freqsEnd && opts.freqsEnd[i] != null ? opts.freqsEnd[i] : f0;
        osc.frequency.setValueAtTime(f0, t0);
        if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
        var g = ctx.createGain();
        g.gain.value = 1 / Math.max(1, freqs.length);
        osc.connect(g);
        g.connect(master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Soft miss cue — single gentle HTML blip (no harsh Web Audio companion) */
  function playPirateMiss() {
    if (audio.muted) return;
    unlockAudio();
    ensureHtmlPlayers();
    htmlRestart(audio.html.miss, 0.65);
  }

  /** Positive chime on each correct letter */
  function playCorrectLetter() {
    if (audio.muted) return;
    unlockAudio();
    ensureHtmlPlayers();
    htmlRestart(audio.html.correct, 0.85);
    playWebToneBurst({
      freqs: [660, 990],
      dur: 0.18,
      type: "sine",
      peak: 0.22
    });
  }

  /** Short win fanfare — may overlap run-away animation */
  function playWinSound() {
    if (audio.muted) return;
    unlockAudio();
    ensureHtmlPlayers();
    htmlRestart(audio.html.win, 0.95);
    playWebToneBurst({
      freqs: [523.25, 659.25, 783.99],
      dur: 0.45,
      type: "triangle",
      peak: 0.26
    });
  }

  /** Short lose tone with skeleton / trap sequence */
  function playLoseSound() {
    if (audio.muted) return;
    unlockAudio();
    ensureHtmlPlayers();
    htmlRestart(audio.html.lose, 0.9);
    playWebToneBurst({
      freqs: [320],
      freqsEnd: [120],
      dur: 0.5,
      type: "sawtooth",
      peak: 0.24
    });
  }

  function syncMuteButton() {
    var btn = els.btnMute || $("btn-mute");
    if (!btn) return;
    btn.setAttribute("aria-pressed", audio.muted ? "true" : "false");
    btn.setAttribute(
      "aria-label",
      audio.muted ? "Unmute sound" : "Mute sound"
    );
    btn.title = audio.muted ? "Unmute" : "Mute";
    btn.textContent = audio.muted ? "🔇" : "🔊";
    syncSoundHint();
  }

  function setMuted(muted, opts) {
    opts = opts || {};
    audio.muted = !!muted;
    saveMutePref(audio.muted);
    syncMuteButton();
    if (audio.muted) {
      stopAllHtmlSfx();
      markUnlockProgress();
    } else {
      /* Blip FIRST in the unmute tap so Chris hears feedback immediately */
      if (opts.playBlip) playUnmuteBlip();
      unlockAudio();
      if (!audioIsReady()) armAudioUnlock();
    }
  }

  function toggleMute() {
    if (audio.muted) {
      /* Unmute: audible blip in this same tap handler */
      setMuted(false, { playBlip: true });
    } else {
      setMuted(true);
    }
  }

  // Scholastic Fry 100 Word List (flashcards) — stored lowercase; "I" displays capital
  var FRY_100 = [
    "the", "of", "and", "a", "to", "in", "is", "you", "that", "it",
    "he", "was", "for", "on", "are", "as", "with", "his", "they", "i",
    "at", "be", "this", "have", "from", "or", "one", "had", "by", "words",
    "but", "not", "what", "all", "were", "we", "when", "your", "can", "said",
    "there", "use", "an", "each", "which", "she", "do", "how", "their", "if",
    "will", "up", "other", "about", "out", "many", "then", "them", "these", "so",
    "some", "her", "would", "make", "like", "him", "into", "time", "has", "look",
    "two", "more", "write", "go", "see", "number", "no", "way", "could", "people",
    "my", "than", "first", "water", "been", "called", "who", "am", "its", "now",
    "find", "long", "down", "day", "did", "get", "come", "made", "may", "part"
  ];

  var MAX_MISSES = 6;
  /** Lose sequence: morph (still hanging) → trap open → detach+full fall+dust → wait 3s → popup */
  var LOSE_MORPH_MS = 400;
  var LOSE_TRAP_MS = 400;
  var LOSE_FALL_MS = 1250;
  var LOSE_DUST_MS = 700; /* overlaps fall; cartoon puff at trap */
  var LOSE_POPUP_DELAY_MS = 3000; /* pause after fall/dust before outcome */
  var LOSE_TOTAL_MS =
    LOSE_MORPH_MS +
    LOSE_TRAP_MS +
    Math.max(LOSE_FALL_MS, LOSE_DUST_MS) +
    LOSE_POPUP_DELAY_MS;

  /** Win sequence: free+drop → grab loot → run off → wait 3s → same word popup as lose */
  var WIN_DROP_MS = 450;
  var WIN_GRAB_MS = 350;
  var WIN_RUN_MS = 1500;
  var WIN_POPUP_DELAY_MS = 3000; /* pause after run-off before outcome (mirrors lose) */
  var WIN_TOTAL_MS =
    WIN_DROP_MS + WIN_GRAB_MS + WIN_RUN_MS + WIN_POPUP_DELAY_MS;

  var CHARACTERS = [
    {
      id: "pip",
      name: "Captain Pip",
      hook: "Captain Pip hangs from the craft noose — spell carefully!",
      captions: [
        "Empty craft noose on the gallows — spell to build Pip!",
        "Felt head in the yarn noose — hello from above the plank!",
        "Cloth stripes + felt red coat, dangling from the rope!",
        "One felt arm dangling — still hanging in there!",
        "Two arms dangling from the craft noose!",
        "Left fabric boot floating above the trap (uh-oh)!",
        "Full craft pirate hanging on! Spell fast — tides wait for no letter!"
      ]
    }
  ];

  var MISS_JOKES = [
    "Whoops! That letter went snorkeling.",
    "Nope — try a different letter, letter-explorer!",
    "Silly miss! Your beach buddy grew another piece.",
    "That letter is playing hide-and-seek in the sand.",
    "Boop! Wrong letter, right attitude.",
    "Almost… but not that one, matey!"
  ];

  var HIT_JOKES = [
    "Yes! Letter power!",
    "Boing! That letter fits!",
    "You found it — beach high five!",
    "Smart cookies eat letters like that!",
    "Whee! More of the word!",
    "Letter detective strikes again!"
  ];


  var LOSE_SKELETON_CAPTIONS = [
    "Rattle rattle — felt bones still hanging… trap door time!",
    "Boop! {NAME} is crafty bones… whoosh — long drop through the plank!",
    "Halloween-cute felt bones say: try again!"
  ];

  var state = {
    library: [], // [{ word, on }]
    playWords: [], // shuffled ON words for this round (storage order never used)
    enabledSig: "", // signature of enabled set for change detection
    roundTotal: 0, // enabled count at round start (progress denominator)
    cleared: {}, // word -> true for wins this round
    passSteps: 0, // advances since last reshuffle (detect list loop)
    index: 0,
    word: "",
    guessed: {},
    misses: 0,
    over: false,
    won: false,
    emptyPool: false,
    character: null, // current CHARACTERS entry
    lastCharId: null,
    skeleton: false,
    loseTimer: null,
    winTimer: null,
    snapClearTimer: null,
    rippleTimer: null,
    rippleClearTimer: null,
    confettiTimer: null,
    shipTimer: null,
    /* v2 navigation */
    screen: "home",
    game: null, /* "hangman" | "island" | "spell" */
    levelId: null,
    wordSource: "level", /* "level" | "library" */
    settings: null,
    progress: null
  };

  var CONFETTI_MS = 3200;

  var els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function normalizeWord(raw) {
    return String(raw || "")
      .toLowerCase()
      .replace(/[\u2018\u2019\u02BC]/g, "'")
      .replace(/[^a-z\s'-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isValidWord(w) {
    return !!w && w.length >= 1 && /[a-z]/.test(w);
  }

  function displayWord(w) {
    if (w === "i") return "I";
    return w;
  }

  function seedFry() {
    return FRY_100.map(function (word) {
      return { word: word, on: true };
    });
  }

  function parseWordList(text) {
    return String(text || "")
      .split(/[\n,;]+/)
      .map(normalizeWord)
      .filter(isValidWord);
  }

  function migrateFromV1() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_V1);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return null;
      var out = [];
      var seen = {};
      parsed.forEach(function (item) {
        var w = normalizeWord(typeof item === "string" ? item : item && item.word);
        if (!isValidWord(w) || seen[w]) return;
        seen[w] = true;
        out.push({ word: w, on: true });
      });
      return out.length ? out : null;
    } catch (e) {
      return null;
    }
  }

  function coerceLibrary(parsed) {
    if (!Array.isArray(parsed) || !parsed.length) return null;
    var out = [];
    var seen = {};
    parsed.forEach(function (item) {
      var w;
      var on = true;
      if (typeof item === "string") {
        w = normalizeWord(item);
      } else if (item && typeof item === "object") {
        w = normalizeWord(item.word);
        on = item.on !== false;
      } else {
        return;
      }
      if (!isValidWord(w) || seen[w]) return;
      seen[w] = true;
      out.push({ word: w, on: !!on });
    });
    return out.length ? out : null;
  }

  function loadLibrary() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var coerced = coerceLibrary(JSON.parse(raw));
        if (coerced) return coerced;
      }
    } catch (e) {
      /* fall through */
    }
    var fromV1 = migrateFromV1();
    if (fromV1) return fromV1;
    return seedFry();
  }

  /** Alphabetical by word (lowercase storage). Parents list stays A–Z; play shuffle is separate. */
  function sortLibrary(library) {
    return library.slice().sort(function (a, b) {
      if (a.word < b.word) return -1;
      if (a.word > b.word) return 1;
      return 0;
    });
  }

  function saveLibrary(library) {
    state.library = sortLibrary(library);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.library));
    syncPlaySession();
  }

  function enabledWordList() {
    if (state.wordSource === "level" && state.levelId) {
      return wordsForLevel(state.levelId);
    }
    var out = [];
    for (var i = 0; i < state.library.length; i++) {
      if (state.library[i].on) out.push(state.library[i].word);
    }
    return out;
  }

  function enabledSignature(words) {
    return words
      .slice()
      .sort()
      .join("\0");
  }

  /** Fisher–Yates — never present parent/storage order as play order */
  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function clearedCount() {
    var n = 0;
    var w;
    for (w in state.cleared) {
      if (state.cleared[w]) n++;
    }
    return n;
  }

  /** Full new round: reshuffle all enabled words, reset clears */
  function beginShuffledRound() {
    var enabled = enabledWordList();
    state.enabledSig = enabledSignature(enabled);
    state.roundTotal = enabled.length;
    state.playWords = shuffleArray(enabled);
    state.cleared = {};
    state.passSteps = 0;
    state.index = 0;
  }

  /**
   * Keep session if enabled set unchanged; reshuffle when set changes.
   * Call after library edits.
   */
  function syncPlaySession() {
    var enabled = enabledWordList();
    var sig = enabledSignature(enabled);
    if (sig !== state.enabledSig) {
      beginShuffledRound();
      return;
    }
    // Drop cleared entries that are no longer enabled (shouldn't happen if sig matches)
    if (state.index >= state.playWords.length) state.index = 0;
  }

  /** Reshuffle only remaining uncleared words (loop of the list) */
  function reshuffleUncleared() {
    var remaining = [];
    var i;
    for (i = 0; i < state.playWords.length; i++) {
      if (!state.cleared[state.playWords[i]]) remaining.push(state.playWords[i]);
    }
    var done = [];
    for (i = 0; i < state.playWords.length; i++) {
      if (state.cleared[state.playWords[i]]) done.push(state.playWords[i]);
    }
    state.playWords = shuffleArray(remaining).concat(done);
    state.index = 0;
    state.passSteps = 0;
  }

  function findNextUncleared(fromIndex) {
    var n = state.playWords.length;
    if (!n) return { index: -1, wrapped: false };
    var step;
    for (step = 0; step < n; step++) {
      var i = (fromIndex + step) % n;
      if (!state.cleared[state.playWords[i]]) {
        return { index: i, wrapped: fromIndex + step >= n };
      }
    }
    return { index: -1, wrapped: false };
  }

  function updateProgressBar() {
    var wrap = els.progress || $("progress");
    var fill = els.progressFill || $("progress-fill");
    if (!wrap) return;
    var total = state.roundTotal | 0;
    var done = clearedCount();
    if (total < 0) total = 0;
    if (done > total) done = total;
    var pct = total ? Math.round((done / total) * 100) : 0;
    if (fill) fill.style.width = pct + "%";
    wrap.setAttribute("aria-valuemin", "0");
    wrap.setAttribute("aria-valuemax", String(total));
    wrap.setAttribute("aria-valuenow", String(done));
    wrap.setAttribute(
      "aria-label",
      total
        ? "Words cleared " + done + " of " + total
        : "No words turned on"
    );
    if (!total) wrap.classList.add("is-empty");
    else wrap.classList.remove("is-empty");
  }

  function clearShipSail() {
    if (state.shipTimer) {
      clearTimeout(state.shipTimer);
      state.shipTimer = null;
    }
    var ship = els.shipLayer || $("ship-layer");
    if (ship) {
      ship.classList.remove("is-on");
    }
  }

  /** v1.27: tall craft galleon + Cap'n Pip + cannons sails across during full-set confetti (pointer-events none). */
  function fireShipSail() {
    var ship = els.shipLayer || $("ship-layer");
    if (!ship) return;
    clearShipSail();
    ship.classList.add("is-on");
    /* restart sail keyframes (child holds the animation) */
    var craft = ship.querySelector(".pirate-ship");
    if (craft) {
      craft.style.animation = "none";
      void craft.offsetWidth;
      craft.style.animation = "";
    }
    state.shipTimer = setTimeout(function () {
      state.shipTimer = null;
      clearShipSail();
    }, CONFETTI_MS);
  }

  function clearConfetti() {
    if (state.confettiTimer) {
      clearTimeout(state.confettiTimer);
      state.confettiTimer = null;
    }
    clearShipSail();
    var layer = els.confettiLayer || $("confetti-layer");
    if (layer) {
      layer.classList.remove("is-on");
      layer.innerHTML = "";
    }
  }

  function fireConfetti(thenFn) {
    var layer = els.confettiLayer || $("confetti-layer");
    if (!layer) {
      if (thenFn) thenFn();
      return;
    }
    clearConfetti();
    layer.classList.add("is-on");
    fireShipSail();
    var colors = [
      "#FF6B6B",
      "#FFD93D",
      "#6BCB77",
      "#4D96FF",
      "#FF8FAB",
      "#C77DFF",
      "#FF9F1C",
      "#2EC4B6"
    ];
    var count = 120;
    var i;
    for (i = 0; i < count; i++) {
      var piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = colors[i % colors.length];
      piece.style.width = 6 + Math.random() * 8 + "px";
      piece.style.height = 8 + Math.random() * 10 + "px";
      piece.style.setProperty("--dx", Math.floor(Math.random() * 120 - 60) + "px");
      piece.style.animationDuration = 2.2 + Math.random() * 1.6 + "s";
      piece.style.animationDelay = Math.random() * 0.45 + "s";
      piece.style.transform = "rotate(" + Math.floor(Math.random() * 360) + "deg)";
      layer.appendChild(piece);
    }
    state.confettiTimer = setTimeout(function () {
      state.confettiTimer = null;
      clearConfetti();
      if (thenFn) thenFn();
    }, CONFETTI_MS);
  }

  function onCount() {
    var n = 0;
    for (var i = 0; i < state.library.length; i++) {
      if (state.library[i].on) n++;
    }
    return n;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function setJoke(text) {
    /* v1.11: play joke line removed */
    if (els.jokeLine) els.jokeLine.textContent = text || "";
  }

  function pickCharacter() {
    var pool = CHARACTERS.slice();
    if (state.lastCharId && pool.length > 1) {
      pool = pool.filter(function (c) {
        return c.id !== state.lastCharId;
      });
    }
    var chosen = pick(pool);
    state.character = chosen;
    state.lastCharId = chosen.id;
    state.skeleton = false;
    return chosen;
  }

  function hideAllCharacters() {
    var nodes = document.querySelectorAll("#hangman .character");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.add("hidden");
      nodes[i].classList.remove("celebrating", "skel-pop");
    }
  }

  function resetStageEffects() {
    if (state.loseTimer) {
      clearTimeout(state.loseTimer);
      state.loseTimer = null;
    }
    if (state.winTimer) {
      clearTimeout(state.winTimer);
      state.winTimer = null;
    }
    clearMotionTimers();
    clearSnapClasses(document);
    var hm = els.hangman || $("hangman");
    if (hm) hm.classList.remove("trap-open", "win-escape");
    var actor = $("actor");
    if (actor) {
      actor.classList.remove(
        "falling",
        "impact-ripple",
        "win-drop",
        "win-grab",
        "win-run"
      );
      actor.classList.add("hanging");
      // reflow so next hang/fall animation can restart
      void actor.getBoundingClientRect();
    }
    var dust = $("dust-puff");
    if (dust) {
      dust.classList.remove("dust-burst");
      void dust.getBoundingClientRect();
    }
    var chest = $("treasure-chest");
    if (chest) chest.classList.remove("loot-taken");
    var lootEl = $("pip-loot");
    if (lootEl) lootEl.classList.add("hidden");
    var pip = $("char-pip");
    if (pip) pip.classList.remove("celebrating");
  }
  function showLivingCharacter() {
    hideAllCharacters();
    state.skeleton = false;
    if (!state.character) return;
    var g = $("char-" + state.character.id);
    if (g) g.classList.remove("hidden");
  }

  function showSkeleton() {
    hideAllCharacters();
    state.skeleton = true;
    var sk = $("char-skeleton");
    if (sk) {
      sk.classList.remove("hidden");
      sk.classList.remove("skel-pop");
      void sk.getBoundingClientRect();
      sk.classList.add("skel-pop");
    }
  }


  function clearMotionTimers() {
    if (state.snapClearTimer) {
      clearTimeout(state.snapClearTimer);
      state.snapClearTimer = null;
    }
    if (state.rippleTimer) {
      clearTimeout(state.rippleTimer);
      state.rippleTimer = null;
    }
    if (state.rippleClearTimer) {
      clearTimeout(state.rippleClearTimer);
      state.rippleClearTimer = null;
    }
  }

  function clearSnapClasses(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll
      ? scope.querySelectorAll(".part.snap-on")
      : [];
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.remove("snap-on");
    }
  }

  /** Brief body + independent limb react after a part magnet-snaps on */
  function triggerImpactRipple() {
    var actor = $("actor");
    if (!actor || actor.classList.contains("falling")) return;
    if (
      actor.classList.contains("win-drop") ||
      actor.classList.contains("win-grab") ||
      actor.classList.contains("win-run")
    ) {
      return;
    }
    if (state.rippleTimer) {
      clearTimeout(state.rippleTimer);
      state.rippleTimer = null;
    }
    if (state.rippleClearTimer) {
      clearTimeout(state.rippleClearTimer);
      state.rippleClearTimer = null;
    }
    // Let magnet snap start, then ripple existing limbs
    state.rippleTimer = setTimeout(function () {
      state.rippleTimer = null;
      actor.classList.remove("impact-ripple");
      void actor.getBoundingClientRect();
      actor.classList.add("impact-ripple");
      state.rippleClearTimer = setTimeout(function () {
        state.rippleClearTimer = null;
        actor.classList.remove("impact-ripple");
      }, 950);
    }, 160);
  }


  function updateAttemptsBadge() {
    var el = els.attemptsFraction || $("attempts-fraction");
    if (!el) return;
    var n = state.misses | 0;
    if (n < 0) n = 0;
    if (n > MAX_MISSES) n = MAX_MISSES;
    el.textContent = n + "/" + MAX_MISSES;
    var badge = els.attemptsBadge || $("attempts-badge");
    if (badge) {
      badge.setAttribute(
        "aria-label",
        n + " of " + MAX_MISSES + " wrong guesses"
      );
    }
  }

  function updateHangman() {
    if (state.skeleton) {
      showSkeleton();
      updateAttemptsBadge();
      return;
    }

    showLivingCharacter();
    if (!state.character) {
      updateAttemptsBadge();
      return;
    }
    var g = $("char-" + state.character.id);
    if (!g) {
      updateAttemptsBadge();
      return;
    }

    var newlyShown = null;
    for (var i = 1; i <= MAX_MISSES; i++) {
      var part = g.querySelector(".part-" + i);
      if (!part) continue;
      if (i <= state.misses) {
        if (part.classList.contains("hidden")) {
          newlyShown = part;
          part.classList.remove("hidden");
          part.classList.remove("snap-on");
          void part.getBoundingClientRect();
          part.classList.add("snap-on");
        }
      } else {
        part.classList.add("hidden");
        part.classList.remove("snap-on");
      }
    }

    if (newlyShown) {
      if (state.snapClearTimer) clearTimeout(state.snapClearTimer);
      state.snapClearTimer = setTimeout(function () {
        state.snapClearTimer = null;
        clearSnapClasses(g);
      }, 450);
      triggerImpactRipple();
    }

    updateAttemptsBadge();
  }

  function setCharacterHook() {
    /* v1.11: character hook removed from play view */
    if (!els.characterHook) return;
  }

  function charName() {
    return state.character ? state.character.name : "Your buddy";
  }

  function renderBlanks() {
    var wrap = els.wordBlanks;
    wrap.innerHTML = "";
    var letters = state.word.split("");
    for (var i = 0; i < letters.length; i++) {
      var ch = letters[i];
      var cell = document.createElement("div");
      if (ch === " ") {
        cell.className = "blank space";
        cell.innerHTML = "&nbsp;";
      } else if (/[a-z]/.test(ch)) {
        cell.className = "blank";
        if (state.guessed[ch] || (state.over && !state.won)) {
          cell.textContent = ch.toUpperCase();
          cell.classList.add("filled");
          if (state.guessed[ch]) cell.classList.add("pop");
        } else {
          cell.textContent = "";
        }
      } else {
        cell.className = "blank filled";
        cell.textContent = ch;
        cell.style.borderBottomColor = "transparent";
      }
      wrap.appendChild(cell);
    }
  }

  function lettersInWord() {
    var set = {};
    for (var i = 0; i < state.word.length; i++) {
      var ch = state.word[i];
      if (/[a-z]/.test(ch)) set[ch] = true;
    }
    return set;
  }

  function allLettersGuessed() {
    var need = lettersInWord();
    for (var ch in need) {
      if (!state.guessed[ch]) return false;
    }
    return Object.keys(need).length > 0;
  }

  function buildKeyboard() {
    var kb = els.keyboard;
    kb.innerHTML = "";
    var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (var i = 0; i < alphabet.length; i++) {
      (function (letter) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "key";
        btn.textContent = letter;
        btn.dataset.letter = letter.toLowerCase();
        btn.setAttribute("aria-label", "Letter " + letter);
        btn.addEventListener("click", function () {
          onGuess(letter.toLowerCase());
        });
        kb.appendChild(btn);
      })(alphabet[i]);
    }
  }

  function syncKeyboard() {
    var keys = els.keyboard.querySelectorAll(".key");
    for (var i = 0; i < keys.length; i++) {
      var btn = keys[i];
      var L = btn.dataset.letter;
      btn.classList.remove("correct", "wrong");
      btn.disabled = false;
      if (state.guessed[L]) {
        btn.disabled = true;
        if (state.word.indexOf(L) !== -1) btn.classList.add("correct");
        else btn.classList.add("wrong");
      }
      if (state.over || state.emptyPool) btn.disabled = true;
    }
  }

  function pickWinEmoji() {
    var emojis = ["🎉", "⭐", "🏴‍☠️", "🏆", "✨", "🥳"];
    return emojis[Math.floor(Math.random() * emojis.length)] || "🎉";
  }

  function buildWinSparkles(container) {
    if (!container) return;
    container.innerHTML = "";
    var glyphs = ["✨", "⭐", "🌟", "💛", "✦"];
    var spots = [
      { top: "2%", left: "8%" },
      { top: "6%", right: "10%" },
      { top: "28%", left: "-2%" },
      { top: "32%", right: "-2%" },
      { top: "58%", left: "4%" },
      { top: "62%", right: "6%" },
      { bottom: "10%", left: "18%" },
      { bottom: "8%", right: "16%" },
      { top: "-4%", left: "42%" },
      { bottom: "-2%", left: "48%" }
    ];
    for (var i = 0; i < spots.length; i++) {
      var s = document.createElement("span");
      s.className = "spark";
      s.textContent = glyphs[i % glyphs.length];
      s.style.animationDelay = (i * 0.09) + "s";
      var spot = spots[i];
      if (spot.top != null) s.style.top = spot.top;
      if (spot.bottom != null) s.style.bottom = spot.bottom;
      if (spot.left != null) s.style.left = spot.left;
      if (spot.right != null) s.style.right = spot.right;
      container.appendChild(s);
    }
  }

  /* ---- US pronunciation via Web Speech API (no third-party audio) ---- */
  var speakUs = {
    preferred: null,
    voicesReady: false
  };

  function pickUsVoice() {
    if (!window.speechSynthesis) return null;
    var voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;
    speakUs.voicesReady = true;
    var i;
    var v;
    /* Prefer explicit en-US voices */
    for (i = 0; i < voices.length; i++) {
      v = voices[i];
      if (/^en-US$/i.test(v.lang || "")) {
        speakUs.preferred = v;
        return v;
      }
    }
    for (i = 0; i < voices.length; i++) {
      v = voices[i];
      if (/^en[-_]?US/i.test(v.lang || "")) {
        speakUs.preferred = v;
        return v;
      }
    }
    for (i = 0; i < voices.length; i++) {
      v = voices[i];
      if (/en/i.test(v.lang || "") && /us|american/i.test(v.name || "")) {
        speakUs.preferred = v;
        return v;
      }
    }
    for (i = 0; i < voices.length; i++) {
      v = voices[i];
      if (/^en/i.test(v.lang || "")) {
        speakUs.preferred = v;
        return v;
      }
    }
    speakUs.preferred = voices[0] || null;
    return speakUs.preferred;
  }

  function ensureSpeechVoices() {
    if (!window.speechSynthesis) return;
    pickUsVoice();
    if (typeof window.speechSynthesis.addEventListener === "function") {
      window.speechSynthesis.addEventListener("voiceschanged", function () {
        pickUsVoice();
      });
    } else {
      window.speechSynthesis.onvoiceschanged = function () {
        pickUsVoice();
      };
    }
  }

  function stopSpeakingWord() {
    var btn = els.btnSpeakUs || $("btn-speak-us");
    if (btn) btn.classList.remove("is-speaking");
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) { /* ignore */ }
    }
  }

  /**
   * Speak the current word in US English (Web Speech API).
   * Independent of game SFX mute — pronunciation is intentional learning audio.
   * Tap replay is reliable on iOS (user gesture). Auto-speak on popup show is
   * best-effort (may need prior unlock from gameplay taps).
   */
  function speakCurrentWordUS() {
    var word = state.word;
    if (!word) return;
    var btn = els.btnSpeakUs || $("btn-speak-us");
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      if (btn) {
        btn.setAttribute("aria-label", "Speech not supported on this device");
      }
      return;
    }

    /* Cancel any prior utterance, then speak the current word. */
    try {
      window.speechSynthesis.cancel();
    } catch (e) { /* ignore */ }

    var voice = speakUs.preferred || pickUsVoice();
    var utter = new window.SpeechSynthesisUtterance(String(word));
    utter.lang = "en-US";
    utter.rate = 0.92;
    utter.pitch = 1;
    if (voice) {
      utter.voice = voice;
      if (voice.lang) utter.lang = voice.lang;
    }

    if (btn) btn.classList.add("is-speaking");
    utter.onend = function () {
      if (btn) btn.classList.remove("is-speaking");
    };
    utter.onerror = function () {
      if (btn) btn.classList.remove("is-speaking");
    };

    try {
      window.speechSynthesis.speak(utter);
      /* iOS sometimes needs a nudge if paused after cancel */
      if (window.speechSynthesis.paused) {
        try { window.speechSynthesis.resume(); } catch (e2) { /* ignore */ }
      }
    } catch (err) {
      if (btn) btn.classList.remove("is-speaking");
    }
  }

  function fillOutcomeCard() {
    var raw = displayWord(state.word);
    var shown = raw === "I" ? "I" : String(raw).toUpperCase();
    if (els.outcomeWord) {
      els.outcomeWord.textContent = shown;
    }

    var speakBtn = els.btnSpeakUs || $("btn-speak-us");
    if (speakBtn) {
      speakBtn.setAttribute(
        "aria-label",
        "Hear pronunciation of " + (shown || "word")
      );
      speakBtn.classList.remove("is-speaking");
    }

    var card = els.outcomeCard || $("outcome-card");
    var title = els.outcomeTitle || $("outcome-title");
    var emoji = els.outcomeEmoji || $("outcome-emoji");
    var sparkles = els.outcomeSparkles || $("outcome-sparkles");
    var won = !!state.won;

    if (els.outcome) {
      els.outcome.classList.toggle("is-win", won);
      /* v1.26–v1.30: text content is the word (+ speak icon); no cheer title */
      els.outcome.setAttribute("aria-labelledby", "outcome-word");
    }
    if (card) {
      card.classList.toggle("win-word-card", won);
      card.classList.toggle("lose-word-card", !won);
    }
    /* v1.26: never show cheer sentence — keep title node hidden for layout stability */
    if (title) {
      title.textContent = "";
      title.classList.add("hidden");
    }
    if (emoji) {
      if (won) {
        emoji.textContent = pickWinEmoji();
        emoji.classList.remove("hidden");
        emoji.setAttribute("aria-hidden", "true");
      } else {
        emoji.textContent = "";
        emoji.classList.add("hidden");
      }
    }
    if (sparkles) {
      if (won) buildWinSparkles(sparkles);
      else sparkles.innerHTML = "";
    }
  }

  function revealOutcomePopup() {
    els.outcome.classList.remove("hidden");
    syncKeyboard();
    /* v1.30: auto-speak the word when win/lose popup appears (same path as icon tap).
       Ignores SFX mute. Best-effort on iOS if speech was unlocked by earlier gameplay taps. */
    speakCurrentWordUS();
  }

  function runLoseSequence() {
    playLoseSound();
    // 1) Morph living pirate → silly cartoon skeleton
    showSkeleton();
    renderBlanks();
    syncKeyboard();

    var hm = els.hangman || $("hangman");
    var actor = $("actor");

    // 2) After morph, open trap door
    state.loseTimer = setTimeout(function () {
      if (hm) hm.classList.add("trap-open");

      // 3) Detach from noose → skeleton drops ALL THE WAY DOWN + dust puff
      state.loseTimer = setTimeout(function () {
        if (actor) {
          actor.classList.remove("falling", "hanging");
          void actor.getBoundingClientRect();
          actor.classList.add("falling");
        }
        var dust = $("dust-puff");
        if (dust) {
          dust.classList.remove("dust-burst");
          void dust.getBoundingClientRect();
          dust.classList.add("dust-burst");
        }

        // 4) After fall/dust complete, wait LOSE_POPUP_DELAY_MS, then popup
        var afterAnimMs = Math.max(LOSE_FALL_MS, LOSE_DUST_MS);
        state.loseTimer = setTimeout(function () {
          state.loseTimer = setTimeout(function () {
            state.loseTimer = null;
            fillOutcomeCard();
            revealOutcomePopup();
          }, LOSE_POPUP_DELAY_MS);
        }, afterAnimMs);
      }, LOSE_TRAP_MS);
    }, LOSE_MORPH_MS);
  }

  /** v1.26–v1.30: free+drop → grab → run off → wait 3s → celebratory word popup (word + auto-speak; no cheer sentence) */
  function runWinSequence() {
    playWinSound();
    resetStageEffects();
    state.skeleton = false;
    showLivingCharacter();

    var pip = $("char-pip");
    if (pip) {
      for (var i = 1; i <= MAX_MISSES; i++) {
        var part = pip.querySelector(".part-" + i);
        if (part) part.classList.remove("hidden");
      }
      pip.classList.remove("celebrating");
    }

    var hm = els.hangman || $("hangman");
    var actor = $("actor");
    var chest = $("treasure-chest");
    var lootEl = $("pip-loot");

    if (hm) hm.classList.add("win-escape");

    // Popup after animation + delay (same card as lose)
    els.outcome.classList.add("hidden");

    // 1) Drop from noose onto plank
    if (actor) {
      actor.classList.remove(
        "hanging",
        "falling",
        "win-drop",
        "win-grab",
        "win-run"
      );
      void actor.getBoundingClientRect();
      actor.classList.add("win-drop");
    }

    state.winTimer = setTimeout(function () {
      // 2) Grab loot — empty beach chest, show carried loot
      if (chest) chest.classList.add("loot-taken");
      if (lootEl) lootEl.classList.remove("hidden");
      if (actor) {
        actor.classList.remove("win-drop");
        void actor.getBoundingClientRect();
        actor.classList.add("win-grab");
      }
      state.winTimer = setTimeout(function () {
        // 3) Silly run off-screen with the loot
        if (actor) {
          actor.classList.remove("win-grab");
          void actor.getBoundingClientRect();
          actor.classList.add("win-run");
        }
        state.winTimer = setTimeout(function () {
          // 4) After run-off, wait WIN_POPUP_DELAY_MS, then same word popup as lose
          state.winTimer = setTimeout(function () {
            state.winTimer = null;
            fillOutcomeCard();
            revealOutcomePopup();
          }, WIN_POPUP_DELAY_MS);
        }, WIN_RUN_MS);
      }, WIN_GRAB_MS);
    }, WIN_DROP_MS);
  }

  function showOutcome(won) {
    state.over = true;
    state.won = won;
    syncKeyboard();

    if (won) {
      runWinSequence();
    } else {
      runLoseSequence();
    }
  }

  function onGuess(letter) {
    unlockAudio();
    if (state.over || state.emptyPool || state.guessed[letter]) return;
    state.guessed[letter] = true;

    if (state.word.indexOf(letter) !== -1) {
      playCorrectLetter();
      renderBlanks();
      syncKeyboard();
      if (allLettersGuessed()) showOutcome(true);
    } else {
      state.misses += 1;
      playPirateMiss();
      updateHangman();
      syncKeyboard();
      if (state.misses >= MAX_MISSES) showOutcome(false);
    }
  }

  function showEmptyPoolUI() {
    state.emptyPool = true;
    state.word = "";
    state.guessed = {};
    state.misses = 0;
    state.over = true;
    state.won = false;
    els.outcome.classList.add("hidden");
    updateProgressBar();
    els.wordBlanks.innerHTML = "";
    state.skeleton = false;
    resetStageEffects();
    if (!state.character) pickCharacter();
    updateHangman();
    // hide body parts when empty
    state.misses = 0;
    updateHangman();
    syncKeyboard();
    if (els.emptyBanner) els.emptyBanner.classList.remove("hidden");
  }

  function hideEmptyBanner() {
    if (els.emptyBanner) els.emptyBanner.classList.add("hidden");
  }

  function setBuddyCaption() {
    /* v1.11: buddy caption removed from play view */
  }

  function startRound() {
    stopSpeakingWord();
    els.outcome.classList.add("hidden");
    els.outcome.classList.remove("is-win");
    var card = els.outcomeCard || $("outcome-card");
    if (card) {
      card.classList.remove("win-word-card");
      card.classList.add("lose-word-card");
    }
    syncPlaySession();

    if (!state.playWords.length || !state.roundTotal) {
      showEmptyPoolUI();
      return;
    }

    state.emptyPool = false;
    hideEmptyBanner();

    // Prefer current index if still uncleared; otherwise next uncleared
    if (state.cleared[state.playWords[state.index]]) {
      var pick = findNextUncleared(state.index);
      if (pick.index === -1) {
        beginShuffledRound();
      } else {
        state.index = pick.index;
      }
    }
    if (state.index >= state.playWords.length) state.index = 0;

    state.word = state.playWords[state.index];
    state.guessed = {};
    state.misses = 0;
    state.over = false;
    state.won = false;
    state.skeleton = false;
    resetStageEffects();
    pickCharacter();
    updateProgressBar();
    updateHangman();
    renderBlanks();
    syncKeyboard();
  }

  /** After a loss (or manual Next): advance without counting a clear */
  function nextWord() {
    syncPlaySession();
    if (!state.playWords.length || !state.roundTotal) {
      startRound();
      return;
    }

    var found = findNextUncleared(state.index + 1);
    if (found.index === -1) {
      beginShuffledRound();
      startRound();
      return;
    }

    // Looping the list → reshuffle remaining uncleared so order is never fixed
    if (found.wrapped) {
      reshuffleUncleared();
      found = findNextUncleared(0);
      if (found.index === -1) {
        beginShuffledRound();
        startRound();
        return;
      }
    }

    state.index = found.index;
    startRound();
  }

  /** After a win animation: mark cleared; confetti when full set won */
  function advanceAfterWin() {
    var wonWord = state.word;
    syncPlaySession();
    if (!state.playWords.length || !state.roundTotal) {
      startRound();
      return;
    }

    // Count win only if the word is still in this round's enabled set
    if (wonWord && state.playWords.indexOf(wonWord) !== -1) {
      state.cleared[wonWord] = true;
    }
    updateProgressBar();

    if (clearedCount() >= state.roundTotal) {
      fireConfetti(function () {
        beginShuffledRound();
        startRound();
      });
      return;
    }

    var found = findNextUncleared(state.index + 1);
    if (found.index === -1) {
      beginShuffledRound();
      startRound();
      return;
    }
    if (found.wrapped) {
      reshuffleUncleared();
      found = findNextUncleared(0);
      if (found.index === -1) {
        beginShuffledRound();
        startRound();
        return;
      }
    }
    state.index = found.index;
    state.passSteps = 0;
    startRound();
  }

  function hideAllScreens() {
    ["screen-home","screen-map","screen-play","screen-island","screen-spell","screen-words"].forEach(function (id) {
      var el = $(id);
      if (el) el.classList.add("hidden");
    });
    if (els.parentGate) els.parentGate.classList.add("hidden");
  }

  function showPlay() {
    hideAllScreens();
    if (els.screenPlay) els.screenPlay.classList.remove("hidden");
    state.screen = "play";
  }

  function showWords() {
    hideAllScreens();
    if (els.screenWords) els.screenWords.classList.remove("hidden");
    state.screen = "words";
    renderParentsLevels();
    renderWordList();
  }

  /* Parent gate: easy single-digit × single-digit (avoid hardest facts) */
  var gateA = 0;
  var gateB = 0;
  var gateExpected = 0;
  var gateDigits = "";

  function isHardFact(a, b) {
    /* Skip 6–9 × 6–9 (7×8, 8×9, etc.) — keep adult-easy, kid-proof facts */
    return Math.min(a, b) >= 6 && Math.max(a, b) >= 6;
  }

  function newGateProblem() {
    var a, b, guard = 0;
    do {
      a = 2 + Math.floor(Math.random() * 8); /* 2–9 */
      b = 2 + Math.floor(Math.random() * 8);
      guard++;
    } while (isHardFact(a, b) && guard < 40);
    if (isHardFact(a, b)) {
      /* fallback ultra-easy */
      a = 2 + Math.floor(Math.random() * 4); /* 2–5 */
      b = 2 + Math.floor(Math.random() * 4);
    }
    gateA = a;
    gateB = b;
    gateExpected = a * b;
    gateDigits = "";
    renderGateUI("");
  }

  function renderGateUI(feedback) {
    if (els.gateProblem) {
      els.gateProblem.textContent = gateA + " × " + gateB + " = ?";
    }
    if (els.gateAnswer) {
      els.gateAnswer.textContent = gateDigits.length ? gateDigits : "·";
    }
    if (els.gateFeedback) {
      els.gateFeedback.textContent = feedback || "";
      els.gateFeedback.classList.toggle("is-ok", feedback === "Nice!");
    }
  }

  function appendGateDigit(d) {
    if (gateDigits.length >= 2) return; /* products are at most 2 digits for easy facts */
    gateDigits += String(d);
    renderGateUI("");
    /* Auto-check when digit count matches the expected product */
    if (gateDigits.length === String(gateExpected).length) {
      checkGateAnswer();
    }
  }

  function backspaceGate() {
    gateDigits = gateDigits.slice(0, -1);
    renderGateUI("");
  }

  function checkGateAnswer() {
    if (!gateDigits.length) {
      renderGateUI("Tap the answer on the pad.");
      return;
    }
    var n = parseInt(gateDigits, 10);
    if (n === gateExpected) {
      renderGateUI("Nice!");
      showWords();
      return;
    }
    /* Wrong — gentle retry with a fresh problem */
    newGateProblem();
    renderGateUI("Not quite — try this one!");
  }

  function openParentGate() {
    unlockAudio();
    newGateProblem();
    els.parentGate.classList.remove("hidden");
  }

  function closeParentGate() {
    els.parentGate.classList.add("hidden");
    gateDigits = "";
  }

  function updateCounts() {
    var total = state.library.length;
    var on = onCount();
    if (els.wordCount) {
      els.wordCount.textContent = on + " of " + total + " on";
    }
  }

  function renderWordList() {
    state.library = sortLibrary(state.library);
    updateCounts();
    els.wordList.innerHTML = "";
    state.library.forEach(function (entry, idx) {
      var li = document.createElement("li");
      if (!entry.on) li.classList.add("off");

      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "toggle-btn" + (entry.on ? " is-on" : " is-off");
      toggle.setAttribute("role", "switch");
      toggle.setAttribute("aria-checked", entry.on ? "true" : "false");
      toggle.setAttribute(
        "aria-label",
        (entry.on ? "Turn off " : "Turn on ") + displayWord(entry.word)
      );
      toggle.innerHTML =
        '<span class="toggle-knob" aria-hidden="true"></span>' +
        '<span class="toggle-label">' +
        (entry.on ? "On" : "Off") +
        "</span>";
      toggle.addEventListener("click", function () {
        var next = state.library.slice();
        next[idx] = { word: entry.word, on: !entry.on };
        saveLibrary(next);
        renderWordList();
      });

      var span = document.createElement("span");
      span.className = "word-text";
      span.textContent = displayWord(entry.word);

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "icon-btn";
      editBtn.textContent = "Edit";
      editBtn.setAttribute("aria-label", "Edit " + displayWord(entry.word));

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "icon-btn danger";
      delBtn.textContent = "Delete";
      delBtn.setAttribute("aria-label", "Delete " + displayWord(entry.word));

      editBtn.addEventListener("click", function () {
        beginEdit(li, idx, entry.word);
      });
      delBtn.addEventListener("click", function () {
        if (
          !confirm(
            "Delete “" + displayWord(entry.word) + "” from the library?"
          )
        )
          return;
        var next = state.library.slice();
        next.splice(idx, 1);
        if (!next.length) next = seedFry();
        saveLibrary(next);
        renderWordList();
      });

      li.appendChild(toggle);
      li.appendChild(span);
      li.appendChild(editBtn);
      li.appendChild(delBtn);
      els.wordList.appendChild(li);
    });
  }

  function beginEdit(li, idx, word) {
    li.innerHTML = "";
    li.classList.remove("off");
    var input = document.createElement("input");
    input.className = "edit-input";
    input.value = word;
    input.maxLength = 24;
    var save = document.createElement("button");
    save.type = "button";
    save.className = "icon-btn";
    save.textContent = "Save";
    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "icon-btn";
    cancel.textContent = "Cancel";
    save.addEventListener("click", function () {
      var n = normalizeWord(input.value);
      if (!isValidWord(n)) {
        alert("Please enter a real spelling word (letters only).");
        return;
      }
      var next = state.library.slice();
      var dup = false;
      for (var i = 0; i < next.length; i++) {
        if (i !== idx && next[i].word === n) {
          dup = true;
          break;
        }
      }
      if (dup) {
        alert("That word is already in the library.");
        return;
      }
      next[idx] = { word: n, on: next[idx].on };
      saveLibrary(next);
      renderWordList();
    });
    cancel.addEventListener("click", renderWordList);
    li.appendChild(input);
    li.appendChild(save);
    li.appendChild(cancel);
    input.focus();
  }

  function addWordsFromText(text) {
    var added = parseWordList(text);
    if (!added.length) {
      alert(
        "No words found. Try letters only (a–z), separated by commas or new lines. Single letters like a and I are OK."
      );
      return 0;
    }
    var next = state.library.slice();
    var seen = {};
    next.forEach(function (entry) {
      seen[entry.word] = true;
    });
    var count = 0;
    added.forEach(function (w) {
      if (!seen[w]) {
        next.push({ word: w, on: true });
        seen[w] = true;
        count++;
      }
    });
    saveLibrary(next);
    return count;
  }

  function setAllOn(on) {
    var next = state.library.map(function (entry) {
      return { word: entry.word, on: !!on };
    });
    saveLibrary(next);
    renderWordList();
  }

  function bind() {
    els.btnParents.addEventListener("click", openParentGate);
    if (els.btnMute) {
      els.btnMute.addEventListener("click", function (e) {
        e.preventDefault();
        /* toggleMute unmutes with audible blip in this same tap */
        toggleMute();
      });
    }
    if (els.soundHint) {
      els.soundHint.addEventListener("click", function (e) {
        e.preventDefault();
        playUnmuteBlip();
        unlockAudio();
      });
    }
    els.gateCancel.addEventListener("click", closeParentGate);
    if (els.gatePad) {
      els.gatePad.addEventListener("click", function (e) {
        var t = e.target.closest("button");
        if (!t || !els.gatePad.contains(t)) return;
        if (t.id === "gate-backspace") {
          backspaceGate();
          return;
        }
        if (t.id === "gate-check") {
          checkGateAnswer();
          return;
        }
        var dig = t.getAttribute("data-digit");
        if (dig != null) appendGateDigit(dig);
      });
    }
    els.btnBackPlay.addEventListener("click", function () {
      showHome();
    });
    els.btnNext.addEventListener("click", function () {
      stopSpeakingWord();
      if (state.won) advanceAfterWin();
      else nextWord();
    });
    if (els.btnSpeakUs) {
      els.btnSpeakUs.addEventListener("click", function (e) {
        if (e && e.preventDefault) e.preventDefault();
        /* Keep this synchronous in the tap so iOS unlocks speechSynthesis */
        speakCurrentWordUS();
      });
    }

    els.addOneForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var n = addWordsFromText(els.wordInput.value);
      els.wordInput.value = "";
      if (n) renderWordList();
    });

    els.pasteForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var n = addWordsFromText(els.pasteInput.value);
      els.pasteInput.value = "";
      if (n) renderWordList();
    });

    if (els.btnTurnAllOn) {
      els.btnTurnAllOn.addEventListener("click", function () {
        setAllOn(true);
      });
    }
    if (els.btnTurnAllOff) {
      els.btnTurnAllOff.addEventListener("click", function () {
        setAllOn(false);
      });
    }

    els.btnResetSamples.addEventListener("click", function () {
      if (
        !confirm(
          "Replace the library with the Fry 100 sight words (all On)?"
        )
      )
        return;
      saveLibrary(seedFry());
      beginShuffledRound();
      renderWordList();
    });

    window.addEventListener("keydown", function (e) {
      var gateOpen = els.parentGate && !els.parentGate.classList.contains("hidden");
      if (gateOpen) {
        if (e.key >= "0" && e.key <= "9") {
          e.preventDefault();
          appendGateDigit(e.key);
        } else if (e.key === "Backspace") {
          e.preventDefault();
          backspaceGate();
        } else if (e.key === "Enter") {
          e.preventDefault();
          checkGateAnswer();
        } else if (e.key === "Escape") {
          e.preventDefault();
          closeParentGate();
        }
        return;
      }
      if (!els.screenPlay || els.screenPlay.classList.contains("hidden")) return;
      if (state.over || state.emptyPool) return;
      var k = e.key.toLowerCase();
      if (/^[a-z]$/.test(k)) onGuess(k);
    });
  }

  function cacheEls() {
    els.screenPlay = $("screen-play");
    els.screenWords = $("screen-words");
    els.parentGate = $("parent-gate");
    els.progress = $("progress");
    els.progressFill = $("progress-fill");
    els.confettiLayer = $("confetti-layer");
    els.shipLayer = $("ship-layer");
    els.jokeLine = $("joke-line");
    els.buddy = $("buddy"); // legacy id unused; characters live under #hangman
    els.buddyCaption = $("buddy-caption");
    els.characterHook = $("character-hook");
    els.hangman = $("hangman");
    els.attemptsBadge = $("attempts-badge");
    els.attemptsFraction = $("attempts-fraction");
    els.wordBlanks = $("word-blanks");
    els.keyboard = $("keyboard");
        els.outcome = $("outcome");
    els.outcomeCard = $("outcome-card");
    els.outcomeWord = $("outcome-word");
    els.btnSpeakUs = $("btn-speak-us");
    els.outcomeTitle = $("outcome-title");
    els.outcomeEmoji = $("outcome-emoji");
    els.outcomeSparkles = $("outcome-sparkles");
    els.btnNext = $("btn-next");
    els.btnParents = $("btn-parents");
    els.btnMute = $("btn-mute");
    els.soundHint = $("sound-unlock-hint");
    els.gateCancel = $("gate-cancel");
    els.gateProblem = $("gate-problem");
    els.gateAnswer = $("gate-answer");
    els.gateFeedback = $("gate-feedback");
    els.gatePad = $("gate-pad");
    els.gateCheck = $("gate-check");
    els.btnBackPlay = $("btn-back-play");
    els.addOneForm = $("add-one-form");
    els.wordInput = $("word-input");
    els.pasteForm = $("paste-form");
    els.pasteInput = $("paste-input");
    els.wordList = $("word-list");
    els.wordCount = $("word-count");
    els.btnResetSamples = $("btn-reset-samples");
    els.btnTurnAllOn = $("btn-turn-all-on");
    els.btnTurnAllOff = $("btn-turn-all-off");
    els.emptyBanner = $("empty-pool-banner");
  }


  /* ===== v2.0: settings, levels, navigation, Word Island bridge ===== */

  var UNIT_COLORS = {
    1: { name: "blue", fill: "#5B9BD5", deep: "#2E6FA8" },
    2: { name: "green", fill: "#6BBF6B", deep: "#3A8F3A" },
    3: { name: "gold", fill: "#E0B040", deep: "#B88418" },
    4: { name: "purple", fill: "#9B7AD8", deep: "#6A4AAD" },
    5: { name: "rose", fill: "#E07A9A", deep: "#B84868" }
  };

  function defaultSettings() {
    return {
      unit: 1,
      week: 1,
      wordMode: "both", /* both | sight | spelling */
      spellMode: "spelling", /* Parrot Spell: spelling | both */
      customByLevel: {} /* levelId -> [words] */
    };
  }

  function defaultProgress() {
    return { hangman: {}, island: {}, spell: {} };
  }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        var d = defaultSettings();
        return {
          unit: Math.min(5, Math.max(1, parseInt(p.unit, 10) || 1)),
          week: Math.min(6, Math.max(1, parseInt(p.week, 10) || 1)),
          wordMode: p.wordMode === "sight" || p.wordMode === "spelling" ? p.wordMode : "both",
          spellMode: p.spellMode === "both" ? "both" : "spelling",
          customByLevel: p.customByLevel && typeof p.customByLevel === "object" ? p.customByLevel : {}
        };
      }
    } catch (e) {}
    return defaultSettings();
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    } catch (e) {}
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(PROGRESS_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        return {
          hangman: p.hangman && typeof p.hangman === "object" ? p.hangman : {},
          island: p.island && typeof p.island === "object" ? p.island : {},
          spell: p.spell && typeof p.spell === "object" ? p.spell : {}
        };
      }
    } catch (e) {}
    return defaultProgress();
  }

  function saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
    } catch (e) {}
  }

  function allLevels() {
    return (window.WORD_BUDDY_LEVELS && window.WORD_BUDDY_LEVELS.levels) || [];
  }

  function findLevel(levelId) {
    var levels = allLevels();
    for (var i = 0; i < levels.length; i++) {
      if (levels[i].id === levelId) return levels[i];
    }
    return null;
  }

  function levelIdFor(unit, week) {
    return "u" + unit + "w" + week;
  }

  function dedupeWords(list) {
    var seen = {};
    var out = [];
    list.forEach(function (w) {
      var n = normalizeWord(w);
      if (!isValidWord(n) || seen[n]) return;
      seen[n] = true;
      out.push(n === "i" ? "i" : n);
    });
    return out;
  }

  function wordsForLevel(levelId, modeOverride) {
    var L = findLevel(levelId);
    if (!L) return [];
    var mode = modeOverride || (state.settings && state.settings.wordMode) || "both";
    var words = [];
    if (mode !== "spelling") words = words.concat(L.sightWords || []);
    if (mode !== "sight") words = words.concat(L.spellingWords || []);
    var custom = (state.settings && state.settings.customByLevel && state.settings.customByLevel[levelId]) || [];
    words = words.concat(custom);
    return dedupeWords(words);
  }

  /* Parrot Spell: spelling words by default; Parents can add sight words */
  function spellWordsForLevel(levelId) {
    var m = (state.settings && state.settings.spellMode) === "both" ? "both" : "spelling";
    return wordsForLevel(levelId, m);
  }

  function libraryWords() {
    var out = [];
    for (var i = 0; i < state.library.length; i++) {
      if (state.library[i].on) out.push(state.library[i].word);
    }
    return out;
  }

  function markLevelComplete(game, levelId) {
    if (!state.progress) state.progress = defaultProgress();
    if (!state.progress[game]) state.progress[game] = {};
    state.progress[game][levelId] = true;
    saveProgress();
    renderLevelMap();
  }

  function isLevelComplete(game, levelId) {
    return !!(state.progress && state.progress[game] && state.progress[game][levelId]);
  }

  function nextHighlightId() {
    var s = state.settings || defaultSettings();
    return levelIdFor(s.unit, s.week);
  }

  function showHome() {
    stopSpeakingWord();
    if (window.SpellGame && window.SpellGame.stop) window.SpellGame.stop();
    hideAllScreens();
    var home = $("screen-home");
    if (home) home.classList.remove("hidden");
    state.screen = "home";
    state.game = null;
  }

  function showMap(game) {
    stopSpeakingWord();
    if (window.SpellGame && window.SpellGame.stop) window.SpellGame.stop();
    state.game = game || state.game || "hangman";
    hideAllScreens();
    var map = $("screen-map");
    if (map) map.classList.remove("hidden");
    state.screen = "map";
    var title = $("map-title");
    if (title) {
      title.textContent = state.game === "island" ? "Word Island — pick a week" :
        (state.game === "spell" ? "Parrot Spell — pick a week" : "Hangman — pick a week");
    }
    var custom = $("map-custom");
    if (custom) {
      custom.classList.toggle("hidden", state.game !== "hangman" && state.game !== "spell");
    }
    renderLevelMap();
  }

  var MAP_GAMES = [
    { id: "hangman", name: "Hangman" },
    { id: "island", name: "Word Island" },
    { id: "spell", name: "Parrot Spell" }
  ];

  function renderLevelMap() {
    var box = $("level-map");
    if (!box) return;
    box.innerHTML = "";
    var highlight = nextHighlightId();
    var game = state.game || "hangman";
    for (var unit = 1; unit <= 5; unit++) {
      var island = document.createElement("section");
      island.className = "map-unit unit-" + unit;
      island.setAttribute("role", "listitem");
      var color = UNIT_COLORS[unit];
      island.style.setProperty("--unit-fill", color.fill);
      island.style.setProperty("--unit-deep", color.deep);
      var head = document.createElement("h3");
      head.className = "map-unit-title";
      head.textContent = "Unit " + unit;
      island.appendChild(head);
      var row = document.createElement("div");
      row.className = "map-weeks";
      for (var week = 1; week <= 6; week++) {
        var id = levelIdFor(unit, week);
        var L = findLevel(id);
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "map-week";
        btn.setAttribute("data-level", id);
        if (id === highlight) btn.classList.add("is-next");
        if (isLevelComplete(game, id)) btn.classList.add("is-done");
        /* Big star = this game; tiny pips = which of the 3 games cleared this week */
        var pips = MAP_GAMES.map(function (g) {
          var on = isLevelComplete(g.id, id);
          return '<span class="map-pip pip-' + g.id + (on ? " is-on" : "") + (g.id === game ? " is-current" : "") +
            '" title="' + g.name + (on ? " ★" : "") + '"></span>';
        }).join("");
        btn.innerHTML =
          '<span class="map-week-num">' + week + "</span>" +
          (isLevelComplete(game, id) ? '<span class="map-star" aria-label="done">★</span>' : "") +
          (L ? '<span class="map-pattern">' + escapeHtml(L.pattern) + "</span>" : "") +
          '<span class="map-pips" aria-hidden="true">' + pips + "</span>";
        btn.addEventListener("click", (function (levelId) {
          return function () {
            unlockAudio();
            startGameLevel(state.game, levelId);
          };
        })(id));
        row.appendChild(btn);
      }
      island.appendChild(row);
      box.appendChild(island);
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function startGameLevel(game, levelId) {
    state.game = game;
    state.levelId = levelId;
    state.wordSource = "level";
    var label = "";
    var L = findLevel(levelId);
    if (L) label = "Unit " + L.unit + " · Week " + L.week;
    if (game === "hangman") {
      var hl = $("hangman-level-label");
      if (hl) hl.textContent = label;
      beginShuffledRound();
      showPlay();
      startRound();
    } else if (game === "island") {
      hideAllScreens();
      var isl = $("screen-island");
      if (isl) isl.classList.remove("hidden");
      state.screen = "island";
      if (window.IslandGame) {
        window.IslandGame.startLevel(levelId);
        /* Speak synchronously in this tap so iOS unlocks speech */
        window.IslandGame.speakCurrent();
      }
    } else if (game === "spell") {
      showSpellScreen();
      if (window.SpellGame) {
        window.SpellGame.startLevel(levelId);
        /* Speak synchronously in this tap so iOS unlocks speech */
        window.SpellGame.speakCurrent();
      }
    }
  }

  function showSpellScreen() {
    hideAllScreens();
    var scr = $("screen-spell");
    if (scr) scr.classList.remove("hidden");
    state.screen = "spell";
  }

  function startSpellLibrary() {
    state.game = "spell";
    state.levelId = null;
    showSpellScreen();
    if (window.SpellGame) {
      window.SpellGame.startLibrary();
      window.SpellGame.speakCurrent();
    }
  }

  function startHangmanLibrary() {
    state.game = "hangman";
    state.levelId = null;
    state.wordSource = "library";
    var hl = $("hangman-level-label");
    if (hl) hl.textContent = "My words";
    beginShuffledRound();
    showPlay();
    startRound();
  }

  function speakWordUS(word) {
    if (!word) return;
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") return;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    var voice = speakUs.preferred || pickUsVoice();
    var utter = new window.SpeechSynthesisUtterance(String(displayWord(word)));
    utter.lang = "en-US";
    utter.rate = 0.92;
    utter.pitch = 1;
    if (voice) {
      utter.voice = voice;
      if (voice.lang) utter.lang = voice.lang;
    }
    try {
      window.speechSynthesis.speak(utter);
      if (window.speechSynthesis.paused) {
        try { window.speechSynthesis.resume(); } catch (e2) {}
      }
    } catch (err) {}
  }

  function renderParentsLevels() {
    var unitSel = $("parent-unit");
    var weekSel = $("parent-week");
    if (!unitSel || !weekSel || !state.settings) return;
    if (!unitSel.options.length) {
      for (var u = 1; u <= 5; u++) {
        var o = document.createElement("option");
        o.value = String(u);
        o.textContent = "Unit " + u + " (" + UNIT_COLORS[u].name + ")";
        unitSel.appendChild(o);
      }
    }
    if (!weekSel.options.length) {
      for (var w = 1; w <= 6; w++) {
        var o2 = document.createElement("option");
        o2.value = String(w);
        o2.textContent = "Week " + w;
        weekSel.appendChild(o2);
      }
    }
    unitSel.value = String(state.settings.unit);
    weekSel.value = String(state.settings.week);
    document.querySelectorAll(".mode-btn").forEach(function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-mode") === state.settings.wordMode);
    });
    document.querySelectorAll(".spell-mode-btn").forEach(function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-spellmode") === (state.settings.spellMode || "spelling"));
    });
    renderParentLevelWords();
  }

  function renderParentLevelWords() {
    var box = $("parent-level-words");
    if (!box || !state.settings) return;
    var id = levelIdFor(state.settings.unit, state.settings.week);
    var L = findLevel(id);
    if (!L) { box.innerHTML = ""; return; }
    var sight = (L.sightWords || []).slice().sort(function (a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    var spell = (L.spellingWords || []).slice().sort(function (a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    var custom = ((state.settings.customByLevel[id]) || []).slice().sort();
    var html = '<p class="level-meta"><strong>' + escapeHtml(L.pattern) + "</strong> · " + id.toUpperCase() + "</p>";
    html += '<div class="level-word-cols">';
    html += "<div><h4>Sight</h4><ul>" + sight.map(function (w) {
      return "<li>" + escapeHtml(displayWord(w)) + "</li>";
    }).join("") + "</ul></div>";
    html += "<div><h4>Spelling</h4><ul>" + spell.map(function (w) {
      return "<li>" + escapeHtml(displayWord(w)) + "</li>";
    }).join("") + "</ul></div>";
    if (custom.length) {
      html += "<div><h4>Custom</h4><ul>" + custom.map(function (w) {
        return '<li>' + escapeHtml(displayWord(w)) +
          ' <button type="button" class="linkish tiny remove-level-word" data-word="' + escapeHtml(w) + '">remove</button></li>';
      }).join("") + "</ul></div>";
    }
    html += "</div>";
    var play = wordsForLevel(id);
    html += '<p class="hint compact">Play pool (' + play.length + "): " +
      play.slice().sort().map(function (w) { return escapeHtml(displayWord(w)); }).join(", ") + "</p>";
    var spellPool = spellWordsForLevel(id);
    html += '<p class="hint compact">Parrot Spell pool (' + spellPool.length + "): " +
      spellPool.slice().sort().map(function (w) { return escapeHtml(displayWord(w)); }).join(", ") + "</p>";
    box.innerHTML = html;
    box.querySelectorAll(".remove-level-word").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var w = btn.getAttribute("data-word");
        var list = state.settings.customByLevel[id] || [];
        state.settings.customByLevel[id] = list.filter(function (x) { return x !== w; });
        saveSettings();
        renderParentLevelWords();
      });
    });
  }

  function bindV2() {
    var homeHm = $("home-hangman");
    var homeIs = $("home-island");
    var homeSp = $("home-spell");
    var mapBack = $("map-back-home");
    var mapCustom = $("map-custom");
    var btnHome = $("btn-home");
    var hangBack = $("hangman-back");
    if (homeHm) homeHm.addEventListener("click", function () {
      unlockAudio();
      showMap("hangman");
    });
    if (homeIs) homeIs.addEventListener("click", function () {
      unlockAudio();
      showMap("island");
    });
    if (homeSp) homeSp.addEventListener("click", function () {
      unlockAudio();
      showMap("spell");
    });
    if (mapBack) mapBack.addEventListener("click", showHome);
    if (mapCustom) mapCustom.addEventListener("click", function () {
      unlockAudio();
      if (state.game === "spell") startSpellLibrary();
      else startHangmanLibrary();
    });
    document.querySelectorAll(".spell-mode-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.settings.spellMode = btn.getAttribute("data-spellmode") === "both" ? "both" : "spelling";
        saveSettings();
        renderParentsLevels();
      });
    });
    if (btnHome) btnHome.addEventListener("click", function () {
      showHome();
    });
    if (hangBack) hangBack.addEventListener("click", function () {
      showMap("hangman");
    });
    var unitSel = $("parent-unit");
    var weekSel = $("parent-week");
    if (unitSel) unitSel.addEventListener("change", function () {
      state.settings.unit = parseInt(unitSel.value, 10) || 1;
      saveSettings();
      renderParentLevelWords();
      renderLevelMap();
    });
    if (weekSel) weekSel.addEventListener("change", function () {
      state.settings.week = parseInt(weekSel.value, 10) || 1;
      saveSettings();
      renderParentLevelWords();
      renderLevelMap();
    });
    document.querySelectorAll(".mode-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.settings.wordMode = btn.getAttribute("data-mode") || "both";
        saveSettings();
        renderParentsLevels();
        if (state.wordSource === "level" && state.screen === "play") {
          beginShuffledRound();
          startRound();
        }
      });
    });
    var addLevelForm = $("add-level-word-form");
    if (addLevelForm) {
      addLevelForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = $("level-word-input");
        var words = parseWordList(input && input.value);
        if (!words.length) return;
        var id = levelIdFor(state.settings.unit, state.settings.week);
        if (!state.settings.customByLevel[id]) state.settings.customByLevel[id] = [];
        words.forEach(function (w) {
          if (state.settings.customByLevel[id].indexOf(w) === -1) {
            state.settings.customByLevel[id].push(w);
          }
        });
        saveSettings();
        if (input) input.value = "";
        renderParentLevelWords();
      });
    }
    var resetProg = $("btn-reset-progress");
    if (resetProg) {
      resetProg.addEventListener("click", function () {
        if (!confirm("Clear all level stars for Hangman, Word Island and Parrot Spell?")) return;
        state.progress = defaultProgress();
        saveProgress();
        renderLevelMap();
      });
    }
    if (window.IslandGame && window.IslandGame.bind) window.IslandGame.bind();
    if (window.SpellGame && window.SpellGame.bind) window.SpellGame.bind();
  }

  function exposeWordBuddy() {
    window.WordBuddy = {
      version: APP_VERSION,
      wordsForLevel: function (levelId) { return wordsForLevel(levelId); },
      spellWordsForLevel: spellWordsForLevel,
      libraryWords: libraryWords,
      markLevelComplete: markLevelComplete,
      speakWord: speakWordUS,
      unlockAudio: unlockAudio,
      playCorrect: playCorrectLetter,
      playMiss: playPirateMiss,
      playWin: playWinSound,
      burstConfetti: function () {
        /* Island has its own overlay; reuse color burst on play confetti layer if visible */
        var layer = els.confettiLayer || $("confetti-layer");
        if (layer && state.screen === "play") fireConfetti();
        else fireIslandConfetti();
      },
      showHome: showHome,
      showMap: showMap
    };
  }

  function fireIslandConfetti() {
    var host = (state.screen === "spell" ? $("screen-spell") : $("screen-island")) || document.body;
    var layer = document.createElement("div");
    layer.className = "confetti-layer is-on island-confetti";
    layer.setAttribute("aria-hidden", "true");
    host.appendChild(layer);
    var colors = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#FF8FAB","#C77DFF","#FF9F1C","#2EC4B6"];
    for (var i = 0; i < 80; i++) {
      var piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = colors[i % colors.length];
      piece.style.width = 6 + Math.random() * 8 + "px";
      piece.style.height = 8 + Math.random() * 10 + "px";
      piece.style.setProperty("--dx", Math.floor(Math.random() * 120 - 60) + "px");
      piece.style.animationDuration = 2.2 + Math.random() * 1.6 + "s";
      piece.style.animationDelay = Math.random() * 0.45 + "s";
      layer.appendChild(piece);
    }
    setTimeout(function () {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }, 3200);
  }


  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    var hadController = !!navigator.serviceWorker.controller;
    var refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").then(function (reg) {
        try { reg.update(); } catch (e) {}
        document.addEventListener("visibilitychange", function () {
          if (document.visibilityState === "visible") {
            try { reg.update(); } catch (e2) {}
          }
        });
      }).catch(function () {});
    });
  }

  function init() {
    cacheEls();
    audio.muted = loadMutePref();
    syncMuteButton();
    armAudioUnlock();
    bindAudioVisibility();
    syncSoundHint();
    state.library = loadLibrary();
    saveLibrary(state.library); // persist library (and migration) — keep spellBuddy.words.*
    state.settings = loadSettings();
    state.progress = loadProgress();
    buildKeyboard();
    bind();
    bindV2();
    exposeWordBuddy();
    ensureSpeechVoices();
    registerSW();
    /* v2: land on home menu; do not auto-start Hangman */
    showHome();
    var ver = document.querySelector(".version");
    if (ver) ver.textContent = "v" + APP_VERSION;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
