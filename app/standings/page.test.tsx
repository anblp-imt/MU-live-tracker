import { describe, it, expect } from 'vitest';
import { metadata } from './page';

describe('Standings page metadata', () => {
  it('sets a Standings-specific title, description, and canonical url', () => {
    expect(metadata.title).toBe('Standings — Glory Glory Man United');
    expect(metadata.description).toBe(
      "Manchester United's league position and cup group standings across every competition this season.",
    );
    expect(metadata.alternates).toEqual({ canonical: 'https://gloryglory.vercel.app/standings' });
    expect(metadata.openGraph?.title).toBe('Standings — Glory Glory Man United');
  });
});
