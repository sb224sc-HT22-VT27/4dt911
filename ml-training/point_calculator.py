race_point_matrix = {
    1: 25,
    2: 18,
    3: 15,
    4: 12,
    5: 10,
    6: 8,
    7: 6,
    8: 4,
    9: 2,
    10: 1,
}




def get_race_position_point(pos):
    if pos > 10:
        return 0
    return race_point_matrix[pos]

def get_sprint_position_point(pos):
    if pos > 8:
        return 0
    return 9 - pos

