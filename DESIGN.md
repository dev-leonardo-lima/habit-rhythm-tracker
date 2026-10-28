---
name: Habit Tracker
description: A compact seven-day habit strip inside Obsidian, built around completion sequences.
colors:
  accent: '#8a5cf5'
  background: '#1c1c1c'
  surface: '#282828'
  text: '#dadada'
  text-muted: '#b3b3b3'
  text-faint: '#666666'
  border: '#333333'
typography:
  headline:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    fontSize: '19px'
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: '-0.025em'
  body:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    fontSize: '11.5px'
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: '0em'
  label:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    fontSize: '9px'
    fontWeight: 450
    lineHeight: 1.3
    letterSpacing: '0.01em'
rounded:
  sm: '4px'
  md: '6px'
  lg: '8px'
  pill: '999px'
spacing:
  xs: '2px'
  sm: '4px'
  md: '6px'
  lg: '10px'
  xl: '16px'
  xxl: '20px'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.background}'
    rounded: '{rounded.md}'
    padding: '0 12px'
    height: '30px'
  button-ghost:
    backgroundColor: '{colors.background}'
    textColor: '{colors.text-muted}'
    rounded: '{rounded.md}'
    padding: '7px 8px'
    height: '26px'
  field:
    backgroundColor: '{colors.background}'
    textColor: '{colors.text}'
    rounded: '{rounded.md}'
    padding: '3px 8px'
    height: '30px'
  day-completed:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.background}'
    rounded: '{rounded.lg}'
    height: '16px'
---

# Design System: Habit Tracker

## Overview

**Creative North Star: "The Week Strip"**

The dashboard is one week seen as a single quiet strip. It behaves like a studio wall chart: names
stay in place, seven dates run across, and consistency appears as connected marks rather than badges
or scores. The surrounding Obsidian chrome remains familiar; the plugin earns its character through
density, rhythm, and one accent.

The surface is deliberately dark-first but theme-driven: the runtime reads Obsidian's interface,
accent, neutral, border, and type variables. Hex values above are the dark-theme reference used for
design review and should not be treated as fixed brand colors. Light themes inherit the same
relationships with their own values.

**Key Characteristics:**

- One Monday–Sunday week, exactly seven columns, no monthly calendar.
- Habit names left; compact weekly progress, outcome, and streak text underneath.
- Completion runs are continuous capsules without count labels; each habit also has textual
  progress without repeating the target or adding another progress rail.
- The year is a small centered label above the week range; crossing years name both.
- Quiet typographic navigation; advanced controls are progressively disclosed.
- Hairlines and tonal layering instead of cards, shadows, or decorative chrome.

## Colors

The palette is restrained: Obsidian neutrals tinted by the active theme, plus a single violet accent
that carries completion and current-week meaning.

### Primary

- **Theme Violet** (`#8a5cf5` reference): default completion runs, current-day header outline, current-week
  marker, and primary create action. The live value is `var(--interactive-accent)`; the accent is
  never used for decoration.
- **Habit Color** (optional per-habit `#rrggbb`): applies to that habit's completion marks and icon.
  When absent or invalid, the habit falls back to the theme accent.

### Neutral

- **Deep Ground** (`#1c1c1c` reference): the page and grid ground.
- **Raised Surface** (`#282828` reference): messages, code blocks, hover rows, and popover ground.
- **Primary Text** (`#dadada` reference): habit names and dates.
- **Muted Text** (`#b3b3b3` reference): target, streak, and weekly status.
- **Faint Text** (`#666666` reference): weekday labels, separators, and secondary metadata.
- **Hairline** (`#333333` reference): one-pixel week, row, and table boundaries.

### Named Rules

**The One Accent Rule.** The theme accent marks completion, the current day/week, the primary create
action, and habit icons without a custom color. Other surfaces remain neutral.

**The Theme Ownership Rule.** Runtime colors come from Obsidian variables. The hex values here are a
dark-theme reference, not a replacement palette.

## Typography

**Display Font:** None; the interface uses Obsidian's interface stack.
**Body Font:** Obsidian interface stack, with Inter and system sans fallbacks.
**Label/Mono Font:** None; all UI text uses the interface stack.

**Character:** A single workhorse sans. The hierarchy comes from scale, weight, and spacing rather
than a display face. Numerals are tabular so dates, targets, and counts stay aligned.

### Hierarchy

- **Headline** (650, 19–22px, 1.15): the selected week range; one per view.
- **Year Label** (500, 10px, 1): the year above the range, or both years when the week crosses one.
- **Title** (560, 12px, 1.25): habit names in the grid.
- **Body** (400, 11.5px, 1.45): forms, messages, and disclosure copy.
- **Label** (450, 9–10.5px, 1.3): weekdays, dates, targets, streaks, week status, and disclosure
  summaries.
- **Micro/Caption** (450, 7–8.5px, 1.2–1.3): weekday initials and compact labels.

### Named Rules

**The Quiet Label Rule.** Metadata is small and muted but never hidden or color-only. Status is
always written in words.

## Layout

