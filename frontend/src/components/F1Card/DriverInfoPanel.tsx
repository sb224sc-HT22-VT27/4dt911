// src/components/F1Card/DriverInfoPanel.tsx
import React from 'react';
import { HexChart } from '../Charts/HexChart';
import { TeamBadge } from '../TeamPanel/TeamBadge';
import { type CardItem, type Ratings } from '../../types/f1';
import './F1Card.css';

interface DriverInfoPanelProps {
    item?: CardItem;
    gridRatings?: Ratings; // grid average of the same kind, from the backend
    inTeam: boolean;
    blocker: string | null; // why it can't be added, or null
    onAdd: (item: CardItem) => void;
    onRemove: (id: string) => void;
}

const finishClass = (position: number, dnf: boolean) =>
    dnf ? 'dnf' : position <= 3 ? 'podium' : position <= 10 ? 'points' : 'out';

export const DriverInfoPanel: React.FC<DriverInfoPanelProps> = ({ item, gridRatings, inTeam, blocker, onAdd, onRemove }) => {
    if (!item) {
        return (
            <div className="info-panel">
                <h3 className="side-title">Driver info</h3>
                <p className="info-panel-empty">Click a player to see details</p>
            </div>
        );
    }

    // Bar runs from the lower of 0 and the floor to a bit above the ceiling (floors can be negative)
    const scaleMin = Math.min(0, item.floor);
    const scaleMax = Math.max(item.ceiling * 1.15, scaleMin + 1);
    const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - scaleMin) / (scaleMax - scaleMin)) * 100))}%`;
    const isDriver = item.kind === 'driver';

    return (
        <div className="info-panel">
            <h3 className="side-title">{isDriver ? 'Driver info' : 'Constructor info'}</h3>
            <div className="info-hero">
                <div>
                    <span className="info-team">
                        <TeamBadge item={item} /> {isDriver ? item.team : 'Constructor'}
                    </span>
                    <h4>{item.name}</h4>
                    <div className="info-chips">
                        <span>€{item.price}M</span>
                        <span>{item.ownership}% owned</span>
                        <span>{item.ppm} pts/€M</span>
                    </div>
                </div>
            </div>
            {inTeam ? (
                <button type="button" className="info-action remove" onClick={() => onRemove(item.id)}>
                    Remove from team
                </button>
            ) : (
                <button type="button" className="info-action" disabled={!!blocker} onClick={() => onAdd(item)}>
                    {blocker ?? '+ Add to team'}
                </button>
            )}

            <section className="info-section">
                <span className="info-label">Predicted points</span>
                <div className="range-bar">
                    <span className="range-fill" style={{ left: pos(item.floor), right: `calc(100% - ${pos(item.ceiling)})` }} />
                    <span className="range-marker" style={{ left: pos(item.expectedPoints) }} />
                </div>
                <div className="range-labels">
                    <span>
                        <b>{item.floor}</b> P10
                    </span>
                    <span className="mid">
                        <b>{item.expectedPoints}</b> P50
                    </span>
                    <span>
                        <b>{item.ceiling}</b> P90
                    </span>
                </div>

                <div className="info-facts">
                    {isDriver && item.qualiPos && item.racePos && (
                        <div className="info-fact">
                            <span className="info-label">Predicted result</span>
                            <div className="grid-to-finish">
                                <span>Q P{item.qualiPos}</span>
                                <span className="arrow">→</span>
                                <strong>P{item.racePos}</strong>
                            </div>
                        </div>
                    )}
                    {item.dnfChance !== undefined && (
                        <div className="info-fact">
                            <span className="info-label">{isDriver ? 'DNF chance' : 'DNF rate'}</span>
                            <div className="dnf-meter">
                                <span
                                    className={item.dnfChance >= 10 ? 'high' : ''}
                                    style={{ width: `${Math.min(100, (item.dnfChance / 30) * 100)}%` }}
                                />
                            </div>
                            <strong className={item.dnfChance >= 10 ? 'dnf-high' : ''}>{item.dnfChance}%</strong>
                        </div>
                    )}
                </div>
            </section>

            {item.ratings && (
                <section className="info-hex">
                    <span className="info-label">Ratings vs grid average</span>
                    <HexChart
                        series={[
                            { label: item.name, color: '#3987e5', values: item.ratings },
                            ...(gridRatings ? [{ label: 'Grid average', color: '#8b98a9', values: gridRatings }] : []),
                        ]}
                    />
                </section>
            )}

            <section className="info-columns">
                <div className="info-side">
                    {item.recentFinishes && (
                        <div>
                            <span className="info-label">Last 5 races</span>
                            <div className="recent-finishes">
                                {item.recentFinishes.map((f) => (
                                    <div key={f.race} className="recent-finish" title={`${f.race} GP`}>
                                        <span className={`finish-box ${finishClass(f.position, f.dnf)}`}>
                                            {f.dnf ? 'DNF' : `P${f.position}`}
                                        </span>
                                        <span className="finish-race">{f.race.slice(0, 3).toUpperCase()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {item.season && (
                        <div className="season-grid">
                            <div>
                                <strong>{item.season.points}</strong>
                                <span>Points</span>
                            </div>
                            <div>
                                <strong>{item.season.wins}</strong>
                                <span>Wins</span>
                            </div>
                            <div>
                                <strong>{item.season.podiums}</strong>
                                <span>Podiums</span>
                            </div>
                            <div>
                                <strong>{item.season.avgFinish ? `P${item.season.avgFinish}` : '–'}</strong>
                                <span>Avg finish</span>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};
