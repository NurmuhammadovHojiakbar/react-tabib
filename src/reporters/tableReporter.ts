import path from 'node:path';
import pc from 'picocolors';
import type { AnalyzerResult, Finding } from '../types';

function formatSeverity(severity: Finding['severity'], color: boolean): string {
  if (!color) {
    return severity.toUpperCase();
  }

  switch (severity) {
    case 'critical':
      return pc.red(pc.bold(severity.toUpperCase()));
    case 'high':
      return pc.red(severity.toUpperCase());
    case 'medium':
      return pc.yellow(severity.toUpperCase());
    default:
      return pc.cyan(severity.toUpperCase());
  }
}

export function renderTableReport(
  result: AnalyzerResult,
  rootPath: string,
  useColor: boolean,
  summaryOnly = false,
): string {
  const lines: string[] = [];
  const grouped = new Map<string, Finding[]>();

  for (const finding of result.findings) {
    const key = path.relative(rootPath, finding.filePath) || finding.filePath;
    const existing = grouped.get(key) ?? [];
    existing.push(finding);
    grouped.set(key, existing);
  }

  if (!summaryOnly) {
    for (const [file, findings] of grouped.entries()) {
      lines.push(file);
      for (const finding of findings) {
        lines.push(
          `  ${formatSeverity(finding.severity, useColor)} ${finding.line}:${finding.column} ${finding.ruleId} (${finding.confidence})`,
        );
        lines.push(`    ${finding.explanation}`);
        lines.push(`    Why: ${finding.impact}`);
        lines.push(`    Fix: ${finding.suggestion}`);
        if (finding.snippet) {
          lines.push(`    Code: ${finding.snippet}`);
        }
      }
      lines.push('');
    }
  }

  lines.push('Summary');
  lines.push(`  Files scanned: ${result.filesScanned}`);
  lines.push(`  Findings: ${result.findings.length}`);
  lines.push(
    `  Severity counts: critical=${result.summary.bySeverity.critical}, high=${result.summary.bySeverity.high}, medium=${result.summary.bySeverity.medium}, low=${result.summary.bySeverity.low}`,
  );
  lines.push(
    `  Categories: ${
      Object.entries(result.summary.byCategory)
        .map(([category, count]) => `${category}=${count}`)
        .join(', ') || 'none'
    }`,
  );
  lines.push(`  Rules triggered: ${result.rulesTriggered.join(', ') || 'none'}`);

  if (result.filesWithErrors.length > 0) {
    lines.push(`  Parse errors: ${result.filesWithErrors.length}`);
  }

  lines.push('Recommended next actions');
  if (result.findings.length === 0) {
    lines.push('  No actionable leak patterns found. Add this tool to CI and expand rule coverage over time.');
  } else {
    lines.push('  Address critical/high issues first, then add suppressions only for reviewed false positives.');
    lines.push('  Re-run after fixes and consider enabling the JSON report in CI.');
  }

  return lines.join('\n');
}
