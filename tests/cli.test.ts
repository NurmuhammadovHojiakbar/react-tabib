import { describe, expect, it } from 'vitest';
import { renderPrettyReport } from '../src/reporters/prettyReporter';
import { renderTableReport } from '../src/reporters/tableReporter';
import type { AnalyzerResult, ReportMeta } from '../src/types';

describe('table reporter', () => {
  it('renders a summary and recommended actions', () => {
    const result: AnalyzerResult = {
      findings: [
        {
          ruleId: 'event-listener-cleanup',
          category: 'events',
          severity: 'high',
          confidence: 'high',
          filePath: '/repo/src/App.tsx',
          line: 10,
          column: 5,
          snippet: "window.addEventListener('resize', onResize);",
          explanation: 'window adds an event listener without cleanup.',
          impact: 'The listener can survive unmount.',
          suggestion: 'Remove the listener in cleanup.',
        },
      ],
      filesScanned: 1,
      filesWithErrors: [],
      skippedFiles: 0,
      rulesTriggered: ['event-listener-cleanup'],
      summary: {
        bySeverity: {
          low: 0,
          medium: 0,
          high: 1,
          critical: 0,
        },
        byCategory: {
          events: 1,
        },
      },
    };

    expect(renderTableReport(result, '/repo', false)).toMatchInlineSnapshot(`
      "src/App.tsx
        HIGH 10:5 event-listener-cleanup (high)
          window adds an event listener without cleanup.
          Why: The listener can survive unmount.
          Fix: Remove the listener in cleanup.
          Code: window.addEventListener('resize', onResize);

      Summary
        Files scanned: 1
        Findings: 1
        Severity counts: critical=0, high=1, medium=0, low=0
        Categories: events=1
        Rules triggered: event-listener-cleanup
      Recommended next actions
        Address critical/high issues first, then add suppressions only for reviewed false positives.
        Re-run after fixes and consider enabling the JSON report in CI."
    `);
  });
});

describe('pretty reporter', () => {
  it('renders banner metadata and next actions', () => {
    const result: AnalyzerResult = {
      findings: [
        {
          ruleId: 'use-effect-timer-cleanup',
          category: 'timers',
          severity: 'critical',
          confidence: 'high',
          filePath: '/repo/src/Leak.tsx',
          line: 12,
          column: 11,
          snippet: 'const timer = setInterval(work, 1000);',
          explanation: 'setInterval is created without cleanup.',
          impact: 'The timer can continue after unmount.',
          suggestion: 'Call clearInterval in cleanup.',
          autofixHint: 'Return a cleanup function.',
        },
      ],
      filesScanned: 3,
      filesWithErrors: [],
      skippedFiles: 0,
      rulesTriggered: ['use-effect-timer-cleanup'],
      summary: {
        bySeverity: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 1,
        },
        byCategory: {
          timers: 1,
        },
      },
    };
    const meta: ReportMeta = {
      elapsedMs: 42,
      riskScore: 88,
      totalFindings: 4,
      visibleFindings: 1,
    };

    expect(renderPrettyReport(result, '/repo', false, meta)).toMatchInlineSnapshot(`
      "react-tabib
      Scan target: /repo
      Files: 3  Findings: 1/4  Risk Score: 88/100  Time: 42ms

      src/Leak.tsx
        ! [CRITICAL] 12:11 use-effect-timer-cleanup [high]
          setInterval is created without cleanup.
          Why it matters: The timer can continue after unmount.
          Suggested fix: Call clearInterval in cleanup.
          Code: const timer = setInterval(work, 1000);
          Hint: Return a cleanup function.

      Overview
        Critical ██████████████████ 1
        High     ░░░░░░░░░░░░░░░░░░ 0
        Medium   ░░░░░░░░░░░░░░░░░░ 0
        Low      ░░░░░░░░░░░░░░░░░░ 0
        Categories  timers:■■■■■1
        Rules       use-effect-timer-cleanup
      Next actions
        [1] Fix critical/high findings first.
        [2] Review medium findings next and confirm any heuristics.
        [3] Use --files-with-issues for quick targeted cleanup."
    `);
  });
});
