# Spell Buddy (Spelling Hangman) — v1.2

Private prototype: a kid-friendly spelling Hangman PWA for ~5-year-olds learning school words on iPad.

## Features
- Big letter blanks + large A–Z tap keys
- **Beach pirate buddies** (CSS/SVG): sand, water, sky, palm, distant ship
- **Rotating characters** each round (~6): Captain Pip, Matey Blink, Captain Squawk, Crabby Peg, Marina Splash, Chesty Gold
- Classic **6-stage** illustrated build (no gore) — wrong guesses assemble the buddy
- **Lose → comedy skeleton** (Halloween-cute bones); win keeps the living character celebrating
- Win/lose comedy copy mentions the character
- Parent library seeded with **Fry 100** sight words; toggle On/Off per word
- Play pool = words that are On; gentle message if none are on
- Add one / paste list (custom words default On); edit/delete
- Offline PWA shell (manifest + service worker)
- Version label **v1.2** in the UI

## Preview locally
```bash
cd /workspace/spelling-hangman
python3 -m http.server 8765
# open http://localhost:8765
```

## Parent words
Tap **Parents** → confirm → toggle words, add custom words, or paste a list.
Storage key: `spellBuddy.words.v2` (`{ word, on }`). Migrates older v1 string lists.

## Note
Repo is **private**. Do not enable GitHub Pages for this prototype.
