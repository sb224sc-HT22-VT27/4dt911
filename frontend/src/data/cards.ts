export interface Driver {
    // Info
    id: string; // Last name in lower case "ver"
    name: string; // Full name
    number: number;
    code: string; // Code ex. VER
    team: string; // Team Name 
    team_id: String; // Team id "c-redbull" used to link team
    avatarColor: string;
    // Stats
    price: number; // in millions ($M)
    ownership: number; // percentage %
    fantasyPoints: number; // fantasy points this season
    predictedPoints: number; // Predicted points this week
    championshipPoints: number; // Actual points this season
}

export interface Constructor {
    id: string; // id is "c-redbull"
    name: string; // Full team name
    code: string; // 3-letter team abbreviation
    price: number; // in millions ($M)
    avatarColor: string;
    // stats
    ownership: number; // percentage %
    fantasyPoints: number; // fantasy points this season
    predictedPoints: number; // Predicted points this week
    championshipPoints: number; // Actual points this season
}

export const MOCK_DRIVERS: Driver[] = [
    {
        id: 'ver', name: 'Max Verstappen', number: 1, code: 'VER', team: 'Red Bull Racing', price: 30.5, ownership: 68.4,
        predictedPoints: 24.5, avatarColor: '#1e3a8a', team_id: "c-redbull",
        fantasyPoints: 178, championshipPoints: 200
    }
];

export const MOCK_CONSTRUCTORS: Constructor[] = [
    {
        id: 'c-redbull', name: 'Red Bull Racing', code: 'RBR', price: 29.0, ownership: 62.1,
        predictedPoints: 37.0, avatarColor: '#1e3a8a', fantasyPoints: 0, championshipPoints: 0
    },
];