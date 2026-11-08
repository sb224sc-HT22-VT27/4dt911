// src/components/TeamPanel/optimizer.ts
import { pointsFor, type CardItem, type Risk } from '../../types/f1';

interface Group {
    items: CardItem[];
    cost: number;
    points: number;
}

function combinations(items: CardItem[], size: number, risk: Risk): Group[] {
    const result: Group[] = [];
    const pick = (start: number, chosen: CardItem[]) => {
        if (chosen.length === size) {
            result.push({
                items: chosen,
                cost: chosen.reduce((sum, i) => sum + i.price, 0),
                points: chosen.reduce((sum, i) => sum + pointsFor(i, risk), 0),
            });
            return;
        }
        for (let i = start; i < items.length; i++) pick(i + 1, [...chosen, items[i]]);
    };
    pick(0, []);
    return result;
}

// Brute force the best 5 drivers + 2 constructors within budget.
// Risk decides which prediction we maximise: P10 (floor), P50 (middle) or P90 (ceiling).
export function findOptimalTeam(
    drivers: CardItem[],
    constructors: CardItem[],
    budget: number,
    risk: Risk
): { drivers: CardItem[]; constructors: CardItem[]; points: number } | null {
    if (drivers.length < 5 || constructors.length < 2) return null;

    const driverGroups = combinations(drivers, 5, risk).filter((g) => g.cost <= budget);
    const constructorPairs = combinations(constructors, 2, risk).filter((g) => g.cost <= budget);

    let best: { drivers: Group; constructors: Group } | null = null;
    let bestPoints = -Infinity;

    for (const pair of constructorPairs) {
        for (const group of driverGroups) {
            if (pair.cost + group.cost > budget + 0.0001) continue;
            const points = pair.points + group.points;
            if (points > bestPoints) {
                bestPoints = points;
                best = { drivers: group, constructors: pair };
            }
        }
    }

    if (!best) return null;
    return {
        drivers: best.drivers.items,
        constructors: best.constructors.items,
        points: Number(bestPoints.toFixed(1)),
    };
}
