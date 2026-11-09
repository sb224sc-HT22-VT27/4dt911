// src/components/Header/ParametersBar.tsx
import React from 'react';
import {
    DEFAULT_PARAMS,
    RISK_LABELS,
    TRACK_LABELS,
    type Horizon,
    type Params,
    type Risk,
    type TrackType,
} from '../../types/f1';
import './ParametersBar.css';

interface ParametersBarProps {
    params: Params;
    trackType: TrackType;
    horizon: Horizon;
    onChange: (params: Params) => void;
    onHorizonChange: (horizon: Horizon) => void;
}

const RISKS: Risk[] = ['floor', 'expected', 'ceiling'];

export const ParametersBar: React.FC<ParametersBarProps> = ({
    params,
    trackType,
    horizon,
    onChange,
    onHorizonChange,
}) => {
    const sliders: { key: 'form' | 'track' | 'dnf'; label: string; hint: string }[] = [
        { key: 'form', label: 'Recent form', hint: 'Boost drivers with strong last 5 races' },
        {
            key: 'track',
            label: horizon === 1 ? `Track fit · ${TRACK_LABELS[trackType]}` : 'Track fit · per race',
            hint:
                horizon === 1
                    ? `Boost drivers who over-perform on ${TRACK_LABELS[trackType].toLowerCase()} tracks`
                    : 'Boost drivers who over-perform on each race\'s track type',
        },
        { key: 'dnf', label: 'DNF penalty', hint: 'Reduce points by the chance of not finishing' },
    ];

    return (
        <div className="params-bar">
            <div className="param">
                <span className="param-label">Horizon</span>
                <div className="risk-toggle horizon-toggle">
                    {([1, 3] as Horizon[]).map((h) => (
                        <button
                            key={h}
                            type="button"
                            className={`risk-btn ${horizon === h ? 'active' : ''}`}
                            onClick={() => onHorizonChange(h)}
                        >
                            {h === 1 ? '1 race' : '3 races'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="param">
                <span className="param-label">Risk</span>
                <div className="risk-toggle">
                    {RISKS.map((r) => (
                        <button
                            key={r}
                            type="button"
                            className={`risk-btn risk-${r} ${params.risk === r ? 'active' : ''}`}
                            onClick={() => onChange({ ...params, risk: r })}
                        >
                            {RISK_LABELS[r]}
                        </button>
                    ))}
                </div>
            </div>

            {sliders.map((s) => (
                <label key={s.key} className="param" title={s.hint}>
                    <span className="param-label">
                        {s.label}
                        <strong>{params[s.key]}%</strong>
                    </span>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        step={10}
                        value={params[s.key]}
                        onChange={(e) => onChange({ ...params, [s.key]: Number(e.target.value) })}
                    />
                </label>
            ))}

            <button
                type="button"
                className="params-reset"
                onClick={() => {
                    onChange(DEFAULT_PARAMS);
                    onHorizonChange(1);
                }}
            >
                Reset
            </button>
        </div>
    );
};
