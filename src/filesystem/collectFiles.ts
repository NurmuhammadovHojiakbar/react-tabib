import fg from 'fast-glob';
import path from 'node:path';
import type { ReactTabibResolvedConfig } from '../types';

export async function collectFiles(
  rootPath: string,
  config: ReactTabibResolvedConfig,
): Promise<string[]> {
  const entries = await fg(config.include, {
    cwd: rootPath,
    absolute: true,
    onlyFiles: true,
    unique: true,
    ignore: config.ignore,
  });

  return entries
    .filter((entry) => /\.(jsx?|tsx?)$/.test(entry))
    .map((entry) => path.resolve(entry));
}
