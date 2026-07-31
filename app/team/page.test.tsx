import { describe, it, expect } from 'vitest';
import { metadata } from './page';

describe('Team page metadata', () => {
  it('sets a Team-specific title, description, and canonical url', () => {
    expect(metadata.title).toBe('Team — Glory Glory Man United');
    expect(metadata.description).toBe(
      "Manchester United's current first-team squad, grouped by position.",
    );
    expect(metadata.alternates).toEqual({ canonical: 'https://gloryglory.vercel.app/team' });
    expect(metadata.openGraph?.title).toBe('Team — Glory Glory Man United');
  });
});
