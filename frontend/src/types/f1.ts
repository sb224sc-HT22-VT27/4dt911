// src/types/f1.ts

// Raw driver/constructor shapes returned by the FastAPI backend
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

export interface Race {
    round: string;
    name: string;
    date: string;
}

export interface FantasyPoints {
    floor_p10: number;
    expected_p50: number;
    ceiling_p90: number;
}

export interface DriverPrediction {
    race_name: string;
    date: string;
    driver: string;
    predictions: {
        qualifying_position: number;
        race_position: number;
        dnf_probability: number;
    };
    fantasy_points: FantasyPoints;
}

export interface ConstructorPrediction {
    race_name: string;
    date: string;
    team_id: number;
    drivers_included: string[];
    fantasy_points: FantasyPoints;
}

export interface RoundPredictions {
    drivers: Record<string, DriverPrediction>;
    constructors: Record<string, ConstructorPrediction>;
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
    qualiPos?: number;
    racePos?: number;
    dnfChance?: number;
    ratings?: Ratings;
    season?: SeasonStats;
    trackAvg?: number;
    multiplier?: number;
}

export type TrackType = 'street' | 'high_speed' | 'technical';

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

export interface StatsEntry {
    name: string;
    ratings: Omit<Ratings, 'trackFit'>;
    trackFit: Record<TrackType, number>;
    season: SeasonStats;
    trackHistory: Record<string, number>;
}

export interface Track {
    circuit: string;
    circuitRef: string;
    location: string;
    type: TrackType;
}

export interface StatsFile {
    tracks: Record<string, Track>;
    drivers: Record<string, StatsEntry>;
    constructors: Record<string, StatsEntry>;
}

// User controlled weights, all sliders go from 0 to 100
export interface Params {
    risk: Risk;
    formWeight: number;
    trackWeight: number;
    dnfWeight: number;
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
