import * as t from '@babel/types';
import type { Finding, Rule } from '../types';
import { applySeverityOverride } from '../utils/severity';
import {
  buildSnippet,
  collectEffects,
  findVariableDeclarations,
  isCleanupCall,
} from './ruleUtils';

const OBSERVER_NAMES = ['MutationObserver', 'ResizeObserver', 'IntersectionObserver'];

export const observerCleanupRule: Rule = {
  meta: {
    id: 'observer-cleanup',
    title: 'Observers should be disconnected in effect cleanup',
    category: 'observers',
    defaultSeverity: 'high',
    confidence: 'high',
  },
  analyze(context) {
    const findings: Finding[] = [];

    for (const effect of collectEffects(context.ast)) {
      for (const declaration of findVariableDeclarations(effect.bodyStatements)) {
        if (
          !declaration.init ||
          !t.isNewExpression(declaration.init) ||
          !t.isIdentifier(declaration.init.callee) ||
          !OBSERVER_NAMES.includes(declaration.init.callee.name)
        ) {
          continue;
        }

        if (isCleanupCall(effect.cleanupStatements, declaration.id, ['disconnect'])) {
          continue;
        }

        findings.push({
          ruleId: observerCleanupRule.meta.id,
          category: observerCleanupRule.meta.category,
          severity: applySeverityOverride(
            observerCleanupRule.meta.id,
            observerCleanupRule.meta.defaultSeverity,
            context.config.severityOverrides,
          ),
          confidence: observerCleanupRule.meta.confidence,
          filePath: context.filePath,
          line: declaration.line,
          column: declaration.column + 1,
          snippet: buildSnippet(context.source, declaration.line),
          explanation: `${declaration.init.callee.name} is not disconnected in cleanup.`,
          impact: 'Observers can keep DOM references and callbacks alive after unmount.',
          suggestion: `Call ${declaration.id}.disconnect() inside the function returned from useEffect.`,
        });
      }
    }

    return findings;
  },
};
