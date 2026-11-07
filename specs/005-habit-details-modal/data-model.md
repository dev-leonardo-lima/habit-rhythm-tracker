# Data Model: Habit Details Modal

**Feature**: [spec.md](spec.md)
**Design**: [plan.md](plan.md)

## Persistent data

The existing Habit, target/state histories, completion records, and note format remain unchanged.
See [version-1 notes](../../docs/data-format.md). Opening, navigating, or dismissing
details does not write a note. Existing mutations and explicitly confirmed whole-note deletion
remain the only data-changing actions. No migration, additional setting, or persisted draft exists.

## Read-only presentation data

| Model                   | Fields and meaning                                                                                                    | Source                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `HabitSummaryViewModel` | Existing ID, note path, name, color/icon, creation date, current state/target/progress/streak, pending target/archive | Controller's validated discovery, evaluated as of today |
| `HabitDetailViewModel`  | Summary fields plus the existing `HabitHistory` for one selected year                                                 | `getHabitDetail(habitId, year)`; no I/O                 |
| Archived collection     | Summaries whose current state is archived; count equals list length                                                   | Derived from all summaries, independent of focused week |
| `duplicateHabitIds`     | Read-only set of IDs whose normalized comparison names repeat among valid active/archived summaries                   | Derived once per view-model projection, including hidden rows |
| `settingsChanging`      | Existing transition flag exposed in `DashboardViewModel`                                                              | Existing controller settings lifecycle                  |

The detail projection selects only a valid habit ID from the same accepted discovery snapshot used
by the dashboard. Invalid notes and duplicate-ID groups stay in existing issue feedback. A unique
name is not an identity guarantee. Clamp the requested year to the interval between creation and
today's year, using the existing history behavior.

The name comparison key is derived only and never stored in a note. Creation and rename use fresh
discovery plus a small controller queue per requested key to prevent colliding submissions. Existing
duplicate names remain valid; the same key controls UI path disambiguation without changing IDs.

Remove controller-global selected-habit/year state and `DashboardViewModel.detail` after migration.
Current-week summaries remain separate from the selected week's row eligibility and outcomes.
`target` remains the effective current-week progress target. `configuredTarget` exposes the saved
current-week target before creation-week adjustment. The editor uses `pendingTarget` when present,
otherwise `configuredTarget`, regardless of the week currently displayed by the dashboard. A
seven-day habit created on Saturday therefore has a two-day first-week progress target but a
seven-day editing default and next-week target. This is derived presentation data, not a note change.

## Transient state and ownership

| Owner                | State                                                                             | Lifetime                                                                          |
| -------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `HabitDashboardView` | Active modal reference; originating habit ID and grid/archive entry kind          | One active modal per view                                                         |
| `HabitDashboardView` | `Map<habitId, { name?: string; target?: string }>` containing raw dirty input     | Current dashboard session; clear on view closure or folder/controller replacement |
| `HabitDetailModal`   | Captured controller and habit ID; active year                                     | One opening; initially current year and visible editor                            |
| Editor               | Stable input elements and last rendered saved baselines                           | Keep mounted across normal updates                                                |
| Modal                | Owned deletion preparation/request and submission-in-flight indicators            | Only the active deletion interaction; controller owns actual protection/outcome   |
| Modal/view           | Modal vertical scroll, calendar horizontal scroll for its year, stable focus keys | Preserve during refresh; restore originating dashboard context on close           |

A cached draft is absent for a pristine field. Compare the current input with its previous saved
baseline before applying incoming saved information. Untouched fields adopt the latest values;
dirty fields retain raw input. On a successful submission, clear that field's draft only if it
still matches the submitted raw value. Preserve other fields and newer typing. Retire drafts for
habits that are successfully deleted or no longer safely available.

Quick creation snapshots its raw name/target and originating view subscription while awaiting the
controller. After success, reset the form only if the active subscription/controller and both raw
values still match; newer or other-view input remains untouched. This snapshot is local to the
promise, not another persisted draft. Dashboard refresh retains the active input's selection and
keeps the current feedback object/paragraph associated with its container through a weak map.

Folder persistence uses one promise queue per plugin instance. Each caller still starts synchronous
deletion invalidation, while saves/rebinds run in request order. Assign the active settings only
after that save and submitted deletion settlement succeed. Rejection leaves the last committed
controller/settings in place and permits the next queued update.

No hidden modal DOM is retained after closure. Reopening shows the editor before history and
restores cached drafts immediately. History year and scroll must survive ordinary refresh, but do not
require caching across separate openings. Every mutation still uses existing validation and fresh
guarded lookup; retaining a draft never authorizes saving it implicitly.

## Interaction transitions

| Event                                               | Result                                                                                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activate a grid/archive name                        | Open that view's modal; title/editor/history visible; focus title                                                                                           |
| Open icon chooser                                   | Float next to the trigger; keep search/page within this modal; close on selection/Escape/outside click                                                      |
| Ordinary controller notification                    | Update saved labels/pristine values and isolated history content; retain active input, draft, year, scroll, and focus                                       |
| Rename/target submission succeeds                   | Adopt saved baseline; clear only the matching submitted draft                                                                                               |
| Submission is blocked, fails, or is uncertain       | Keep input and show the existing result on the visible surface                                                                                              |
| Delete preparation completes                        | Show original prepared question only if that modal/controller/reservation still applies                                                                     |
| Cancel/Escape during unconfirmed deletion           | Release the owned request; return to details and focus Delete habit                                                                                         |
| Confirm deletion                                    | Disable conflicting same-habit controls; retain UI submission state until the existing operation settles                                                    |
| Own deletion succeeds                               | Close modal, remove cached draft, show updated dashboard and appropriate focus                                                                              |
| Own deletion fails or is uncertain                  | Clear the consumed confirmation; show the actual outcome in details if still valid, otherwise on the dashboard; require a fresh request for another attempt |
| Close details                                       | Cache dirty input and cancel only owned unconfirmed work; clear modal reference before callbacks; restore current originating control/fallback              |
| Successful discovery excludes selected ID           | Close safely and report unavailability, preserving a more specific failed/uncertain outcome                                                                 |
| Top-level discovery fails                           | Retain prior accepted snapshot and show load failure; do not infer disappearance                                                                            |
| Settings transition starts                         | Close details and cancel unconfirmed work; retain drafts until settings persistence succeeds, preserving submitted-operation settlement                    |
| Settings persistence fails                         | Keep drafts in the unchanged controller/view so reopening restores them                                                                                    |
| Saved folder/controller is rebound                 | Clear folder-specific drafts before subscribing to the replacement controller                                                                              |
| Dashboard closes                                    | Dispose dialog and clear drafts; late preparation/results cannot reopen it or update another session                                                        |

During its own submitted deletion, a missing projection can be expected before the operation
promise resolves. Await its outcome rather than replacing it with a generic unavailable message.
`isDeletionPending` excludes committing requests and is therefore not a modal-lifetime signal.
Teardown cancels owned unconfirmed work once; a late continuation must not cancel a newer request
for the same habit. No new storage coordinator or persisted operation state is introduced.
An in-flight preparation uses a local `AbortController`; its listener checks the exact pending
reservation before cancellation and is removed when preparation settles. Ready confirmation and
cancellation use the same captured request object. Detected name/path changes report a conflict
and return focus to Delete while preserving dirty input.
