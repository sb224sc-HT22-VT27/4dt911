// src/components/SidePanels/TeamSummary.tsx
import React from 'react';
import { DistGraph } from '../Charts/DistGraph';
import { RISK_LABELS, type CardItem, type Risk, type TeamEvaluation } from '../../types/f1';
import './SidePanels.css';

interface TeamSummaryProps {
    team: CardItem[];
    evaluation: TeamEvaluation | null;
    baseEvaluation: TeamEvaluation | null;
    swapping: boolean;
    risk: Risk;
    onConfirm: () => void;
}

const Diff: React.FC<{ value: number }> = ({ value }) => {
    const d = Number(value.toFixed(1));
    return <span className={`stat-diff ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`}>{d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : '±0'}</span>;
};

const RISKS: Risk[] = ['floor', 'expected', 'ceiling'];

export const TeamSummary: React.FC<TeamSummaryProps> = ({
    team,
    evaluation,
    baseEvaluation,
    swapping,
    risk,
    onConfirm,
}) => {
    const byId = new Map(team.map((i) => [i.id, i]));
    const drsDriver = evaluation?.drs ? byId.get(evaluation.drs) : undefined;

    return (
        <div className="side-panel">
            <h3 className="side-title">{swapping ? 'Team info · with the swap' : 'Team info'}</h3>


            <div className="stat-tiles">
                {RISKS.map((r) => (
                    <div key={r} className={`stat-tile risk-${r} ${risk === r ? 'active' : ''}`}>
                        <span className="stat-tile-label">{RISK_LABELS[r]}</span>
                        <strong>{evaluation ? evaluation[r] : '–'}</strong>
                        {evaluation && baseEvaluation && <Diff value={evaluation[r] - baseEvaluation[r]} />}
                    </div>
                ))}
            </div>

            {evaluation && (
                <DistGraph
                    p10={evaluation.floor}
                    p50={evaluation.expected}
                    p90={evaluation.ceiling}
                    risk={risk}
                    ghost={baseEvaluation ? { p10: baseEvaluation.floor, p50: baseEvaluation.expected, p90: baseEvaluation.ceiling } : undefined}
                />
            )}

            <div className={`drs-row ${drsDriver ? '' : 'empty'}`}>
                <span className="drs-badge">DRS 2x</span>
                <span>{drsDriver ? drsDriver.name : 'No DRS Boost picked, press DRS on a driver row'}</span>
            </div>
            {swapping && (
                <button type="button" className="replace-btn confirm" onClick={onConfirm}>
                    Confirm swap
                </button>
            )}
        </div>
    );
};
