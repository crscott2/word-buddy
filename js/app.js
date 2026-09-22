(function () {
  "use strict";

  var STORAGE_KEY = "spellBuddy.words.v1";
  var SAMPLE_WORDS = ["cat", "ship", "green", "beach"];
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
    words: [],
    index: 0,
    word: "",
    guessed: {},
    misses: 0,
    over: false,
    won: false
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

  function parseWordList(text) {
    return String(text || "")
      .split(/[\n,;]+/)
      .map(normalizeWord)
      .filter(function (w) {
        return w.length >= 2 && /[a-z]/.test(w);
      });
  }

  function loadWords() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return SAMPLE_WORDS.slice();
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return SAMPLE_WORDS.slice();
      return parsed.map(normalizeWord).filter(Boolean);
    } catch (e) {
      return SAMPLE_WORDS.slice();
    }
  }

  function saveWords(words) {
    state.words = words.slice();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.words));
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

    // Expressive / comedic faces by miss count
    if (state.misses === 0) setFace("ok");
    else if (state.misses <= 2) setFace("ok");
    else if (state.misses === 3) setFace("silly");
    else if (state.misses === 4) setFace("wow");
    else setFace("oops");

    // Funny pose tweaks via transform on arms/legs (CSS-free: adjust SVG attrs lightly)
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

    // Reset defaults
    armL.setAttribute("x2", "120");
    armL.setAttribute("y2", "145");
    armR.setAttribute("x2", "180");
    armR.setAttribute("y2", "145");
    legL.setAttribute("x2", "128");
    legL.setAttribute("y2", "210");
    legR.setAttribute("x2", "172");
    legR.setAttribute("y2", "210");

    if (state.misses >= 3) {
      // waving left arm up
      armL.setAttribute("x2", "115");
      armL.setAttribute("y2", "105");
      if ($("wave-hand")) {
        $("wave-hand").setAttribute("cx", "112");
        $("wave-hand").setAttribute("cy", "100");
      }
    }
    if (state.misses >= 4) {
      // right arm akimbo / shrug
      armR.setAttribute("x2", "185");
      armR.setAttribute("y2", "130");
    }
    if (state.misses >= 5) {
      // legs a bit splayed silly
      legL.setAttribute("x2", "118");
      legL.setAttribute("y2", "215");
    }
    if (state.misses >= 6) {
      legR.setAttribute("x2", "182");
      legR.setAttribute("y2", "215");
      // arms both up like "ta-da / oh well"
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
        // hyphen / apostrophe always shown
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
      if (state.over) btn.disabled = true;
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
      setJoke("You spelled \"" + state.word + "\"! Fancy pants!");
      setFace("silly");
    } else {
      els.outcomeEmoji.textContent = pick(["🤗", "🍌", "🌈", "🧸"]);
      els.outcomeTitle.textContent = pick(LOSE_TITLES);
      els.outcomeMsg.textContent = pick(LOSE_MSGS).replace(
        "{WORD}",
        "“" + state.word + "”"
      );
      setJoke("Nice try — the word was \"" + state.word + "\"!");
      setFace("oops");
      renderBlanks();
    }
    syncKeyboard();
  }

  function onGuess(letter) {
    if (state.over || state.guessed[letter]) return;
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

  function startRound() {
    els.outcome.classList.add("hidden");
    if (!state.words.length) {
      state.words = SAMPLE_WORDS.slice();
      saveWords(state.words);
    }
    if (state.index >= state.words.length) state.index = 0;
    state.word = state.words[state.index];
    state.guessed = {};
    state.misses = 0;
    state.over = false;
    state.won = false;
    els.progress.textContent =
      "Word " + (state.index + 1) + " of " + state.words.length;
    setJoke("Tap a letter. Your buddy believes in you!");
    updateHangman();
    renderBlanks();
    syncKeyboard();
  }

  function nextWord() {
    state.index = (state.index + 1) % Math.max(state.words.length, 1);
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

  function renderWordList() {
    els.wordCount.textContent = String(state.words.length);
    els.wordList.innerHTML = "";
    state.words.forEach(function (word, idx) {
      var li = document.createElement("li");
      var span = document.createElement("span");
      span.className = "word-text";
      span.textContent = word;

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "icon-btn";
      editBtn.textContent = "Edit";
      editBtn.setAttribute("aria-label", "Edit " + word);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "icon-btn danger";
      delBtn.textContent = "Delete";
      delBtn.setAttribute("aria-label", "Delete " + word);

      editBtn.addEventListener("click", function () {
        beginEdit(li, idx, word);
      });
      delBtn.addEventListener("click", function () {
        if (!confirm("Delete “" + word + "” from the list?")) return;
        var next = state.words.slice();
        next.splice(idx, 1);
        if (!next.length) next = SAMPLE_WORDS.slice();
        saveWords(next);
        if (state.index >= state.words.length) state.index = 0;
        renderWordList();
      });

      li.appendChild(span);
      li.appendChild(editBtn);
      li.appendChild(delBtn);
      els.wordList.appendChild(li);
    });
  }

  function beginEdit(li, idx, word) {
    li.innerHTML = "";
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
      if (!n || n.length < 2) {
        alert("Please enter a real spelling word (at least 2 letters).");
        return;
      }
      var next = state.words.slice();
      next[idx] = n;
      saveWords(next);
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
      alert("No words found. Try letters only, separated by commas or new lines.");
      return 0;
    }
    var next = state.words.slice();
    var seen = {};
    next.forEach(function (w) {
      seen[w] = true;
    });
    var count = 0;
    added.forEach(function (w) {
      if (!seen[w]) {
        next.push(w);
        seen[w] = true;
        count++;
      }
    });
    saveWords(next);
    return count;
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

    els.btnResetSamples.addEventListener("click", function () {
      if (!confirm("Replace the list with sample words (cat, ship, green, beach)?"))
        return;
      saveWords(SAMPLE_WORDS.slice());
      state.index = 0;
      renderWordList();
    });

    // Physical keyboard support (helpful for desktop preview)
    window.addEventListener("keydown", function (e) {
      if (els.screenPlay.classList.contains("hidden")) return;
      if (state.over) return;
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
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function () {});
    });
  }

  function init() {
    cacheEls();
    state.words = loadWords();
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