The dashboard is a centered strip up to 1200px inside the main Obsidian tab. The week header is a
centered group: small previous/next arrows around the year label and range, with the current-week
context directly beneath. It shows no habit count. The grid uses a fixed habit column (240px), a
10px gutter, and seven fluid day columns. A subtle border groups the table, while row separators and
the column header retain the shape of an Obsidian table.

The always-visible New habit row sits above the grid, separated by a hairline. A selected habit's
history opens below the grid; Manage habits is a disclosure below it, with compact rows that expand
in place for editing. The editor groups name and next week's target, then places the color and icon
controls together; the selected icon is shown without its technical name but is identified for
assistive technology. The yearly activity grid
uses the available width while keeping its day cells square, and scrolls on narrower panes. In a
narrow workspace pane or phone-sized view, each habit's details sit above
its seven days, which remain aligned with the weekday header. Each day has a 44px minimum hit area;
very narrow views scroll horizontally if needed. No modal is used for creation or management.

## Elevation & Depth

The system is flat. Depth comes from tonal surfaces and hairlines only. A single border frames the
week grid; table boundaries are single-pixel lines. Routine controls stay in place, and
successful changes do not raise a banner.

## Shapes

Corners are restrained: 6px for fields and buttons, 7px for message surfaces, and full pills for
state labels. Completion runs are the signature shape: adjacent completed days share a continuous
capsule, and an isolated completed day is the same full-cell capsule. Empty days have a centered
outline; unavailable days are muted. Hover and focus highlights use the same capsule geometry as
the marks, so the realce never becomes a larger offset rectangle.

## Components

### Week Navigation

Icon-only chevrons at 32px, muted at rest, centered on either side of the week block. Hover raises
the text to normal; focus uses a 2px accent ring. The year is a small centered label above the week
range; a crossing week shows both years. The range is the only headline and no habit count appears.
Current-week emphasis is a faint accent band across the seven day
headers, plus the “This week” context label and a thin outline around today’s header. The header labels keep their
normal text color and body cells keep the ground tone, so completion marks stay the focus. “This
week” appears only on the current week; other weeks leave the same space empty so the layout stays
stable. Navigation in both directions uses the arrows.

### Day Toggle

The whole day cell is the hit area. A visually hidden native checkbox keeps keyboard, touch, and
screen-reader semantics. Completed days form unlabeled capsules in the habit's color or the theme
accent. Hover and focus draw a capsule-shaped halo aligned with the mark. Disabled future or
pre-creation days remain visible but muted.

### Habit Row

A habit cell holds an optional local Obsidian icon and the name as a history control. Compact
metadata shows the selected week's `completed / target · outcome` and the current
streak; no separate target label or progress rail repeats those values. Future marks do not count
as completed. The row uses a hairline bottom border and a tonal hover. Archived rows are muted and
labeled in text.

### Habit History and Management

The individual history is a bordered section with current and best streaks in weeks, marked days,
and a read-only yearly calendar. Calendar squares follow the habit color, with labels for archived,
unmarked, and unavailable days. Year navigation stays within the habit's recorded lifetime, and
the calendar scrolls horizontally when space is limited. Management is a compact list of names,
targets, current-week progress, and streaks; an Edit disclosure reveals the existing controls.
On narrow screens, the name and metadata sit above the day controls, keeping each day easy to tap.
Only one habit editor is expanded at a time; switching rows preserves unsaved form input in the view.
The row has an accessible description without a redundant tooltip covering the editor.

### Disclosure

Hairline-top rows with a small rotating chevron. Manage habits uses this pattern; the New habit form
is always visible above the grid. The summary remains a standard focusable `<summary>`; details open
in place.

### Inputs and Buttons

Inputs are 30px high, 6px radius, ground-colored, with a hairline border and accent focus. The color
control is a true circular swatch with a 34px touch target; choosing a color applies immediately,
and **Use theme color** sits beside it, disabled when the theme is already active. The input names
the habit in its accessible label. A searchable, paginated in-place icon picker uses Obsidian's local
icon registry, with labeled, touch-sized choices and an explicit remove action. Primary creation uses the theme accent; all secondary actions are
text or hairline ghost buttons. Touch targets grow on narrow screens.

## Do's and Don'ts

### Do:

- **Do** keep one week, exactly seven date columns, and habits in rows.
- **Do** draw consecutive completions as connected capsules without count labels.
- **Do** keep target, streak, and weekly outcome visible in words.
- **Do** use the theme accent by default and apply an optional habit color only to that habit.
- **Do** keep the year smaller and centered above the visible week range, with no habit count.
- **Do** keep New habit visible, refresh automatically, and reserve banners for errors or conflicts.
- **Do** preserve focus, keyboard access, touch targets, and progressive disclosure where it earns its place.

### Don't:

- **Don't** add a monthly grid, month selector, or all-weeks table as the primary view.
- **Don't** turn weeks into separate cards or nest cards.
- **Don't** use color alone for completion, state, or errors.
- **Don't** hide target, streak, or weekly outcome behind hover-only affordances.
- **Don't** replace native checkboxes, summaries, or form controls with custom div controls.
