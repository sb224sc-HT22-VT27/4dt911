TRACK_TYPES = {
    # street circuits
    "monaco": "street", "baku": "street", "marina_bay": "street", "jeddah": "street",
    "vegas": "street", "miami": "street",
    # power / high speed circuits
    "monza": "high_speed", "spa": "high_speed", "silverstone": "high_speed",
    "red_bull_ring": "high_speed", "interlagos": "high_speed", "rodriguez": "high_speed",
    "losail": "high_speed", "albert_park": "high_speed",
}
DEFAULT = "technical"
 
 
def track_type(circuit_ref: str) -> str:
    return TRACK_TYPES.get(circuit_ref, DEFAULT)
