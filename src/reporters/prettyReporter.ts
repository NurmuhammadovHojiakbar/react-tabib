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
    renderBarLine(
      'Critical',
      result.summary.bySeverity.critical,
      maxSeverityCount(result),
      'critical',
      useColor,
    ),
  );
  lines.push(
    renderBarLine(
      'High',
      result.summary.bySeverity.high,
      maxSeverityCount(result),
      'high',
      useColor,
    ),
  );
  lines.push(
    renderBarLine(
      'Medium',
      result.summary.bySeverity.medium,
      maxSeverityCount(result),
      'medium',
      useColor,
    ),
  );
  lines.push(
    renderBarLine(
      'Low',
      result.summary.bySeverity.low,
      maxSeverityCount(result),
      'low',
      useColor,
    ),
  );
  lines.push(
    `  Categories  ${formatCategoryGraph(result.summary.byCategory, useColor)}`,
  );
  lines.push(`  Rules       ${result.rulesTriggered.join(', ') || 'none'}`);

  if (result.filesWithErrors.length > 0) {
    lines.push(`  Parse errors: ${result.filesWithErrors.length}`);
  }

  lines.push(useColor ? pc.bold('Next actions') : 'Next actions');
  if (result.findings.length === 0) {
    lines.push(
      `  ${colorActionBullet('ready', useColor)} ${colorActionText(
        'No findings. Wire this into CI and keep the baseline clean.',
        'low',
        useColor,
      )}`,
    );
  } else {
    lines.push(
      `  ${colorActionBullet('1', useColor)} ${colorActionText(
        'Fix critical/high findings first.',
        'critical',
        useColor,
      )}`,
    );
    lines.push(
      `  ${colorActionBullet('2', useColor)} ${colorActionText(
        'Review medium findings next and confirm any heuristics.',
        'medium',
        useColor,
      )}`,
    );
    lines.push(
      `  ${colorActionBullet('3', useColor)} ${colorActionText(
        'Use --files-with-issues for quick targeted cleanup.',
        'low',
        useColor,
      )}`,
    );
  }

  return lines.join('\n');
}

function maxSeverityCount(result: AnalyzerResult): number {
  return Math.max(
    result.summary.bySeverity.critical,
    result.summary.bySeverity.high,
    result.summary.bySeverity.medium,
    result.summary.bySeverity.low,
    1,
  );
}

function renderBarLine(
  label: string,
  count: number,
  max: number,
  severity: Finding['severity'],
  useColor: boolean,
): string {
  const width = 18;
  const filled = Math.round((count / max) * width);
  const bar = `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`;
  const tintedBar = tintBySeverity(bar, severity, useColor);
  const tintedLabel = tintBySeverity(label.padEnd(8, ' '), severity, useColor);

  return `  ${tintedLabel} ${tintedBar} ${count}`;
}

function formatCategoryGraph(
  categories: Record<string, number>,
  useColor: boolean,
): string {
  const entries = Object.entries(categories);
  if (entries.length === 0) {
    return 'none';
  }

  const max = Math.max(...entries.map(([, count]) => count), 1);
  return entries
    .map(([category, count]) => {
      const blocks = Math.max(1, Math.round((count / max) * 5));
      const graph = tintBySeverity('■'.repeat(blocks), 'medium', useColor);
      return `${category}:${graph}${count}`;
    })
    .join('  ');
}

function colorActionBullet(
  label: string,
  useColor: boolean,
): string {
  if (!useColor) {
    return `[${label}]`;
  }

  return pc.bgBlue(pc.white(` ${label} `));
}

function colorActionText(
  text: string,
  severity: Finding['severity'],
  useColor: boolean,
): string {
  return tintBySeverity(text, severity, useColor);
}

function tintBySeverity(
  text: string,
  severity: Finding['severity'],
  useColor: boolean,
): string {
  if (!useColor) {
    return text;
  }

  switch (severity) {
    case 'critical':
      return pc.red(pc.bold(text));
    case 'high':
      return pc.red(text);
    case 'medium':
      return pc.yellow(text);
    default:
      return pc.cyan(text);
  }
}
