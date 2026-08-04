import { NextRequest, NextResponse } from 'next/server';
import { getNews } from '@/lib/news';

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get('force') === '1';
  const articles = await getNews(force);
  return NextResponse.json({ articles });
}
