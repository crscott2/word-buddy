# Spell Buddy (Spelling Hangman) — v1.8

Private prototype: a kid-friendly spelling Hangman PWA for ~5-year-olds learning school words on iPad.

## Features
- Big letter blanks + large A–Z tap keys (fabric / cardboard tile look)
- **LittleBigPlanet craft vibe**: felt, cardboard, cork, yarn stitches, buttons — soft cozy diorama (not flat Material Design)
- **Craft beach stage**: felt sky, fabric ocean, sand-side cardboard palm, cork plank + bigger cardboard gallows, felt shark fin
- **Environment props**: open cardboard treasure chest (treasure visible), pirate sword in foreground, felt/cardboard seagulls drifting in the sky
- **Hanging pose**: Captain Pip is clearly **suspended from a yarn rope + cartoon noose** under the crossbeam — feet float above the plank (not standing); kid-safe classic Hangman silhouette (no gore)
- **Static idle (v1.8)**: while waiting for the next guess, the body hangs still — no continuous sway, bounce, or idle limb loops
- **Magnet snap + impact ripple (v1.8)**: when a wrong letter adds the next hangman segment, the new part **snaps on magnetically**; then existing limbs get a brief **independent decaying sway** and settle back to static
- **Open treasure chest**: lid open with gold coins + gems visible (LBP craft style)
- **Foreground pirate sword**: sword drawn in front of stage elements
- **No water palms**: horizon palms in/on the ocean removed; sand palm kept
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
- Version label **v1.8** in the UI

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
