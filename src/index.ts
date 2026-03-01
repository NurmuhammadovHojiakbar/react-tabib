export { analyzeProject } from './core/analyzeProject';
export { analyzeFiles } from './core/analyzer';
export { defaultConfig } from './config/defaults';
export { renderCompactReport } from './reporters/compactReporter';
export { renderJsonReport } from './reporters/jsonReporter';
export { renderPrettyReport } from './reporters/prettyReporter';
export { renderTableReport } from './reporters/tableReporter';
export { getRuleById } from './rules';
export type {
  AnalyzerResult,
  CliOptions,
  Confidence,
  Finding,
  IssueCategory,
  ReactTabibConfig,
  ReactTabibResolvedConfig,
  Rule,
  RuleContext,
  RuleMeta,
  Severity,
} from './types';
