# Development

For contribution workflow, pull request guidance, and the project license, see
[CONTRIBUTING.md](../CONTRIBUTING.md).

## Requirements

- Node.js 24 LTS (pinned by `.nvmrc`; run `nvm use` if you use nvm).
- npm 11 or later.
- An isolated Obsidian test vault for manual verification. Do not use a production vault for fault
  injection.

## Setup

```sh
nvm use
npm ci
```

## Commands

| Command                  | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `npm run dev`            | Development build producing `main.js`                              |
| `npm run dev -- --watch` | Rebuild `main.js` when source files change                         |
| `npm run build`          | strict typecheck plus production esbuild bundle                    |
| `npm run typecheck`      | `tsc --noEmit` with strict settings                                |
| `npm run lint`           | ESLint flat config                                                 |
| `npm run format`         | Prettier write                                                     |
| `npm run format:check`   | Prettier check (generated output, Spec Kit, and lockfile excluded) |
| `npm test`               | Vitest unit and integration tests                                  |
| `npm run test:coverage`  | Vitest with V8 coverage and 80% line/branch thresholds             |

The maintained application code under `src/` must keep at least **80% line and 80% branch
coverage**. Generated output (`main.js`, `coverage/`) is excluded. A failure to reach the threshold
fails the command.

## Tests

- `tests/unit/` covers local dates, note codecs, weekly targets, streaks, yearly history, week views,
  settings, and guarded-write result validation.
- `tests/integration/` covers repository discovery, guarded writes and creation,
  repeated marking, conflicts, lifecycle changes, week navigation, activity history, icon pagination,
  management focus and drafts, UI rendering, and plugin lifecycle.
- `tests/mocks/obsidian.ts` provides the minimal Obsidian runtime used by Vitest; production builds
  use the real `obsidian` package as an external dependency.
- Fixtures are synthetic. Tests never read or write a personal vault.

## Sample vault installation

```sh
npm run build
mkdir -p "<vault>/.obsidian/plugins/habit-tracker"
cp main.js manifest.json styles.css "<vault>/.obsidian/plugins/habit-tracker/"
```

Enable the plugin and open the dashboard from the command palette or ribbon. The default folder is
`Habits`; change it in **Settings → Habit Tracker**.

## Conventional Commits

All commits use the [Conventional Commits](https://www.conventionalcommits.org/) format:

```text
type(scope): description
```

- `type` is required: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `build`, `ci`, `perf`, or
  `style`.
- `scope` is optional and describes the affected area, for example `feat(storage): guard note writes`.
- Use the imperative mood and keep the description concise.
- Mark breaking changes with `!` after the type/scope and/or a `BREAKING CHANGE:` footer.

Examples:

```text
feat(ui): add weekly habit dashboard
fix(storage): retain conflicts after reopening
docs: document guarded writes and conflict warnings
test(storage): cover guarded conflicts and failed writes
```

Release version selection is an explicit developer action. Do not infer a release from commit types
in this feature.

## Feature 002

Release automation (CI/CD, versioning, and plugin publishing) belongs to the separate feature
`002-automated-plugin-release`. This feature only provides the build, test, coverage, and manifest
inputs that release automation can consume. Do not implement the 002 pipeline here.

## Manual verification

Use [specs/001-weekly-habit-dashboard/quickstart.md](../specs/001-weekly-habit-dashboard/quickstart.md)
for functional and conflict scenarios. Record actual desktop/iOS/Android results or the
unverified platform and reason in
[specs/001-weekly-habit-dashboard/validation.md](../specs/001-weekly-habit-dashboard/validation.md).
