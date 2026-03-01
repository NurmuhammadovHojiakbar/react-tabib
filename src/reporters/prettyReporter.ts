import path from 'node:path';
import pc from 'picocolors';
import type { AnalyzerResult, Finding, ReportMeta } from '../types';

function severityBadge(severity: Finding['severity'], color: boolean): string {
  const raw = ` ${severity.toUpperCase()} `;
  if (!color) {
    return `[${raw.trim()}]`;
  }

  switch (severity) {
    case 'critical':
      return pc.bgRed(pc.white(pc.bold(raw)));
    case 'high':
      return pc.bgRed(pc.black(raw));
    case 'medium':
      return pc.bgYellow(pc.black(raw));
    default:
      return pc.bgCyan(pc.black(raw));
  }
}

function severityIcon(severity: Finding['severity']): string {
  switch (severity) {
    case 'critical':
      return '!';
    case 'high':
      return '^';
    case 'medium':
      return '~';
    default:
      return 'i';
  }
}

export function renderPrettyReport(
  result: AnalyzerResult,
  rootPath: string,
  useColor: boolean,
  meta: ReportMeta,
  summaryOnly = false,
  showBanner = true,
): string {
  const lines: string[] = [];
  const grouped = new Map<string, Finding[]>();

  if (showBanner) {
    lines.push(useColor ? pc.bold('react-tabib') : 'react-tabib');
    lines.push(`Scan target: ${rootPath}`);
    lines.push(
      `Files: ${result.filesScanned}  Findings: ${meta.visibleFindings}/${meta.totalFindings}  Risk Score: ${meta.riskScore}/100  Time: ${meta.elapsedMs}ms`,
    );
    lines.push('');
  }

  for (const finding of result.findings) {
    const key = path.relative(rootPath, finding.filePath) || finding.filePath;
    const existing = grouped.get(key) ?? [];
    existing.push(finding);
    grouped.set(key, existing);
  }

  if (!summaryOnly) {
    for (const [file, findings] of grouped.entries()) {
      lines.push(useColor ? pc.bold(file) : file);
      for (const finding of findings) {
        lines.push(
          `  ${severityIcon(finding.severity)} ${severityBadge(finding.severity, useColor)} ${finding.line}:${finding.column} ${finding.ruleId} [${finding.confidence}]`,
        );
        lines.push(`    ${finding.explanation}`);
        lines.push(`    Why it matters: ${finding.impact}`);
        lines.push(`    Suggested fix: ${finding.suggestion}`);
        if (finding.snippet) {
          lines.push(`    Code: ${finding.snippet}`);
        }
        if (finding.autofixHint) {
          lines.push(`    Hint: ${finding.autofixHint}`);
        }
      }
      lines.push('');
    }
  }

  lines.push(useColor ? pc.bold('Overview') : 'Overview');
  lines.push(
    `  Severity: critical=${result.summary.bySeverity.critical}, high=${result.summary.bySeverity.high}, medium=${result.summary.bySeverity.medium}, low=${result.summary.bySeverity.low}`,
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

  lines.push(useColor ? pc.bold('Next actions') : 'Next actions');
  if (result.findings.length === 0) {
    lines.push('  No findings. Wire this into CI and keep the baseline clean.');
  } else {
    lines.push('  Fix critical/high findings first.');
    lines.push('  Re-run with --top to focus on the highest-risk items.');
    lines.push('  Use --files-with-issues for quick targeted cleanup.');
  }

  return lines.join('\n');
}
