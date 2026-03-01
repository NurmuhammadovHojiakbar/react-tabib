import type { File } from '@babel/types';

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Confidence = 'low' | 'medium' | 'high';
export type IssueCategory =
  | 'timers'
  | 'events'
  | 'subscriptions'
  | 'observers'
  | 'async'
  | 'lifecycle';

export interface Finding {
  ruleId: string;
  category: IssueCategory;
  severity: Severity;
  confidence: Confidence;
  filePath: string;
  line: number;
  column: number;
  snippet: string;
  explanation: string;
  impact: string;
  suggestion: string;
  autofixHint?: string;
}

export interface RuleMeta {
  id: string;
  title: string;
  category: IssueCategory;
  defaultSeverity: Severity;
  confidence: Confidence;
  experimental?: boolean;
}

export interface SuppressionIndex {
  ignoreFile: boolean;
  ignoreNextLineByRule: Map<number, Set<string>>;
}

export interface RuleContext {
  filePath: string;
  source: string;
  ast: File;
  config: ReactTabibResolvedConfig;
  suppressions: SuppressionIndex;
}

export interface Rule {
  meta: RuleMeta;
  analyze: (context: RuleContext) => Finding[];
}

export interface AnalyzerResult {
  findings: Finding[];
  filesScanned: number;
  filesWithErrors: string[];
  skippedFiles: number;
  rulesTriggered: string[];
  summary: {
    bySeverity: Record<Severity, number>;
    byCategory: Record<string, number>;
  };
}

export interface ReactTabibConfig {
  include?: string[];
  ignore?: string[];
  enabledRules?: string[];
  disabledRules?: string[];
  severityOverrides?: Partial<Record<string, Severity>>;
  reporter?: 'table' | 'compact' | 'json' | 'pretty';
  ci?: boolean;
  experimentalRules?: boolean;
  failOnSeverity?: Severity;
  maxWarnings?: number;
}

export interface ReactTabibResolvedConfig {
  include: string[];
  ignore: string[];
  enabledRules: string[] | null;
  disabledRules: string[];
  severityOverrides: Partial<Record<string, Severity>>;
  reporter: 'table' | 'compact' | 'json' | 'pretty';
  ci: boolean;
  experimentalRules: boolean;
  failOnSeverity: Severity;
  maxWarnings: number;
}

export interface CliOptions {
  path: string;
  format?: 'table' | 'compact' | 'json' | 'pretty';
  json?: boolean;
  severity?: Severity;
  maxWarnings?: number;
  ignore?: string[];
  config?: string;
  noColor?: boolean;
  debug?: boolean;
  summaryOnly?: boolean;
  top?: number;
  filesWithIssues?: boolean;
  explain?: string;
  noBanner?: boolean;
}

export interface ReportMeta {
  elapsedMs: number;
  riskScore: number;
  totalFindings: number;
  visibleFindings: number;
}

export interface EffectDescriptor {
  line: number;
  column: number;
  callbackAsync: boolean;
  bodyStatements: import('@babel/types').Statement[];
  cleanupStatements: import('@babel/types').Statement[];
  dependencyExpression?: import('@babel/types').Expression | null;
}
