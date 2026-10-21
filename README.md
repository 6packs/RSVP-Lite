# RSVP Lite

A speed reader that shows one word at a time, rebuilt to be small. Each word
is pinned by its focus letter, so your eyes never move. The pacing slows down
where reading naturally does: long words, punctuation, paragraph and speaker
changes, quotes and names.

**On Android:** download `rsvp-lite.apk` from the
[android-latest release](../../releases/tag/android-latest) on your phone and
open it. Every push to `main` rebuilds it.

## What it does

- **Reads** `.txt`, `.md`, `.epub` and `.pdf` (text PDFs, not scans), and
  keeps your place in each book.
- **Paces for comprehension.** A comprehension ↔ speed slider picks one of
  five presets: Deep, Careful (the default, at 250 wpm), Balanced, Brisk and
  Skim. Every rule can be fine-tuned, with a live preview of the
  milliseconds each word gets. [docs/research.md](docs/research.md) has the
  evidence behind the presets.
- **Fills the screen sideways.** Turn your phone to landscape and only the
  word is left, as big as it fits, with the system bars hidden.
- **Shows the text when you want it.** "Text" shows the surrounding
  paragraphs with the current word marked. Tap any word to jump there.
- **Dark by default.** Use ☀/☾ in the library, or match the phone's setting.
- **Controls:** tap the middle of the word to play or pause, and the left or
  right edge to step a word. On a keyboard: space, ← →
  (with shift: 10 words), ↑ ↓ for speed, `t` for text, esc for the library.

## How it's built

There is no framework, no bundler and no build step. `www/` is the app,
exactly as it runs:

| File | Lines | What it does |
|---|---|---|
| `rsvp.js` | ~210 | Words, focus letters, the timing rules, the presets, the player. No DOM. |
| `books.js` | ~165 | Files to text: Markdown stripping, a 30-line zip reader for EPUB, PDF lines to paragraphs |
| `store.js` | ~65 | Settings in localStorage, books in IndexedDB |
| `app.js` | ~400 | Three screens (library, reader, settings) and the hash router between them |
| `style.css` | ~320 | Two palettes and a handful of layouts, including the landscape one |

The only third-party code is [pdf.js](https://mozilla.github.io/pdf.js/),
vendored in `www/vendor/` and loaded only when you open a PDF. It's the
legacy build, so older Android WebViews work too. Capacitor wraps `www/` as
an Android app. Its built-in SystemBars plugin is called straight through
the native bridge, and Back is handled by a few lines of Java in
`MainActivity`. No Capacitor plugins are installed.

```sh
npm start      # serve www/ on http://localhost:8080 — edit, reload, done
npm test       # node --test: timing rules, presets, player, unzip
npm run android  # a debug APK for your own device (needs the Android SDK)
```

## Releases and signing

Releases are signed with a private key that exists only on your own computer
and in two encrypted repository secrets. To make the key, run this once:

```sh
keytool -genkeypair -keystore rsvp-release.keystore -storetype PKCS12 \
  -alias release -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=RSVP"
base64 < rsvp-release.keystore | tr -d '\n' > keystore.b64   # the secret's value
```

Then add these under the repo's Settings → Secrets and variables → Actions:

- `ANDROID_KEYSTORE_BASE64`: the contents of `keystore.b64`
- `ANDROID_KEYSTORE_PASSWORD`: the password you chose

Keep `rsvp-release.keystore` and its password somewhere safe, like a password
manager, and delete `keystore.b64`. Updates must be signed with the same key,
so losing it means uninstalling and starting over.

The build runs in a job that can only read the repo. A separate job uploads
the APK with its SHA-256 and a
[build attestation](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations),
so you can confirm a download came from this repo's own build:
`gh attestation verify rsvp-lite.apk -R 6packs/RSVP-Lite`.

## Credits

Rewritten from [HawkOsm/rsvp-reader](https://github.com/HawkOsm/rsvp-reader)
by way of [6packs/RSVP-Plus](https://github.com/6packs/RSVP-Plus). The
focus-letter rule, the classic timing and the test fixtures come from there.
GPL-3.0-or-later, like the original.
