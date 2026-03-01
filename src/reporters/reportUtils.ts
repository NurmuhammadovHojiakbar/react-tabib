import path from 'node:path';
import type { AnalyzerResult, Finding, ReportMeta, Severity } from '../types';

const severityWeight: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 4,
  critical: 6,
};

export function compareFindings(left: Finding, right: Finding): number {
  const weightDelta = severityWeight[right.severity] - severityWeight[left.severity];
  if (weightDelta !== 0) {
    return weightDelta;
  }

  const confidenceDelta = confidenceScore(right.confidence) - confidenceScore(left.confidence);
  if (confidenceDelta !== 0) {
    return confidenceDelta;
  }

  if (left.filePath !== right.filePath) {
    return left.filePath.localeCompare(right.filePath);
  }

  return left.line - right.line;
}

export function buildReportMeta(
  result: AnalyzerResult,
  visibleFindings: Finding[],
  elapsedMs: number,
): ReportMeta {
  return {
    elapsedMs,
    riskScore: calculateRiskScore(result.findings),
    totalFindings: result.findings.length,
    visibleFindings: visibleFindings.length,
  };
}

export function calculateRiskScore(findings: Finding[]): number {
  if (findings.length === 0) {
    return 0;
  }

  const weighted = findings.reduce((sum, finding) => {
    return sum + severityWeight[finding.severity] * confidenceScore(finding.confidence);
  }, 0);
  const maxPossible = findings.length * severityWeight.critical * confidenceScore('high');

  return Math.min(100, Math.round((weighted / maxPossible) * 100));
}

export function limitFindings(findings: Finding[], top?: number): Finding[] {
  if (!top) {
    return [...findings];
  }

  const sorted = [...findings].sort(compareFindings);
  if (top >= sorted.length) {
    return sorted;
  }

  return sorted.slice(0, top);
}

export function listFilesWithIssues(findings: Finding[], rootPath: string): string[] {
  return [...new Set(findings.map((finding) => path.relative(rootPath, finding.filePath) || finding.filePath))];
}

function confidenceScore(confidence: Finding['confidence']): number {
  switch (confidence) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}
