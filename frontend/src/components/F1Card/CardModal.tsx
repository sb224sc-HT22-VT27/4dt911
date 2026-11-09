// src/components/F1Card/CardModal.tsx
import React from 'react';
import { HexChart } from '../Charts/HexChart';
import { type CardItem } from '../../types/f1';

interface CardModalProps {
    item: CardItem;
    onClose: () => void;
}

const finishClass = (position: number, dnf: boolean) =>
    dnf ? 'dnf' : position <= 3 ? 'podium' : position <= 10 ? 'points' : 'out';

export const CardModal: React.FC<CardModalProps> = ({ item, onClose }) => {
    // Scale the range bar so the ceiling sits at ~85% of the width
    const scaleMax = Math.max(item.ceiling * 1.15, 1);
    const pos = (v: number) => `${Math.max(0, Math.min(100, (v / scaleMax) * 100))}%`;
    const isDriver = item.kind === 'driver';

    return (
        <div className="f1-info-overlay" onClick={onClose}>
            <div
                className="f1-info-dialog"
                style={{ '--team-color': item.avatarColor } as React.CSSProperties}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="info-hero">
                    <div>
                        <span className="info-team">{item.team}</span>
                        <h4>{item.name}</h4>
                        <div className="info-chips">
                            <span>€{item.price}M</span>
                            <span>{item.ownership}% owned</span>
                            <span>{item.ppm} pts/€M</span>
                        </div>
                    </div>
                    <span className="info-number">{isDriver ? item.number : item.code}</span>
                    <button type="button" className="info-close-x" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                <section className="info-section">
                    <span className="info-label">Predicted points this race</span>
                    <div className="range-bar">
                        <span className="range-fill" style={{ left: pos(item.floor), right: `calc(100% - ${pos(item.ceiling)})` }} />
                        <span className="range-marker" style={{ left: pos(item.expectedPoints) }} />
                    </div>
                    <div className="range-labels">
                        <span style={{ left: pos(item.floor) }}>
                            <b>{item.floor}</b> P10
                        </span>
                        <span className="mid" style={{ left: pos(item.expectedPoints) }}>
                            <b>{item.expectedPoints}</b> P50
                        </span>
                        <span style={{ left: pos(item.ceiling) }}>
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

                <section className="info-columns">
                    {item.ratings && (
                        <div className="info-hex">
                            <span className="info-label">Ratings vs the grid</span>
                            <HexChart series={[{ label: item.name, color: item.avatarColor, values: item.ratings }]} />
                        </div>
                    )}

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
        </div>
    );
};
