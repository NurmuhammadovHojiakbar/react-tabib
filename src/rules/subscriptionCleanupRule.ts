import * as t from '@babel/types';
import type { Finding, Rule } from '../types';
import { applySeverityOverride } from '../utils/severity';
import {
  buildSnippet,
  collectEffects,
  findVariableDeclarations,
  getIdentifierName,
  isCleanupCall,
} from './ruleUtils';

const CONSTRUCTORS = new Map<string, string[]>([
  ['WebSocket', ['close']],
  ['EventSource', ['close']],
]);

export const subscriptionCleanupRule: Rule = {
  meta: {
    id: 'subscription-cleanup',
    title: 'Persistent resources created in effects should be disposed',
    category: 'subscriptions',
    defaultSeverity: 'high',
    confidence: 'high',
  },
  analyze(context) {
    const findings: Finding[] = [];

    for (const effect of collectEffects(context.ast)) {
      const declarations = findVariableDeclarations(effect.bodyStatements);

      for (const declaration of declarations) {
        if (!declaration.init) {
          continue;
        }

        if (t.isNewExpression(declaration.init) && t.isIdentifier(declaration.init.callee)) {
          const cleanupMethods = CONSTRUCTORS.get(declaration.init.callee.name);
          if (!cleanupMethods) {
            continue;
          }

          const cleaned = isCleanupCall(
            effect.cleanupStatements,
            declaration.id,
            cleanupMethods,
          );
          if (cleaned) {
            continue;
          }

          findings.push({
            ruleId: subscriptionCleanupRule.meta.id,
            category: subscriptionCleanupRule.meta.category,
            severity: applySeverityOverride(
              subscriptionCleanupRule.meta.id,
              subscriptionCleanupRule.meta.defaultSeverity,
              context.config.severityOverrides,
            ),
            confidence: subscriptionCleanupRule.meta.confidence,
            filePath: context.filePath,
            line: declaration.line,
            column: declaration.column + 1,
            snippet: buildSnippet(context.source, declaration.line),
            explanation: `${declaration.init.callee.name} is created in useEffect without being disposed.`,
            impact: 'The resource can continue receiving updates and retain component references after unmount.',
            suggestion: `Dispose the instance in cleanup using ${cleanupMethods.join(' or ')}.`,
          });
        }

        if (t.isCallExpression(declaration.init) && t.isMemberExpression(declaration.init.callee)) {
          const methodName = t.isIdentifier(declaration.init.callee.property)
            ? declaration.init.callee.property.name
            : null;
          if (!methodName || !['subscribe', 'on'].includes(methodName)) {
            continue;
          }

          const sourceName = getIdentifierName(declaration.init.callee.object);
          const handlerName = getIdentifierName(
            t.isExpression(declaration.init.arguments[0]) ? declaration.init.arguments[0] : null,
          );

          const cleaned =
            isCleanupCall(effect.cleanupStatements, declaration.id, ['unsubscribe']) ||
            isCleanupCall(effect.cleanupStatements, sourceName, ['off', 'removeListener'], handlerName);

          if (cleaned) {
            continue;
          }

          findings.push({
            ruleId: subscriptionCleanupRule.meta.id,
            category: subscriptionCleanupRule.meta.category,
            severity: applySeverityOverride(
              subscriptionCleanupRule.meta.id,
              methodName === 'on'
                ? 'critical'
                : subscriptionCleanupRule.meta.defaultSeverity,
              context.config.severityOverrides,
            ),
            confidence:
              methodName === 'on'
                ? 'medium'
                : subscriptionCleanupRule.meta.confidence,
            filePath: context.filePath,
            line: declaration.line,
            column: declaration.column + 1,
            snippet: buildSnippet(context.source, declaration.line),
            explanation: `${methodName} is called inside useEffect without a matching unsubscribe/off path.`,
            impact: 'Subscriptions can keep pushing data into stale closures and prevent garbage collection.',
            suggestion:
              methodName === 'subscribe'
                ? 'Call unsubscribe() on the returned subscription in cleanup.'
                : 'Remove the listener with off/removeListener in cleanup using the same handler.',
          });
        }
      }

      for (const statement of effect.bodyStatements) {
        if (!t.isExpressionStatement(statement) || !t.isCallExpression(statement.expression)) {
          continue;
        }

        const call = statement.expression;
        if (
          !t.isMemberExpression(call.callee) ||
          !t.isIdentifier(call.callee.property) ||
          !['subscribe', 'on'].includes(call.callee.property.name)
        ) {
          continue;
        }

        const objectName = getIdentifierName(call.callee.object);
        const methodName = t.isIdentifier(call.callee.property) ? call.callee.property.name : 'subscribe';
        const handlerName = getIdentifierName(
          t.isExpression(call.arguments[0]) ? call.arguments[0] : null,
        );

        const cleaned =
          isCleanupCall(effect.cleanupStatements, objectName, ['unsubscribe']) ||
          isCleanupCall(effect.cleanupStatements, objectName, ['off', 'removeListener'], handlerName);

        if (cleaned) {
          continue;
        }

        findings.push({
          ruleId: subscriptionCleanupRule.meta.id,
          category: subscriptionCleanupRule.meta.category,
          severity: applySeverityOverride(
            subscriptionCleanupRule.meta.id,
            methodName === 'on'
              ? 'critical'
              : subscriptionCleanupRule.meta.defaultSeverity,
            context.config.severityOverrides,
          ),
          confidence: 'medium',
          filePath: context.filePath,
          line: call.loc?.start.line ?? effect.line,
          column: (call.loc?.start.column ?? effect.column) + 1,
          snippet: buildSnippet(context.source, call.loc?.start.line ?? effect.line),
          explanation: `${objectName ?? 'A resource'} uses ${methodName} in useEffect without obvious cleanup.`,
          impact: 'Long-lived subscriptions can outlive the component and retain memory.',
          suggestion:
            methodName === 'subscribe'
              ? 'Capture the returned subscription and unsubscribe in cleanup.'
              : 'Pair on() with off()/removeListener() in the cleanup function.',
        });
      }
    }

    return findings;
  },
};
