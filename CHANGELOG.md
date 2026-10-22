# Changelog

What changed in RSVP Lite and why, newest first. RSVP Lite descends from
[HawkOsm/rsvp-reader](https://github.com/HawkOsm/rsvp-reader) through
[6packs/RSVP-Plus](https://github.com/6packs/RSVP-Plus); the early history is
in RSVP-Plus's [CHANGELOG](https://github.com/6packs/RSVP-Plus/blob/main/CHANGELOG.md).

## 2026-10-22

### Two speeds: the dial and the real pace

- **Both values are shown together.** The speed now reads as two values,
  such as **450 wpm ≈ 296 real**, in the reader, next to "Speed for new
  books", on each preset's suggestion and on the preview.
- **What the two values mean.** The dial sets the pace of a plain word.
  Pauses for punctuation, long words, quotes and names make the real pace
  slower; at 450 wpm on Careful, real reading is about 300 words a minute.
- **How the real pace is measured.** It comes from a built-in sample of
  *Pride and Prejudice*: every 59th paragraph, about 2,000 words. That
  sample runs within 2% of the whole novel under every preset, so the figure
  means the same whichever book is open. It's recalculated instantly with
  your exact settings, including fine-tuned ones.

## 2026-10-21

### Text panel follows the word; touch sliders need a hold (`4f6f15b`)

- **The text panel scrolls by itself.** Before, it caught up only when a new
  paragraph started, so in a long paragraph the highlighted word walked off
  the bottom. Now, once reading carries the word two-thirds of the way down
  the panel, it glides back up to a third.
- **Touch sliders need a short hold.** On a touchscreen, sliders in Settings
  ignore taps and swipes, because scrolling past one used to change it by
  accident. A press held for about a quarter of a second picks the slider up
  (with an outline and a short buzz), and then it follows your finger.
- **Fixed:** opening the app straight onto Settings crashed it. The app
  started up before the settings tables further down `app.js` were defined.
  Startup now runs at the end of the file.

### Temporary-key builds (`e7d6270`)

- Running the workflow by hand with `one_off_key` builds a release APK signed
  with a key made for that one build and then deleted. This is for when the
  permanent signing secrets aren't set up yet. Nobody keeps the key, so
  nobody can sign an update that would install over it.

### Security hardening (`1e52e9c`)

This came from a security review:

- **Signing:** the committed debug key (password `android`) is gone.
  Releases are signed with a private key that lives only in repository
  secrets. Without the secrets, the build fails instead of falling back to a
  weaker key.
- **Release builds:** the APK is a release build, so it isn't debuggable and
  Chrome's remote inspector stays off.
- **Pipeline:**
  - The build job can only read the repo, keeps no token on disk, and
    installs packages with install scripts off.
  - A separate publish job is the only one that can write. It adds a build
    attestation and the APK's SHA-256 checksum to the release.
  - Every step is pinned to a commit, and the third-party
    `android-actions/setup-android` step is gone, since GitHub's runners
    already include the Android SDK.
- **Scaffold leftovers:** the unused file provider (pointed at all of shared
  storage) and the Google Services classpath are removed, and
  `allowBackup` is off.
- **Hardening:** EPUB unpacking stops past 200 MB, the page has a strict
  Content Security Policy, pdf.js runs with `eval` disabled, and `npm start`
  listens on 127.0.0.1 only.
- **Release numbering:** each CI build's version code is its run number, so
  every build is newer than the last.

### License kept GPL-3.0 (`7829f69`)

- GitHub's initial commit added an MIT license. RSVP Lite is derived from the
  GPL-3.0 original, so it stays GPL-3.0. The commit was merged rather than
  overwritten.

### RSVP Lite: the reader, rebuilt small (`bea3b57`)

RSVP-Plus was rewritten as plain HTML, CSS and JavaScript modules, with no
framework, bundler or build step. It keeps every feature RSVP-Plus had
designed:

- **Reading:** focus-letter alignment, the classic timing, and the quote,
  capital, word-length and punctuation rules.
- **Pacing:** the five presets with fine-tuning and a live preview.
- **Display:** the landscape word-only view and dark mode by default.
- **Books:** TXT, MD, EPUB and PDF import, and saved progress.
- **Navigation:** tap zones and keyboard shortcuts.

Changes from RSVP-Plus:

- **Book and page view → Text panel.** RSVP-Plus's book and page view became
  a Text panel under the word: the surrounding paragraphs, with tap-to-jump.
  RSVP Lite doesn't render real PDF page images.
- **EPUB:** a 30-line zip reader on `DecompressionStream` replaces JSZip.
- **PDF:** pdf.js is vendored in its legacy build, so older Android WebViews
  can open PDFs. It loads only when a PDF is opened.
- **Android:** Capacitor with no plugins. The built-in SystemBars plugin is
  called through the native bridge, and Back is handled in `MainActivity`.
- **Tests:** they run on `node --test`. They include the original Python
  engine's timing and focus-letter cases, and upstream's PDF and EPUB
  fixtures, which give identical output.
- **Dropped:** desktop installers, the offline web version (PWA), and library
  backup and restore.
