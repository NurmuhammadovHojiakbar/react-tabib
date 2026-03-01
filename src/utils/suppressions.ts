import type { Comment } from '@babel/types';
import type { SuppressionIndex } from '../types';

const IGNORE_FILE = 'react-tabib-ignore-file';
const IGNORE_NEXT_LINE = 'react-tabib-ignore-next-line';

export function buildSuppressionIndex(comments: Comment[] | null | undefined): SuppressionIndex {
  const ignoreNextLineByRule = new Map<number, Set<string>>();
  let ignoreFile = false;

  for (const comment of comments ?? []) {
    const value = comment.value.trim();
    if (value.includes(IGNORE_FILE)) {
      ignoreFile = true;
      continue;
    }

    const markerIndex = value.indexOf(IGNORE_NEXT_LINE);
    if (markerIndex === -1) {
      continue;
    }

    const trailing = value.slice(markerIndex + IGNORE_NEXT_LINE.length).trim();
    const rules = trailing.length > 0 ? trailing.split(/\s+/) : ['*'];
    const nextLine = (comment.loc?.end.line ?? 0) + 1;
    ignoreNextLineByRule.set(nextLine, new Set(rules));
  }

  return { ignoreFile, ignoreNextLineByRule };
}

export function isSuppressed(
  suppressions: SuppressionIndex,
  line: number,
  ruleId: string,
): boolean {
  if (suppressions.ignoreFile) {
    return true;
  }

  const rules = suppressions.ignoreNextLineByRule.get(line);
  if (!rules) {
    return false;
  }

  return rules.has('*') || rules.has(ruleId);
}
