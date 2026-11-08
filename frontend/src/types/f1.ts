// src/types/f1.ts

// Roster shapes returned by the FastAPI backend
export interface Driver {
    id: string;
    name: string;
    number: number;
    code: string;
    team: string;
    team_id: string;
    avatarColor: string;
    price: number;
    ownership: number;
    fantasyPoints: number;
    predictedPoints: number;
    championshipPoints: number;
}

export interface Constructor {
    id: string;
    name: string;
    code: string;
    price: number;
    avatarColor: string;
    ownership: number;
    fantasyPoints: number;
    predictedPoints: number;
    championshipPoints: number;
}

export type Risk = 'floor' | 'expected' | 'ceiling';
export type ItemKind = 'driver' | 'constructor';
export type TrackType = 'street' | 'high_speed' | 'technical';

// User controlled settings, sliders go from 0 to 100
export interface Params {
    risk: Risk;
    form: number;
    track: number;
    dnf: number;
}

export const DEFAULT_PARAMS: Params = { risk: 'expected', form: 0, track: 0, dnf: 0 };

// Responses from the endpoints in API_ENDPOINTS.md
export interface Race {
    round: string;
    name: string;
    date: string;
    circuit: string;
    location: string;
    trackType: TrackType;
}

export interface Prediction {
    id: string;
    kind: ItemKind;
    floor: number;
    expected: number;
    ceiling: number;
    ppm: number;
    multiplier: number;
    dnfChance?: number;
    qualiPos?: number;
    racePos?: number;
}

export interface Ratings {
    quali: number;
    race: number;
    form: number;
    reliability: number;
    overtaking: number;
    trackFit: number;
}

export interface SeasonStats {
    starts: number;
    wins: number;
    podiums: number;
    points: number;
    avgQuali: number | null;
    avgFinish: number | null;
    bestFinish: number | null;
    dnfs: number;
    avgGained: number;
    avgPitStop: number | null;
}

export interface PlayerStats {
    id: string;
    code: string | null;
    ratings: Ratings;
    season: SeasonStats;
    trackAvg: number | null;
}

export interface TeamEvaluation {
    cost: number;
    floor: number;
    expected: number;
    ceiling: number;
    players: { id: string; points: number; share: number }[];
}

export interface OptimizeResult {
    drivers: string[];
    constructors: string[];
    points: number;
}

// Everything the UI needs for one selectable driver or constructor
export interface CardItem {
    id: string;
    kind: ItemKind;
    name: string;
    code: string;
    number?: string | number;
    team: string;
    price: number;
    ownership: number;
    avatarColor: string;
    floor: number;
    expectedPoints: number;
    ceiling: number;
    ppm: number;
    multiplier: number;
    qualiPos?: number;
    racePos?: number;
    dnfChance?: number;
    ratings?: Ratings;
    season?: SeasonStats;
    trackAvg?: number | null;
}

export const RISK_LABELS: Record<Risk, string> = {
    floor: 'Floor',
    expected: 'Middle',
    ceiling: 'Ceiling',
};

export const TRACK_LABELS: Record<TrackType, string> = {
    street: 'Street',
    high_speed: 'High speed',
    technical: 'Technical',
};

export const RATING_LABELS: Record<keyof Ratings, string> = {
    quali: 'Quali',
    race: 'Race',
    form: 'Form',
    reliability: 'Reliability',
    overtaking: 'Overtaking',
    trackFit: 'Track fit',
};

export const pointsFor = (item: CardItem, risk: Risk): number =>
    risk === 'floor' ? item.floor : risk === 'ceiling' ? item.ceiling : item.expectedPoints;
