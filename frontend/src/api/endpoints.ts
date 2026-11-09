// src/api/endpoints.ts
const REAL_API = 'http://localhost:8000';
const MOCK_API = 'http://localhost:8001';

// Where each endpoint is served from. Switch one to REAL_API when the backend implements it.
export const ENDPOINTS = {
    drivers: `${REAL_API}/drivers/`,
    constructors: `${REAL_API}/constructors/`,
    upcomingRaces: `${MOCK_API}/races/upcoming`,
    predictions: `${MOCK_API}/predictions`,
    driverStats: `${MOCK_API}/stats/drivers`,
    constructorStats: `${MOCK_API}/stats/constructors`,
    teammates: `${MOCK_API}/stats/teammates`,
    evaluateTeam: `${MOCK_API}/teams/evaluate`,
    optimize: `${MOCK_API}/optimize`,
};
