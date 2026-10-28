# Contract: Dashboard Interaction

- Entry: a command and ribbon action open an Obsidian view. On open it displays the current local
  month and highlights the current week; a return-to-current control restores that state.
- Layout: render all weeks intersecting the selected month as separate tables. Each has habits in
  rows and exactly seven Monday–Sunday date columns; adjacent-month dates remain visible. Month
  navigation and week navigation allow access to history, and each habit shows weekly completion,
  effective target, state and current streak. Entirely future weeks are not started. Monthly totals
  count only dates in the selected month up to today, including completions in archived weeks;
  stored dates now in the future remain visible but do not count.
- Interactions: a uniquely labeled checkbox per habit/date works with pointer, touch and keyboard.
  Dates before creation or after today are disabled. Marking persists once per date; unmarking is
  explicit and offers undo for the latest unmark per habit until the dashboard closes or another
  change to that habit succeeds. Retained recovery records support guarded restoration afterward until explicitly deleted.
  Loading, empty, saved, failure, invalid-note and recovery states must be communicated with text,
  not color alone.
- Habit actions: create with a nonblank name and target 1–7 (default 7); rename; schedule a target
  change or archive for next week; reactivate this week. Historical records remain accessible,
  including for archived habits.
- Live behavior: update after successful note changes or valid external edits. Detect a new local
  date/zone after the app resumes and while the view is open; a new week shows the current month
  and highlights its week. An incomplete current week does not break the previous weekly streak.
- Small screens: preserve names and dates through responsive layout/scrolling, with focus indicators
  and usable touch targets. Theme styling follows Obsidian variables; no network is required.
- Errors: identify the affected habit and issue in text; focus the error/recovery dialog and provide
  labeled keyboard- and touch-operable controls. Failed persistence, invalid files, duplicates and
  conflicts are actionable. A detected conflict leaves the existing note unchanged and provides
  comparison, explicit resolution, and recovery after reopening. The recovery area lists records
  and explains retention; deleting selected records requires an explicit confirmation and warning.
  All recovery interactions work offline on desktop, iOS and Android.
