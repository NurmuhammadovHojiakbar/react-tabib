#!/usr/bin/env node
import { Command } from 'commander';
import { analyzeProject } from '../core/analyzeProject';
import { renderCompactReport } from '../reporters/compactReporter';
import { renderJsonReport } from '../reporters/jsonReporter';
import { renderPrettyReport } from '../reporters/prettyReporter';
import {
  buildReportMeta,
  limitFindings,
  listFilesWithIssues,
} from '../reporters/reportUtils';
import { renderTableReport } from '../reporters/tableReporter';
import { allRules, getRuleById } from '../rules';
import type { AnalyzerResult, CliOptions, Severity } from '../types';

export async function runCli(argv: string[]): Promise<number> {
  const startedAt = Date.now();
  const program = new Command();

  program
    .name('react-tabib')
    .description('Audit React code for likely memory leaks and lifecycle misuse.')
    .option('--path <dir>', 'path to scan', '.')
    .option('--json', 'emit JSON output')
    .option('--format <format>', 'table, pretty, compact, or json')
    .option('--severity <level>', 'minimum displayed severity and fail threshold (low|medium|high|critical)')
    .option('--max-warnings <count>', 'maximum allowed findings before failing', parseMaxWarnings)
    .option('--ignore <glob>', 'add an ignore glob', collectIgnoreGlobs, [])
    .option('--config <path>', 'path to config file')
    .option('--no-color', 'disable terminal colors')
    .option('--debug', 'print resolved analysis metadata')
    .option('--summary-only', 'print only summary information')
    .option('--top <count>', 'show only the top N highest-risk findings', parseTopCount)
    .option('--files-with-issues', 'print only files that contain findings')
    .option('--explain <ruleId>', 'show details about a rule and exit')
    .option('--no-banner', 'disable the pretty report banner')
    .allowUnknownOption(false);

  program.parse(argv);
  const rawOptions = program.opts<Record<string, unknown>>();
  const options: CliOptions = {
    path: typeof rawOptions.path === 'string' ? rawOptions.path : '.',
    format:
      typeof rawOptions.format === 'string'
        ? (rawOptions.format as CliOptions['format'])
        : undefined,
    json: rawOptions.json === true,
    severity:
      typeof rawOptions.severity === 'string'
        ? (rawOptions.severity as Severity)
        : undefined,
    maxWarnings:
      typeof rawOptions.maxWarnings === 'number' ? rawOptions.maxWarnings : undefined,
    ignore: Array.isArray(rawOptions.ignore)
      ? rawOptions.ignore.filter((value): value is string => typeof value === 'string')
      : undefined,
    config: typeof rawOptions.config === 'string' ? rawOptions.config : undefined,
    noColor: rawOptions.color === false,
    debug: rawOptions.debug === true,
    summaryOnly: rawOptions.summaryOnly === true,
    top: typeof rawOptions.top === 'number' ? rawOptions.top : undefined,
    filesWithIssues: rawOptions.filesWithIssues === true,
    explain: typeof rawOptions.explain === 'string' ? rawOptions.explain : undefined,
    noBanner: rawOptions.banner === false,
  };

  if (options.explain) {
    process.stdout.write(`${renderRuleExplanation(options.explain)}\n`);
    return 0;
  }

  if (options.severity && !isSeverity(options.severity)) {
    throw new Error(`Invalid severity: ${options.severity}`);
  }
  if (options.format && !isReporterFormat(options.format)) {
    throw new Error(`Invalid format: ${options.format}`);
  }

  const analysis = await analyzeProject(process.cwd(), {
    ...options,
    severity: options.severity as Severity | undefined,
  });

  if (options.debug) {
    process.stderr.write(
      `react-tabib debug: root=${analysis.rootPath} config=${analysis.configPath ?? 'default'} files=${analysis.result.filesScanned}\n`,
    );
  }

  const displayResult = createDisplayResult(analysis.result, options.top);
  const elapsedMs = Date.now() - startedAt;
  const meta = buildReportMeta(analysis.result, displayResult.findings, elapsedMs);

  if (options.filesWithIssues) {
    const files = listFilesWithIssues(displayResult.findings, analysis.rootPath);
    process.stdout.write(`${files.join('\n')}${files.length > 0 ? '\n' : ''}`);
    const tooManyWarnings = analysis.warningCount > analysis.config.maxWarnings;
    return analysis.hasBlockingFindings || tooManyWarnings ? 1 : 0;
  }

  const output =
    analysis.config.reporter === 'json'
      ? renderJsonReport(displayResult, analysis.rootPath, meta)
      : analysis.config.reporter === 'compact'
        ? renderCompactReport(displayResult, analysis.rootPath, meta)
        : analysis.config.reporter === 'pretty'
          ? renderPrettyReport(
              displayResult,
              analysis.rootPath,
              options.noColor !== true,
              meta,
              options.summaryOnly,
              options.noBanner !== true,
            )
          : renderTableReport(
            displayResult,
            analysis.rootPath,
            options.noColor !== true,
            options.summaryOnly,
            meta,
          );

  process.stdout.write(`${output}\n`);

  const tooManyWarnings = analysis.warningCount > analysis.config.maxWarnings;
  return analysis.hasBlockingFindings || tooManyWarnings ? 1 : 0;
}

