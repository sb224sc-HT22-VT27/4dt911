// src/components/Info/RulesModal.tsx
import React from 'react';
import { InfoModal, PointsTable } from './InfoModal';

// Static summary of the official F1 Fantasy rules for the 2026 season
export const RulesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <InfoModal title="F1 Fantasy rules" subtitle="Summary of the official game for the 2026 season" onClose={onClose}>
        <section className="doc-section">
            <h3>The basics</h3>
            <div className="doc-grid two">
                <div className="doc-tile">
                    <strong>Your team</strong>
                    <p>5 drivers and 2 constructors, picked again before every race weekend. You can have up to 3 teams.</p>
                </div>
                <div className="doc-tile">
                    <strong>Budget</strong>
                    <p>
                        You start with a $100M cost cap. Prices change after every race based on performance, and your cap
                        moves with the value of your players. The lowest possible price is $3M.
                    </p>
                </div>
                <div className="doc-tile">
                    <strong>Deadline</strong>
                    <p>Your team locks when qualifying starts. On Sprint weekends it locks earlier in the weekend.</p>
                </div>
                <div className="doc-tile">
                    <strong>2X Boost (DRS)</strong>
                    <p>
                        Pick one driver each race to score double points. Negative points are doubled too, so a −20 DNF
                        becomes −40.
                    </p>
                </div>
            </div>
        </section>

        <section className="doc-section">
            <h3>Transfers</h3>
            <ul>
                <li>
                    <strong>2 free transfers</strong> before each race. One unused transfer carries over, so you can have at
                    most 3.
                </li>
                <li>
                    Every transfer beyond your free ones costs <strong>−10 points</strong>.
                </li>
                <li>Transfers are counted by the net change to your team, so undoing a swap is free.</li>
                <li>Changing which driver has the 2X Boost is not a transfer. Race 1 has unlimited transfers.</li>
            </ul>
        </section>

        <section className="doc-section">
            <h3>Chips (each usable once per season)</h3>
            <div className="doc-grid">
                <div className="doc-tile">
                    <strong>Wildcard</strong>
                    <p>Unlimited free transfers for one race, within your cost cap.</p>
                </div>
                <div className="doc-tile">
                    <strong>Limitless</strong>
                    <p>Unlimited transfers with no budget limit for one race. Your old team comes back after.</p>
                </div>
                <div className="doc-tile">
                    <strong>3X Boost</strong>
                    <p>Triple one driver's points instead of doubling them.</p>
                </div>
                <div className="doc-tile">
                    <strong>Autopilot</strong>
                    <p>The 2X Boost automatically goes to your highest scoring driver.</p>
                </div>
                <div className="doc-tile">
                    <strong>No Negative</strong>
                    <p>Any negative score for a driver or constructor counts as zero.</p>
                </div>
                <div className="doc-tile">
                    <strong>Final Fix</strong>
                    <p>One driver change after qualifying, before the Grand Prix starts.</p>
                </div>
            </div>
        </section>

        <section className="doc-section">
            <h3>Driver scoring</h3>
            <div className="doc-grid">
                <PointsTable
                    title="Qualifying"
                    rows={[
                        ['Pole (P1)', '10'],
                        ['P2 – P10', '9 down to 1'],
                        ['P11 – P20', '0'],
                        ['No time set / disqualified', '−5'],
                    ]}
                />
                <PointsTable
                    title="Sprint"
                    rows={[
                        ['P1', '8'],
                        ['P2 – P8', '7 down to 1'],
                        ['Position gained / lost', '+1 / −1'],
                        ['Overtake', '+1'],
                        ['Fastest lap', '+10'],
                        ['DNF / disqualified', '−10'],
                    ]}
                />
                <PointsTable
                    title="Grand Prix"
                    rows={[
                        ['P1 / P2 / P3', '25 / 18 / 15'],
                        ['P4 – P10', '12, 10, 8, 6, 4, 2, 1'],
                        ['Position gained / lost', '+1 / −1'],
                        ['Overtake', '+1'],
                        ['Fastest lap', '+10'],
                        ['Driver of the Day', '+10'],
                        ['DNF / disqualified', '−20'],
                    ]}
                />
            </div>
        </section>

        <section className="doc-section">
            <h3>Constructor scoring</h3>
            <p>
                A constructor scores the points of both its drivers (except Driver of the Day), plus these bonuses.
                Disqualifications cost the constructor −20 per driver.
            </p>
            <div className="doc-grid">
                <PointsTable
                    title="Qualifying bonus"
                    rows={[
                        ['Neither driver reaches Q2', '−1'],
                        ['One driver reaches Q2', '+1'],
                        ['Both drivers reach Q2', '+3'],
                        ['One driver reaches Q3', '+5'],
                        ['Both drivers reach Q3', '+10'],
                    ]}
                />
                <PointsTable
                    title="Fastest pit stop (Grand Prix)"
                    rows={[
                        ['Under 2.0s', '+20'],
                        ['2.00 – 2.19s', '+10'],
                        ['2.20 – 2.49s', '+5'],
                        ['2.50 – 2.99s', '+2'],
                        ['Fastest stop of the race', '+5'],
                        ['New world record', '+15'],
                    ]}
                />
            </div>
        </section>

        <section className="doc-section">
            <h3>New in 2026</h3>
            <ul>
                <li>Sprint DNF penalty reduced from −20 to −10.</li>
                <li>Transfers count the net change, so reversing a swap uses no free transfers.</li>
                <li>Minimum price lowered from $4.5M to $3M.</li>
            </ul>
        </section>

        <p className="doc-note">
            This is a summary. The official rules on{' '}
            <a href="https://fantasy.formula1.com" target="_blank" rel="noreferrer">
                fantasy.formula1.com
            </a>{' '}
            always win if anything differs.
        </p>
    </InfoModal>
);
