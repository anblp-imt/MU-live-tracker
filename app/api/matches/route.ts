import { NextRequest, NextResponse } from 'next/server';
import { getMatches } from '@/lib/matches';

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get('force') === '1';
  const response = await getMatches(process.env.FOOTBALL_API_KEY || '', force);
  return NextResponse.json(response);
}
