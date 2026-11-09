// src/components/Info/InfoModal.tsx
import React, { useEffect } from 'react';
import './InfoModal.css';

interface InfoModalProps {
    title: string;
    subtitle: string;
    onClose: () => void;
    children: React.ReactNode;
}

export const InfoModal: React.FC<InfoModalProps> = ({ title, subtitle, onClose, children }) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="doc-overlay" onClick={onClose}>
            <div className="doc-dialog" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
                <div className="doc-dialog-header">
                    <div>
                        <h2>{title}</h2>
                        <span>{subtitle}</span>
                    </div>
                    <button type="button" className="picker-close-btn" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>
                <div className="doc-dialog-body">{children}</div>
            </div>
        </div>
    );
};

// Small two-column table used by both explainers
export const PointsTable: React.FC<{ title: string; rows: [string, string][] }> = ({ title, rows }) => (
    <div className="points-table">
        <span className="points-table-title">{title}</span>
        <table>
            <tbody>
                {rows.map(([label, value]) => (
                    <tr key={label}>
                        <td>{label}</td>
                        <td className={value.startsWith('−') ? 'negative' : ''}>{value}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);
