import type { Rule } from '../types';
import { asyncUnmountRule } from './asyncUnmountRule';
import { eventListenerCleanupRule } from './eventListenerCleanupRule';
import { lifecycleMisuseRule } from './lifecycleMisuseRule';
import { observerCleanupRule } from './observerCleanupRule';
import { subscriptionCleanupRule } from './subscriptionCleanupRule';
import { useEffectTimerCleanupRule } from './useEffectTimerCleanupRule';

export const allRules: Rule[] = [
  useEffectTimerCleanupRule,
  eventListenerCleanupRule,
  subscriptionCleanupRule,
  observerCleanupRule,
  asyncUnmountRule,
  lifecycleMisuseRule,
];

export function getActiveRules(rules: Rule[], config: { enabledRules: string[] | null; disabledRules: string[]; experimentalRules: boolean }): Rule[] {
  return rules.filter((rule) => {
    if (rule.meta.experimental && !config.experimentalRules) {
      return false;
    }

    if (config.enabledRules && !config.enabledRules.includes(rule.meta.id)) {
      return false;
    }

    return !config.disabledRules.includes(rule.meta.id);
  });
}
