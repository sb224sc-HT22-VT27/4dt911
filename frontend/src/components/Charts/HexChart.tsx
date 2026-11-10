// src/components/Charts/HexChart.tsx
import React from 'react';
import { RATING_LABELS, type Ratings } from '../../types/f1';

interface HexSeries {
    label: string;
    color: string;
    values: Ratings;
}

interface HexChartProps {
    series: HexSeries[];
}

const AXES = Object.keys(RATING_LABELS) as (keyof Ratings)[];
const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 82;

// Point on axis i at a 0-100 value, first axis points straight up
const point = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
    const r = (value / 100) * RADIUS;
    return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
};

const polygon = (values: number[]) => values.map((v, i) => point(i, v).join(',')).join(' ');

export const HexChart: React.FC<HexChartProps> = ({ series }) => (
    <div className="hex-chart">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {[25, 50, 75, 100].map((ring) => (
                <polygon key={ring} points={polygon(AXES.map(() => ring))} className="hex-ring" />
            ))}
            {AXES.map((axis, i) => {
                const [x, y] = point(i, 100);
                const [lx, ly] = point(i, 122);
                return (
                    <g key={axis}>
                        <line x1={CENTER} y1={CENTER} x2={x} y2={y} className="hex-axis" />
                        <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="hex-label">
                            {RATING_LABELS[axis]}
                        </text>
                    </g>
                );
            })}
            {series.map((s) => (
                <g key={s.label}>
                    <polygon
                        points={polygon(AXES.map((a) => s.values[a]))}
                        fill={s.color}
                        fillOpacity={0.18}
                        stroke={s.color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                    />
                    {AXES.map((a, i) => {
                        const [x, y] = point(i, s.values[a]);
                        return (
                            <circle key={a} cx={x} cy={y} r={3} fill={s.color}>
                                <title>{`${s.label} · ${RATING_LABELS[a]}: ${s.values[a]}`}</title>
                            </circle>
                        );
                    })}
                </g>
            ))}
        </svg>
        <div className="hex-legend">
            {series.map((s) => (
                <span key={s.label}>
                    <i style={{ backgroundColor: s.color }} />
                    {s.label}
                </span>
            ))}
        </div>
    </div>
);
