// src/components/F1Card.tsx
import React, { useState } from 'react';

export interface CardItem {
    id: string;
    name: string;
    number?: string | number;
    team: string;
    price: number;
    ownership: number;
    expectedPoints: number;
    accentColor?: string;
}

interface F1CardProps {
    item?: CardItem;
    type: 'driver' | 'constructor';
    slotIndex: number;
    onRemove: (id: string) => void;
    onAdd: (slotIndex: number, type: 'driver' | 'constructor') => void;
}

export const F1Card: React.FC<F1CardProps> = ({
    item,
    type,
    slotIndex,
    onRemove,
    onAdd,
}) => {
    const [showInfo, setShowInfo] = useState(false);

    if (!item) {
        return (
            <div
                className="f1-card-empty"
                onClick={() => onAdd(slotIndex, type)}
                role="button"
                tabIndex={0}
            >
                <span className="add-icon">+</span>
                <span className="add-text">Add {type === 'driver' ? 'Driver' : 'Constructor'}</span>
            </div>
        );
    }

    const nameParts = item.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return (
        <>
            <div className="f1-card">
                {/* Header */}
                <div className="f1-card-header">
                    <div
                        className="f1-price-pill"
                        style={{
                            backgroundColor: item.accentColor || '#277960'
                        }}
                    >
                        €{item.price}
                    </div>
                    <div className="f1-actions">
                        <button
                            type="button"
                            className="f1-circle-btn"
                            onClick={() => setShowInfo(true)}
                            aria-label="Info"
                        >
                            ⓘ
                        </button>
                        <button
                            type="button"
                            className="f1-circle-btn"
                            onClick={() => onRemove(item.id)}
                            aria-label="Remove"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Body & Watermark */}
                <div className="f1-card-body">
                    {item.number && (
                        <span
                            className="f1-watermark-number"
                            style={{ color: item.accentColor || '#17362d' }}
                        >
                            {item.number}
                        </span>
                    )}

                    <div className="f1-driver-meta">
                        <span className="f1-team-title">{item.team}</span>
                        <h3 className="f1-driver-name">
                            <span>{firstName}</span>
                            {lastName && <span>{lastName}</span>}
                        </h3>
                    </div>
                </div>

                {/* Footer */}
                <div className="f1-card-footer">
                    <div className="f1-stat-col">
                        <span className="f1-stat-value">{item.expectedPoints}</span>
                        <span className="f1-stat-label">EXPECTED PTS</span>
                    </div>
                    <div className="f1-stat-divider" />
                    <div className="f1-stat-col">
                        <span className="f1-stat-value">{item.ownership}%</span>
                        <span className="f1-stat-label">OWNERSHIP</span>
                    </div>
                </div>
            </div>

            {/* Info Modal Popup */}
            {showInfo && (
                <div className="f1-info-overlay" onClick={() => setShowInfo(false)}>
                    <div className="f1-info-dialog" onClick={(e) => e.stopPropagation()}>
                        <h4>{item.name}</h4>
                        <p><strong>Team:</strong> {item.team}</p>
                        <p><strong>Price:</strong> €{item.price}M</p>
                        <p><strong>Expected Points:</strong> {item.expectedPoints}</p>
                        <p><strong>Ownership:</strong> {item.ownership}%</p>
                        <button className="f1-info-close" onClick={() => setShowInfo(false)}>
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};