import { describe, it, expect } from 'vitest';
import { metadata } from './page';

describe('Stats page metadata', () => {
  it('sets a Stats-specific title, description, and canonical url', () => {
    expect(metadata.title).toBe('Season Stats — Glory Glory Man United');
    expect(metadata.description).toBe(
      'Top scorers, assists, and season leaderboard for Manchester United across every competition.',
    );
    expect(metadata.alternates).toEqual({ canonical: 'https://gloryglory.vercel.app/stats' });
    expect(metadata.openGraph?.title).toBe('Season Stats — Glory Glory Man United');
  });
});
