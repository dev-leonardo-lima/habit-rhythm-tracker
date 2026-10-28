---
version: 1
slug: 'src-ui-dashboard-renderer-ts'
primary_target: 'src/ui/dashboard-renderer.ts'
related_targets: []
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
- Previous/next week navigation and an explicit return to the current week.
- No monthly grid or month selector.
- Open in the main workspace tab; reveal an existing main-tab instance. Move a sidebar instance to a
  predictable main tab rather than leaving it in the sidebar.
- Keep controls standard, keyboard/touch operable, and fully accessible.
- Theme-aware through Obsidian variables; dark-first reference, light-theme compatible.

## Chosen direction

A compact week strip based on the supplied references: habit names in rows, seven date columns,
completion runs as connected unlabeled capsules that use the habit color or theme accent. The
selected week range is named once at the top, with the year smaller and centered above it; crossing
years name both. Navigation is limited to previous, next, and current week. Creation and habit
management are progressively disclosed below the grid; conflicts and failures surface as clear
status text without a recovery area.

## Direction contract

THESIS: One week is the whole frame, not a slice of a monthly report; the category default of a
monthly calendar grid and chunky sidebar controls is refused.

OWN-WORLD: Obsidian neutral surfaces, one theme accent, hairline rules, compact tabular numerals, and
completion runs as continuous pill segments. Controls are quiet text/icon buttons with visible focus.

STORY: The visitor sees the current week's rhythm in one look, marks a day in place, reads weekly
progress and streak in the habit label, and moves backward one week at a time when reviewing history.

FIRST VIEWPORT: A compact week header with small previous/next week arrows, the year above the
Monday–Sunday range, a current-week marker, and a return-to-current action when browsing. Immediately
below, seven date columns and habit rows fill the surface; the current day is ringed in the theme
accent and the current week is named in accent text. No monthly strip is shown.

FORM: Seven-day week strip with sticky habit column; picked from the supplied reference direction.
seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance.
