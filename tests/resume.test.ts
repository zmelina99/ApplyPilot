import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectDefaultResume } from '../src/prep/resume.js';

describe('default resume resolution', () => {
  it('returns unavailable when no approved defaultFile is configured', () => {
    const dir = mkdtempSync(join(tmpdir(), 'applypilot-resume-'));
    writeFileSync(join(dir, 'orphan.pdf'), '%PDF');
    const cfg = JSON.stringify({
      _meta: { profileVersion: 'test' },
      availability: 'immediate',
      weeklyHours: 40,
      applicationCountry: { swissJob: 'Switzerland', default: 'Spain' },
      salary: { usdHourly: 35 },
      resume: { defaultFile: null },
    });
    const cfgPath = join(dir, 'application-defaults.json');
    writeFileSync(cfgPath, cfg);
    expect(detectDefaultResume(dir, cfgPath)).toEqual({ available: false, name: null, path: null });
  });

  it('returns unavailable when defaultFile is configured but missing on disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'applypilot-resume-'));
    const cfgPath = join(dir, 'application-defaults.json');
    writeFileSync(cfgPath, JSON.stringify({
      _meta: { profileVersion: 'test' },
      availability: 'immediate',
      weeklyHours: 40,
      applicationCountry: { swissJob: 'Switzerland', default: 'Spain' },
      salary: { usdHourly: 35 },
      resume: { defaultFile: 'approved.pdf' },
    }));
    expect(detectDefaultResume(dir, cfgPath)).toEqual({ available: false, name: 'approved.pdf', path: null });
  });

  it('resolves the approved file when configured and present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'applypilot-resume-'));
    const cfgPath = join(dir, 'application-defaults.json');
    writeFileSync(join(dir, 'approved.pdf'), '%PDF');
    writeFileSync(cfgPath, JSON.stringify({
      _meta: { profileVersion: 'test' },
      availability: 'immediate',
      weeklyHours: 40,
      applicationCountry: { swissJob: 'Switzerland', default: 'Spain' },
      salary: { usdHourly: 35 },
      resume: { defaultFile: 'approved.pdf' },
    }));
    expect(detectDefaultResume(dir, cfgPath)).toEqual({
      available: true,
      name: 'approved.pdf',
      path: join(dir, 'approved.pdf'),
    });
  });
});
