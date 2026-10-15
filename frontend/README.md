# Frontend

## Driver and constructor setup
````
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
```python