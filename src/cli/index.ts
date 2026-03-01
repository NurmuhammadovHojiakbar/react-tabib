#!/usr/bin/env node
import { Command } from 'commander';
import { analyzeProject } from '../core/analyzeProject';
import { renderCompactReport } from '../reporters/compactReporter';
import { renderJsonReport } from '../reporters/jsonReporter';
import { renderTableReport } from '../reporters/tableReporter';
import type { CliOptions, Severity } from '../types';

export async function runCli(argv: string[]): Promise<number> {
  const program = new Command();

  program
    .name('react-tabib')
    .description('Audit React code for likely memory leaks and lifecycle misuse.')
    .option('--path <dir>', 'path to scan', '.')
    .option('--json', 'emit JSON output')
    .option('--format <format>', 'table, compact, or json')
    .option('--severity <level>', 'minimum displayed severity and fail threshold (low|medium|high|critical)')
    .option('--max-warnings <count>', 'maximum allowed findings before failing', parseMaxWarnings)
    .option('--ignore <glob>', 'add an ignore glob', collectIgnoreGlobs, [])
    .option('--config <path>', 'path to config file')
    .option('--no-color', 'disable terminal colors')
    .option('--debug', 'print resolved analysis metadata')
    .option('--summary-only', 'print only summary information')
    .allowUnknownOption(false);

  program.parse(argv);
  const rawOptions = program.opts<Record<string, unknown>>();
  const options: CliOptions = {
    ...(rawOptions as CliOptions),
    noColor: rawOptions.color === false,
  };

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

  const output =
    analysis.config.reporter === 'json'
      ? renderJsonReport(analysis.result, analysis.rootPath)
      : analysis.config.reporter === 'compact'
        ? renderCompactReport(analysis.result, analysis.rootPath)
        : renderTableReport(
            analysis.result,
            analysis.rootPath,
            options.noColor !== true,
            options.summaryOnly,
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

function isSeverity(value: string): value is Severity {
  return ['low', 'medium', 'high', 'critical'].includes(value);
}

function isReporterFormat(value: string): value is NonNullable<CliOptions['format']> {
  return ['table', 'compact', 'json'].includes(value);
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
