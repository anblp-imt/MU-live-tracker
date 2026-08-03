import { describe, it, expect } from 'vitest';
import { newsArticleId } from './newsId';

describe('newsArticleId', () => {
  it('returns the same id for the same source and url', () => {
    const a = newsArticleId('BBC', 'https://example.com/story-1');
    const b = newsArticleId('BBC', 'https://example.com/story-1');
    expect(a).toBe(b);
  });

  it('returns different ids for different urls', () => {
    const a = newsArticleId('BBC', 'https://example.com/story-1');
    const b = newsArticleId('BBC', 'https://example.com/story-2');
    expect(a).not.toBe(b);
  });

  it('returns different ids for the same url from different sources', () => {
    const a = newsArticleId('BBC', 'https://example.com/story-1');
    const b = newsArticleId('Guardian', 'https://example.com/story-1');
    expect(a).not.toBe(b);
  });
});
