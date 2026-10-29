f1_driver_numbers = {
    # 2022
    2022: {
        "max_verstappen": 1,
        "sergio_perez": 11,
        "charles_leclerc": 16,
        "carlos_sainz": 55,
        "lewis_hamilton": 44,
        "george_russell": 63,
        "lando_norris": 4,
        "daniel_ricciardo": 3,
        "fernando_alonso": 14,
        "esteban_ocon": 31,
        "pierre_gasly": 10,
        "yuki_tsunoda": 22,
        "sebastian_vettel": 5,
        "lance_stroll": 18,
        "alex_albon": 23,
        "nicholas_latifi": 6,
        "zhou_guanyu": 24,
        "valtteri_bottas": 77,
        "kevin_magnussen": 20,
        "mick_schumacher": 47,
        "nico_hulkenberg": 27,
        "nyck_de_vries": 45,
    },

    # 2023
    2023: {
        "max_verstappen": 1,
        "sergio_perez": 11,
        "charles_leclerc": 16,
        "carlos_sainz": 55,
        "lewis_hamilton": 44,
        "george_russell": 63,
        "lando_norris": 4,
        "oscar_piastri": 81,
        "fernando_alonso": 14,
        "esteban_ocon": 31,
        "pierre_gasly": 10,
        "yuki_tsunoda": 22,
        "nick_de_vries": 21,
        "daniel_ricciardo": 3,
        "liam_lawson": 40,
        "lance_stroll": 18,
        "alex_albon": 23,
        "logan_sargeant": 2,
        "zhou_guanyu": 24,
        "valtteri_bottas": 77,
        "kevin_magnussen": 20,
        "nico_hulkenberg": 27,
    },

    # 2024
    2024: {
        "max_verstappen": 1,
        "sergio_perez": 11,
        "charles_leclerc": 16,
        "carlos_sainz": 55,
        "lewis_hamilton": 44,
        "george_russell": 63,
        "lando_norris": 4,
        "oscar_piastri": 81,
        "fernando_alonso": 14,
        "lance_stroll": 18,
        "esteban_ocon": 31,
        "pierre_gasly": 10,
        "yuki_tsunoda": 22,
        "daniel_ricciardo": 3,
        "liam_lawson": 30,
        "alex_albon": 23,
        "logan_sargeant": 2,
        "franco_colapinto": 43,
        "zhou_guanyu": 24,
        "valtteri_bottas": 77,
        "kevin_magnussen": 20,
        "nico_hulkenberg": 27,
        "oliver_bearman": 38,
    },

    # 2025
    2025: {
        "max_verstappen": 1,
        "sergio_perez": 11,
        "charles_leclerc": 16,
        "lewis_hamilton": 44,
        "carlos_sainz": 55,
        "george_russell": 63,
        "andrea_kimi_antonelli": 12,
        "lando_norris": 4,
        "oscar_piastri": 81,
        "lance_stroll": 18,
        "fernando_alonso": 14,
        "pierre_gasly": 10,
        "jack_doohan": 7,
        "franco_colapinto": 43,
        "esteban_ocon": 31,
        "oliver_bearman": 87,
        "nico_hulkenberg": 27,
        "gabriel_bortoleto": 5,
        "alex_albon": 23,
        "liam_lawson": 30,
        "yuki_tsunoda": 22,
    },

    # 2026
    2026: {
        "max_verstappen": 3,
        "isack_hadjar": 6,
        "charles_leclerc": 16,
        "lewis_hamilton": 44,
        "george_russell": 63,
        "andrea_kimi_antonelli": 12,
        "lando_norris": 1,
        "oscar_piastri": 81,
        "liam_lawson": 30,
        "arvid_lindblad": 41,
        "fernando_alonso": 14,
        "lance_stroll": 18,
        "pierre_gasly": 10,
        "franco_colapinto": 43,
        "esteban_ocon": 31,
        "oliver_bearman": 87,
        "nico_hulkenberg": 27,
        "gabriel_bortoleto": 5,
        "alex_albon": 23,
        "carlos_sainz": 55,
        "sergio_perez": 11,
        "valtteri_bottas": 77,
    },
}

# Bi-directional mapping of driver names and numbers for each year
f1_drivers = {}

for year, drivers in f1_driver_numbers.items():
    f1_drivers[year] = {
        "by_name": drivers,
        "by_number": {
            number: name
            for name, number in drivers.items()
        }
    }


def get_driver_number(year, driver):
    return f1_drivers.get(year, {}).get("by_name", {}).get(driver)


def get_driver_name(year, number):
    return f1_drivers.get(year, {}).get("by_number", {}).get(number)


# Test cases
print(get_driver_number(2026, "max_verstappen"))
# 3

print(get_driver_name(2026, 3))
# max_verstappen

print(get_driver_name(2026, 99))
# None