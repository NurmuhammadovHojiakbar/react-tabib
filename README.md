# react-tabib

`react-tabib` is a production-oriented static analysis CLI for React codebases. It scans JavaScript and TypeScript React files, looks for likely memory leaks and lifecycle misuse, and reports both high-confidence issues and heuristic risks before they reach production.

## What it checks

- Timers created in `useEffect` without `clearInterval`, `clearTimeout`, `cancelAnimationFrame`, or `cancelIdleCallback`
- Event listeners added in `useEffect` without matching removal
- Persistent resources and subscriptions not disposed:
  - `WebSocket`
  - `EventSource`
  - Rx-style `.subscribe()`
  - emitter `.on()` without `.off()` / `.removeListener()`
- Observers not disconnected:
  - `MutationObserver`
  - `ResizeObserver`
  - `IntersectionObserver`
- Async effects that may update stale state after unmount
- Repeated side effects caused by missing dependency arrays

The current implementation intentionally separates high-confidence checks from heuristic ones. It does not claim to prove runtime leaks; it highlights suspicious patterns with explicit confidence levels.

## Installation

Run directly with `npx` after publishing:

```bash
npx @hojiakbar/react-tabib
```

Or install locally:

```bash
npm install --save-dev @hojiakbar/react-tabib
```

After local installation, the executable is still `react-tabib` because the package keeps that `bin` name.

## Usage

```bash
npx @hojiakbar/react-tabib
npx @hojiakbar/react-tabib --path ./src
npx @hojiakbar/react-tabib --format compact
npx @hojiakbar/react-tabib --json
npx @hojiakbar/react-tabib --severity high
npx @hojiakbar/react-tabib --max-warnings 0
npx @hojiakbar/react-tabib --ignore "storybook/**"
npx @hojiakbar/react-tabib --config react-tabib.config.ts
npx @hojiakbar/react-tabib --summary-only
```

If the package is installed in the current project, you can also run:

```bash
npx react-tabib
```

## CLI flags

- `--path <dir>`: scan a custom directory
- `--json`: emit JSON instead of terminal text
- `--format <table|compact|json>`: choose reporter format
- `--severity <level>`: set the minimum displayed severity and fail threshold
- `--max-warnings <count>`: fail if findings exceed the limit
- `--ignore <glob>`: add an ignore pattern
- `--config <path>`: load a config file
- `--no-color`: disable ANSI colors
- `--debug`: print resolved metadata to stderr
- `--summary-only`: only print summary information in table format

## Config file

Create `react-tabib.config.ts` or `react-tabib.config.js`:

```ts
import type { ReactTabibConfig } from '@hojiakbar/react-tabib';

const config: ReactTabibConfig = {
  ignore: ['storybook/**'],
  disabledRules: ['repeated-side-effect'],
  severityOverrides: {
    'async-unmount-update': 'high',
  },
  reporter: 'table',
  failOnSeverity: 'high',
  maxWarnings: 0,
};

export default config;
```

## Inline suppressions

- `// react-tabib-ignore-file`
- `// react-tabib-ignore-next-line rule-id`

Use suppressions sparingly and only after reviewing the finding.

## Example terminal output

```text
src/App.tsx
  CRITICAL 24:3 event-listener-cleanup (high)
    window adds an event listener in useEffect without a matching removal.
    Why: The listener can accumulate on every render and keep component closures alive.
    Fix: Return a cleanup function that calls removeEventListener with the same target and handler.

Summary
  Files scanned: 12
  Findings: 4
  Severity counts: critical=1, high=2, medium=1, low=0
  Categories: events=1, timers=1, subscriptions=1, async=1
  Rules triggered: event-listener-cleanup, use-effect-timer-cleanup, subscription-cleanup, async-unmount-update
Recommended next actions
  Address critical/high issues first, then add suppressions only for reviewed false positives.
  Re-run after fixes and consider enabling the JSON report in CI.
```

## Example JSON output

```json
{
  "rootPath": "/repo",
  "findings": [
    {
      "ruleId": "use-effect-timer-cleanup",
      "category": "timers",
      "severity": "high",
      "confidence": "high",
      "filePath": "/repo/src/App.tsx",
      "line": 12,
      "column": 11,
      "snippet": "const timer = setInterval(doWork, 1000);",
      "explanation": "setInterval is created inside useEffect but is not cancelled in the cleanup function.",
      "impact": "The callback can keep running after the component unmounts and retain component state or closures.",
      "suggestion": "Store the handle and call clearInterval in the function returned from useEffect."
    }
  ],
  "filesScanned": 12,
  "filesWithErrors": [],
  "skippedFiles": 0,
  "rulesTriggered": ["use-effect-timer-cleanup"],
  "summary": {
    "bySeverity": {
      "low": 0,
      "medium": 0,
      "high": 1,
      "critical": 0
    },
    "byCategory": {
      "timers": 1
    }
  }
}
```

## Architecture

- `src/cli/`: command-line entry point
- `src/core/`: project orchestration and analyzer
- `src/filesystem/`: file discovery
- `src/parser/`: Babel parsing
- `src/rules/`: modular rule registry and rule implementations
- `src/reporters/`: table, compact, and JSON formatters
- `src/config/`: defaults and config loader
- `src/types/`: shared types
- `tests/`: fixture-driven tests and reporter snapshots

## Design decisions and tradeoffs

- Babel-based AST parsing is fast and broadly compatible with mixed JS/TS React codebases.
- Rules are modular and metadata-driven so the same engine can later back an ESLint rule set or editor diagnostics.
- Some checks are inherently heuristic, especially async state updates and repeated side effects. Those are marked with medium confidence rather than overstating certainty.
- The analyzer currently uses limited local identifier tracking inside `useEffect`, which keeps the MVP reliable and understandable without pretending to be a full interprocedural dataflow engine.

## High-confidence vs heuristic checks

High-confidence:

- Missing timer cleanup when a handle is clearly assigned
- Missing `removeEventListener` when setup is explicit
- Missing `unsubscribe`, `close`, or `disconnect` for obvious resources

Heuristic:

- Async work that may resolve after unmount
- Effects with missing dependency arrays that may repeatedly attach side effects
- `.on()` style event emitters where exact cleanup pairing may be ambiguous

## CI usage

Use JSON output for machine parsing and fail on high-severity issues:

```bash
npx @hojiakbar/react-tabib --json --severity high --max-warnings 0
```

## Limitations

- Static analysis cannot prove actual heap retention or runtime leak severity.
- The current analyzer focuses on `useEffect`-driven resource lifecycles.
- Deep dataflow across helper functions, third-party abstractions, and custom hooks is intentionally conservative in this MVP.
- `.ts` config loading is supported through on-the-fly transpilation, but configs that depend on complex ESM-only runtime behavior may need `.mjs`.

## Build and publish

```bash
npm run build
npm test
npm run lint
npm run typecheck
npm publish --access public
```

Before publishing:

- Make sure the scoped package name `@hojiakbar/react-tabib` is available to your npm account
- Bump `version` in `package.json`
- Verify the `bin` entry points to `dist/cli.js`

## Future evolution

To evolve this into an ESLint plugin:

- Reuse the rule metadata and analysis logic as rule adapters
- Convert findings into ESLint diagnostics with node-level reporting
- Add optional safe autofixes for simple patterns

To evolve this into a VS Code extension:

- Run the analyzer on save or in a language server
- Surface findings as diagnostics with code actions
- Add workspace-level config and suppression management
