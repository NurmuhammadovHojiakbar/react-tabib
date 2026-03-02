import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { EffectDescriptor } from '../types';

export function collectEffects(ast: t.File): EffectDescriptor[] {
  const effects: EffectDescriptor[] = [];

  traverse(ast, {
    CallExpression(callPath) {
      if (!isUseEffectCall(callPath.node)) {
        return;
      }

      const callback = callPath.node.arguments[0];
      if (!t.isArrowFunctionExpression(callback) && !t.isFunctionExpression(callback)) {
        return;
      }

      const bodyStatements = t.isBlockStatement(callback.body) ? callback.body.body : [];
      const cleanupStatements = getCleanupStatements(bodyStatements);

      effects.push({
        line: callPath.node.loc?.start.line ?? 1,
        column: callPath.node.loc?.start.column ?? 0,
        callbackAsync: callback.async,
        bodyStatements,
        cleanupStatements,
        dependencyExpression: t.isExpression(callPath.node.arguments[1])
          ? callPath.node.arguments[1]
          : null,
      });
    },
  });

  return effects;
}

const EFFECT_HOOK_NAMES = new Set(['useEffect', 'useLayoutEffect']);

function isUseEffectCall(node: t.CallExpression): boolean {
  if (t.isIdentifier(node.callee) && EFFECT_HOOK_NAMES.has(node.callee.name)) {
    return true;
  }

  return (
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(node.callee.object, { name: 'React' }) &&
    t.isIdentifier(node.callee.property) &&
    EFFECT_HOOK_NAMES.has(node.callee.property.name)
  );
}

function getCleanupStatements(statements: t.Statement[]): t.Statement[] {
  // Collect all variable declarations so we can resolve named cleanup references.
  const varMap = new Map<string, t.ArrowFunctionExpression | t.FunctionExpression>();
  for (const statement of statements) {
    if (!t.isVariableDeclaration(statement)) {
      continue;
    }
    for (const declarator of statement.declarations) {
      if (
        t.isIdentifier(declarator.id) &&
        (t.isArrowFunctionExpression(declarator.init) || t.isFunctionExpression(declarator.init))
      ) {
        varMap.set(declarator.id.name, declarator.init);
      }
    }
  }

  for (const statement of statements) {
    if (!t.isReturnStatement(statement)) {
      continue;
    }

    const argument = statement.argument;

    // Pattern: return () => { ... }  or  return function() { ... }
    if (t.isArrowFunctionExpression(argument) || t.isFunctionExpression(argument)) {
      if (t.isBlockStatement(argument.body)) {
        return argument.body.body;
      }
      // Pattern: return () => clearInterval(timer)  (expression body)
      if (t.isExpression(argument.body)) {
        return [t.expressionStatement(argument.body)];
      }
    }

    // Pattern: const cleanup = () => { ... };  return cleanup;
    if (t.isIdentifier(argument)) {
      const fn = varMap.get(argument.name);
      if (fn) {
        if (t.isBlockStatement(fn.body)) {
          return fn.body.body;
        }
        if (t.isExpression(fn.body)) {
          return [t.expressionStatement(fn.body)];
        }
      }
    }
  }

  return [];
}

export function getIdentifierName(node: t.Node | null | undefined): string | null {
  if (!node) {
    return null;
  }

  if (t.isIdentifier(node)) {
    return node.name;
  }

  if (t.isMemberExpression(node)) {
    const objectName = getIdentifierName(node.object);
    const propertyName = t.isIdentifier(node.property) ? node.property.name : null;
    return objectName && propertyName ? `${objectName}.${propertyName}` : null;
  }

  return null;
}

export function buildSnippet(source: string, line: number): string {
  return source.split('\n')[line - 1]?.trim() ?? '';
}

export function findCalls(
  statements: t.Statement[],
  predicate: (call: t.CallExpression) => boolean,
): t.CallExpression[] {
  const calls: t.CallExpression[] = [];
  const container = t.program(statements);

  traverse(container, {
    noScope: true,
    CallExpression(callPath) {
      if (predicate(callPath.node)) {
        calls.push(callPath.node);
      }
    },
  });

  return calls;
}

