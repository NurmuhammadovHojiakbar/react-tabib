import * as t from '@babel/types';
import type { Finding, Rule } from '../types';
import { applySeverityOverride } from '../utils/severity';
import {
  buildSnippet,
  collectEffects,
  findCalls,
  hasLikelyRepeatedEffect,
  isEmptyDependencyArray,
} from './ruleUtils';

export const lifecycleMisuseRule: Rule = {
  meta: {
    id: 'repeated-side-effect',
    title: 'Effects with persistent side effects should declare stable dependencies',
    category: 'lifecycle',
    defaultSeverity: 'medium',
    confidence: 'medium',
  },
  analyze(context) {
    const findings: Finding[] = [];

    for (const effect of collectEffects(context.ast)) {
      if (isEmptyDependencyArray(effect)) {
        continue;
      }

      const persistentCalls = findCalls(effect.bodyStatements, (call) => {
        if (!t.isIdentifier(call.callee) && !t.isMemberExpression(call.callee)) {
          return false;
        }

        if (t.isIdentifier(call.callee)) {
          return ['setInterval', 'setTimeout'].includes(call.callee.name);
        }

        return (
          t.isIdentifier(call.callee.property) &&
          ['addEventListener', 'subscribe', 'on'].includes(call.callee.property.name)
        );
      });

      if (persistentCalls.length === 0 || !hasLikelyRepeatedEffect(effect)) {
        continue;
      }

      const firstCall = persistentCalls[0];
      const line = firstCall.loc?.start.line ?? effect.line;
      findings.push({
        ruleId: lifecycleMisuseRule.meta.id,
        category: lifecycleMisuseRule.meta.category,
        severity: applySeverityOverride(
          lifecycleMisuseRule.meta.id,
          lifecycleMisuseRule.meta.defaultSeverity,
          context.config.severityOverrides,
        ),
        confidence: lifecycleMisuseRule.meta.confidence,
        filePath: context.filePath,
        line,
        column: (firstCall.loc?.start.column ?? effect.column) + 1,
        snippet: buildSnippet(context.source, line),
        explanation:
          'This effect creates a persistent side effect but has no dependency array, so it may re-run on every render.',
        impact:
          'Repeated subscriptions or listeners can accumulate and create leak-like behavior even when cleanup exists elsewhere.',
        suggestion:
          'Add an explicit dependency array or restructure the effect so setup only runs when required.',
      });
    }

    return findings;
  },
};
