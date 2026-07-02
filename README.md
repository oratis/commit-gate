# @oratis/commit-gate

[![npm version](https://img.shields.io/npm/v/@oratis/commit-gate.svg)](https://www.npmjs.com/package/@oratis/commit-gate)
[![install size](https://img.shields.io/bundlephobia/minzip/@oratis/commit-gate)](https://bundlephobia.com/package/@oratis/commit-gate)
[![license](https://img.shields.io/npm/l/@oratis/commit-gate.svg)](./LICENSE)

A **zero-dependency, config-driven [Conventional Commits](https://www.conventionalcommits.org/) linter**.
One tiny CLI you can drop into a `commit-msg` hook or CI, plus a fully typed
programmatic API. No plugins, no config-cascade, no 100-package install tree —
just a single self-contained binary.

- 🪶 **Zero runtime dependencies** — installs in a blink
- 🔧 **Config-driven** — types, scopes, length, breaking marker, required body sections
- 🪝 Works as a **husky `commit-msg` hook**, a **CI range check**, or a **library**
- 📏 Sensible Conventional-Commits defaults; override only what you need
- 🧾 Clear, actionable error output

## Install

```bash
npm install --save-dev @oratis/commit-gate
```

## Use it as a commit-msg hook (husky)

```bash
# .husky/commit-msg
npx commit-gate "$1"
```

That's it — a bad message is rejected before the commit is created:

```
✖ commit-gate: commit message check failed

Expected: type(scope): summary   (scope optional unless configured)
Types:    feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
Subject:  ≤ 72 chars, starts lowercase/digit, no trailing period

  .git/COMMIT_EDITMSG: Fixed the thing.
    - type "Fixed" is not allowed (allowed: feat, fix, ...)
    - summary must not end with a period
```

## Use it in CI

Lint every commit on a branch:

```bash
npx commit-gate --range origin/main..HEAD
```

## CLI

```
commit-gate <commit-msg-file>     Lint one message file (husky / commit-msg hook)
commit-gate --message "<text>"    Lint a message passed inline  (alias: -m)
commit-gate --range <base..head>  Lint every commit in a git range  (alias: -r)
commit-gate --help                Show help  (alias: -h)
```

Exit codes: `0` valid · `1` lint failure · `2` usage / IO error.

## Configuration

Drop a `commitgate.config.json` (or `.commitgaterc.json`, `.commitgaterc`, or a
`commitGate` key in `package.json`). Everything is optional — unset fields use
the defaults.

```jsonc
{
  // Allowed commit types (default: the Conventional Commits set)
  "types": ["feat", "fix", "docs", "refactor", "test", "chore", "ci"],

  // Restrict scopes. Omit to allow any scope (or none).
  "scopes": ["web", "api", "mobile", "docs"],
  "requireScope": false,

  "maxSubjectLength": 72,       // whole subject line
  "allowBreaking": true,        // allow `feat!: ...`

  // Require sections in the commit body (regex, multiline):
  "bodyRequired": [
    { "pattern": "^WHY:\\s+\\S", "message": "commit body must include a WHY: line" }
  ],

  // Extra subjects to skip entirely (merged with built-in Merge/Revert/fixup!/squash!)
  "exemptPatterns": ["^chore\\(release\\): "]
}
```

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `types` | `string[]` | Conventional set | Allowed `type` values. |
| `scopes` | `string[]` | _any_ | If set, every scope must be listed. |
| `requireScope` | `boolean` | `false` | Force a scope on every commit. |
| `maxSubjectLength` | `number` | `72` | Max length of the subject line. |
| `allowBreaking` | `boolean` | `true` | Allow the `!` breaking marker. |
| `bodyRequired` | `{ pattern, message }[]` | `[]` | Required body sections. |
| `exemptPatterns` | `string[]` | `[]` | Extra subjects to bypass checks. |

## Programmatic API

```ts
import { validateMessage, isValid } from "@oratis/commit-gate";

validateMessage("feat: add search");            // => []  (valid)
validateMessage("Nope.");                        // => ["subject must match ..."]
isValid("fix(api): handle null", { scopes: ["api"] }); // => true
```

## Why another commit linter?

`commitlint` is great but pulls in dozens of transitive packages and a config
ecosystem. `commit-gate` is a **single zero-dependency file** with the 90%
defaults built in and a flat JSON config for the rest — ideal when you want a
fast hook without the install weight.

## License

[MIT](./LICENSE) © [oratis](https://github.com/oratis)
