import { describe, expect, it } from 'vitest';
import { renderTableReport } from '../src/reporters/tableReporter';
import type { AnalyzerResult } from '../src/types';

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
