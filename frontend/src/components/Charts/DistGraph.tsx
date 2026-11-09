// src/components/Charts/DistGraph.tsx
import React from 'react';
import * as d3 from 'd3';
import type { Risk } from '../../types/f1';

interface DistGraphProps {
    p10: number;
    p50: number;
    p90: number;
    risk: Risk;
}

const Z90 = 1.2816; // z-score of the 90th percentile

export const DistGraph: React.FC<DistGraphProps> = ({ p10, p50, p90, risk }) => {
    const width = 280;
    const height = 100;
    const margin = { top: 20, right: 14, bottom: 20, left: 14 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Split normal: separate spread below and above the median so P10/P90 can be asymmetric
    const sigmaLow = Math.max((p50 - p10) / Z90, 1);
    const sigmaHigh = Math.max((p90 - p50) / Z90, 1);
    const density = (x: number) => {
        const z = (x - p50) / (x < p50 ? sigmaLow : sigmaHigh);
        return Math.exp(-0.5 * z * z);
    };

    const minX = p50 - 3 * sigmaLow;
    const maxX = p50 + 3 * sigmaHigh;
    const xScale = d3.scaleLinear().domain([minX, maxX]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]);
    const points = d3.range(0, 101).map((i) => {
        const val = minX + (i / 100) * (maxX - minX);
        return [val, density(val)] as [number, number];
    });
    const linePath = d3.line<[number, number]>().x((d) => xScale(d[0])).y((d) => yScale(d[1])).curve(d3.curveBasis)(points) ?? '';
    const areaPath =
        d3
            .area<[number, number]>()
            .x((d) => xScale(d[0]))
            .y0(innerHeight)
            .y1((d) => yScale(d[1]))
            .curve(d3.curveBasis)(points) ?? '';

    if (p50 <= 0) {
        return <p className="side-empty">Add players to see your points distribution.</p>;
    }

    const markers: { key: Risk; label: string; value: number }[] = [
        { key: 'floor', label: 'P10', value: p10 },
        { key: 'expected', label: 'P50', value: p50 },
        { key: 'ceiling', label: 'P90', value: p90 },
    ];

    return (
        <div className="dist-container">
            <svg viewBox={`0 0 ${width} ${height}`} className="dist-svg" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id="distGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
                    </linearGradient>
                </defs>

                <g transform={`translate(${margin.left}, ${margin.top})`}>
                    <rect
                        x={xScale(p10)}
                        y={0}
                        width={xScale(p90) - xScale(p10)}
                        height={innerHeight}
                        fill="#2dd4bf"
                        opacity={0.05}
                    />
                    <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="#253140" strokeWidth={1.5} />
                    <path d={areaPath} fill="url(#distGradient)" />
                    <path d={linePath} fill="none" stroke="#2dd4bf" strokeWidth={2.5} strokeLinecap="round" />

                    {markers.map((m) => {
                        const x = xScale(m.value);
                        const y = yScale(density(m.value));
                        const active = risk === m.key;
                        return (
                            <g key={m.key} className={`dist-marker risk-${m.key}`} opacity={active ? 1 : 0.6}>
                                <line x1={x} y1={y} x2={x} y2={innerHeight} strokeWidth={active ? 2 : 1.2} strokeDasharray="3 3" />
                                <circle cx={x} cy={y} r={active ? 4.5 : 3} />
                                {active && (
                                    <text x={x} y={y - 9} textAnchor="middle" fontSize={12} fontWeight={800}>
                                        {m.value}
                                    </text>
                                )}
                                <text x={x} y={innerHeight + 16} textAnchor="middle" fontSize="9" fontWeight={700}>
                                    {m.label}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>
        </div>
    );
};
