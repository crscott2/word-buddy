# Spell Buddy (Spelling Hangman) — v1.7

Private prototype: a kid-friendly spelling Hangman PWA for ~5-year-olds learning school words on iPad.

## Features
- Big letter blanks + large A–Z tap keys (fabric / cardboard tile look)
- **LittleBigPlanet craft vibe**: felt, cardboard, cork, yarn stitches, buttons — soft cozy diorama (not flat Material Design)
- **Craft beach stage**: felt sky, fabric ocean, sand-side cardboard palm, cork plank + bigger cardboard gallows, felt shark fin
- **Environment props**: open cardboard treasure chest (treasure visible), pirate sword in foreground, felt/cardboard seagulls drifting in the sky
- **Hanging pose (v1.7)**: Captain Pip is clearly **suspended from a yarn rope + cartoon noose** under the crossbeam — feet float above the plank (not standing); gentle **side-to-side pendulum sway** (no vertical bounce); kid-safe classic Hangman silhouette (no gore)
- **Independent appendage sway (v1.7)**: left/right arms, left/right legs, and coat tails each sway on their own timing/phase (loose craft ragdoll hang)
- **Open treasure chest (v1.7)**: lid open with gold coins + gems visible (LBP craft style)
- **Foreground pirate sword (v1.7)**: sword drawn in front of stage elements
- **No water palms (v1.7)**: horizon palms in/on the ocean removed; sand palm kept
- **Stage framing**: gallows dominates; Pip / skeleton scaled down; trap door centered under noose/character; cartoon dust burst on fall
- **Hero buddy — Captain Pip** (SVG segments): felt head, button eye, stitch smile, yarn bandana, cloth striped shirt, felt red coat with button gold studs, fabric boots (dangling hang pose)
- Classic **6-miss** reveal (head → torso → L arm → R arm → L leg → R leg) — wholesome, no gore
- **Lose sequence**: living craft pirate (hanging) → silly felt/cardboard skeleton (still hanging briefly) → trap opens → **detaches and drops ALL THE WAY DOWN** through the trap + dust puff → **3s pause** → outcome popup
- **Win**: Pip celebrates with a cheerful side-sway while still on the rope; trap door stays shut — no fall
- Scrapbook / fabric outcome cards; Parents screen uses the same craft UI language
- Parent library seeded with **Fry 100** sight words; toggle On/Off per word
- Play pool = words that are On; gentle message if none are on
- Add one / paste list (custom words default On); edit/delete
- Offline PWA shell (manifest + service worker)
- Version label **v1.7** in the UI

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
