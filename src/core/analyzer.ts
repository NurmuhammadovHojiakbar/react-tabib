import { allRules, getActiveRules } from '../rules';
import { parseFile } from '../parser/parseFile';
import { buildSuppressionIndex, isSuppressed } from '../utils/suppressions';
import type { AnalyzerResult, Finding, ReactTabibResolvedConfig } from '../types';

export async function analyzeFiles(
  files: string[],
  config: ReactTabibResolvedConfig,
): Promise<AnalyzerResult> {
  const findings: Finding[] = [];
  const filesWithErrors: string[] = [];
  let skippedFiles = 0;
  const activeRules = getActiveRules(allRules, config);

  for (const filePath of files) {
    try {
      const { source, ast } = await parseFile(filePath);
      const suppressions = buildSuppressionIndex(ast.comments);

      if (suppressions.ignoreFile) {
        skippedFiles += 1;
        continue;
      }

      for (const rule of activeRules) {
        const nextFindings = rule
          .analyze({ filePath, source, ast, config, suppressions })
          .filter((finding) => !isSuppressed(suppressions, finding.line, finding.ruleId));

        findings.push(...nextFindings);
      }
    } catch {
      filesWithErrors.push(filePath);
    }
  }

  const rulesTriggered = [...new Set(findings.map((finding) => finding.ruleId))];
  const summary = {
    bySeverity: {
      low: findings.filter((finding) => finding.severity === 'low').length,
      medium: findings.filter((finding) => finding.severity === 'medium').length,
      high: findings.filter((finding) => finding.severity === 'high').length,
      critical: findings.filter((finding) => finding.severity === 'critical').length,
    },
    byCategory: findings.reduce<Record<string, number>>((accumulator, finding) => {
      accumulator[finding.category] = (accumulator[finding.category] ?? 0) + 1;
      return accumulator;
    }, {}),
  };

  return {
    findings: findings.sort((left, right) => {
      if (left.filePath === right.filePath) {
        return left.line - right.line;
      }

      return left.filePath.localeCompare(right.filePath);
    }),
    filesScanned: files.length,
    filesWithErrors,
    skippedFiles,
    rulesTriggered,
    summary,
  };
}
