// src/utils/scoring.ts
import type { CardItem, Params, Ratings } from '../types/f1';

export const DEFAULT_PARAMS: Params = { risk: 'expected', formWeight: 0, trackWeight: 0, dnfWeight: 0 };

// At 100% weight, a perfect rating gives up to +30% points and a rating of 0 gives -30%
const MAX_SWING = 0.3;

export function applyParams(item: CardItem, params: Params): CardItem {
    const r = item.ratings;
    const formBoost = r ? (params.formWeight / 100) * MAX_SWING * ((r.form - 50) / 50) : 0;
    const trackBoost = r ? (params.trackWeight / 100) * MAX_SWING * ((r.trackFit - 50) / 50) : 0;
    const dnfPenalty = (params.dnfWeight / 100) * ((item.dnfChance ?? 0) / 100);
    const multiplier = (1 + formBoost + trackBoost) * (1 - dnfPenalty);
    const scale = (v: number) => Number((v * multiplier).toFixed(1));

    return {
        ...item,
        floor: scale(item.floor),
        expectedPoints: scale(item.expectedPoints),
        ceiling: scale(item.ceiling),
        multiplier,
    };
}

export function averageRatings(items: CardItem[]): Ratings | null {
    const rated = items.filter((i) => i.ratings).map((i) => i.ratings!);
    if (!rated.length) return null;
    const keys = Object.keys(rated[0]) as (keyof Ratings)[];
    return Object.fromEntries(
        keys.map((k) => [k, Math.round(rated.reduce((sum, r) => sum + r[k], 0) / rated.length)])
    ) as unknown as Ratings;
}
