// src/components/F1Card/CardModal.tsx
import React from 'react';
import { type CardItem } from '../../types/f1';

interface CardModalProps {
    item: CardItem;
    onClose: () => void;
}

export const CardModal: React.FC<CardModalProps> = ({ item, onClose }) => {
    const rows: [string, string | number | undefined][] = [
        ['Team', item.team],
        ['Price', `€${item.price}M`],
        ['Ownership', `${item.ownership}%`],
        ['Floor (P10)', item.floor],
        ['Expected (P50)', item.expectedPoints],
        ['Ceiling (P90)', item.ceiling],
        ['Predicted quali', item.qualiPos && `P${item.qualiPos}`],
        ['Predicted finish', item.racePos && `P${item.racePos}`],
        ['DNF chance', item.dnfChance !== undefined ? `${item.dnfChance}%` : undefined],
        ['Settings effect', item.multiplier && item.multiplier !== 1 ? `${item.multiplier > 1 ? '+' : ''}${Math.round((item.multiplier - 1) * 100)}%` : undefined],
    ];

    return (
        <div className="f1-info-overlay" onClick={onClose}>
            <div className="f1-info-dialog" onClick={(e) => e.stopPropagation()}>
                <h4 style={{ borderColor: item.avatarColor }}>{item.name}</h4>
                {rows
                    .filter(([, value]) => value !== undefined)
                    .map(([label, value]) => (
                        <p key={label}>
                            <span>{label}</span>
                            <strong>{value}</strong>
                        </p>
                    ))}
                <button className="f1-info-close" onClick={onClose}>Close</button>
            </div>
        </div>
    );
};
