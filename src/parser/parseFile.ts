import fs from 'node:fs/promises';
import { parse } from '@babel/parser';
import type { File } from '@babel/types';

export async function parseFile(filePath: string): Promise<{ source: string; ast: File }> {
  const source = await fs.readFile(filePath, 'utf8');
  const ast = parse(source, {
    sourceType: 'unambiguous',
    plugins: ['jsx', 'typescript'],
    errorRecovery: true,
    ranges: false,
    tokens: false,
  });

  return { source, ast };
}
