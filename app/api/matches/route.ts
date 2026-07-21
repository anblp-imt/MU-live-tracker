import { NextResponse } from 'next/server';
import { getMatches } from '@/lib/matches';

export async function GET() {
  const response = await getMatches(process.env.FOOTBALL_API_KEY || '');
  return NextResponse.json(response);
}
