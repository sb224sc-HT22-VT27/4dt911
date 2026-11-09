// src/api/fantasyApi.ts
import { ENDPOINTS } from './endpoints';
import type {
    CardItem,
    Constructor,
    Driver,
    OptimizeResult,
    Params,
    PlayerStats,
    Prediction,
    Race,
    TeammateStats,
    TeamEvaluation,
    TransferSettings,
} from '../types/f1';

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
        res = await fetch(url, init);
    } catch {
        throw new Error(`Could not reach ${new URL(url).origin}. Is the server running?`);
    }
    if (!res.ok) throw new Error(`${new URL(url).pathname} failed (${res.status})`);
    return res.json();
}

const postJson = <T>(url: string, body: unknown) =>
    getJson<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const paramsBody = (rounds: string[], params: Params) => ({ rounds, ...params });

export const fetchDrivers = () => getJson<Driver[]>(ENDPOINTS.drivers);
export const fetchConstructors = () => getJson<Constructor[]>(ENDPOINTS.constructors);
export const fetchUpcomingRaces = () => getJson<Race[]>(ENDPOINTS.upcomingRaces);

export const fetchPredictions = (rounds: string[], params: Params) => {
    const query = new URLSearchParams({
        rounds: rounds.join(','),
        risk: params.risk,
        form: String(params.form),
        track: String(params.track),
        dnf: String(params.dnf),
    });
    return getJson<Prediction[]>(`${ENDPOINTS.predictions}?${query}`);
};

export const fetchStats = (kind: 'driver' | 'constructor', round: string) =>
    getJson<PlayerStats[]>(`${kind === 'driver' ? ENDPOINTS.driverStats : ENDPOINTS.constructorStats}?round=${round}`);

export const evaluateTeam = (
    drivers: string[],
    constructors: string[],
    drs: string | null,
    rounds: string[],
    params: Params
) => postJson<TeamEvaluation>(ENDPOINTS.evaluateTeam, { drivers, constructors, drs, ...paramsBody(rounds, params) });

export const fetchTeammates = () => getJson<TeammateStats[]>(ENDPOINTS.teammates);

// Pass transfer settings to get the best transfers from the current team instead of a whole new team
export const optimizeTeam = (budget: number, rounds: string[], params: Params, transfers?: TransferSettings) =>
    postJson<OptimizeResult>(ENDPOINTS.optimize, { budget, ...paramsBody(rounds, params), ...transfers });

// Joins roster, predictions and stats by player id. Players without a prediction aren't selectable.
export function toCards(
    roster: (Driver | Constructor)[],
    kind: 'driver' | 'constructor',
    predictions: Prediction[],
    stats: PlayerStats[]
): CardItem[] {
    const predById = new Map(predictions.filter((p) => p.kind === kind).map((p) => [p.id, p]));
    const statsById = new Map(stats.map((s) => [s.id, s]));

    return roster
        .filter((r) => predById.has(r.id))
        .map((r) => {
            const pred = predById.get(r.id)!;
            const s = statsById.get(r.id);
            const driver = kind === 'driver' ? (r as Driver) : null;
            return {
                id: r.id,
                kind,
                name: r.name,
                code: s?.code || r.code || r.name.slice(0, 3).toUpperCase(),
                number: driver?.number,
                team: driver ? driver.team : 'Constructor',
                price: Number(r.price),
                ownership: Number(r.ownership),
                avatarColor: r.avatarColor || '#2dd4bf',
                floor: pred.floor,
                expectedPoints: pred.expected,
                ceiling: pred.ceiling,
                ppm: pred.ppm,
                multiplier: pred.multiplier,
                dnfChance: pred.dnfChance,
                qualiPos: pred.qualiPos,
                racePos: pred.racePos,
                ratings: s?.ratings,
                season: s?.season,
                trackAvg: s?.trackAvg,
                recentFinishes: s?.recentFinishes,
            };
        });
}
