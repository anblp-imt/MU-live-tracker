import { NextRequest, NextResponse } from 'next/server';
import { fetchEspnDetail } from '@/lib/espn';
import { getCached, setCached, LIVE_TTL_MS, STATIC_TTL_MS } from '@/lib/cache';
import type { EspnDetail } from '@/lib/types';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: espnId } = await params;
  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'slug query param is required' }, { status: 400 });
  }

  const cacheKey = `match-detail:${slug}:${espnId}`;
  const cached = getCached<EspnDetail>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const detail = await fetchEspnDetail(slug, espnId);
  const state = detail.header?.competitions?.[0]?.status?.type?.state;
  setCached(cacheKey, detail, state === 'in' ? LIVE_TTL_MS : STATIC_TTL_MS);
  return NextResponse.json(detail);
}
