import { NextResponse } from 'next/server';
import { fetchSquad } from '@/lib/fd';
import { fetchEspnRoster } from '@/lib/espn';
import { buildSquad } from '@/lib/team';
import { getCached, setCached, STATIC_TTL_MS } from '@/lib/cache';
import type { TeamGroup } from '@/lib/team';

const CACHE_KEY = 'team';

export async function GET() {
  const cached = getCached<TeamGroup[]>(CACHE_KEY);
  if (cached) return NextResponse.json({ groups: cached });

  const apiKey = process.env.FOOTBALL_API_KEY || '';
  const [fdSquad, espnRoster] = await Promise.all([
    fetchSquad(apiKey),
    fetchEspnRoster(),
  ]);

  const groups = buildSquad(fdSquad, espnRoster);
  setCached(CACHE_KEY, groups, STATIC_TTL_MS);
  return NextResponse.json({ groups });
}
