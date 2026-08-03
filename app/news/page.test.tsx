import { describe, it, expect } from 'vitest';
import { metadata } from './page';

describe('News page metadata', () => {
  it('sets a News-specific title, description, and canonical url', () => {
    expect(metadata.title).toBe('News — Glory Glory Man United');
    expect(metadata.description).toBe('Latest Manchester United news from BBC Sport, The Guardian and ESPN.');
    expect(metadata.alternates).toEqual({ canonical: 'https://gloryglory.vercel.app/news' });
    expect(metadata.openGraph?.title).toBe('News — Glory Glory Man United');
  });
});
