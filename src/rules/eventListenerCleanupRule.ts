import * as t from '@babel/types';
import type { Finding, Rule } from '../types';
import { applySeverityOverride } from '../utils/severity';
import {
  buildSnippet,
  collectEffects,
  findCalls,
  getIdentifierName,
  hasLikelyRepeatedEffect,
  isCleanupCall,
  isGlobalTargetName,
} from './ruleUtils';

export const eventListenerCleanupRule: Rule = {
  meta: {
    id: 'event-listener-cleanup',
    title: 'Event listeners should be removed in effect cleanup',
    category: 'events',
    defaultSeverity: 'high',
    confidence: 'high',
  },
  analyze(context) {
    const findings: Finding[] = [];

    for (const effect of collectEffects(context.ast)) {
      const listenerCalls = findCalls(effect.bodyStatements, (call) => {
        return (
          t.isMemberExpression(call.callee) &&
          t.isIdentifier(call.callee.property, { name: 'addEventListener' })
        );
      });

      for (const call of listenerCalls) {
        if (!t.isMemberExpression(call.callee)) {
          continue;
        }

        const targetName = getIdentifierName(call.callee.object);
        const handlerName = getIdentifierName(
          t.isExpression(call.arguments[1]) ? call.arguments[1] : null,
        );
        const removed = isCleanupCall(
          effect.cleanupStatements,
          targetName,
          ['removeEventListener'],
          handlerName,
        );

        if (removed) {
          continue;
        }

        const repeatedEffect = hasLikelyRepeatedEffect(effect);
        findings.push({
          ruleId: eventListenerCleanupRule.meta.id,
          category: eventListenerCleanupRule.meta.category,
          severity: applySeverityOverride(
            eventListenerCleanupRule.meta.id,
            repeatedEffect || isGlobalTargetName(targetName)
              ? 'critical'
              : eventListenerCleanupRule.meta.defaultSeverity,
            context.config.severityOverrides,
          ),
          confidence: eventListenerCleanupRule.meta.confidence,
          filePath: context.filePath,
          line: call.loc?.start.line ?? effect.line,
          column: (call.loc?.start.column ?? effect.column) + 1,
          snippet: buildSnippet(context.source, call.loc?.start.line ?? effect.line),
          explanation: `${targetName ?? 'A target'} adds an event listener in useEffect without a matching removal.`,
          impact: repeatedEffect
            ? 'The listener can accumulate on every render and keep component closures alive.'
            : 'The listener can survive unmount and continue retaining component state.',
          suggestion:
            'Return a cleanup function that calls removeEventListener with the same target and handler.',
          autofixHint: handlerName
            ? `Add ${targetName ?? 'target'}.removeEventListener(..., ${handlerName}) to the cleanup function.`
            : 'Preserve a stable handler reference and remove it during cleanup.',
        });
      }
    }

    return findings;
  },
};
