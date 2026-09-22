# Spell Buddy (Spelling Hangman) — v1.5

Private prototype: a kid-friendly spelling Hangman PWA for ~5-year-olds learning school words on iPad.

## Features
- Big letter blanks + large A–Z tap keys (fabric / cardboard tile look)
- **LittleBigPlanet craft vibe**: felt, cardboard, cork, yarn stitches, buttons — soft cozy diorama (not flat Material Design)
- **Craft beach stage**: felt sky, fabric ocean, cardboard palms, cork plank + **bigger** cardboard gallows, felt shark fin
- **Stage framing (v1.5)**: gallows dominates; Captain Pip / skeleton scaled down under the crossbeam; trap door aligned under feet; cartoon dust burst on fall
- **Hero buddy — Captain Pip** (SVG segments): felt head, button eye, stitch smile, yarn bandana, cloth striped shirt, felt red coat with button gold studs, fabric boots
- Classic **6-miss** reveal (head → torso → L arm → R arm → L leg → R leg) — wholesome, no gore
- **Lose sequence**: living craft pirate → silly felt/cardboard skeleton → trap opens → fall + dust puff → **3s pause** → outcome popup
- **Win**: Pip celebrates on stage; trap door stays shut
- Scrapbook / fabric outcome cards; Parents screen uses the same craft UI language
- Parent library seeded with **Fry 100** sight words; toggle On/Off per word
- Play pool = words that are On; gentle message if none are on
- Add one / paste list (custom words default On); edit/delete
- Offline PWA shell (manifest + service worker)
- Version label **v1.5** in the UI

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
