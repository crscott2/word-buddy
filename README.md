# Spell Buddy (Spelling Hangman) — v1.13

Private prototype: a kid-friendly spelling Hangman PWA for ~5-year-olds learning school words on **iPad in landscape**.

## Features
- **Attempts fraction (v1.13)**: craft badge in the bottom-right of the beach stage shows miss status (`0/6` … `6/6`); updates after each wrong guess; resets each new word
- **No foreground sword (v1.12)**: pirate sword prop removed from the beach stage
- **Clearer win run (v1.12)**: Pip’s escape uses a stronger run cycle (alternating limbs), bounce in stride, forward lean, and dust puffs at the feet
- **Clean play UI (v1.11)**: play view shows only the header (title / Parents) and **Word x of x** progress — no joke lines, character hooks, buddy captions, or other chrome copy
- **Bigger highlighted blanks (v1.11)**: empty letter bubbles are larger with stronger contrast, outline, and warm glow so they read clearly on iPad landscape
- **Lose popup display word (v1.11)**: missed word is large bold display typography that dominates the popup (word + Next only)
- **Landscape-first layout (v1.9+)**: hangman/beach stage beside word blanks + large letter keyboard (stacked fallback in portrait)
- Compact header in landscape; **lose-only** outcome popup sized for short landscape height
- Parents screen two-column in landscape (forms | word list) — Parents labels/hints kept
- Big letter blanks + large A–Z tap keys (fabric / cardboard tile look) — kids touch targets kept large
- **LittleBigPlanet craft vibe**: felt, cardboard, cork, yarn stitches, buttons — soft cozy diorama (not flat Material Design)
- **Craft beach stage**: felt sky, fabric ocean, sand-side cardboard palm, cork plank + bigger cardboard gallows, felt shark fin
- **Environment props**: open cardboard treasure chest (treasure visible), felt/cardboard seagulls drifting in the sky
- **Hanging pose**: Captain Pip is clearly **suspended from a yarn rope + cartoon noose** under the crossbeam — feet float above the plank (not standing); kid-safe classic Hangman silhouette (no gore)
- **Static idle (v1.8)**: while waiting for the next guess, the body hangs still — no continuous sway, bounce, or idle limb loops
- **Magnet snap + impact ripple (v1.8)**: when a wrong letter adds the next hangman segment, the new part **snaps on magnetically**; then existing limbs get a brief **independent decaying sway** and settle back to static
- **Open treasure chest**: lid open with gold coins + gems visible (LBP craft style)
- **No water palms**: horizon palms in/on the ocean removed; sand palm kept
- **Stage framing**: gallows dominates; Pip / skeleton scaled down; trap door centered under noose/character; cartoon dust burst on fall
- **Hero buddy — Captain Pip** (SVG segments): felt head, button eye, stitch smile, yarn bandana, cloth striped shirt, felt red coat with button gold studs, fabric boots (dangling hang pose)
- Classic **6-miss** reveal (head → torso → L arm → R arm → L leg → R leg) — wholesome, no gore
- **Lose sequence**: living craft pirate (hanging) → silly felt/cardboard skeleton (still hanging briefly) → trap opens → **detaches and drops ALL THE WAY DOWN** through the trap + dust puff → **3s pause** → outcome popup showing **only the secret word (big bold display)** + Next word
- **Win (v1.12)**: Pip frees from the noose, drops to the plank, grabs the treasure, then **runs** off-screen — clearer opposite-phase arm/leg cycle, stride bounce, forward lean, foot dust puffs — **no outcome popup**; auto-advances after the run
- Scrapbook / fabric outcome cards; Parents screen uses the same craft UI language
- Parent library seeded with **Fry 100** sight words; toggle On/Off per word
- Play pool = words that are On; progress shows empty-pool state if none are on
- Add one / paste list (custom words default On); edit/delete
- Offline PWA shell (manifest + service worker); manifest `orientation` stays **any** so Safari Add to Home Screen is not locked
- Version label **v1.13** in the UI

## Preview locally
```bash
cd /workspace/spelling-hangman
python3 -m http.server 8765
# open http://localhost:8765
```

## Parent words
Tap **Parents** → confirm → toggle words, add custom words, or paste a list.
Storage key: `spellBuddy.words.v2` (`{ word, on }`). Migrates older v1 string lists.
