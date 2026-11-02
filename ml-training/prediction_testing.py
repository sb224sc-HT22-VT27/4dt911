def get_driver_fantasy_prediction(driver_slug, season, round_num, df_spine, races_df):
    """
    Given a specific driver and future round, returns their F1 Fantasy projections.
    """
    # 1. Run the full weekend simulation for the requested round
    future_grid, r_name, r_date = predict_future_weekend(
        df_spine=df_spine, 
        races_df=races_df, 
        target_season=season, 
        target_round=round_num,
        ranker_quali=ranker, 
        ranker_race=race_ranker,
        quali_features=features, 
        race_features=race_features
    )
    
    # 2. Apply the Fantasy Scoring Math
    future_grid[['P10_Pts', 'P50_Pts', 'P90_Pts']] = future_grid.apply(calculate_fantasy_percentiles, axis=1)
    
    # 3. Extract just the requested driver
    driver_data = future_grid[future_grid['driver_slug'] == driver_slug]
    
    if driver_data.empty:
        return {"error": f"Driver '{driver_slug}' not found in active grid for Round {round_num}."}
        
    driver_row = driver_data.iloc[0]
    
    # Return a clean JSON/Dict format perfect for a web API
    return {
        "race_name": r_name,
        "date": r_date,
        "driver": driver_slug,
        "predictions": {
            "qualifying_position": int(driver_row['predicted_quali_rank']),
            "race_position": int(driver_row['predicted_race_rank']),
            "dnf_probability": round(driver_row['predicted_dnf_prob'] * 100, 1)
        },
        "fantasy_points": {
            "floor_p10": driver_row['P10_Pts'],
            "expected_p50": driver_row['P50_Pts'],
            "ceiling_p90": driver_row['P90_Pts']
        }
    }

# --- Example Usage for your Web Backend ---
prediction_json = get_driver_fantasy_prediction("lando_norris", 2026, 18, final_spine, races)
print(prediction_json)