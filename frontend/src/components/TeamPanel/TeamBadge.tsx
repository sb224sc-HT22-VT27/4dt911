// src/components/TeamPanel/TeamBadge.tsx
import React from 'react';
import type { CardItem } from '../../types/f1';

// Display-only short codes, same neutral style for every team
const TEAM_CODES: Record<string, string> = {
    Alpine: 'ALP',
    'Aston Martin': 'AST',
    Audi: 'AUD',
    Cadillac: 'CAD',
    Ferrari: 'FER',
    'Haas F1 Team': 'HAA',
    McLaren: 'MCL',
    Mercedes: 'MER',
    'Racing Bulls': 'RB',
    'Red Bull Racing': 'RBR',
    Williams: 'WIL',
};

// Drivers carry their team name, constructors are the team
const teamCode = (item: CardItem) => {
    const team = item.kind === 'driver' ? item.team : item.name;
    return TEAM_CODES[team] ?? team.slice(0, 3).toUpperCase();
};

export const TeamBadge: React.FC<{ item: CardItem }> = ({ item }) => (
    <span className="team-badge">{teamCode(item)}</span>
);
