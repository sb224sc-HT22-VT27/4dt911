export interface Driver {
    id: string;
    name: string;
    code: string;
    team: string;
    price: number; // in millions ($M)
    ownership: number; // percentage %
    expectedPoints: number;
    avatarColor: string;
}

export interface Constructor {
    id: string;
    name: string;
    code: string; // 3-letter team abbreviation
    price: number; // in millions ($M)
    ownership: number; // percentage %
    expectedPoints: number;
    avatarColor: string;
}

export const MOCK_DRIVERS: Driver[] = [
    { id: 'ver', name: 'Max Verstappen', code: 'VER', team: 'Red Bull Racing', price: 30.5, ownership: 68.4, expectedPoints: 24.5, avatarColor: '#1e3a8a' },
    { id: 'nor', name: 'Lando Norris', code: 'NOR', team: 'McLaren', price: 27.0, ownership: 55.2, expectedPoints: 21.0, avatarColor: '#f97316' },
    { id: 'lec', name: 'Charles Leclerc', code: 'LEC', team: 'Ferrari', price: 24.0, ownership: 42.1, expectedPoints: 18.5, avatarColor: '#dc2626' },
    { id: 'pia', name: 'Oscar Piastri', code: 'PIA', team: 'McLaren', price: 22.5, ownership: 38.0, expectedPoints: 17.2, avatarColor: '#ea580c' },
    { id: 'ham', name: 'Lewis Hamilton', code: 'HAM', team: 'Mercedes', price: 21.0, ownership: 29.5, expectedPoints: 15.0, avatarColor: '#0d9488' },
    { id: 'rus', name: 'George Russell', code: 'RUS', team: 'Mercedes', price: 20.0, ownership: 25.8, expectedPoints: 14.8, avatarColor: '#0f766e' },
    { id: 'sai', name: 'Carlos Sainz', code: 'SAI', team: 'Ferrari', price: 19.5, ownership: 22.4, expectedPoints: 14.2, avatarColor: '#b91c1c' },
    { id: 'per', name: 'Sergio Perez', code: 'PER', team: 'Red Bull Racing', price: 18.0, ownership: 15.3, expectedPoints: 12.0, avatarColor: '#1e40af' },
    { id: 'alo', name: 'Fernando Alonso', code: 'ALO', team: 'Aston Martin', price: 14.0, ownership: 18.2, expectedPoints: 10.5, avatarColor: '#047857' },
    { id: 'str', name: 'Lance Stroll', code: 'STR', team: 'Aston Martin', price: 11.0, ownership: 8.1, expectedPoints: 7.8, avatarColor: '#065f46' },
    { id: 'tsu', name: 'Yuki Tsunoda', code: 'TSU', team: 'RB', price: 9.5, ownership: 12.0, expectedPoints: 7.2, avatarColor: '#2563eb' },
    { id: 'alb', name: 'Alexander Albon', code: 'ALB', team: 'Williams', price: 8.5, ownership: 9.4, expectedPoints: 6.8, avatarColor: '#0284c7' },
    { id: 'hul', name: 'Nico Hulkenberg', code: 'HUL', team: 'Haas', price: 7.0, ownership: 6.5, expectedPoints: 5.5, avatarColor: '#e11d48' },
    { id: 'ric', name: 'Daniel Ricciardo', code: 'RIC', team: 'RB', price: 8.0, ownership: 7.2, expectedPoints: 5.8, avatarColor: '#3b82f6' },
    { id: 'gas', name: 'Pierre Gasly', code: 'GAS', team: 'Alpine', price: 7.5, ownership: 5.1, expectedPoints: 5.0, avatarColor: '#ec4899' },
    { id: 'oco', name: 'Esteban Ocon', code: 'OCO', team: 'Alpine', price: 7.5, ownership: 4.8, expectedPoints: 4.8, avatarColor: '#db2777' },
    { id: 'mag', name: 'Kevin Magnussen', code: 'MAG', team: 'Haas', price: 6.5, ownership: 3.9, expectedPoints: 4.2, avatarColor: '#be123c' },
    { id: 'bot', name: 'Valtteri Bottas', code: 'BOT', team: 'Kick Sauber', price: 6.0, ownership: 3.1, expectedPoints: 4.0, avatarColor: '#16a34a' },
    { id: 'zho', name: 'Zhou Guanyu', code: 'ZHO', team: 'Kick Sauber', price: 5.5, ownership: 2.2, expectedPoints: 3.5, avatarColor: '#15803d' },
    { id: 'col', name: 'Franco Colapinto', code: 'COL', team: 'Williams', price: 6.0, ownership: 4.0, expectedPoints: 4.1, avatarColor: '#0369a1' }
];

export const MOCK_CONSTRUCTORS: Constructor[] = [
    { id: 'c-redbull', name: 'Red Bull Racing', code: 'RBR', price: 29.0, ownership: 62.1, expectedPoints: 37.0, avatarColor: '#1e3a8a' },
    { id: 'c-mclaren', name: 'McLaren', code: 'MCL', price: 28.5, ownership: 58.4, expectedPoints: 38.5, avatarColor: '#f97316' },
    { id: 'c-ferrari', name: 'Ferrari', code: 'FER', price: 25.0, ownership: 46.8, expectedPoints: 33.0, avatarColor: '#dc2626' },
    { id: 'c-mercedes', name: 'Mercedes', code: 'MER', price: 22.0, ownership: 31.0, expectedPoints: 30.0, avatarColor: '#0d9488' },
    { id: 'c-astonmartin', name: 'Aston Martin', code: 'AMR', price: 13.5, ownership: 14.5, expectedPoints: 18.0, avatarColor: '#047857' },
    { id: 'c-rb', name: 'RB', code: 'RBF', price: 9.0, ownership: 10.2, expectedPoints: 13.0, avatarColor: '#2563eb' },
    { id: 'c-haas', name: 'Haas', code: 'HAS', price: 7.5, ownership: 7.0, expectedPoints: 9.8, avatarColor: '#e11d48' },
    { id: 'c-williams', name: 'Williams', code: 'WIL', price: 7.0, ownership: 6.4, expectedPoints: 10.2, avatarColor: '#0284c7' },
    { id: 'c-alpine', name: 'Alpine', code: 'ALP', price: 6.5, ownership: 4.8, expectedPoints: 9.0, avatarColor: '#ec4899' },
    { id: 'c-sauber', name: 'Kick Sauber', code: 'SAU', price: 5.5, ownership: 2.5, expectedPoints: 7.5, avatarColor: '#16a34a' }
];