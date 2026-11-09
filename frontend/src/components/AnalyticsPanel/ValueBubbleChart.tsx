// src/components/AnalyticsPanel/ValueBubbleChart.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { pointsFor, RISK_LABELS, type CardItem, type Risk } from '../../types/f1';

type Filter = 'driver' | 'constructor' | 'all';

interface ValueBubbleChartProps {
    allDrivers: CardItem[];
    allConstructors: CardItem[];
    teamIds: Set<string>;
    risk: Risk;
    addBlocker: (item: CardItem) => string | null;
    onAdd: (item: CardItem) => void;
    onRemove: (id: string) => void;
}

const FILTERS: { id: Filter; label: string }[] = [
    { id: 'driver', label: 'Drivers' },
    { id: 'constructor', label: 'Constructors' },
    { id: 'all', label: 'All' },
];
const MARGIN = { top: 10, right: 18, bottom: 34, left: 46 };

export const ValueBubbleChart: React.FC<ValueBubbleChartProps> = ({
    allDrivers,
    allConstructors,
    teamIds,
    risk,
    addBlocker,
    onAdd,
    onRemove,
}) => {
    const [filter, setFilter] = useState<Filter>('driver');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const plotRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 700, height: 260 });

    // Keep the SVG in pixels so the bubbles stay round when the panel resizes
    useEffect(() => {
        const el = plotRef.current;
        if (!el) return;
        const observer = new ResizeObserver(([entry]) =>
            setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const items =
        filter === 'driver' ? allDrivers : filter === 'constructor' ? allConstructors : [...allDrivers, ...allConstructors];
    const byValue = [...items].sort((a, b) => b.ppm - a.ppm);
    const selected = items.find((i) => i.id === selectedId) ?? byValue.find((i) => !teamIds.has(i.id)) ?? byValue[0];
    const inTeam = selected ? teamIds.has(selected.id) : false;
    const blocker = selected && !inTeam ? addBlocker(selected) : null;

    const width = Math.max(size.width, 200);
    const height = Math.max(size.height, 120);
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;

    // Scales use every player so the axes stay the same when switching filter
    const everyone = [...allDrivers, ...allConstructors];
    const points = everyone.map((i) => pointsFor(i, risk));
    const x = d3
        .scaleLinear()
        .domain([0, (d3.max(everyone, (i) => i.price) ?? 30) * 1.08])
        .nice()
        .range([0, innerW]);
    const y = d3
        .scaleLinear()
        .domain([Math.min(0, d3.min(points) ?? 0), (d3.max(points) ?? 10) * 1.1])
        .nice()
        .range([innerH, 0]);
    const r = d3
        .scaleSqrt()
        .domain([0, d3.max(everyone, (i) => i.ownership) ?? 50])
        .range([4, 18]);

    // Guide lines for half, equal and double the median points per €M
    const median = d3.median(everyone, (i) => i.ppm) ?? 1;
    const guides = [median / 2, median, median * 2].map((k) => {
        const [xMax, yMax] = [x.domain()[1], y.domain()[1]];
        const endX = Math.min(xMax, yMax / k);
        return { k, x2: x(endX), y2: y(endX * k) };
    });

    // Label your team, the selection and the standout picks so the chart stays readable
    const topValue = new Set(byValue.slice(0, 4).map((i) => i.id));
    const topPoints = new Set([...items].sort((a, b) => pointsFor(b, risk) - pointsFor(a, risk)).slice(0, 4).map((i) => i.id));
    const showLabel = (i: CardItem) => teamIds.has(i.id) || i.id === selected?.id || topValue.has(i.id) || topPoints.has(i.id);

    return (
        <div className="bubble-wrapper">
            <div className="ppm-toolbar">
                <div className="ppm-kind-toggle">
                    {FILTERS.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            className={filter === f.id ? 'active' : ''}
                            onClick={() => {
                                setFilter(f.id);
                                setSelectedId(null);
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <span className="ppm-axis-hint">
                    <span className="legend-ring" /> your team · <span className="legend-stripes" /> constructor · size =
                    ownership · double-click to add
                </span>
            </div>

            {selected && (
                <div className="ppm-detail" style={{ borderColor: selected.avatarColor }}>
                    <span className="ppm-detail-dot" style={{ backgroundColor: selected.avatarColor }} />
                    <div className="ppm-detail-name">
                        <strong>{selected.name}</strong>
                        <span>{selected.kind === 'driver' ? selected.team : 'Constructor'}</span>
                    </div>
                    <div className="ppm-detail-stat">
                        <strong>€{selected.price}M</strong>
                        <span>Price</span>
                    </div>
                    <div className="ppm-detail-stat">
                        <strong>{pointsFor(selected, risk)}</strong>
                        <span>{RISK_LABELS[risk]} pts</span>
                    </div>
                    <div className="ppm-detail-stat">
                        <strong>{selected.ppm.toFixed(2)}</strong>
                        <span>Pts / €M</span>
                    </div>
                    <div className="ppm-detail-stat">
                        <strong>{selected.ownership}%</strong>
                        <span>Owned</span>
                    </div>
                    {inTeam ? (
                        <button type="button" className="ppm-action remove" onClick={() => onRemove(selected.id)}>
                            Remove
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="ppm-action"
                            disabled={!!blocker}
                            title={blocker ?? ''}
                            onClick={() => onAdd(selected)}
                        >
                            {blocker ?? '+ Add to team'}
                        </button>
                    )}
                </div>
            )}

            <div className="bubble-plot" ref={plotRef}>
                <svg width={width} height={height}>
                    <defs>
                        {allConstructors.map((c) => (
                            <pattern
                                key={c.id}
                                id={`stripes-${c.id}`}
                                patternUnits="userSpaceOnUse"
                                width="6"
                                height="6"
                                patternTransform="rotate(45)"
                            >
                                <rect width="6" height="6" fill={c.avatarColor} fillOpacity="0.3" />
                                <line x1="0" y1="0" x2="0" y2="6" stroke={c.avatarColor} strokeWidth="3.5" />
                            </pattern>
                        ))}
                    </defs>
                    <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                        {y.ticks(5).map((t) => (
                            <g key={`y${t}`}>
                                <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} className="bubble-grid" />
                                <text x={-8} y={y(t)} className="bubble-tick" textAnchor="end" dominantBaseline="middle">
                                    {t}
                                </text>
                            </g>
                        ))}
                        {x.ticks(7).map((t) => (
                            <g key={`x${t}`}>
                                <line x1={x(t)} x2={x(t)} y1={0} y2={innerH} className="bubble-grid" />
                                <text x={x(t)} y={innerH + 14} className="bubble-tick" textAnchor="middle">
                                    €{t}M
                                </text>
                            </g>
                        ))}
                        <text x={innerW} y={innerH + 29} className="bubble-axis-title" textAnchor="end">
                            Price →
                        </text>
                        <text x={6} y={4} className="bubble-axis-title" dominantBaseline="hanging">
                            ↑ {RISK_LABELS[risk]} points
                        </text>

                        {guides.map((g) => (
                            <g key={g.k} className="bubble-guide">
                                <line x1={x(0)} y1={y(0)} x2={g.x2} y2={g.y2} />
                                <text x={g.x2 - 4} y={g.y2 + 12} textAnchor="end">
                                    {g.k.toFixed(1)} pts/€M
                                </text>
                            </g>
                        ))}

                        {[...items]
                            .sort((a, b) => b.ownership - a.ownership)
                            .map((item) => {
                                const isTeam = teamIds.has(item.id);
                                const isSelected = item.id === selected?.id;
                                const cx = x(item.price);
                                const cy = y(pointsFor(item, risk));
                                return (
                                    <g
                                        key={item.id}
                                        className={`bubble ${item.kind} ${isTeam ? 'in-team' : ''} ${isSelected ? 'selected' : ''}`}
                                        onClick={() => setSelectedId(item.id)}
                                        onDoubleClick={() => !addBlocker(item) && onAdd(item)}
                                    >
                                        <title>{`${item.name} · €${item.price}M · ${pointsFor(item, risk)} pts · ${item.ownership}% owned`}</title>
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={r(item.ownership)}
                                            fill={item.kind === 'constructor' ? `url(#stripes-${item.id})` : item.avatarColor}
                                        />
                                        {showLabel(item) && (
                                            <text x={cx + r(item.ownership) + 3} y={cy} dominantBaseline="middle">
                                                {item.code}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                    </g>
                </svg>
            </div>
        </div>
    );
};
