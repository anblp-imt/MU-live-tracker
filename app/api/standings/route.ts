import { NextRequest, NextResponse } from 'next/server';
import { fetchStandings } from '@/lib/fd';
import { getCached, setCached, STATIC_TTL_MS } from '@/lib/cache';
import type { StandingRow } from '@/lib/types';

export async function GET(request: NextRequest) {
  const comp = request.nextUrl.searchParams.get('comp');
  if (comp !== 'PL' && comp !== 'CL') {
    return NextResponse.json({ error: 'comp must be PL or CL' }, { status: 400 });
  }

  const cacheKey = `standings:${comp}`;
  const cached = getCached<StandingRow[]>(cacheKey);
  if (cached) return NextResponse.json({ standings: cached });

  const apiKey = process.env.FOOTBALL_API_KEY || '';
  const standings = await fetchStandings(apiKey, comp);
  setCached(cacheKey, standings, STATIC_TTL_MS);
  return NextResponse.json({ standings });
}
