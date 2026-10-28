# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing TypeScript Obsidian plugin built with esbuild and tested with Vitest. The dashboard is an
Obsidian `ItemView` rendered with native DOM and CSS; no frontend framework.

## Users

Individual Obsidian users who track a small set of weekly habits in their own vault. They use the
dashboard during a short daily check-in and while reviewing earlier weeks. The plugin must work
offline on desktop and mobile, including iOS and Android.

## Product Purpose

Turn a vault of ordinary Markdown habit notes into a compact weekly grid: mark the days completed,
see progress against weekly targets, and review durable history without losing control of the data.
Success means the next mark is obvious, the week is readable at a glance, and every change is
guarded without overwriting concurrent edits.

## Positioning

Habits live in user-readable Markdown notes, but the dashboard behaves like a precise seven-day
matrix, not a generic task list. Completion runs are drawn as connected sequences so consistency is legible
without gamification or decorative dashboards.

## Operating Context

- Weekly targets from 1 to 7 days; weeks run Monday through Sunday.
- Local calendar dates; history remains editable through today.
- One Markdown note per habit; all content outside the managed block is preserved.
- Guarded writes detect concurrent note changes and warn without overwriting them; there is no
  per-edit recovery journal.
- The dashboard is opened as a main workspace tab and may be viewed in a narrow pane.

## Capabilities and Constraints

- Create habits, mark/unmark eligible days, re-mark them directly, and correct historical dates.
- Choose or remove an optional completion color per habit; absence uses the theme accent.
- Weekly progress, effective targets, current streaks, archived weeks, and future stored dates must
  remain visible and truthful through week navigation.
- Target and archive changes take effect next week; reactivation applies in the current week.
- Concurrent edits and failures must be reported without overwriting the existing note.
- Keyboard, touch, focus, text labels, and Obsidian theme variables are required.
- Never drop unrelated note content or delete habit data without explicit user action.

## Brand Commitments

The user pinned the visual direction to the supplied references: a restrained dark-first seven-day habit grid,
compact rows, habit names on the left, exactly seven date columns, completion runs drawn as
unlabeled capsules, and discreet previous/next/current week navigation. The year sits smaller above
the week range, and crossing years show both. The dashboard opens on the current week and lives in
the main workspace tab, never as the primary right-sidebar surface. There is no monthly grid or
month selector. The default accent is theme-aware, with an optional per-habit color;
the accent comes from the active Obsidian theme.

## Evidence on Hand

- Product specification and data contract under `specs/001-weekly-habit-dashboard/`.
- Existing automated tests for targets, streaks, history, guarded writes, accessibility, and lifecycle.
- Synthetic habit data only; no testimonial, customer, or performance claims exist.

## Product Principles

1. The habit grid is the product; controls recede until they are needed.
2. One week is the frame; density is a feature, but labels and state must remain legible without color alone.
3. Repeated sequences are the signature: show consistency as a visual rhythm, not a score.
4. Every edit is explicit and guarded; failures leave the saved note intact, and week navigation is
   the history mechanism.
5. Keep the Obsidian surface familiar; no new workflow is invented for visual effect.

## Accessibility & Inclusion

The dashboard must remain operable by keyboard and touch, expose unique labels for every day, keep
focus visible, use text for state, and respect reduced motion. Narrow screens must preserve access to
every habit and date through responsive layout or horizontal scrolling with a sticky habit column.
