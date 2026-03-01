import type { Finding, Severity } from '../types';

const severityScore: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function compareSeverity(left: Severity, right: Severity): number {
  return severityScore[left] - severityScore[right];
}

export function meetsSeverityThreshold(
  finding: Finding,
  threshold: Severity,
): boolean {
  return compareSeverity(finding.severity, threshold) >= 0;
}

export function applySeverityOverride(
  ruleId: string,
  baseSeverity: Severity,
  overrides: Partial<Record<string, Severity>>,
): Severity {
  return overrides[ruleId] ?? baseSeverity;
}
