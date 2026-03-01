import path from 'node:path';
import type { AnalyzerResult, ReportMeta } from '../types';

export function renderCompactReport(
  result: AnalyzerResult,
  rootPath: string,
  meta?: ReportMeta,
): string {
  if (result.findings.length === 0) {
    return `react-tabib: no findings in ${result.filesScanned} files`;
  }

  const lines = result.findings.map((finding) => {
    const relative = path.relative(rootPath, finding.filePath) || finding.filePath;
    return `${relative}:${finding.line}:${finding.column} [${finding.severity}/${finding.confidence}] ${finding.ruleId} ${finding.explanation}`;
  });

  lines.push(
    `summary: files=${result.filesScanned} findings=${result.findings.length} critical=${result.summary.bySeverity.critical} high=${result.summary.bySeverity.high} medium=${result.summary.bySeverity.medium} low=${result.summary.bySeverity.low}`,
  );
  if (meta) {
    lines.push(`meta: risk=${meta.riskScore}/100 time=${meta.elapsedMs}ms visible=${meta.visibleFindings}/${meta.totalFindings}`);
  }

  return lines.join('\n');
}
