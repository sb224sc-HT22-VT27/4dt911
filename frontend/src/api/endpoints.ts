// src/api/endpoints.ts
const REAL_API = 'http://localhost:8000';

// Where each endpoint is served from. Switch one to REAL_API when the backend implements it.
export const ENDPOINTS = {
    drivers: `${REAL_API}/drivers/`,
    constructors: `${REAL_API}/constructors/`,
    upcomingRaces: `${REAL_API}/races/upcoming`,
    predictions: `${REAL_API}/predictions`,
    predictionsByRound: `${REAL_API}/predictions/by-round`,
    driverStats: `${REAL_API}/stats/drivers`,
    constructorStats: `${REAL_API}/stats/constructors`,
    teammates: `${REAL_API}/stats/teammates`,
    evaluateTeam: `${REAL_API}/teams/evaluate`,
    optimize: `${REAL_API}/optimize`,
};
