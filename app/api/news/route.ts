import { NextResponse } from 'next/server';
import { getNews } from '@/lib/news';

export async function GET() {
  const articles = await getNews();
  return NextResponse.json({ articles });
}
