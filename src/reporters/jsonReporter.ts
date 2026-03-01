import type { AnalyzerResult, ReportMeta } from '../types';

export function renderJsonReport(
  result: AnalyzerResult,
  rootPath: string,
  meta?: ReportMeta,
): string {
  return JSON.stringify(
    {
      rootPath,
      meta,
      ...result,
    },
    null,
    2,
  );
}
