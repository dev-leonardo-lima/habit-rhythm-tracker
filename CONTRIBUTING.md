# Contributing to Habit Tracker

Thanks for helping improve Habit Tracker. Bug reports, documentation, accessibility work, tests,
and code changes are all welcome.

## Before you start

For a bug report, describe the expected and actual behavior, steps to reproduce, your Obsidian and
operating system versions, and any relevant error messages. Use synthetic habits and remove private
vault content before sharing logs or screenshots.

For a substantial feature or behavior change, consider opening an issue first so the approach can
be discussed before you invest in an implementation. The current requirements and design decisions
are documented in [specs/001-weekly-habit-dashboard](specs/001-weekly-habit-dashboard/).

## Development setup

You need Node.js 24 LTS, npm 11 or later, and Obsidian. Use a separate test vault for development,
especially for tests involving note writes or failures. If you use nvm, run `nvm use` to select the
version pinned in `.nvmrc`.

1. Fork the repository and clone your fork.
2. From the project root, install the pinned dependencies and build the plugin:

   ```sh
   npm ci
   npm run build
   ```

3. Create `.obsidian/plugins/habit-tracker/` inside your test vault and copy `main.js`,
   `manifest.json`, and `styles.css` into it.
4. Enable **Habit Tracker** in Obsidian's community plugin settings and open its dashboard from the
   ribbon or command palette.

Run `npm run dev -- --watch` to rebuild `main.js` when source files change. Copy the rebuilt file
and any changed stylesheet to the test vault and reload the plugin or Obsidian to see the changes.
See [docs/development.md](docs/development.md) for the full command reference.

## Checks

Run the following before opening a pull request:

```sh
npm run typecheck
npm run lint
npm run format:check
npm run test:coverage
npm run build
```

The coverage command enforces at least 80% line and branch coverage for maintained code. Use
`npm test` for a quicker test run while developing; `npm run format` formats the files covered by
Prettier. Automated DOM tests do not replace testing the plugin in Obsidian. For UI or platform
changes, record the environments you checked and any you could not test.

## Guidelines

- Keep the plugin offline and compatible with Obsidian desktop and mobile. Use supported Obsidian
  APIs, native DOM controls, theme variables, and keyboard- and touch-accessible interactions.
- Protect vault content: do not delete data without an explicit user action, preserve text outside
  managed habit blocks, and keep conflicts and failures visible without overwriting changes.
- Keep weekly targets, streaks, local dates, and archive behavior consistent with the
  [feature specification](specs/001-weekly-habit-dashboard/spec.md).
- Add or update meaningful tests for changed behavior, especially date boundaries, persistence,
  conflicts, and habit lifecycle rules. Use synthetic fixtures and an isolated test vault.
- Keep changes focused and follow the project's strict TypeScript, ESLint, and Prettier settings.
  Preserve third-party license notices when incorporating external work.

## Commits and pull requests

Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages, for example:

```text
feat(ui): add a habit setting
fix(storage): preserve notes on conflicts
docs: clarify installation
```

For a pull request, explain what changed and why, link any related issue, and list the checks you
ran. Include screenshots or a short recording for visual changes, using synthetic data. Describe
any data-format, compatibility, or migration impact and identify platforms you could not test.

Release version changes are an explicit maintainer decision; release automation is not implemented
yet. When preparing a release, keep `package.json`, `package-lock.json`, and `manifest.json` aligned
and add the corresponding compatibility entry to `versions.json`. Do not assume a commit type
automatically creates a release.

## License

By contributing, you agree that your contributions are made available under the project's
[GNU General Public License v3.0 only](LICENSE). Third-party material retains its applicable license;
see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
