(function () {
  "use strict";

  var STORAGE_KEY = "spellBuddy.words.v2";
  var STORAGE_KEY_V1 = "spellBuddy.words.v1";

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
  var PART_IDS = [
    "part-head",
    "part-body",
    "part-arm-l",
    "part-arm-r",
    "part-leg-l",
    "part-leg-r"
  ];

  var BUDDY_CAPTIONS = [
    "Your buddy is cheering you on!",
    "Hello head! Still smiling!",
    "Body on deck — wiggle time!",
    "One arm for high-fives!",
    "Two arms… jazz hands!",
    "Left foot ready for a silly dance!",
    "Full buddy! Almost out of giggles — you got this!"
  ];

  var MISS_JOKES = [
    "Whoops! That letter went on vacation.",
    "Nope — try a different letter, letter-explorer!",
    "Silly miss! Your buddy grew a goofy part.",
    "That letter is playing hide-and-seek.",
    "Boop! Wrong letter, right attitude.",
    "Almost… but not that one!"
  ];

  var HIT_JOKES = [
    "Yes! Letter power!",
    "Boing! That letter fits!",
    "You found it — high five!",
    "Smart cookies eat letters like that!",
    "Whee! More of the word!",
    "Letter detective strikes again!"
  ];

  var WIN_TITLES = [
    "You spelled it!",
    "Word wizard!",
    "Spelling superstar!",
    "Boom — you got it!"
  ];

  var WIN_MSGS = [
    "Your buddy is doing a happy dance! 💃",
    "That word never stood a chance against you!",
    "Confetti in your brain! (Invisible, but sparkly.)",
    "You and the alphabet are best friends today!"
  ];

  var LOSE_TITLES = [
    "Nice try!",
    "Almost there!",
    "Good guess adventure!"
  ];

  var LOSE_MSGS = [
    "The word was {WORD}. Your buddy needs a snack and another round!",
    "It was {WORD}! No worries — spelling takes practice (and giggles).",
    "Secret word: {WORD}. Want to tickle the next one?"
  ];

  var state = {
    library: [], // [{ word, on }]
    playWords: [], // strings currently ON
    index: 0,
    word: "",
    guessed: {},
    misses: 0,
    over: false,
    won: false,
    emptyPool: false
  };

  var els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function normalizeWord(raw) {
    return String(raw || "")
      .toLowerCase()
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

  function saveLibrary(library) {
    state.library = library.slice();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.library));
    refreshPlayPool();
  }

  function refreshPlayPool() {
    state.playWords = state.library
      .filter(function (entry) {
        return entry.on;
      })
      .map(function (entry) {
        return entry.word;
      });
    if (state.index >= state.playWords.length) state.index = 0;
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
    els.jokeLine.textContent = text || "";
  }

  function setFace(name) {
    var faces = els.buddy.querySelectorAll(".face");
    for (var i = 0; i < faces.length; i++) {
      faces[i].classList.add("hidden");
    }
    var face = els.buddy.querySelector(".face-" + name);
    if (face) face.classList.remove("hidden");
  }

  function updateHangman() {
    for (var i = 0; i < PART_IDS.length; i++) {
      var el = $(PART_IDS[i]);
      if (!el) continue;
      if (i < state.misses) el.classList.remove("hidden");
      else el.classList.add("hidden");
    }
    var wave = $("wave-hand");
    if (wave) {
      if (state.misses >= 3) wave.classList.remove("hidden");
      else wave.classList.add("hidden");
    }

    if (state.misses === 0) setFace("ok");
    else if (state.misses <= 2) setFace("ok");
    else if (state.misses === 3) setFace("silly");
    else if (state.misses === 4) setFace("wow");
    else setFace("oops");

    tweakPose();

    els.buddyCaption.textContent =
      BUDDY_CAPTIONS[Math.min(state.misses, BUDDY_CAPTIONS.length - 1)];
  }

  function tweakPose() {
    var armL = $("part-arm-l");
    var armR = $("part-arm-r");
    var legL = $("part-leg-l");
    var legR = $("part-leg-r");
    if (!armL) return;

    armL.setAttribute("x2", "120");
    armL.setAttribute("y2", "145");
    armR.setAttribute("x2", "180");
    armR.setAttribute("y2", "145");
    legL.setAttribute("x2", "128");
    legL.setAttribute("y2", "210");
    legR.setAttribute("x2", "172");
    legR.setAttribute("y2", "210");

    if (state.misses >= 3) {
      armL.setAttribute("x2", "115");
      armL.setAttribute("y2", "105");
      if ($("wave-hand")) {
        $("wave-hand").setAttribute("cx", "112");
        $("wave-hand").setAttribute("cy", "100");
      }
    }
    if (state.misses >= 4) {
      armR.setAttribute("x2", "185");
      armR.setAttribute("y2", "130");
    }
    if (state.misses >= 5) {
      legL.setAttribute("x2", "118");
      legL.setAttribute("y2", "215");
    }
    if (state.misses >= 6) {
      legR.setAttribute("x2", "182");
      legR.setAttribute("y2", "215");
      armL.setAttribute("x2", "118");
      armL.setAttribute("y2", "100");
      armR.setAttribute("x2", "182");
      armR.setAttribute("y2", "100");
      if ($("wave-hand")) {
        $("wave-hand").setAttribute("cx", "115");
        $("wave-hand").setAttribute("cy", "96");
      }
    }
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
          if (state.guessed[ch]) cell.classList.add("pop");
        } else {
          cell.textContent = "";
        }
      } else {
        cell.className = "blank";
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

  function showOutcome(won) {
    state.over = true;
    state.won = won;
    els.outcome.classList.remove("hidden");
    if (won) {
      els.outcomeEmoji.textContent = pick(["🎉", "🌟", "🥳", "✨"]);
      els.outcomeTitle.textContent = pick(WIN_TITLES);
      els.outcomeMsg.textContent = pick(WIN_MSGS);
      setJoke("You spelled \"" + displayWord(state.word) + "\"! Fancy pants!");
      setFace("silly");
    } else {
      els.outcomeEmoji.textContent = pick(["🤗", "🍌", "🌈", "🧸"]);
      els.outcomeTitle.textContent = pick(LOSE_TITLES);
      els.outcomeMsg.textContent = pick(LOSE_MSGS).replace(
        "{WORD}",
        "“" + displayWord(state.word) + "”"
      );
      setJoke("Nice try — the word was \"" + displayWord(state.word) + "\"!");
      setFace("oops");
      renderBlanks();
    }
    syncKeyboard();
  }

  function onGuess(letter) {
    if (state.over || state.emptyPool || state.guessed[letter]) return;
    state.guessed[letter] = true;

    if (state.word.indexOf(letter) !== -1) {
      setJoke(pick(HIT_JOKES));
      renderBlanks();
      syncKeyboard();
      if (allLettersGuessed()) showOutcome(true);
    } else {
      state.misses += 1;
      setJoke(pick(MISS_JOKES));
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
    els.progress.textContent = "No words turned on";
    setJoke("Ask a parent to turn some words on!");
    els.buddyCaption.textContent = "Your buddy is waiting for words…";
    els.wordBlanks.innerHTML = "";
    var msg = document.createElement("p");
    msg.className = "empty-pool-msg";
    msg.textContent =
      "All library words are off. Parents: open the word list and turn some On to play.";
    els.wordBlanks.appendChild(msg);
    updateHangman();
    syncKeyboard();
    if (els.emptyBanner) els.emptyBanner.classList.remove("hidden");
  }

  function hideEmptyBanner() {
    if (els.emptyBanner) els.emptyBanner.classList.add("hidden");
  }

  function startRound() {
    els.outcome.classList.add("hidden");
    refreshPlayPool();

    if (!state.playWords.length) {
      showEmptyPoolUI();
      return;
    }

    state.emptyPool = false;
    hideEmptyBanner();

    if (state.index >= state.playWords.length) state.index = 0;
    state.word = state.playWords[state.index];
    state.guessed = {};
    state.misses = 0;
    state.over = false;
    state.won = false;
    els.progress.textContent =
      "Word " + (state.index + 1) + " of " + state.playWords.length;
    setJoke("Tap a letter. Your buddy believes in you!");
    updateHangman();
    renderBlanks();
    syncKeyboard();
  }

  function nextWord() {
    refreshPlayPool();
    if (!state.playWords.length) {
      startRound();
      return;
    }
    state.index = (state.index + 1) % state.playWords.length;
    startRound();
  }

  function showPlay() {
    els.screenPlay.classList.remove("hidden");
    els.screenWords.classList.add("hidden");
    els.parentGate.classList.add("hidden");
  }

  function showWords() {
    els.screenPlay.classList.add("hidden");
    els.screenWords.classList.remove("hidden");
    els.parentGate.classList.add("hidden");
    renderWordList();
  }

  function openParentGate() {
    els.parentGate.classList.remove("hidden");
  }

  function updateCounts() {
    var total = state.library.length;
    var on = onCount();
    if (els.wordCount) {
      els.wordCount.textContent = on + " of " + total + " on";
    }
  }

  function renderWordList() {
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
    els.gateCancel.addEventListener("click", function () {
      els.parentGate.classList.add("hidden");
    });
    els.gateOk.addEventListener("click", showWords);
    els.btnBackPlay.addEventListener("click", function () {
      showPlay();
      startRound();
    });
    els.btnNext.addEventListener("click", nextWord);

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
      state.index = 0;
      renderWordList();
    });

    window.addEventListener("keydown", function (e) {
      if (els.screenPlay.classList.contains("hidden")) return;
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
    els.jokeLine = $("joke-line");
    els.buddy = $("buddy");
    els.buddyCaption = $("buddy-caption");
    els.wordBlanks = $("word-blanks");
    els.keyboard = $("keyboard");
    els.outcome = $("outcome");
    els.outcomeEmoji = $("outcome-emoji");
    els.outcomeTitle = $("outcome-title");
    els.outcomeMsg = $("outcome-msg");
    els.btnNext = $("btn-next");
    els.btnParents = $("btn-parents");
    els.gateCancel = $("gate-cancel");
    els.gateOk = $("gate-ok");
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

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function () {});
    });
  }

  function init() {
    cacheEls();
    state.library = loadLibrary();
    saveLibrary(state.library); // persist v2 (and migration)
    buildKeyboard();
    bind();
    startRound();
    registerSW();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
