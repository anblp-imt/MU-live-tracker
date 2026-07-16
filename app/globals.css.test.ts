import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('MU theme tokens', () => {
  const css = readFileSync(join(__dirname, 'globals.css'), 'utf8');

  it('defines the MU brand colors', () => {
    expect(css).toContain('--mu-red: #DA291C');
    expect(css).toContain('--mu-gold: #FFD700');
    expect(css).toContain('--mu-black');
  });

  it('defines the Fergie Time pulse animation', () => {
    expect(css).toContain('fergie-pulse');
  });
});
