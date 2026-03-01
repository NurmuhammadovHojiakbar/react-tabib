import type { AnalyzerResult } from '../types';

export function renderJsonReport(result: AnalyzerResult, rootPath: string): string {
  return JSON.stringify(
    {
      rootPath,
      ...result,
    },
    null,
    2,
  );
}
