---
version: 1
slug: 'src-ui-dashboard-renderer-ts'
primary_target: 'src/ui/dashboard-renderer.ts'
related_targets:
  [
    'src/ui/habit-detail-modal.ts',
    'src/ui/habit-editor.ts',
    'src/ui/habit-icon-picker.ts',
    'src/ui/info-popover.ts',
    'styles.css',
  ]
---

# Surface: Current-week habit dashboard

## Scope and mode

Operate. Obsidian main-workspace tab (`habit-tracker-dashboard`), used for a short daily check-in and
week-by-week history. The surface opens on the current week and must work in a wide central tab and
in a narrow width.

## Audience, job, and action

An individual tracking a few weekly habits wants to mark today with one click, understand progress
against the weekly target, and move to previous weeks without opening each note. The primary action
is marking a day; creation and management are secondary.

## Constraints

- Preserve all target, streak, date, history, guarded-write, and accessibility behavior.
- Exactly seven days in the grid: Monday through Sunday for the selected week.
- Previous/next week navigation, including returning to the current week through the arrows.
- No monthly grid or month selector, no habit count, and no More or manual Refresh control.
- New habit stays visible in a compact row; Archived (n) opens currently archived habits regardless
  of the displayed week. Habit names open a native details dialog.
- Open in the main workspace tab; reveal an existing main-tab instance. Move a sidebar instance to a
  predictable main tab rather than leaving it in the sidebar.
- Keep controls standard, keyboard/touch operable, and fully accessible.
- Theme-aware through Obsidian variables; dark-first reference, light-theme compatible.

## Chosen direction

A compact week strip based on the supplied references: habit names in rows, seven date columns,
completion runs as connected unlabeled capsules that use the habit color or theme accent. The
selected week range is named once at the top, with the year smaller and centered above it; crossing
years name both and the header group is centered. Empty day outlines make the controls discoverable,
and each habit's textual weekly progress remains visible without an extra progress rail or aggregate
summary. On narrow widths the habit details
sit above the seven day cells to keep the controls touchable. Navigation is limited to previous, next,
and returning to the current week through the arrows. Creation is always visible above the grid.
A habit name opens a native dialog with a name-only header and an always-visible compact editor
before history. Independent desktop columns group name/appearance/lifecycle actions on the left
and target/preview on the right. Narrow layouts stack name, target, appearance/actions, preview.
Statistics remain in three equal columns with centered values and captions.
Compact lifecycle captions keep Archive/Cancel archive/Reactivate beside Delete, retaining the
archive/restore icon and full accessible names. Timing is explained on the action's hover/focus.
Weekly target and Appearance have separate, keyboard/touch-operable information buttons beside
their headings; generic guidance stays out of the permanent layout. Saved target scheduling stays
visible. The target icon/title/information row spans the form above the select and save button.
Unsaved input updates the preview without submitting; icon/color retain immediate saves. Archived (n) is the only secondary habit list. Details use one vertical scroller;
the yearly calendar scrolls horizontally on narrow screens. Successful routine changes stay quiet,
while conflicts and failures surface as clear status text inside the active dialog.

The icon chooser floats beside its trigger without moving the form, with 30 local choices per page,
local search, header removal/close, and pagination. Selection closes it and returns focus; Escape
or an outside click dismisses it. It fits the visible viewport and scrolls results in limited height. Existing duplicate names remain accessible with secondary paths;
creation and rename block new collisions, including archived names.

Weekly metadata is limited to completed/target and the labeled streak. Completed marks have a 6px
outer inset on Monday/Sunday while hit areas and internal run joins stay unchanged. Archived
entries use left-aligned icon/name/path groups, the habit's own icon color, and trailing chevrons.

## Direction contract

THESIS: One week is the whole frame, not a slice of a monthly report; the category default of a
monthly calendar grid and chunky sidebar controls is refused.

OWN-WORLD: Obsidian neutral surfaces, one theme accent, hairline rules, compact tabular numerals, and
completion runs as continuous pill segments. Controls are quiet text/icon buttons with visible focus.

STORY: The visitor sees the current week's rhythm in one look, marks a day in place, reads weekly
progress and streak in the habit label, and moves backward one week at a time when reviewing history.

FIRST VIEWPORT: A centered week header with small previous/next arrows, the year above the
Monday–Sunday range and a current-week marker; historical weeks reserve the same space without an
extra action. Immediately
below, the always-visible New habit row sits above seven date columns and habit rows; the current day
header has a thin theme-accent outline and the current week header carries the accent band. No monthly strip
or habit count is shown.

FORM: Seven-day week strip with sticky habit column; picked from the supplied reference direction.
seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance.
