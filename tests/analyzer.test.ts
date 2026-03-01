import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config/defaults';
import { analyzeFiles } from '../src/core/analyzer';

describe('analyzeFiles', () => {
  it('detects leak patterns in a leaky component', async () => {
    const filePath = path.resolve('tests/fixtures/leakyComponent.tsx');
    const result = await analyzeFiles([filePath], defaultConfig);

    expect(result.findings.length).toBeGreaterThanOrEqual(5);
    expect(result.rulesTriggered).toContain('use-effect-timer-cleanup');
    expect(result.rulesTriggered).toContain('event-listener-cleanup');
    expect(result.rulesTriggered).toContain('subscription-cleanup');
    expect(result.rulesTriggered).toContain('observer-cleanup');
  });

  it('avoids obvious false positives in a clean component', async () => {
    const filePath = path.resolve('tests/fixtures/cleanComponent.tsx');
    const result = await analyzeFiles([filePath], defaultConfig);

    expect(result.findings).toEqual([]);
  });

  it('honors file suppression comments', async () => {
    const suppressedPath = path.resolve('tests/fixtures/suppressed.tsx');
    const result = await analyzeFiles([suppressedPath], defaultConfig);
    expect(result.findings).toEqual([]);
  });
});
