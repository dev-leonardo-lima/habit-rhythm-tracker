# Plugin screenshots

## Listing format

All desktop listing images are **1200 × 800 px (3:2), PNG, below 5 MB**, matching the original
images in commit `bc51f5ff36d6a776f34059998df2c54feb7452a7` and the community-directory editor's
recommendation supplied by the maintainer on 2026-11-06. Do not replace them with full-window QA
captures, another language, or different sample data. Mobile layout measurements and test results are kept separately
under `specs/005-habit-details-modal/evidence/`.

## Fixed sample data

[`fixtures.json`](fixtures.json) pins the original visible data independently of the current date
or edits made while manually testing the Preview vault:

- English; the week **26 Oct–1 Nov 2026**, with **29 Oct** as today.
- Exercise: **3 / 4**, **4 weeks**, green dumbbell; marked Monday, Tuesday, Thursday.
- Programming: **4 / 4**, **2 weeks**, blue code icon; marked Monday through Thursday.
- Reading: **3 / 5**, **2 weeks**, amber book icon; marked Monday, Wednesday, Thursday.
- Studying: **2 / 3**, **3 weeks**, violet brain icon; marked Tuesday and Wednesday.
- Exercise history in 2026: **4 weeks** current streak, **9 weeks** best streak, **160 days**.

Exercise's 160 completion dates were recovered from the original calendar image in commit
`7629cc1c48e2d891663b61c0d9d9a99aaf5decdf` and checked through the production note parser and
controller. The other habits' earlier completions are synthetic support for the original visible
streaks; their unseen original note history is not claimed to have been recovered. Colors were
sampled from the original PNGs with their display profiles converted to sRGB. Native `lucide-`
registry identifiers retain the same displayed icons.

The current UI intentionally omits outcome words and the former management section. Preserve the
sample values when those presentation details change.

## Current images

Captured on **2026-11-06**, from the current feature-005 UI including the later dashboard/icon polish,
in **Obsidian 1.15.0 on macOS**, using its native ItemView, Modal, icon registry and theme.

- `01-weekly-dashboard.png`: the four original habits, dates, counts, colors and streaks.
- `02-habit-history.png`: Exercise history in the native dialog, with the compact editor and all 160
  marked calendar cells visible.
- `03-habit-details.png`: Programming's compact editor, with appearance/lifecycle actions beside the preview and the original
  name, four-day target,
  blue color and code icon. The floating icon chooser shows 30 choices without moving the form.
  This replaces the obsolete `03-manage-habits.png` illustration.

## Capture and verification

1. Load the pinned records through the production note parser/repository/controller using a
   read-only in-memory vault and a controller clock fixed to the fixture's date. Use English for
   this temporary capture instance. Do not change the machine clock, persisted language preference,
   or the user's ongoing Preview notes.
2. Render the current compiled dashboard in an isolated temporary leaf, using the installed
   stylesheet and native Obsidian controls. Frame the dashboard in a 900 × 600 region within a 1200 × 600 desktop viewport.
   For the complete always-visible editor/history, use a 1200 × 800 region within a 1500 × 800
   desktop viewport. Show Exercise for history and Programming for the floating icon chooser.
3. Close DevTools and let the viewport settle. Capture that region through Electron `capturePage`
   and resize uniformly to 1200 × 800 using `NativeImage.resize`, preserving 3:2. No text, numbers,
   marks, icons or controls are painted into the PNG afterward.
4. Inspect every output. Check PNG dimensions, ratio, size, English sample values, and the 160
   visible Exercise marks. Keep the icon chooser's code selection and four-day target unchanged.
5. Close the capture dialog/leaf, remove its temporary frame and viewport emulation, and restore the
   normal Preview plugin/runtime. Verify the Preview notes and installed bundle against their
   pre-capture hashes. Remove temporary capture files; retain the user's Preview vault.

The final three PNGs are 110879, 161196, and 194780 bytes respectively. Image 01 was regenerated
earlier in feature 005 and therefore differs from main. Subsequent editor recaptures updated only
images 02/03, which include the compact lifecycle labels and contextual information controls.
The 2026-11-07 code-review corrections changed none of these PNGs.
The initial 3024 × 1898
Portuguese QA captures were replaced because they did not follow this listing contract.
