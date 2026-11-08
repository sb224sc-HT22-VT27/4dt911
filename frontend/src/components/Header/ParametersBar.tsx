// src/components/Header/ParametersBar.tsx
import React from 'react';
import { DEFAULT_PARAMS, RISK_LABELS, TRACK_LABELS, type Params, type Risk, type TrackType } from '../../types/f1';
import './ParametersBar.css';

interface ParametersBarProps {
    params: Params;
    trackType: TrackType;
    onChange: (params: Params) => void;
}

const RISKS: Risk[] = ['floor', 'expected', 'ceiling'];

export const ParametersBar: React.FC<ParametersBarProps> = ({ params, trackType, onChange }) => {
    const sliders: { key: 'form' | 'track' | 'dnf'; label: string; hint: string }[] = [
        { key: 'form', label: 'Recent form', hint: 'Boost drivers with strong last 5 races' },
        {
            key: 'track',
            label: `Track fit · ${TRACK_LABELS[trackType]}`,
            hint: `Boost drivers who over-perform on ${TRACK_LABELS[trackType].toLowerCase()} tracks`,
        },
        { key: 'dnf', label: 'DNF penalty', hint: 'Reduce points by the chance of not finishing' },
    ];

    return (
        <div className="params-bar">
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

            <button type="button" className="params-reset" onClick={() => onChange(DEFAULT_PARAMS)}>
                Reset
            </button>
        </div>
    );
};
