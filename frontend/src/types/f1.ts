// src/types/f1.ts
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

export interface CardItem {
    id: string;
    name: string;
    number?: string | number;
    team: string;
    price: number;
    ownership: number;
    expectedPoints: number;
    avatarColor?: string;
}