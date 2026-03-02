import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { Finding, Rule } from '../types';
import { applySeverityOverride } from '../utils/severity';
import {
  buildSnippet,
  collectEffects,
  findCalls,
  findUseStateSetters,
  getIdentifierName,
  hasCleanupReturn,
  isPromiseThenCall,
} from './ruleUtils';

export const asyncUnmountRule: Rule = {
  meta: {
    id: 'async-unmount-update',
    title: 'Async logic in effects should guard against updates after unmount',
    category: 'async',
    defaultSeverity: 'medium',
    confidence: 'medium',
  },
  analyze(context) {
    const findings: Finding[] = [];
    const setters = findUseStateSetters(context.ast);

    for (const effect of collectEffects(context.ast)) {
      const fetchCalls = findCalls(effect.bodyStatements, (call) => {
        return t.isIdentifier(call.callee, { name: 'fetch' });
      });
      const thenCalls = findCalls(effect.bodyStatements, isPromiseThenCall);

      let hasAbortController = false;
      let updatesStateInsideAsync = false;

      const container = t.program(effect.bodyStatements);
      traverse(container, {
        noScope: true,
        NewExpression(path) {
          if (t.isIdentifier(path.node.callee, { name: 'AbortController' })) {
            hasAbortController = true;
          }
        },
        CallExpression(path) {
          // Only flag state updates that are inside a .then() / async callback,
          // not synchronous updates that happen at the top level of the effect.
          const isInsideAsyncCallback =
            path.findParent(
              (p) =>
                p.isArrowFunctionExpression() ||
                p.isFunctionExpression() ||
                p.isFunctionDeclaration(),
            ) !== null;

          if (!isInsideAsyncCallback) {
            return;
          }

          const calleeName = getIdentifierName(path.node.callee);
          if (calleeName && setters.has(calleeName)) {
            updatesStateInsideAsync = true;
          }
        },
      });

      // If an AbortController exists, it guards both the fetch and any chained
      // .then() handlers, so the combination is considered safe.
      const isRiskyAsync =
        effect.callbackAsync ||
        (fetchCalls.length > 0 && !hasAbortController) ||
        (thenCalls.length > 0 && updatesStateInsideAsync && !hasAbortController);

      if (!isRiskyAsync) {
        continue;
      }

      const line = fetchCalls[0]?.loc?.start.line ?? effect.line;
      const column = (fetchCalls[0]?.loc?.start.column ?? effect.column) + 1;

      findings.push({
        ruleId: asyncUnmountRule.meta.id,
        category: asyncUnmountRule.meta.category,
        severity: applySeverityOverride(
          asyncUnmountRule.meta.id,
          hasCleanupReturn(effect) ? asyncUnmountRule.meta.defaultSeverity : 'high',
          context.config.severityOverrides,
        ),
        confidence: effect.callbackAsync ? 'high' : asyncUnmountRule.meta.confidence,
        filePath: context.filePath,
        line,
        column,
        snippet: buildSnippet(context.source, line),
        explanation:
          'The effect performs asynchronous work that may update retained closures after the component unmounts.',
        impact:
          'Late async completions can trigger stale state updates, retain data longer than necessary, and mask real cleanup bugs.',
        suggestion:
          'Use an AbortController or mounted flag guard, and stop async work in the cleanup function before setting state.',
      });
    }

    return findings;
  },
};
