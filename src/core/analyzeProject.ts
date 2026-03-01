import path from 'node:path';
import { collectFiles } from '../filesystem/collectFiles';
import { loadConfig } from '../config/loadConfig';
import { analyzeFiles } from './analyzer';
import { meetsSeverityThreshold } from '../utils/severity';
import type { AnalyzerResult, CliOptions, ReactTabibResolvedConfig } from '../types';

export interface ProjectAnalysis {
  result: AnalyzerResult;
  config: ReactTabibResolvedConfig;
  configPath: string | null;
  rootPath: string;
  hasBlockingFindings: boolean;
  warningCount: number;
}

export async function analyzeProject(
  cwd: string,
  options: CliOptions,
): Promise<ProjectAnalysis> {
  const rootPath = path.resolve(cwd, options.path || '.');
  const loaded = await loadConfig(cwd, options.config);

  const config: ReactTabibResolvedConfig = {
    ...loaded.config,
    reporter: options.json ? 'json' : options.format ?? loaded.config.reporter,
    ignore: [...loaded.config.ignore, ...(options.ignore ?? [])],
    failOnSeverity: options.severity ?? loaded.config.failOnSeverity,
    maxWarnings: options.maxWarnings ?? loaded.config.maxWarnings,
  };

  const files = await collectFiles(rootPath, config);
  const result = await analyzeFiles(files, config);
  const visibleFindings = result.findings.filter((finding) =>
    meetsSeverityThreshold(finding, options.severity ?? 'low'),
  );

  result.findings = visibleFindings;
  result.rulesTriggered = [...new Set(visibleFindings.map((finding) => finding.ruleId))];
  result.summary = {
    bySeverity: {
      low: visibleFindings.filter((finding) => finding.severity === 'low').length,
      medium: visibleFindings.filter((finding) => finding.severity === 'medium').length,
      high: visibleFindings.filter((finding) => finding.severity === 'high').length,
      critical: visibleFindings.filter((finding) => finding.severity === 'critical').length,
    },
    byCategory: visibleFindings.reduce<Record<string, number>>((accumulator, finding) => {
      accumulator[finding.category] = (accumulator[finding.category] ?? 0) + 1;
      return accumulator;
    }, {}),
  };

  const hasBlockingFindings = visibleFindings.some((finding) =>
    meetsSeverityThreshold(finding, config.failOnSeverity),
  );
  const warningCount = visibleFindings.length;

  return {
    result,
    config,
    configPath: loaded.configPath,
    rootPath,
    hasBlockingFindings,
    warningCount,
  };
}
