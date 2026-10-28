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
- Habit names left; compact target, streak, and status text underneath.
- Completion runs are continuous capsules without count labels; progress stays textual.
- The year is a small centered label above the week range; crossing years name both.
- Quiet typographic navigation; advanced controls are progressively disclosed.
- Hairlines and tonal layering instead of cards, shadows, or decorative chrome.

## Colors

The palette is restrained: Obsidian neutrals tinted by the active theme, plus a single violet accent
that carries completion and current-week meaning.

### Primary

- **Theme Violet** (`#8a5cf5` reference): default completion runs, current-day ring, current-week
  marker, and primary create action. The live value is `var(--interactive-accent)`; the accent is
  never used for decoration.
- **Habit Color** (optional per-habit `#rrggbb`): applies only to that habit's completion marks.
  When absent or invalid, the habit falls back to the theme accent.

### Neutral

- **Deep Ground** (`#1c1c1c` reference): the page and grid ground.
- **Raised Surface** (`#282828` reference): messages, code blocks, hover rows, and popover ground.
- **Primary Text** (`#dadada` reference): habit names and dates.
- **Muted Text** (`#b3b3b3` reference): target, streak, and weekly status.
- **Faint Text** (`#666666` reference): weekday labels, separators, and secondary metadata.
- **Hairline** (`#333333` reference): one-pixel week, row, and table boundaries.

### Named Rules

**The One Accent Rule.** Only the theme accent marks completion, the current day/week, and the primary
create action. Everything else is neutral.

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

The dashboard is a centered strip up to 1080px inside the main Obsidian tab. The week header holds
small previous/next arrows around a centered year label and range; a current-week marker sits
beneath it. The grid uses a fixed habit column (240px) and seven fluid day columns; the full week
fits without horizontal scrolling. Rows are 58px high, with a 20px week context row and a 38px date
row.

Below the grid, bordered disclosures stack in order: New habit and Manage habits. Details expand in
place. On narrow widths the header wraps, the habit column narrows
to 156px then 124px, and all seven days still fit by sharing the remaining width. No modal is used
for creation or management.

## Elevation & Depth

The system is flat. Depth comes from tonal surfaces, hairlines, and one popover shadow. The week grid
has no card shell; table boundaries are single-pixel lines. The More popover may use a single soft
ambient shadow (`0 8px 24px rgba(0, 0, 0, 0.22)`) to separate it from the ground.

## Shapes

Corners are restrained: 6px for fields and buttons, 7px for message surfaces, and full pills for
state labels. Completion runs are the signature shape: adjacent completed days share a continuous
26px capsule with 13px rounded ends, and an isolated completed day is the same full-cell capsule.
Empty days keep a small centered hint. Hover and focus highlights use the same capsule geometry as
the marks, so the realce never becomes a larger offset rectangle.

## Components

### Week Navigation

Icon-only chevrons at 32px, muted at rest. Hover raises the text to normal; focus uses a 2px accent
ring. The year is a small centered label above the week range; a crossing week shows both years.
The range is the only headline. Current-week emphasis stays in the headers: accent text on the
seven day labels, the “This week” context label, and today’s date marker. Day-header and body
surfaces keep the ground tone, with no filled band, so completion marks stay the focus. “This week”
appears as a quiet text button only when the visitor is browsing history.

### Day Toggle

The whole day cell is the hit area. A visually hidden native checkbox keeps keyboard, touch, and
screen-reader semantics. Completed days form unlabeled capsules in the habit's color or the theme
accent. Hover and focus draw a capsule-shaped halo aligned with the mark. Disabled future or
pre-creation days remain visible but muted.

### Habit Row

A sticky habit cell holds the name, then `target/wk`, streak, and the selected week's
`completed / target · outcome`. The row uses a hairline bottom border and a tonal hover, never a card.
Archived rows are muted and labeled in text.

### Disclosure

Hairline-top rows with a small rotating chevron. New habit and Manage habits use the same pattern. The summary remains a standard focusable `<summary>`; details open in place.

### Inputs and Buttons

Inputs are 30px high, 6px radius, ground-colored, with a hairline border and accent focus. The color
picker sits beside its Save color action and names the habit in its accessible label; “Use theme
color” removes a custom value. Primary creation uses the theme accent; all secondary actions are
text or hairline ghost buttons. Touch targets grow on narrow screens.

## Do's and Don'ts

### Do:

- **Do** keep one week, exactly seven date columns, and habits in rows.
- **Do** draw consecutive completions as connected capsules without count labels.
- **Do** keep target, streak, and weekly outcome visible in words.
- **Do** use the theme accent by default and apply an optional habit color only to that habit.
- **Do** keep the year smaller and centered above the visible week range.
- **Do** preserve focus, keyboard access, touch targets, and progressive disclosure.

### Don't:

- **Don't** add a monthly grid, month selector, or all-weeks table as the primary view.
- **Don't** turn weeks into separate cards or nest cards.
- **Don't** use color alone for completion, state, or errors.
- **Don't** hide target, streak, or weekly outcome behind hover-only affordances.
- **Don't** replace native checkboxes, summaries, or form controls with custom div controls.
