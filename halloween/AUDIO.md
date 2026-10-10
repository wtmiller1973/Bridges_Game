# Audio guide

## Recording the voice cues

Until a recording exists, the phone's built-in voice reads the line aloud. To use your own voice instead:

1. Record the line (the iPhone Voice Memos app is fine). Short and cheerful works best. Trim the silence at the start so it plays instantly.
2. Save it as the **exact file name** below. Use `.mp3` if you can. `.m4a` (what Voice Memos exports) also works: just swap the ending, so `count-1.m4a` instead of `count-1.mp3`.
3. Put it in `halloween/assets/audio/voice/`, then commit and push (or redeploy).

No code changes are needed. The game finds the file by its name. You can record a few at a time; any not recorded yet keep using the built-in voice.

| File name | Suggested line | When it plays |
|---|---|---|
| `hello.mp3` | "Hi Goldie! Pick a game!" | Home screen, the first time she taps |
| `game-ghosts.mp3` | "Ghost Pop!" | Ghost icon tapped on the home screen |
| `game-pumpkin.mp3` | "Pumpkin Carving!" | Pumpkin icon tapped |
| `game-cats.mp3` | "Count the Cats!" | Cat icon tapped |
| `game-dressup.mp3` | "Dress up Sniper!" | Sniper icon tapped |
| `ghosts-intro.mp3` | "Tap the ghosts!" | Ghost Pop starts |
| `pumpkin-pick.mp3` | "Pick a pumpkin face!" | Pumpkin Carving starts |
| `pumpkin-trace.mp3` | "Trace the lines with your finger!" | After she picks a face |
| `pumpkin-glow.mp3` | "Look! It glows!" | The carved pumpkin lights up |
| `cats-intro.mp3` | "Find the black cats!" | Count the Cats starts |
| `count-1.mp3` | "One!" | First black cat found |
| `count-2.mp3` | "Two!" | Second black cat |
| `count-3.mp3` | "Three!" | Third black cat |
| `count-4.mp3` | "Four!" | Fourth black cat |
| `count-5.mp3` | "Five!" | Fifth black cat |
| `milly.mp3` | "That's Milly!" | Milly is tapped |
| `dressup-intro.mp3` | "Dress up Sniper!" | Dress Up Sniper starts |
| `tada.mp3` | "Ta-da! Sniper looks great!" | The star (Ta-da) button |
| `cheer-yay.mp3` | "Yay!" | Celebration (one of three, picked at random) |
| `cheer-great.mp3` | "Great job!" | Celebration |
| `cheer-did-it.mp3` | "You did it!" | Celebration |

The suggested lines are only suggestions: say whatever you like, e.g. "Way to go, Goldie!".

To add a new cue or change the built-in wording, edit `js/audio-cues.js` (one line per cue).

## Sound effects

All sound effects are in `assets/audio/sfx/`. They were synthesised from scratch by `tools/make_sfx.py` (no samples or downloads), so they are original and released under **CC0** (public domain). Any of them can be replaced by dropping in a file with the same name (for example, a real recording of Sniper's bark as `woof.mp3`).

| File | Sound | Where it plays | Source / licence |
|---|---|---|---|
| `pop.mp3` | Bubbly pop | Ghost popped, pumpkin shape cut out | Generated, CC0 |
| `poof.mp3` | Soft puff | Ghost popped | Generated, CC0 |
| `sparkle.mp3` | Twinkles | Milly, Ta-da, bonus sparkle | Generated, CC0 |
| `tap.mp3` | Soft blip | Buttons | Generated, CC0 |
| `boo.mp3` | Friendly "woo-oo" | A ghost rises | Generated, CC0 |
| `meow.mp3` | Meow | Milly tapped | Generated, CC0 |
| `woof.mp3` | Two barks | Sniper gets a costume or is tapped | Generated, CC0 |
| `whoosh.mp3` | Whoosh | Costume on/off | Generated, CC0 |
| `boing.mp3` | Spring | Cat jumps, Goldie tapped | Generated, CC0 |
| `glow.mp3` | Rising chime | Pumpkin lights up | Generated, CC0 |
| `jingle.mp3` | Short happy tune | Every celebration | Generated, CC0 |

To regenerate them: `python3 halloween/tools/make_sfx.py` (needs numpy and ffmpeg).