export function findVariableDeclarations(
  statements: t.Statement[],
): Array<{ id: string; init: t.Expression | null; line: number; column: number }> {
  const declarations: Array<{ id: string; init: t.Expression | null; line: number; column: number }> = [];

  for (const statement of statements) {
    if (!t.isVariableDeclaration(statement)) {
      continue;
    }

    for (const declaration of statement.declarations) {
      if (!t.isIdentifier(declaration.id)) {
        continue;
      }

      declarations.push({
        id: declaration.id.name,
        init: t.isExpression(declaration.init) ? declaration.init : null,
        line: declaration.loc?.start.line ?? 1,
        column: declaration.loc?.start.column ?? 0,
      });
    }
  }

  return declarations;
}

export function hasDependencyArray(effect: EffectDescriptor): boolean {
  return Boolean(effect.dependencyExpression);
}

export function isEmptyDependencyArray(effect: EffectDescriptor): boolean {
  return t.isArrayExpression(effect.dependencyExpression) && effect.dependencyExpression.elements.length === 0;
}

export function isStateSetterName(name: string | null): boolean {
  return Boolean(name && /^set[A-Z]/.test(name));
}

export function findUseStateSetters(ast: t.File): Set<string> {
  const setters = new Set<string>();

  traverse(ast, {
    VariableDeclarator(path) {
      if (
        t.isArrayPattern(path.node.id) &&
        path.node.id.elements.length >= 2 &&
        t.isCallExpression(path.node.init) &&
        t.isIdentifier(path.node.init.callee, { name: 'useState' })
      ) {
        const setter = path.node.id.elements[1];
        if (t.isIdentifier(setter)) {
          setters.add(setter.name);
        }
      }
    },
  });

  return setters;
}

export function isGlobalTargetName(name: string | null): boolean {
  return Boolean(name && ['window', 'document', 'globalThis'].includes(name));
}

export function isCleanupCall(
  statements: t.Statement[],
  objectName: string | null,
  methodNames: string[],
  identifierArg?: string | null,
): boolean {
  return findCalls(statements, (call) => {
    if (!t.isMemberExpression(call.callee)) {
      return false;
    }

    const targetName = getIdentifierName(call.callee.object);
    const methodName = t.isIdentifier(call.callee.property) ? call.callee.property.name : null;
    if (targetName !== objectName || !methodName || !methodNames.includes(methodName)) {
      return false;
    }

    if (!identifierArg) {
      return true;
    }

    return call.arguments.some((argument) => {
      return getIdentifierName(t.isExpression(argument) ? argument : null) === identifierArg;
    });
  }).length > 0;
}

export function isClearedByGlobalCleanup(
  statements: t.Statement[],
  cleanupName: string,
  identifierArg: string | null,
): boolean {
  return findCalls(statements, (call) => {
    if (!isGlobalFunctionCall(call.callee, cleanupName)) {
      return false;
    }

    if (!identifierArg) {
      return true;
    }

    const firstArg = call.arguments[0];
    return getIdentifierName(t.isExpression(firstArg) ? firstArg : null) === identifierArg;
  }).length > 0;
}

function isGlobalFunctionCall(
  callee: t.CallExpression['callee'],
  functionName: string,
): boolean {
  if (t.isIdentifier(callee, { name: functionName })) {
    return true;
  }

  if (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.property, { name: functionName })
  ) {
    const objectName = getIdentifierName(callee.object);
    return objectName === 'window' || objectName === 'globalThis' || objectName === 'self';
  }

  return false;
}

export function hasCleanupReturn(effect: EffectDescriptor): boolean {
  return effect.cleanupStatements.length > 0;
}

export function hasLikelyRepeatedEffect(effect: EffectDescriptor): boolean {
  return !hasDependencyArray(effect);
}

export function isPromiseThenCall(call: t.CallExpression): boolean {
  return (
    t.isMemberExpression(call.callee) &&
    t.isIdentifier(call.callee.property, { name: 'then' })
  );
}

export function firstStatementLine(statement: t.Statement): number {
  return statement.loc?.start.line ?? 1;
}

export function firstStatementColumn(statement: t.Statement): number {
  return statement.loc?.start.column ?? 0;
}
