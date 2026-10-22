# RSVP Lite

A speed reader that shows one word at a time, rebuilt to be small. Each word
is pinned by its focus letter, so your eyes never move. The pacing slows down
where reading naturally does: long words, punctuation, paragraph and speaker
changes, quotes and names.

RSVP Lite is a from-scratch rewrite of
**[HawkOsm/rsvp-reader](https://github.com/HawkOsm/rsvp-reader)**, by way of
the fork [6packs/RSVP-Plus](https://github.com/6packs/RSVP-Plus). The core
ideas are HawkOsm's; see [Credits](#credits) for exactly what came from
where.

## Install (Android)

On your phone, open the
[android-latest release](../../releases/tag/android-latest), download
`rsvp-lite.apk` and open it. Android will ask you to allow installs from your
browser, since the app isn't from the Play Store.

> **Right now** the release is a *temporary build*. It's signed with a key
> that was made for that one build and then deleted, until the permanent
> signing key is set up (see [Releases and signing](#releases-and-signing)).
> The first permanent-key build will need one uninstall, which clears the
> library. After that, updates install over each other normally.

## What it does

- **Reads** `.txt`, `.md`, `.epub` (DRM-free) and `.pdf` (text PDFs, not
  scans), and keeps your place in each book.
- **Paces for comprehension.** A comprehension ↔ speed slider picks one of
  five presets: Deep, Careful (the default, at 250 wpm), Balanced, Brisk and
  Skim. Every rule can be fine-tuned, and a live preview shows the
  milliseconds each word gets. [docs/research.md](docs/research.md) has the
  evidence behind the presets.
- **Shows two speeds:** the dial, and the real pace once pauses are counted,
  for example *450 wpm ≈ 296 real*. The real pace is measured on a built-in
  sample of *Pride and Prejudice*, so it means the same for every book.
- **Fills the screen sideways.** Turn your phone to landscape and only the
  word is left, as big as it fits, with the system bars hidden.
- **Shows the text when you want it.** "Text" shows the surrounding
  paragraphs under the word, with the current word highlighted. It scrolls
  along by itself, and you can tap any word to jump there.
- **Dark by default.** Use ☀/☾ in the library, or follow the phone's setting.
- **Controls:**
  - Tap the middle of the word to play or pause, and the left or right edge
    to step one word.
  - On a keyboard: space to play or pause, ← → to step (with shift, 10
    words), ↑ ↓ for speed, `t` for the text, esc for the library.
  - On a touchscreen, settings sliders move only after a short press and
    hold, so scrolling past one never changes it.

## What changed from the original, and why

| Change | Why |
|---|---|
| **Pacing rules for dialogue and capitals.** The first and last word of a quotation, names in mid-sentence and ALL-CAPS words can each be held longer. Every timing constant is now a setting. | Dialogue was hard to follow: a change of speaker flashed by like any other word. The original held words longer only for length, punctuation and paragraph ends, with fixed values. |
| **Presets on a comprehension ↔ speed slider, defaulting to comprehension** (Careful, 250 wpm, instead of 300 wpm). | Studies find RSVP comprehension keeps up with normal reading only up to about 250–350 wpm, and that pauses at clause and sentence ends help. See [docs/research.md](docs/research.md). |
| **Landscape word-only view.** | To read with the phone on its side, with nothing but the word on screen. |
| **Dark by default, one-tap toggle.** | The original followed the phone's setting, which read as "no dark mode" on a phone set to light. |
| **Rewritten as plain HTML, CSS and JavaScript.** About 1,300 lines with no framework, bundler or build step, instead of about 4,900 lines of TypeScript and React with a Vite, Tailwind and Workbox build. | Fewer moving parts. It follows the "do more with less" approach of htmx, Preact and Pinboard: less to break, less to audit, and anyone can read all of it. |
| **Capacitor with no plugins.** Capacitor's built-in SystemBars plugin is called directly, and Back is a few lines of Java. | The original used four Capacitor plugins plus a custom Java plugin for the same results. |
| **EPUBs are read by a 30-line zip reader** using the browser's own decompression. | This replaces JSZip, a dependency. |
| **pdf.js's "legacy" build** is used, vendored and loaded only for PDFs. | The standard build uses JavaScript that only very new browsers have. On an older Android WebView, opening a PDF would probably fail. |
| **A private release key, non-debuggable builds and a least-privilege pipeline.** See [Releases and signing](#releases-and-signing). | A security review found the first builds were signed with a committed key whose password was public, shipped as debuggable, and were built by a job with broad write access. |
| **Template leftovers removed.** An unused file provider over all of shared storage and the Google Services wiring are gone, and backup is off. | They were kept from the app scaffold but never used, and each one widened what the app could expose. |
| **Hardening.** EPUB unpacking stops past 200 MB, the page has a strict Content Security Policy, pdf.js runs with `eval` disabled, and `npm start` serves only to this computer. | These defences came from the same review. None was exploitable as shipped. |
| **Dropped:** desktop installers, the offline web version (PWA), library backup and restore, and rendering real PDF pages. | Not needed for reading on a phone. They're on the [roadmap](ROADMAP.md) if they're missed. |

The full, dated list is in [CHANGELOG.md](CHANGELOG.md), and what's planned
next is in [ROADMAP.md](ROADMAP.md).

## How it's built

`www/` is the app, exactly as it runs:

| File | What it does |
|---|---|
| `rsvp.js` | Words, focus letters, the timing rules, the presets and the player. It doesn't touch the page, so Node tests it directly. |
| `books.js` | Turns files into text: strips Markdown, unzips EPUBs, and rebuilds PDF lines into paragraphs. |
| `store.js` | Keeps settings in localStorage and books in IndexedDB. |
| `app.js` | The three screens (library, reader, settings) and the hash router between them. |
| `style.css` | Two colour palettes and a handful of layouts, including the landscape one. |
| `vendor/` | pdf.js, the only third-party code, loaded only when you open a PDF. |

```sh
npm start        # serve www/ on http://127.0.0.1:8080 — edit, reload, done
npm test         # node --test: timing rules, presets, player, unzip
npm run android  # a debug APK for your own device (needs the Android SDK)
```

## Releases and signing

Every push to `main` runs the tests and, if the signing secrets are set,
builds a signed release APK and publishes it as `android-latest`.

To make the signing key, run this once on your own computer:

```sh
keytool -genkeypair -keystore rsvp-release.keystore -storetype PKCS12 \
  -alias release -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=RSVP"
base64 < rsvp-release.keystore | tr -d '\n' > keystore.b64   # the secret's value
```

Then add two secrets under the repo's Settings → Secrets and variables →
Actions:

- `ANDROID_KEYSTORE_BASE64`: the contents of `keystore.b64`
- `ANDROID_KEYSTORE_PASSWORD`: the password you chose

Keep `rsvp-release.keystore` and its password somewhere safe, like a password
manager, and delete `keystore.b64`. Updates must be signed with the same key,
so losing it means uninstalling and starting over.

Without the secrets, a push builds nothing. Running the workflow by hand with
**one_off_key** makes a temporary build instead. It's signed with a key made
for that one build and then deleted, so nobody can sign an update for it.

How the pipeline is kept safe:

- **Read-only build.** The build job can only read the repo, keeps no GitHub
  token on disk, and installs packages with install scripts switched off.
- **Separate publish.** A separate job, the only one that can write,
  publishes the APK with its SHA-256 checksum and a
  [build attestation](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations).
  To confirm that a download came from this repo's own build, run
  `gh attestation verify rsvp-lite.apk -R 6packs/RSVP-Lite`.
- **Pinned steps.** Every step is pinned to an exact commit, and only
  GitHub's own steps are used.

## Credits

- **[HawkOsm/rsvp-reader](https://github.com/HawkOsm/rsvp-reader)**, the
  original app by HawkOsm. RSVP Lite keeps several of its pieces:
  - the focus-letter rule and the classic timing, which came from its Python
    engine (`rsvp_engine.py`). This repo's tests check them case by case
    against that engine.
  - the colour palettes
  - the fallback to Windows-1254 for old text files
  - the Markdown-stripping rules
  - the PDF paragraph and column approach
  - the test files in `test/fixtures/`
  - the Android project scaffold and app icons
- **[6packs/RSVP-Plus](https://github.com/6packs/RSVP-Plus)**, the fork where
  the pacing rules, presets, landscape view and dark default were first built.
- **[pdf.js](https://mozilla.github.io/pdf.js/)** by Mozilla, Apache-2.0
  ([www/vendor/pdfjs-LICENSE](www/vendor/pdfjs-LICENSE)).
- **[Capacitor](https://capacitorjs.com)** by Ionic, MIT, which packages the
  app for Android.
- The pacing presets draw on the research listed in
  [docs/research.md](docs/research.md).

## License

GPL-3.0-or-later, the same as the original. See [LICENSE](LICENSE).