function collectIgnoreGlobs(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseMaxWarnings(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid max warnings: ${value}`);
  }

  return parsed;
}

function parseTopCount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid top count: ${value}`);
  }

  return parsed;
}

function isSeverity(value: string): value is Severity {
  return ['low', 'medium', 'high', 'critical'].includes(value);
}

function isReporterFormat(value: string): value is NonNullable<CliOptions['format']> {
  return ['table', 'compact', 'json', 'pretty'].includes(value);
}

function renderRuleExplanation(ruleId: string): string {
  const rule = getRuleById(ruleId);
  if (!rule) {
    const availableRules = ['Available rules:', ...listAvailableRules().map((item) => `  ${item}`)];
    return [`Unknown rule: ${ruleId}`, ...availableRules].join('\n');
  }

  return [
    `${rule.meta.id}`,
    `  Title: ${rule.meta.title}`,
    `  Category: ${rule.meta.category}`,
    `  Default severity: ${rule.meta.defaultSeverity}`,
    `  Confidence: ${rule.meta.confidence}`,
    `  What it checks: ${buildRuleExplanation(rule.meta.id, rule.meta.title)}`,
    '  Typical remediation: add explicit cleanup, stabilize dependencies, and suppress only reviewed false positives.',
  ].join('\n');
}

function listAvailableRules(): string[] {
  return allRules.map((rule) => rule.meta.id);
}

function buildRuleExplanation(ruleId: string, fallback: string): string {
  const explanations: Record<string, string> = {
    'use-effect-timer-cleanup':
      'Timers started inside useEffect should be cancelled in the returned cleanup function.',
    'event-listener-cleanup':
      'Listeners attached inside useEffect should be removed with the same target and handler during cleanup.',
    'subscription-cleanup':
      'Long-lived subscriptions or resource handles should be closed, unsubscribed, or otherwise disposed.',
    'observer-cleanup':
      'DOM observers should be disconnected so they do not keep callbacks and nodes alive.',
    'async-unmount-update':
      'Async work should be cancellable or guarded so stale completions do not update state after unmount.',
    'repeated-side-effect':
      'Effects with persistent work should not rerun on every render unless that behavior is intentional and safe.',
  };

  return explanations[ruleId] ?? fallback;
}

function createDisplayResult(result: AnalyzerResult, top?: number): AnalyzerResult {
  const findings = limitFindings(result.findings, top);
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
    ...result,
    findings,
    rulesTriggered: [...new Set(findings.map((finding) => finding.ruleId))],
    summary,
  };
}

if (require.main === module) {
  runCli(process.argv).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`react-tabib: ${message}\n`);
      process.exitCode = 1;
    },
  );
}
