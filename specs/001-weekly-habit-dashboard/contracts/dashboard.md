# Contract: Weekly Dashboard Interaction

- Entry: a command and ribbon action open an Obsidian view. On open it displays the current local
  week, Monday through Sunday, as exactly seven date columns with habits in rows. Today is clearly
  marked. Previous/next week arrows reach history and return to the current week.
- Layout: one week only. Each habit appears once per week with its seven day cells, weekly
  completion count, effective target, state and current streak. The week block, arrows, year, and
  range are centered together; no habit count is shown. The date range is visible once, with the
  year as a smaller label centered above it; a crossing week names both years. A gutter separates
  the name column from the first day while headers and cells stay aligned. Completion runs are
  connected capsules without count labels; progress remains textual without a duplicate target or rail.
  No monthly grid or month
  selector is the primary view. Stored dates now in the future remain visible but do not count.
- Interactions: a uniquely labeled checkbox per habit/date works with pointer, touch and keyboard.
  Dates before creation or after today are disabled. Marking persists once per date; unmarking is
  explicit, and the same eligible date can be marked again without a separate undo control. Hover
  and focus highlights follow the capsule geometry. Successful routine
  changes do not raise a persistent banner; loading, empty, failure, conflict, and invalid-note
  states must be communicated with text, not color alone.
- Habit actions: create with a nonblank name and target 1–7 (default 7) in an always-visible row;
  rename; choose or remove an optional icon from Obsidian's local registry; choose or remove an
  optional per-habit completion color with a circular swatch that
  applies immediately; schedule a target change or archive for next week; reactivate this week. A
  missing or invalid color uses the theme accent and affects only that habit. Archived habits stay
  available through Manage habits. Historical records remain accessible by navigating to earlier
  weeks, including for archived habits.
- Individual history: selecting a habit name opens a read-only yearly activity calendar and current
  and best streaks in successful weeks, with total marked days through today. Calendar years run from
  habit creation to the current year. Archived-week and future marks remain identifiable; future
  marks are excluded from counts and streaks until their date. The management list also provides
  history for archived habits, and past marks are edited through the weekly grid.
- Management: a compact list displays the current target, current-week progress and streak for
  active habits, plus archived status and streak for archived habits. An Edit disclosure reveals
  the habit controls in place; opening another closes the previous editor while retaining its
  unsaved input during the view session. Automatic updates retain open disclosures and unsaved form
  input. The icon picker searches the local registry and pages through all matching results.
- Live behavior: update automatically after successful note changes or valid external edits; no
  manual Refresh or More menu is exposed. Detect a new local date/zone after the app resumes and
  while the view is open; a new week shows the current week. An incomplete current week does not
  break the previous weekly streak.
- Small screens: place habit details above seven aligned day cells, with at least 44px per day and
  horizontal scrolling when necessary. The yearly calendar scrolls horizontally with weekday labels
  visible. Preserve focus indicators. Theme styling follows Obsidian variables; no network is
  required.
- Errors: identify the affected habit and issue in text; focus an error surface when shown and
  provide labeled keyboard- and touch-operable controls, including the color input and its
  "Use theme color" action. Failed persistence, invalid files, duplicates and conflicts are
  actionable. A detected conflict leaves the existing note unchanged and reports a clear warning;
  the person can review the note and repeat the action explicitly. No recovery journal or recovery
  area is created. Error flows work offline on desktop, iOS and Android.
