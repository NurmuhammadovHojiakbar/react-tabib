import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import { defaultConfig } from './defaults';
import type { ReactTabibConfig, ReactTabibResolvedConfig } from '../types';

async function resolveConfigPath(cwd: string, explicitPath?: string): Promise<string | null> {
  if (explicitPath) {
    return path.resolve(cwd, explicitPath);
  }

  const candidates = [
    'react-tabib.config.ts',
    'react-tabib.config.js',
    'react-tabib.config.cjs',
    'react-tabib.config.mjs',
  ];

  for (const candidate of candidates) {
    const configPath = path.resolve(cwd, candidate);
    try {
      await fs.access(configPath);
      return configPath;
    } catch {
      continue;
    }
  }

  return null;
}

async function loadConfigModule(configPath: string): Promise<ReactTabibConfig> {
  const extension = path.extname(configPath);
  if (extension === '.mjs') {
    const dynamicImport = new Function(
      'specifier',
      'return import(specifier);',
    ) as (specifier: string) => Promise<Record<string, unknown>>;
    const imported = await dynamicImport(pathToFileURL(configPath).href);
    return (imported.default ?? imported) as ReactTabibConfig;
  }

  const source = await fs.readFile(configPath, 'utf8');

  if (extension === '.ts') {
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
      fileName: configPath,
    }).outputText;

    const script = new vm.Script(compiled, { filename: configPath });
    const module = { exports: {} as Record<string, unknown> };
    const context = vm.createContext({
      module,
      exports: module.exports,
      require,
      __dirname: path.dirname(configPath),
      __filename: configPath,
      process,
      console,
    });
    script.runInContext(context);
    return (module.exports.default ?? module.exports) as ReactTabibConfig;
  }

  const required = require(configPath);
  return (required.default ?? required) as ReactTabibConfig;
}

export async function loadConfig(
  cwd: string,
  explicitPath?: string,
): Promise<{ config: ReactTabibResolvedConfig; configPath: string | null }> {
  const configPath = await resolveConfigPath(cwd, explicitPath);
  if (!configPath) {
    return { config: defaultConfig, configPath: null };
  }

  const loaded = await loadConfigModule(configPath);
  const config: ReactTabibResolvedConfig = {
    ...defaultConfig,
    ...loaded,
    ignore: [...defaultConfig.ignore, ...(loaded.ignore ?? [])],
    disabledRules: loaded.disabledRules ?? defaultConfig.disabledRules,
    severityOverrides: {
      ...defaultConfig.severityOverrides,
      ...(loaded.severityOverrides ?? {}),
    },
  };

  return { config, configPath };
}
