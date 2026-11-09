// src/components/SidePanels/TeamSummary.tsx
import React from 'react';
import { BudgetPill } from './BudgetPill';
import { DistGraph } from '../Charts/DistGraph';
import { RISK_LABELS, type CardItem, type Risk, type TeamEvaluation } from '../../types/f1';
import './SidePanels.css';

interface TeamSummaryProps {
    team: CardItem[];
    evaluation: TeamEvaluation | null;
    budget: number;
    remainingBudget: number;
    risk: Risk;
    onBudgetChange: (budget: number) => void;
}

const RISKS: Risk[] = ['floor', 'expected', 'ceiling'];

export const TeamSummary: React.FC<TeamSummaryProps> = ({
    team,
    evaluation,
    budget,
    remainingBudget,
    risk,
    onBudgetChange,
}) => {
    const byId = new Map(team.map((i) => [i.id, i]));
    const drsDriver = evaluation?.drs ? byId.get(evaluation.drs) : undefined;

    return (
        <div className="side-panel">
            <h3 className="side-title">Team info</h3>

            <BudgetPill totalBudget={budget} remainingBudget={remainingBudget} onBudgetChange={onBudgetChange} />

            <div className="stat-tiles">
                {RISKS.map((r) => (
                    <div key={r} className={`stat-tile risk-${r} ${risk === r ? 'active' : ''}`}>
                        <span className="stat-tile-label">{RISK_LABELS[r]}</span>
                        <strong>{evaluation ? evaluation[r] : '–'}</strong>
                    </div>
                ))}
            </div>

            {evaluation && (
                <DistGraph p10={evaluation.floor} p50={evaluation.expected} p90={evaluation.ceiling} risk={risk} />
            )}

            <div className={`drs-row ${drsDriver ? '' : 'empty'}`}>
                <span className="drs-badge">DRS 2x</span>
                <span>{drsDriver ? drsDriver.name : 'No DRS Boost picked, press DRS on a driver card'}</span>
            </div>

            <div className="summary-meta">
                <span>
                    Team value <strong>€{evaluation?.cost ?? 0}M</strong>
                </span>
                <span>
                    Players <strong>{team.length} / 7</strong>
                </span>
            </div>
        </div>
    );
};
