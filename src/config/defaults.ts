import type { ReactTabibResolvedConfig } from '../types';

export const defaultConfig: ReactTabibResolvedConfig = {
  include: ['**/*.{js,jsx,ts,tsx}'],
  ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**', '**/coverage/**'],
  enabledRules: null,
  disabledRules: [],
  severityOverrides: {},
  reporter: 'pretty',
  ci: false,
  experimentalRules: false,
  failOnSeverity: 'high',
  maxWarnings: Number.POSITIVE_INFINITY,
};
