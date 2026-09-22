# Spell Buddy (Spelling Hangman) — v1.3

Private prototype: a kid-friendly spelling Hangman PWA for ~5-year-olds learning school words on iPad.

## Features
- Big letter blanks + large A–Z tap keys
- **Storybook cartoon stage**: wooden gallows + raised plank with trap door on a sunny tropical beach (sky, turquoise ocean, shark fin, sand, palms)
- **Hero buddy — Captain Pip** (SVG segments): black skull-and-crossbones hat, red polka-dot bandana, eye patch, big grin; blue-and-white striped shirt + short red coat with gold buttons; thin arms; black pirate boots
- Classic **6-miss** reveal (head+hat → torso → L arm → R arm → L leg → R leg) — wholesome, no gore
- **Lose sequence**: living pirate → silly cartoon skeleton → trap door opens → skeleton falls through → **then** outcome popup
- **Win**: Pip celebrates on stage; trap door stays shut
- Parent library seeded with **Fry 100** sight words; toggle On/Off per word
- Play pool = words that are On; gentle message if none are on
- Add one / paste list (custom words default On); edit/delete
- Offline PWA shell (manifest + service worker)
- Version label **v1.3** in the UI

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
