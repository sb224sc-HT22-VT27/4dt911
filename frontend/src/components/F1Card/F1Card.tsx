// src/components/F1Card/F1Card.tsx
import './F1Card.css';
import React, { useState } from 'react';
import { CardModal } from './CardModal';
import type { CardItem, ItemKind, Risk } from '../../types/f1';

interface F1CardProps {
    item?: CardItem;
    type: ItemKind;
    slotIndex: number;
    risk: Risk;
    onRemove: (id: string) => void;
    onAdd: (slotIndex: number, type: ItemKind) => void;
}

export const F1Card: React.FC<F1CardProps> = ({ item, type, slotIndex, risk, onRemove, onAdd }) => {
    const [showInfo, setShowInfo] = useState(false);

    if (!item) {
        return (
            <div className="f1-card-empty" onClick={() => onAdd(slotIndex, type)} role="button" tabIndex={0}>
                <span className="add-icon">+</span>
                <span className="add-text">Add {type === 'driver' ? 'Driver' : 'Constructor'}</span>
            </div>
        );
    }

    const [firstName, ...rest] = item.name.split(' ');
    const lastName = rest.join(' ');
    const stats: { key: Risk; label: string; value: number }[] = [
        { key: 'floor', label: 'P10', value: item.floor },
        { key: 'expected', label: 'P50', value: item.expectedPoints },
        { key: 'ceiling', label: 'P90', value: item.ceiling },
    ];

    return (
        <>
            <div className="f1-card" style={{ '--team-color': item.avatarColor } as React.CSSProperties}>
                <div className="f1-card-header">
                    <div className="f1-price-pill">€{item.price}M</div>
                    <div className="f1-actions">
                        <button type="button" className="f1-circle-btn" onClick={() => setShowInfo(true)} aria-label="Info">
                            i
                        </button>
                        <button type="button" className="f1-circle-btn" onClick={() => onRemove(item.id)} aria-label="Remove">
                            ✕
                        </button>
                    </div>
                </div>

                <div className="f1-card-body">
                    <span className="f1-watermark-number">{item.kind === 'driver' ? item.number : item.code}</span>
                    <div className="f1-driver-meta">
                        <span className="f1-team-title">{item.team}</span>
                        <h3 className="f1-driver-name">
                            <span>{firstName}</span>
                            {lastName && <span>{lastName}</span>}
                        </h3>
                    </div>
                </div>

                <div className="f1-card-footer">
                    {stats.map((s) => (
                        <div key={s.key} className={`f1-stat-col ${risk === s.key ? `active risk-${s.key}` : ''}`}>
                            <span className="f1-stat-value">{s.value}</span>
                            <span className="f1-stat-label">{s.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {showInfo && <CardModal item={item} onClose={() => setShowInfo(false)} />}
        </>
    );
};
