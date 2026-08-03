// Deterministic djb2-style string hash — NewsArticle isn't persisted, only re-fetched and
// re-hashed on every cache miss, so the same (source, sourceUrl) pair must always produce
// the same id for /news/[id] to keep resolving correctly across requests. No shared id
// exists across BBC/Guardian/ESPN to use instead.
export function newsArticleId(source: string, sourceUrl: string): string {
  const input = `${source}:${sourceUrl}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}
