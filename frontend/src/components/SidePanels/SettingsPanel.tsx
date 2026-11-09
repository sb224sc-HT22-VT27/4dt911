// src/components/SidePanels/SettingsPanel.tsx
import React, { useState } from 'react';
import {
    DEFAULT_PARAMS,
    RISK_LABELS,
    TRACK_LABELS,
    type Horizon,
    type OptimizerMode,
    type Params,
    type Risk,
    type TrackType,
} from '../../types/f1';
import './SidePanels.css';

interface SettingsPanelProps {
    params: Params;
    trackType: TrackType;
    horizon: Horizon;
    optimizerMode: OptimizerMode;
    onChange: (params: Params) => void;
    onHorizonChange: (horizon: Horizon) => void;
    onModeChange: (mode: OptimizerMode) => void;
    onOptimize: () => Promise<string>;
}

const RISKS: Risk[] = ['floor', 'expected', 'ceiling'];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    params,
    trackType,
    horizon,
    optimizerMode,
    onChange,
    onHorizonChange,
    onModeChange,
    onOptimize,
}) => {
    const [message, setMessage] = useState('');
    const [optimizing, setOptimizing] = useState(false);

    const handleOptimize = async () => {
        setOptimizing(true);
        setMessage(await onOptimize());
        setOptimizing(false);
    };

    const sliders: { key: 'form' | 'track' | 'dnf'; label: string; hint: string }[] = [
        { key: 'form', label: 'Recent form', hint: 'Boost drivers with strong last 5 races' },
        {
            key: 'track',
            label: horizon === 1 ? `Track fit · ${TRACK_LABELS[trackType]}` : 'Track fit · per race',
            hint: "Boost drivers who over-perform on the race's track type",
        },
        { key: 'dnf', label: 'DNF penalty', hint: 'Reduce points by the chance of not finishing' },
    ];

    return (
        <div className="settings">
            <div className="settings-head">
                <h3 className="side-title">Settings</h3>
                <button
                    type="button"
                    className="settings-reset"
                    onClick={() => {
                        onChange(DEFAULT_PARAMS);
                        onHorizonChange(1);
                    }}
                >
                    Reset
                </button>
            </div>

            <div className="setting-row">
                <span className="setting-label">Horizon</span>
                <div className="toggle horizon">
                    {([1, 3] as Horizon[]).map((h) => (
                        <button key={h} type="button" className={horizon === h ? 'active' : ''} onClick={() => onHorizonChange(h)}>
                            {h === 1 ? '1 race' : '3 races'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="setting-row">
                <span className="setting-label">Risk</span>
                <div className="toggle">
                    {RISKS.map((r) => (
                        <button
                            key={r}
                            type="button"
                            className={`risk-${r} ${params.risk === r ? 'active' : ''}`}
                            onClick={() => onChange({ ...params, risk: r })}
                        >
                            {RISK_LABELS[r]}
                        </button>
                    ))}
                </div>
            </div>

            {sliders.map((s) => (
                <label key={s.key} className="setting-slider" title={s.hint}>
                    <span className="setting-label">
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

            <div className="settings-optimizer">
                <div className="setting-row">
                    <span className="setting-label">Optimizer</span>
                    <div className="toggle horizon">
                        {(['best', 'transfers'] as OptimizerMode[]).map((m) => (
                            <button
                                key={m}
                                type="button"
                                className={optimizerMode === m ? 'active' : ''}
                                onClick={() => {
                                    onModeChange(m);
                                    setMessage('');
                                }}
                            >
                                {m === 'best' ? 'Best team' : 'Transfers'}
                            </button>
                        ))}
                    </div>
                </div>

                <button type="button" className="optimize-btn" onClick={handleOptimize} disabled={optimizing}>
                    {optimizing ? 'Working…' : optimizerMode === 'best' ? 'Optimize team' : 'Suggest transfers'}
                </button>
                {message && <span className="optimize-msg">{message}</span>}
            </div>
        </div>
    );
};
