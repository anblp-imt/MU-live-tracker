import type { Metadata } from 'next';
import { getNews } from '@/lib/news';
import { buildMetadata, SITE_NAME } from '@/lib/seo';
import NewsDetailClient from './NewsDetailClient';

function fallbackMetadata(id: string): Metadata {
  return buildMetadata({
    title: `News — ${SITE_NAME}`,
    description: 'Latest Manchester United news from BBC Sport, The Guardian and ESPN.',
    path: `/news/${id}`,
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const articles = await getNews();
  const article = articles.find(a => a.id === id);
  if (!article) return fallbackMetadata(id);

  return buildMetadata({
    title: `${article.title} — ${SITE_NAME}`,
    description: article.summary,
    path: `/news/${id}`,
  });
}

export default function NewsDetailPage() {
  return <NewsDetailClient />;
}
