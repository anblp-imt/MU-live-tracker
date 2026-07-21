import type { FdMatch, FdStandingRow, FdSquadPlayer } from './types';

const FD_BASE = 'https://api.football-data.org/v4';
const MU_FD_ID = 66;

export class FdApiError extends Error {
  code: 'INVALID_KEY' | 'PLAN_LIMIT' | 'RATE_LIMIT' | 'NOT_FOUND' | 'NETWORK' | 'HTTP';
  constructor(code: FdApiError['code'], message: string) {
    super(message);
    this.name = 'FdApiError';
    this.code = code;
  }
}

async function fdFetch(path: string, apiKey: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${FD_BASE}${path}`, { headers: { 'X-Auth-Token': apiKey } });
  } catch (e) {
    throw new FdApiError('NETWORK', e instanceof Error ? e.message : 'network error');
  }
  if (res.status === 400 || res.status === 401) throw new FdApiError('INVALID_KEY', 'Invalid API key');
  if (res.status === 403) throw new FdApiError('PLAN_LIMIT', 'No access to this competition');
  if (res.status === 429) throw new FdApiError('RATE_LIMIT', 'Rate limit exceeded (10 req/min)');
  if (res.status === 404) throw new FdApiError('NOT_FOUND', 'Endpoint not found');
  if (!res.ok) throw new FdApiError('HTTP', `HTTP ${res.status}`);
  return res.json();
}

export async function fetchMuMatches(apiKey: string): Promise<FdMatch[]> {
  const data = (await fdFetch(`/teams/${MU_FD_ID}/matches`, apiKey)) as { matches?: FdMatch[] };
  return data.matches || [];
}

export async function fetchStandings(apiKey: string, comp: 'PL' | 'CL'): Promise<FdStandingRow[]> {
  const data = (await fdFetch(`/competitions/${comp}/standings`, apiKey)) as {
    season?: { startDate?: string };
    standings?: Array<{ type: string; table: FdStandingRow[] }>;
  };
  // Before a new season's fixtures exist, football-data.org still returns a `standings`
  // table under that season's object — but it's the previous season's completed table,
  // carried over rather than reset. A future startDate means the table describes a
  // season that hasn't kicked off yet, so it shouldn't be shown as "current".
  if (data.season?.startDate && new Date(data.season.startDate) > new Date()) return [];
  return data.standings?.find(s => s.type === 'TOTAL')?.table || [];
}

export async function fetchSquad(apiKey: string): Promise<FdSquadPlayer[]> {
  const data = (await fdFetch(`/teams/${MU_FD_ID}`, apiKey)) as { squad?: FdSquadPlayer[] };
  return data.squad || [];
}
