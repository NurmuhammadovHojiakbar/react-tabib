import * as t from '@babel/types';
import type { Finding, Rule } from '../types';
import { applySeverityOverride } from '../utils/severity';
import {
  buildSnippet,
  collectEffects,
  findVariableDeclarations,
  getIdentifierName,
  hasCleanupReturn,
  isClearedByGlobalCleanup,
} from './ruleUtils';

const TIMER_FACTORIES = new Map<string, string>([
  ['setInterval', 'clearInterval'],
  ['setTimeout', 'clearTimeout'],
  ['requestAnimationFrame', 'cancelAnimationFrame'],
  ['requestIdleCallback', 'cancelIdleCallback'],
]);

export const useEffectTimerCleanupRule: Rule = {
  meta: {
    id: 'use-effect-timer-cleanup',
    title: 'Timers created in effects should be cleaned up',
    category: 'timers',
    defaultSeverity: 'high',
    confidence: 'high',
  },
  analyze(context) {
    const findings: Finding[] = [];

    for (const effect of collectEffects(context.ast)) {
      const declarations = findVariableDeclarations(effect.bodyStatements);
      const cleanupExists = hasCleanupReturn(effect);

      for (const declaration of declarations) {
        if (!declaration.init || !t.isCallExpression(declaration.init)) {
          continue;
        }

        const calleeName = getIdentifierName(declaration.init.callee);
        const cleanupName = calleeName ? TIMER_FACTORIES.get(calleeName) : null;
        if (!cleanupName) {
          continue;
        }

        const cleaned = isClearedByGlobalCleanup(
          effect.cleanupStatements,
          cleanupName,
          declaration.id,
        );

        if (cleaned) {
          continue;
        }

        findings.push({
          ruleId: useEffectTimerCleanupRule.meta.id,
          category: useEffectTimerCleanupRule.meta.category,
          severity: applySeverityOverride(
            useEffectTimerCleanupRule.meta.id,
            useEffectTimerCleanupRule.meta.defaultSeverity,
            context.config.severityOverrides,
          ),
          confidence: useEffectTimerCleanupRule.meta.confidence,
          filePath: context.filePath,
          line: declaration.line,
          column: declaration.column + 1,
          snippet: buildSnippet(context.source, declaration.line),
          explanation: `${calleeName} is created inside useEffect but is not cancelled in the cleanup function.`,
          impact: 'The callback can keep running after the component unmounts and retain component state or closures.',
          suggestion: `Store the handle and call ${cleanupName} in the function returned from useEffect.`,
          autofixHint: cleanupExists
            ? `Add ${cleanupName}(${declaration.id}) to the existing cleanup block.`
            : `Return a cleanup function that calls ${cleanupName}(${declaration.id}).`,
        });
      }

      if (cleanupExists) {
        continue;
      }

      for (const statement of effect.bodyStatements) {
        if (!t.isExpressionStatement(statement) || !t.isCallExpression(statement.expression)) {
          continue;
        }

        const call = statement.expression;
        const calleeName = getIdentifierName(call.callee);
        if (!calleeName || !TIMER_FACTORIES.has(calleeName)) {
          continue;
        }

        findings.push({
          ruleId: useEffectTimerCleanupRule.meta.id,
          category: useEffectTimerCleanupRule.meta.category,
          severity: applySeverityOverride(
            useEffectTimerCleanupRule.meta.id,
            useEffectTimerCleanupRule.meta.defaultSeverity,
            context.config.severityOverrides,
          ),
          confidence: 'medium',
          filePath: context.filePath,
          line: call.loc?.start.line ?? effect.line,
          column: (call.loc?.start.column ?? effect.column) + 1,
          snippet: buildSnippet(context.source, call.loc?.start.line ?? effect.line),
          explanation: `${calleeName} is scheduled in useEffect without an obvious cleanup handle.`,
          impact: 'The scheduled work may survive component unmount and continue retaining closures.',
          suggestion: 'Assign the return value to a variable and cancel it in the cleanup function.',
        });
      }
    }

    return findings;
  },
};
