// src/components/Info/PredictorModal.tsx
import React from 'react';
import { InfoModal, PointsTable } from './InfoModal';

// Static explanation of what OptiGrid predicts and how the numbers are used
export const PredictorModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <InfoModal title="How predictions work" subtitle="What OptiGrid predicts, where the data comes from and how it is used" onClose={onClose}>
        <section className="doc-section">
            <h3>What we predict</h3>
            <p>For every upcoming race the predictor gives each player a range of outcomes, not just one number:</p>
            <div className="doc-grid">
                <div className="doc-tile">
                    <strong>Drivers</strong>
                    <p>Qualifying position, race finishing position, chance of not finishing (DNF), and fantasy points.</p>
                </div>
                <div className="doc-tile">
                    <strong>Constructors</strong>
                    <p>Fantasy points for the team, built from both drivers plus the constructor bonuses.</p>
                </div>
            </div>
        </section>

        <section className="doc-section">
            <h3>Why a range: floor, middle and ceiling</h3>
            <p>
                An average hides risk. A driver who usually scores 20 but crashes often is a very different pick from one
                who reliably scores 20. So the fantasy points come as three values from the predicted distribution:
            </p>
            <div className="doc-grid">
                <PointsTable
                    title="The three numbers on every card"
                    rows={[
                        ['P10 · Floor', 'scores less only 1 race in 10'],
                        ['P50 · Middle', 'the expected score'],
                        ['P90 · Ceiling', 'scores more only 1 race in 10'],
                    ]}
                />
                <div className="doc-tile">
                    <strong>Choosing a risk</strong>
                    <p>
                        Floor builds a safe team that rarely disappoints. Ceiling chases the upside, useful when you need to
                        catch up in your league. Middle is the balanced choice.
                    </p>
                </div>
            </div>
        </section>

        <section className="doc-section">
            <h3>The data</h3>
            <ul>
                <li>
                    <strong>Race history (Ergast / Kaggle):</strong> results, qualifying, lap times and pit stops for every
                    race, linked by race, driver and constructor.
                </li>
                <li>
                    <strong>F1 Fantasy:</strong> prices, ownership and fantasy points for all 22 drivers and 11 constructors.
                </li>
                <li>
                    <strong>OpenF1:</strong> lap-by-lap timing plus weather (track temperature, rain) for every session.
                </li>
            </ul>
        </section>

        <section className="doc-section">
            <h3>Your settings</h3>
            <p>The settings adjust the predictions to what you believe matters most. Each slider can move a player's points by up to ±30%.</p>
            <ul>
                <li>
                    <strong>Recent form</strong> boosts drivers who finished well in their last 5 races and lowers those who
                    didn't.
                </li>
                <li>
                    <strong>Track fit</strong> boosts drivers who finish better than their own average on this type of track
                    (street, high speed or technical).
                </li>
                <li>
                    <strong>DNF penalty</strong> reduces points by the chance of not finishing.
                </li>
                <li>
                    <strong>Horizon</strong> adds up the points for the next 1 or 3 races, each race with its own track type.
                </li>
            </ul>
        </section>

        <section className="doc-section">
            <h3>The ratings hexagon</h3>
            <p>Every rating is 0 to 100, compared with the rest of the grid, based on this season's races.</p>
            <div className="doc-grid">
                <PointsTable
                    title="What each corner means"
                    rows={[
                        ['Quali', 'average qualifying position'],
                        ['Race', 'average finishing position'],
                        ['Form', 'average finish over the last 5 races'],
                    ]}
                />
                <PointsTable
                    title=" "
                    rows={[
                        ['Reliability', 'how rarely they DNF'],
                        ['Overtaking', 'positions gained from the grid'],
                        ['Track fit', 'results on this track type vs their average'],
                    ]}
                />
            </div>
        </section>

        <section className="doc-section">
            <h3>The optimizer</h3>
            <p>
                <strong>Best team</strong> tries every possible team of 5 drivers and 2 constructors that fits your budget
                (over a million combinations), adds up the points for your chosen risk and horizon, gives the best driver
                the 2X Boost, and picks the highest total. Because it checks every team, the result is the true best team
                for those settings.
            </p>
        </section>

        <section className="doc-section">
            <h3>Suggest transfers</h3>
            <p>Transfers start from your current team. You tell it how many free transfers you have (0 to 3, the game's maximum), then it compares two plans:</p>
            <div className="doc-grid">
                <div className="doc-tile">
                    <strong>Free only</strong>
                    <p>The best team you can reach using only your free transfers.</p>
                </div>
                <div className="doc-tile">
                    <strong>With extra transfers</strong>
                    <p>
                        The best team when extra transfers are allowed, with −10 points counted for each one beyond your
                        free transfers.
                    </p>
                </div>
            </div>
            <ul>
                <li>Extra transfers are only recommended if the gain is bigger than their −10s.</li>
                <li>
                    The −10s are only used to make that decision. Once you apply the transfers, your team's totals show the
                    normal predicted points without any penalty.
                </li>
            </ul>
        </section>

        <p className="doc-note">
            The season stats, ratings and teammate data come from real race results. The point predictions are currently
            test data while the prediction model is being connected, so treat the numbers as examples.
        </p>
    </InfoModal>
);
