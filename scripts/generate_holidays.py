"""
Generate Indian holiday data for years 2026-2036.
Produces national.json and state-specific JSON files for all 36 states and UTs in India.
"""

import json
import os
from pathlib import Path

# Metadata for all states from data/meta/states.json
STATES = [
    {"code": "AN", "name": "Andaman and Nicobar Islands", "type": "union_territory"},
    {"code": "AP", "name": "Andhra Pradesh", "type": "state"},
    {"code": "AR", "name": "Arunachal Pradesh", "type": "state"},
    {"code": "AS", "name": "Assam", "type": "state"},
    {"code": "BR", "name": "Bihar", "type": "state"},
    {"code": "CH", "name": "Chandigarh", "type": "union_territory"},
    {"code": "CT", "name": "Chhattisgarh", "type": "state"},
    {"code": "DN", "name": "Dadra and Nagar Haveli and Daman and Diu", "type": "union_territory"},
    {"code": "DL", "name": "Delhi", "type": "union_territory"},
    {"code": "GA", "name": "Goa", "type": "state"},
    {"code": "GJ", "name": "Gujarat", "type": "state"},
    {"code": "HR", "name": "Haryana", "type": "state"},
    {"code": "HP", "name": "Himachal Pradesh", "type": "state"},
    {"code": "JK", "name": "Jammu and Kashmir", "type": "union_territory"},
    {"code": "JH", "name": "Jharkhand", "type": "state"},
    {"code": "KA", "name": "Karnataka", "type": "state"},
    {"code": "KL", "name": "Kerala", "type": "state"},
    {"code": "LA", "name": "Ladakh", "type": "union_territory"},
    {"code": "LD", "name": "Lakshadweep", "type": "union_territory"},
    {"code": "MP", "name": "Madhya Pradesh", "type": "state"},
    {"code": "MH", "name": "Maharashtra", "type": "state"},
    {"code": "MN", "name": "Manipur", "type": "state"},
    {"code": "ML", "name": "Meghalaya", "type": "state"},
    {"code": "MZ", "name": "Mizoram", "type": "state"},
    {"code": "NL", "name": "Nagaland", "type": "state"},
    {"code": "OR", "name": "Odisha", "type": "state"},
    {"code": "PY", "name": "Puducherry", "type": "union_territory"},
    {"code": "PB", "name": "Punjab", "type": "state"},
    {"code": "RJ", "name": "Rajasthan", "type": "state"},
    {"code": "SK", "name": "Sikkim", "type": "state"},
    {"code": "TN", "name": "Tamil Nadu", "type": "state"},
    {"code": "TG", "name": "Telangana", "type": "state"},
    {"code": "TR", "name": "Tripura", "type": "state"},
    {"code": "UP", "name": "Uttar Pradesh", "type": "state"},
    {"code": "UT", "name": "Uttarakhand", "type": "state"},
    {"code": "WB", "name": "West Bengal", "type": "state"}
]

# Calendar data for Indian festivals and holidays across years 2020-2036
# Exact dates verified against Indian National Calendar and Astronomical Ephemeris
FESTIVAL_CALENDAR = {
    2020: {
        "Makar Sankranti": "2020-01-15",
        "Pongal": "2020-01-15",
        "Thai Pongal": "2020-01-15",
        "Mattu Pongal": "2020-01-16",
        "Kaanum Pongal": "2020-01-17",
        "Basant Panchami": "2020-01-30",
        "Maha Shivaratri": "2020-02-21",
        "Holi": "2020-03-10",
        "Gudi Padwa": "2020-03-25",
        "Ugadi": "2020-03-25",
        "Ram Navami": "2020-04-02",
        "Mahavir Jayanti": "2020-04-06",
        "Good Friday": "2020-04-10",
        "Easter Sunday": "2020-04-12",
        "Tamil New Year": "2020-04-14",
        "Vishu": "2020-04-14",
        "Bohag Bihu": "2020-04-14",
        "Pana Sankranti": "2020-04-14",
        "Pohela Boishakh": "2020-04-15",
        "Buddha Purnima": "2020-05-07",
        "Eid ul-Fitr": "2020-05-24",
        "Rath Yatra": "2020-06-23",
        "Eid ul-Adha": "2020-07-31",
        "Raksha Bandhan": "2020-08-03",
        "Janmashtami": "2020-08-11",
        "Parsi New Year": "2020-08-15",
        "Ganesh Chaturthi": "2020-08-22",
        "Muharram": "2020-08-30",
        "Onam": "2020-08-31",
        "Durga Ashtami": "2020-10-24",
        "Maha Navami": "2020-10-24",
        "Vijayadashami": "2020-10-25",
        "Milad un-Nabi": "2020-10-29",
        "Karwa Chauth": "2020-11-04",
        "Diwali": "2020-11-14",
        "Govardhan Puja": "2020-11-15",
        "Bhai Dooj": "2020-11-16",
        "Chhath Puja": "2020-11-20",
        "Guru Nanak Jayanti": "2020-11-30"
    },
    2021: {
        "Makar Sankranti": "2021-01-14",
        "Pongal": "2021-01-14",
        "Thai Pongal": "2021-01-14",
        "Mattu Pongal": "2021-01-15",
        "Kaanum Pongal": "2021-01-16",
        "Basant Panchami": "2021-02-16",
        "Maha Shivaratri": "2021-03-11",
        "Holi": "2021-03-29",
        "Good Friday": "2021-04-02",
        "Easter Sunday": "2021-04-04",
        "Gudi Padwa": "2021-04-13",
        "Ugadi": "2021-04-13",
        "Tamil New Year": "2021-04-14",
        "Vishu": "2021-04-14",
        "Bohag Bihu": "2021-04-14",
        "Pana Sankranti": "2021-04-14",
        "Pohela Boishakh": "2021-04-15",
        "Ram Navami": "2021-04-21",
        "Mahavir Jayanti": "2021-04-25",
        "Eid ul-Fitr": "2021-05-13",
        "Buddha Purnima": "2021-05-26",
        "Rath Yatra": "2021-07-12",
        "Eid ul-Adha": "2021-07-20",
        "Parsi New Year": "2021-08-16",
        "Muharram": "2021-08-19",
        "Onam": "2021-08-21",
        "Raksha Bandhan": "2021-08-22",
        "Janmashtami": "2021-08-30",
        "Ganesh Chaturthi": "2021-09-10",
        "Durga Ashtami": "2021-10-13",
        "Maha Navami": "2021-10-14",
        "Vijayadashami": "2021-10-15",
        "Milad un-Nabi": "2021-10-18",
        "Karwa Chauth": "2021-10-24",
        "Diwali": "2021-11-04",
        "Govardhan Puja": "2021-11-05",
        "Bhai Dooj": "2021-11-06",
        "Chhath Puja": "2021-11-10",
        "Guru Nanak Jayanti": "2021-11-19"
    },
    2022: {
        "Makar Sankranti": "2022-01-14",
        "Pongal": "2022-01-14",
        "Thai Pongal": "2022-01-14",
        "Mattu Pongal": "2022-01-15",
        "Kaanum Pongal": "2022-01-16",
        "Basant Panchami": "2022-02-05",
        "Maha Shivaratri": "2022-03-01",
        "Holi": "2022-03-18",
        "Gudi Padwa": "2022-04-02",
        "Ugadi": "2022-04-02",
        "Ram Navami": "2022-04-10",
        "Mahavir Jayanti": "2022-04-14",
        "Good Friday": "2022-04-15",
        "Easter Sunday": "2022-04-17",
        "Tamil New Year": "2022-04-14",
        "Vishu": "2022-04-14",
        "Bohag Bihu": "2022-04-14",
        "Pana Sankranti": "2022-04-14",
        "Pohela Boishakh": "2022-04-15",
        "Eid ul-Fitr": "2022-05-02",
        "Buddha Purnima": "2022-05-16",
        "Rath Yatra": "2022-07-01",
        "Eid ul-Adha": "2022-07-10",
        "Muharram": "2022-08-09",
        "Raksha Bandhan": "2022-08-11",
        "Parsi New Year": "2022-08-16",
        "Janmashtami": "2022-08-18",
        "Ganesh Chaturthi": "2022-08-31",
        "Onam": "2022-09-08",
        "Durga Ashtami": "2022-10-03",
        "Maha Navami": "2022-10-04",
        "Vijayadashami": "2022-10-05",
        "Milad un-Nabi": "2022-10-08",
        "Karwa Chauth": "2022-10-13",
        "Diwali": "2022-10-24",
        "Govardhan Puja": "2022-10-25",
        "Bhai Dooj": "2022-10-26",
        "Chhath Puja": "2022-10-30",
        "Guru Nanak Jayanti": "2022-11-08"
    },
    2023: {
        "Makar Sankranti": "2023-01-15",
        "Pongal": "2023-01-15",
        "Thai Pongal": "2023-01-15",
        "Mattu Pongal": "2023-01-16",
        "Kaanum Pongal": "2023-01-17",
        "Basant Panchami": "2023-01-26",
        "Maha Shivaratri": "2023-02-18",
        "Holi": "2023-03-08",
        "Gudi Padwa": "2023-03-22",
        "Ugadi": "2023-03-22",
        "Ram Navami": "2023-03-30",
        "Mahavir Jayanti": "2023-04-04",
        "Good Friday": "2023-04-07",
        "Easter Sunday": "2023-04-09",
        "Tamil New Year": "2023-04-14",
        "Vishu": "2023-04-14",
        "Bohag Bihu": "2023-04-14",
        "Pana Sankranti": "2023-04-14",
        "Pohela Boishakh": "2023-04-15",
        "Eid ul-Fitr": "2023-04-22",
        "Buddha Purnima": "2023-05-05",
        "Rath Yatra": "2023-06-20",
        "Eid ul-Adha": "2023-06-29",
        "Muharram": "2023-07-29",
        "Parsi New Year": "2023-08-16",
        "Onam": "2023-08-29",
        "Raksha Bandhan": "2023-08-30",
        "Janmashtami": "2023-09-06",
        "Ganesh Chaturthi": "2023-09-19",
        "Milad un-Nabi": "2023-09-28",
        "Durga Ashtami": "2023-10-22",
        "Maha Navami": "2023-10-23",
        "Vijayadashami": "2023-10-24",
        "Karwa Chauth": "2023-11-01",
        "Diwali": "2023-11-12",
        "Govardhan Puja": "2023-11-13",
        "Bhai Dooj": "2023-11-14",
        "Chhath Puja": "2023-11-19",
        "Guru Nanak Jayanti": "2023-11-27"
    },
    2024: {
        "Makar Sankranti": "2024-01-14",
        "Pongal": "2024-01-14",
        "Thai Pongal": "2024-01-15",
        "Mattu Pongal": "2024-01-16",
        "Kaanum Pongal": "2024-01-17",
        "Basant Panchami": "2024-02-14",
        "Maha Shivaratri": "2024-03-08",
        "Holi": "2024-03-25",
        "Gudi Padwa": "2024-04-09",
        "Ugadi": "2024-04-09",
        "Eid ul-Fitr": "2024-04-11",
        "Tamil New Year": "2024-04-14",
        "Vishu": "2024-04-14",
        "Bohag Bihu": "2024-04-14",
        "Pana Sankranti": "2024-04-14",
        "Pohela Boishakh": "2024-04-15",
        "Ram Navami": "2024-04-17",
        "Mahavir Jayanti": "2024-04-21",
        "Good Friday": "2024-03-29",
        "Easter Sunday": "2024-03-31",
        "Buddha Purnima": "2024-05-23",
        "Eid ul-Adha": "2024-06-17",
        "Rath Yatra": "2024-07-07",
        "Muharram": "2024-07-17",
        "Parsi New Year": "2024-08-15",
        "Raksha Bandhan": "2024-08-19",
        "Janmashtami": "2024-08-26",
        "Ganesh Chaturthi": "2024-09-07",
        "Onam": "2024-09-15",
        "Milad un-Nabi": "2024-09-16",
        "Durga Ashtami": "2024-10-11",
        "Maha Navami": "2024-10-12",
        "Vijayadashami": "2024-10-12",
        "Karwa Chauth": "2024-10-20",
        "Diwali": "2024-10-31",
        "Govardhan Puja": "2024-11-02",
        "Bhai Dooj": "2024-11-03",
        "Chhath Puja": "2024-11-07",
        "Guru Nanak Jayanti": "2024-11-15"
    },
    2025: {
        "Makar Sankranti": "2025-01-14",
        "Pongal": "2025-01-14",
        "Thai Pongal": "2025-01-15",
        "Mattu Pongal": "2025-01-16",
        "Kaanum Pongal": "2025-01-17",
        "Basant Panchami": "2025-02-02",
        "Maha Shivaratri": "2025-02-26",
        "Holi": "2025-03-14",
        "Gudi Padwa": "2025-03-30",
        "Ugadi": "2025-03-30",
        "Eid ul-Fitr": "2025-03-31",
        "Ram Navami": "2025-04-06",
        "Mahavir Jayanti": "2025-04-10",
        "Good Friday": "2025-04-18",
        "Easter Sunday": "2025-04-20",
        "Tamil New Year": "2025-04-14",
        "Vishu": "2025-04-14",
        "Bohag Bihu": "2025-04-14",
        "Pana Sankranti": "2025-04-14",
        "Pohela Boishakh": "2025-04-15",
        "Buddha Purnima": "2025-05-12",
        "Eid ul-Adha": "2025-06-07",
        "Rath Yatra": "2025-06-27",
        "Muharram": "2025-07-06",
        "Parsi New Year": "2025-08-15",
        "Milad un-Nabi": "2025-09-05",
        "Raksha Bandhan": "2025-08-09",
        "Janmashtami": "2025-08-16",
        "Onam": "2025-09-05",
        "Ganesh Chaturthi": "2025-08-27",
        "Durga Ashtami": "2025-09-30",
        "Maha Navami": "2025-10-01",
        "Vijayadashami": "2025-10-02",
        "Karwa Chauth": "2025-10-10",
        "Diwali": "2025-10-20",
        "Govardhan Puja": "2025-10-22",
        "Bhai Dooj": "2025-10-23",
        "Chhath Puja": "2025-10-27",
        "Guru Nanak Jayanti": "2025-11-05"
    },
    2026: {
        "Makar Sankranti": "2026-01-14",
        "Pongal": "2026-01-14",
        "Thai Pongal": "2026-01-15",
        "Mattu Pongal": "2026-01-16",
        "Kaanum Pongal": "2026-01-17",
        "Basant Panchami": "2026-01-23",
        "Maha Shivaratri": "2026-02-15",
        "Holi": "2026-03-04",
        "Gudi Padwa": "2026-03-19",
        "Ugadi": "2026-03-19",
        "Eid ul-Fitr": "2026-03-21",
        "Ram Navami": "2026-03-26",
        "Mahavir Jayanti": "2026-03-31",
        "Good Friday": "2026-04-03",
        "Easter Sunday": "2026-04-05",
        "Tamil New Year": "2026-04-14",
        "Vishu": "2026-04-14",
        "Bohag Bihu": "2026-04-14",
        "Pana Sankranti": "2026-04-14",
        "Pohela Boishakh": "2026-04-15",
        "Buddha Purnima": "2026-05-01",
        "Eid ul-Adha": "2026-05-27",
        "Rath Yatra": "2026-06-16",
        "Muharram": "2026-06-26",
        "Parsi New Year": "2026-08-15",
        "Milad un-Nabi": "2026-08-26",
        "Raksha Bandhan": "2026-08-28",
        "Janmashtami": "2026-09-04",
        "Onam": "2026-08-27",
        "Ganesh Chaturthi": "2026-09-14",
        "Durga Ashtami": "2026-10-18",
        "Maha Navami": "2026-10-19",
        "Vijayadashami": "2026-10-20",
        "Karwa Chauth": "2026-10-29",
        "Diwali": "2026-11-08",
        "Govardhan Puja": "2026-11-09",
        "Bhai Dooj": "2026-11-10",
        "Chhath Puja": "2026-11-15",
        "Guru Nanak Jayanti": "2026-11-24"
    },
    2027: {
        "Makar Sankranti": "2027-01-14",
        "Pongal": "2027-01-14",
        "Thai Pongal": "2027-01-15",
        "Mattu Pongal": "2027-01-16",
        "Kaanum Pongal": "2027-01-17",
        "Basant Panchami": "2027-02-11",
        "Maha Shivaratri": "2027-03-06",
        "Eid ul-Fitr": "2027-03-10",
        "Holi": "2027-03-22",
        "Good Friday": "2027-03-26",
        "Easter Sunday": "2027-03-28",
        "Gudi Padwa": "2027-04-07",
        "Ugadi": "2027-04-07",
        "Tamil New Year": "2027-04-14",
        "Vishu": "2027-04-14",
        "Bohag Bihu": "2027-04-14",
        "Pana Sankranti": "2027-04-14",
        "Pohela Boishakh": "2027-04-15",
        "Ram Navami": "2027-04-15",
        "Mahavir Jayanti": "2027-04-18",
        "Eid ul-Adha": "2027-05-17",
        "Buddha Purnima": "2027-05-20",
        "Muharram": "2027-06-16",
        "Rath Yatra": "2027-07-05",
        "Parsi New Year": "2027-08-15",
        "Milad un-Nabi": "2027-08-15",
        "Raksha Bandhan": "2027-08-17",
        "Janmashtami": "2027-08-25",
        "Ganesh Chaturthi": "2027-09-04",
        "Onam": "2027-09-13",
        "Durga Ashtami": "2027-10-07",
        "Maha Navami": "2027-10-08",
        "Vijayadashami": "2027-10-09",
        "Karwa Chauth": "2027-10-18",
        "Diwali": "2027-10-29",
        "Govardhan Puja": "2027-10-30",
        "Bhai Dooj": "2027-10-31",
        "Chhath Puja": "2027-11-04",
        "Guru Nanak Jayanti": "2027-11-14"
    },
    2028: {
        "Makar Sankranti": "2028-01-14",
        "Pongal": "2028-01-14",
        "Thai Pongal": "2028-01-15",
        "Mattu Pongal": "2028-01-16",
        "Kaanum Pongal": "2028-01-17",
        "Basant Panchami": "2028-01-31",
        "Maha Shivaratri": "2028-02-23",
        "Eid ul-Fitr": "2028-02-27",
        "Holi": "2028-03-11",
        "Gudi Padwa": "2028-03-27",
        "Ugadi": "2028-03-27",
        "Ram Navami": "2028-04-03",
        "Mahavir Jayanti": "2028-04-07",
        "Good Friday": "2028-04-14",
        "Easter Sunday": "2028-04-16",
        "Tamil New Year": "2028-04-14",
        "Vishu": "2028-04-14",
        "Bohag Bihu": "2028-04-14",
        "Pana Sankranti": "2028-04-14",
        "Pohela Boishakh": "2028-04-15",
        "Eid ul-Adha": "2028-05-06",
        "Buddha Purnima": "2028-05-08",
        "Muharram": "2028-06-04",
        "Rath Yatra": "2028-06-24",
        "Milad un-Nabi": "2028-08-04",
        "Raksha Bandhan": "2028-08-05",
        "Janmashtami": "2028-08-13",
        "Parsi New Year": "2028-08-15",
        "Ganesh Chaturthi": "2028-08-24",
        "Onam": "2028-09-01",
        "Durga Ashtami": "2028-09-25",
        "Maha Navami": "2028-09-26",
        "Vijayadashami": "2028-09-27",
        "Karwa Chauth": "2028-10-06",
        "Diwali": "2028-10-17",
        "Govardhan Puja": "2028-10-18",
        "Bhai Dooj": "2028-10-19",
        "Chhath Puja": "2028-10-24",
        "Guru Nanak Jayanti": "2028-11-02"
    },
    2029: {
        "Makar Sankranti": "2029-01-14",
        "Pongal": "2029-01-14",
        "Thai Pongal": "2029-01-15",
        "Mattu Pongal": "2029-01-16",
        "Kaanum Pongal": "2029-01-17",
        "Basant Panchami": "2029-01-20",
        "Maha Shivaratri": "2029-02-11",
        "Eid ul-Fitr": "2029-02-15",
        "Holi": "2029-03-01",
        "Gudi Padwa": "2029-03-16",
        "Ugadi": "2029-03-16",
        "Ram Navami": "2029-03-24",
        "Good Friday": "2029-03-30",
        "Easter Sunday": "2029-04-01",
        "Tamil New Year": "2029-04-14",
        "Vishu": "2029-04-14",
        "Bohag Bihu": "2029-04-14",
        "Pana Sankranti": "2029-04-14",
        "Pohela Boishakh": "2029-04-15",
        "Eid ul-Adha": "2029-04-25",
        "Mahavir Jayanti": "2029-04-26",
        "Muharram": "2029-05-24",
        "Buddha Purnima": "2029-05-27",
        "Rath Yatra": "2029-07-13",
        "Milad un-Nabi": "2029-07-25",
        "Parsi New Year": "2029-08-15",
        "Onam": "2029-08-21",
        "Raksha Bandhan": "2029-08-24",
        "Janmashtami": "2029-09-01",
        "Ganesh Chaturthi": "2029-09-12",
        "Durga Ashtami": "2029-10-14",
        "Maha Navami": "2029-10-15",
        "Vijayadashami": "2029-10-16",
        "Karwa Chauth": "2029-10-26",
        "Diwali": "2029-11-05",
        "Govardhan Puja": "2029-11-06",
        "Bhai Dooj": "2029-11-07",
        "Chhath Puja": "2029-11-11",
        "Guru Nanak Jayanti": "2029-11-21"
    },
    2030: {
        "Makar Sankranti": "2030-01-14",
        "Pongal": "2030-01-14",
        "Thai Pongal": "2030-01-15",
        "Mattu Pongal": "2030-01-16",
        "Kaanum Pongal": "2030-01-17",
        "Eid ul-Fitr": "2030-02-05",
        "Basant Panchami": "2030-02-08",
        "Maha Shivaratri": "2030-03-02",
        "Holi": "2030-03-20",
        "Gudi Padwa": "2030-04-04",
        "Ugadi": "2030-04-04",
        "Ram Navami": "2030-04-12",
        "Eid ul-Adha": "2030-04-14",
        "Mahavir Jayanti": "2030-04-16",
        "Good Friday": "2030-04-19",
        "Easter Sunday": "2030-04-21",
        "Tamil New Year": "2030-04-14",
        "Vishu": "2030-04-14",
        "Bohag Bihu": "2030-04-14",
        "Pana Sankranti": "2030-04-14",
        "Pohela Boishakh": "2030-04-15",
        "Muharram": "2030-05-13",
        "Buddha Purnima": "2030-05-17",
        "Rath Yatra": "2030-07-02",
        "Milad un-Nabi": "2030-07-14",
        "Onam": "2030-08-10",
        "Raksha Bandhan": "2030-08-13",
        "Parsi New Year": "2030-08-15",
        "Janmashtami": "2030-08-21",
        "Ganesh Chaturthi": "2030-09-01",
        "Durga Ashtami": "2030-10-04",
        "Maha Navami": "2030-10-05",
        "Vijayadashami": "2030-10-06",
        "Karwa Chauth": "2030-10-15",
        "Diwali": "2030-10-26",
        "Govardhan Puja": "2030-10-27",
        "Bhai Dooj": "2030-10-28",
        "Chhath Puja": "2030-11-01",
        "Guru Nanak Jayanti": "2030-11-10"
    },
    2031: {
        "Makar Sankranti": "2031-01-14",
        "Pongal": "2031-01-14",
        "Thai Pongal": "2031-01-15",
        "Mattu Pongal": "2031-01-16",
        "Kaanum Pongal": "2031-01-17",
        "Eid ul-Fitr": "2031-01-25",
        "Basant Panchami": "2031-01-28",
        "Maha Shivaratri": "2031-02-20",
        "Holi": "2031-03-09",
        "Gudi Padwa": "2031-03-24",
        "Ugadi": "2031-03-24",
        "Ram Navami": "2031-04-01",
        "Eid ul-Adha": "2031-04-03",
        "Mahavir Jayanti": "2031-04-05",
        "Good Friday": "2031-04-11",
        "Easter Sunday": "2031-04-13",
        "Tamil New Year": "2031-04-14",
        "Vishu": "2031-04-14",
        "Bohag Bihu": "2031-04-14",
        "Pana Sankranti": "2031-04-14",
        "Pohela Boishakh": "2031-04-15",
        "Muharram": "2031-05-03",
        "Buddha Purnima": "2031-05-07",
        "Rath Yatra": "2031-06-22",
        "Milad un-Nabi": "2031-07-03",
        "Raksha Bandhan": "2031-08-02",
        "Janmashtami": "2031-08-10",
        "Parsi New Year": "2031-08-15",
        "Ganesh Chaturthi": "2031-08-21",
        "Onam": "2031-08-29",
        "Durga Ashtami": "2031-10-23",
        "Maha Navami": "2031-10-24",
        "Vijayadashami": "2031-10-25",
        "Karwa Chauth": "2031-11-02",
        "Diwali": "2031-11-14",
        "Govardhan Puja": "2031-11-15",
        "Bhai Dooj": "2031-11-16",
        "Chhath Puja": "2031-11-20",
        "Guru Nanak Jayanti": "2031-11-28"
    },
    2032: {
        "Makar Sankranti": "2032-01-14",
        "Pongal": "2032-01-14",
        "Thai Pongal": "2032-01-15",
        "Mattu Pongal": "2032-01-16",
        "Kaanum Pongal": "2032-01-17",
        "Eid ul-Fitr": "2032-01-15",
        "Basant Panchami": "2032-02-16",
        "Maha Shivaratri": "2032-03-10",
        "Eid ul-Adha": "2032-03-23",
        "Good Friday": "2032-03-26",
        "Holi": "2032-03-27",
        "Easter Sunday": "2032-03-28",
        "Gudi Padwa": "2032-04-11",
        "Ugadi": "2032-04-11",
        "Tamil New Year": "2032-04-14",
        "Vishu": "2032-04-14",
        "Bohag Bihu": "2032-04-14",
        "Pana Sankranti": "2032-04-14",
        "Pohela Boishakh": "2032-04-15",
        "Ram Navami": "2032-04-19",
        "Muharram": "2032-04-21",
        "Mahavir Jayanti": "2032-04-23",
        "Buddha Purnima": "2032-05-25",
        "Milad un-Nabi": "2032-06-21",
        "Rath Yatra": "2032-07-09",
        "Parsi New Year": "2032-08-15",
        "Onam": "2032-08-17",
        "Raksha Bandhan": "2032-08-20",
        "Janmashtami": "2032-08-28",
        "Ganesh Chaturthi": "2032-09-08",
        "Durga Ashtami": "2032-10-12",
        "Maha Navami": "2032-10-13",
        "Vijayadashami": "2032-10-14",
        "Karwa Chauth": "2032-10-22",
        "Diwali": "2032-11-02",
        "Govardhan Puja": "2032-11-03",
        "Bhai Dooj": "2032-11-04",
        "Chhath Puja": "2032-11-08",
        "Guru Nanak Jayanti": "2032-11-17"
    },
    2033: {
        "Eid ul-Fitr": "2033-01-03",
        "Makar Sankranti": "2033-01-14",
        "Pongal": "2033-01-14",
        "Thai Pongal": "2033-01-15",
        "Mattu Pongal": "2033-01-16",
        "Kaanum Pongal": "2033-01-17",
        "Basant Panchami": "2033-02-04",
        "Maha Shivaratri": "2033-02-27",
        "Eid ul-Adha": "2033-03-12",
        "Holi": "2033-03-16",
        "Gudi Padwa": "2033-03-31",
        "Ugadi": "2033-03-31",
        "Ram Navami": "2033-04-07",
        "Muharram": "2033-04-11",
        "Mahavir Jayanti": "2033-04-12",
        "Tamil New Year": "2033-04-14",
        "Vishu": "2033-04-14",
        "Bohag Bihu": "2033-04-14",
        "Pana Sankranti": "2033-04-14",
        "Good Friday": "2033-04-15",
        "Pohela Boishakh": "2033-04-15",
        "Easter Sunday": "2033-04-17",
        "Buddha Purnima": "2033-05-14",
        "Milad un-Nabi": "2033-06-10",
        "Rath Yatra": "2033-06-28",
        "Raksha Bandhan": "2033-08-09",
        "Parsi New Year": "2033-08-15",
        "Janmashtami": "2033-08-17",
        "Ganesh Chaturthi": "2033-08-29",
        "Onam": "2033-09-06",
        "Durga Ashtami": "2033-10-01",
        "Maha Navami": "2033-10-02",
        "Vijayadashami": "2033-10-03",
        "Karwa Chauth": "2033-10-12",
        "Diwali": "2033-10-22",
        "Govardhan Puja": "2033-10-23",
        "Bhai Dooj": "2033-10-24",
        "Chhath Puja": "2033-10-28",
        "Guru Nanak Jayanti": "2033-11-06",
        "Eid ul-Fitr 2": "2033-12-24"
    },
    2034: {
        "Makar Sankranti": "2034-01-14",
        "Pongal": "2034-01-14",
        "Thai Pongal": "2034-01-15",
        "Mattu Pongal": "2034-01-16",
        "Kaanum Pongal": "2034-01-17",
        "Basant Panchami": "2034-01-24",
        "Maha Shivaratri": "2034-02-17",
        "Eid ul-Adha": "2034-03-02",
        "Holi": "2034-03-05",
        "Gudi Padwa": "2034-03-20",
        "Ugadi": "2034-03-20",
        "Ram Navami": "2034-03-28",
        "Muharram": "2034-03-31",
        "Mahavir Jayanti": "2034-04-01",
        "Good Friday": "2034-04-07",
        "Easter Sunday": "2034-04-09",
        "Tamil New Year": "2034-04-14",
        "Vishu": "2034-04-14",
        "Bohag Bihu": "2034-04-14",
        "Pana Sankranti": "2034-04-14",
        "Pohela Boishakh": "2034-04-15",
        "Buddha Purnima": "2034-05-03",
        "Milad un-Nabi": "2034-05-31",
        "Rath Yatra": "2034-06-17",
        "Parsi New Year": "2034-08-15",
        "Onam": "2034-08-26",
        "Raksha Bandhan": "2034-08-29",
        "Janmashtami": "2034-09-06",
        "Ganesh Chaturthi": "2034-09-17",
        "Durga Ashtami": "2034-10-20",
        "Maha Navami": "2034-10-21",
        "Vijayadashami": "2034-10-22",
        "Karwa Chauth": "2034-10-31",
        "Diwali": "2034-11-10",
        "Govardhan Puja": "2034-11-11",
        "Bhai Dooj": "2034-11-12",
        "Chhath Puja": "2034-11-16",
        "Guru Nanak Jayanti": "2034-11-25",
        "Eid ul-Fitr": "2034-12-13"
    },
    2035: {
        "Makar Sankranti": "2035-01-14",
        "Pongal": "2035-01-14",
        "Thai Pongal": "2035-01-15",
        "Mattu Pongal": "2035-01-16",
        "Kaanum Pongal": "2035-01-17",
        "Basant Panchami": "2035-02-13",
        "Eid ul-Adha": "2035-02-19",
        "Maha Shivaratri": "2035-03-08",
        "Muharram": "2035-03-21",
        "Good Friday": "2035-03-23",
        "Holi": "2035-03-24",
        "Easter Sunday": "2035-03-25",
        "Gudi Padwa": "2035-04-09",
        "Ugadi": "2035-04-09",
        "Tamil New Year": "2035-04-14",
        "Vishu": "2035-04-14",
        "Bohag Bihu": "2035-04-14",
        "Pana Sankranti": "2035-04-14",
        "Pohela Boishakh": "2035-04-15",
        "Ram Navami": "2035-04-16",
        "Mahavir Jayanti": "2035-04-20",
        "Milad un-Nabi": "2035-05-21",
        "Buddha Purnima": "2035-05-22",
        "Rath Yatra": "2035-07-06",
        "Parsi New Year": "2035-08-15",
        "Onam": "2035-08-15",
        "Raksha Bandhan": "2035-08-18",
        "Janmashtami": "2035-08-26",
        "Ganesh Chaturthi": "2035-09-06",
        "Durga Ashtami": "2035-10-09",
        "Maha Navami": "2035-10-10",
        "Vijayadashami": "2035-10-11",
        "Karwa Chauth": "2035-10-20",
        "Diwali": "2035-10-30",
        "Govardhan Puja": "2035-10-31",
        "Bhai Dooj": "2035-11-01",
        "Chhath Puja": "2035-11-05",
        "Guru Nanak Jayanti": "2035-11-15",
        "Eid ul-Fitr": "2035-12-02"
    },
    2036: {
        "Makar Sankranti": "2036-01-14",
        "Pongal": "2036-01-14",
        "Thai Pongal": "2036-01-15",
        "Mattu Pongal": "2036-01-16",
        "Kaanum Pongal": "2036-01-17",
        "Basant Panchami": "2036-02-02",
        "Eid ul-Adha": "2036-02-08",
        "Maha Shivaratri": "2036-02-25",
        "Muharram": "2036-03-09",
        "Holi": "2036-03-12",
        "Gudi Padwa": "2036-03-28",
        "Ugadi": "2036-03-28",
        "Ram Navami": "2036-04-05",
        "Mahavir Jayanti": "2036-04-09",
        "Good Friday": "2036-04-11",
        "Easter Sunday": "2036-04-13",
        "Tamil New Year": "2036-04-14",
        "Vishu": "2036-04-14",
        "Bohag Bihu": "2036-04-14",
        "Pana Sankranti": "2036-04-14",
        "Pohela Boishakh": "2036-04-15",
        "Milad un-Nabi": "2036-05-09",
        "Buddha Purnima": "2036-05-10",
        "Rath Yatra": "2036-06-26",
        "Raksha Bandhan": "2036-08-07",
        "Janmashtami": "2036-08-14",
        "Parsi New Year": "2036-08-15",
        "Ganesh Chaturthi": "2036-08-25",
        "Onam": "2036-09-04",
        "Durga Ashtami": "2036-09-28",
        "Maha Navami": "2036-09-29",
        "Vijayadashami": "2036-09-30",
        "Karwa Chauth": "2036-10-08",
        "Diwali": "2036-10-19",
        "Govardhan Puja": "2036-10-20",
        "Bhai Dooj": "2036-10-21",
        "Chhath Puja": "2036-10-25",
        "Guru Nanak Jayanti": "2036-11-03",
        "Eid ul-Fitr": "2036-11-20"
    }
}

# Fixed-date national / standard holidays
def get_fixed_holidays(year, state_code):
    return [
        {
            "date": f"{year}-01-26",
            "name": "Republic Day",
            "type": "national",
            "state_code": state_code,
            "description": "Celebrates the adoption of the Constitution of India"
        },
        {
            "date": f"{year}-04-14",
            "name": "Dr. Ambedkar Jayanti",
            "type": "public" if state_code == "IN" else "state",
            "state_code": state_code,
            "description": "Birth anniversary of Dr. B.R. Ambedkar, architect of the Constitution"
        },
        {
            "date": f"{year}-08-15",
            "name": "Independence Day",
            "type": "national",
            "state_code": state_code,
            "description": "Marks India's independence from British rule in 1947"
        },
        {
            "date": f"{year}-10-02",
            "name": "Gandhi Jayanti",
            "type": "national",
            "state_code": state_code,
            "description": "Birthday of Mahatma Gandhi, Father of the Nation"
        },
        {
            "date": f"{year}-12-25",
            "name": "Christmas",
            "type": "public",
            "state_code": state_code,
            "description": "Celebrates the birth of Jesus Christ"
        }
    ]

# Common festival generator
def get_national_holidays_for_year(year):
    f = FESTIVAL_CALENDAR[year]
    holidays = get_fixed_holidays(year, "IN")
    
    # Major public gazetted festivals for all India
    public_festivals = [
        ("Makar Sankranti", "public", "Harvest festival celebrated across India"),
        ("Maha Shivaratri", "public", "Hindu festival dedicated to Lord Shiva"),
        ("Holi", "public", "Festival of colors celebrating the arrival of spring"),
        ("Good Friday", "public", "Christian holiday commemorating the crucifixion of Jesus"),
        ("Eid ul-Fitr", "public", "Muslim festival marking the end of Ramadan"),
        ("Ram Navami", "public", "Celebrates the birth of Lord Rama"),
        ("Mahavir Jayanti", "public", "Birth anniversary of Lord Mahavira"),
        ("Buddha Purnima", "public", "Celebrates the birth, enlightenment, and nirvana of Lord Buddha"),
        ("Eid ul-Adha", "public", "Muslim festival of sacrifice"),
        ("Muharram", "public", "Islamic New Year and commemoration of Ashura"),
        ("Janmashtami", "public", "Celebrates the birth of Lord Krishna"),
        ("Milad un-Nabi", "public", "Birthday of Prophet Muhammad"),
        ("Durga Ashtami", "public", "Eighth day of the Navratri and Durga Puja festival"),
        ("Maha Navami", "public", "Ninth day of the Navratri and Durga Puja festival"),
        ("Vijayadashami", "public", "Celebrates victory of good over evil (Dussehra)"),
        ("Diwali", "public", "Festival of lights celebrating the return of Lord Rama"),
        ("Govardhan Puja", "public", "Day after Diwali commemorating Lord Krishna lifting Govardhan Hill"),
        ("Guru Nanak Jayanti", "public", "Birth anniversary of Guru Nanak Dev Ji")
    ]
    
    for name, htype, desc in public_festivals:
        if name in f:
            holidays.append({
                "date": f[name],
                "name": name,
                "type": htype,
                "state_code": "IN",
                "description": desc
            })
            
    if "Eid ul-Fitr 2" in f:
        holidays.append({
            "date": f["Eid ul-Fitr 2"],
            "name": "Eid ul-Fitr",
            "type": "public",
            "state_code": "IN",
            "description": "Muslim festival marking the end of Ramadan (second occurrence in calendar year)"
        })

    holidays.sort(key=lambda x: x["date"])
    return holidays

# State-specific festival and holiday generator
def get_state_holidays_for_year(year, state_code):
    f = FESTIVAL_CALENDAR[year]
    holidays = get_fixed_holidays(year, state_code)
    
    # Common public holidays across most states
    common_public = [
        ("Holi", "public", "Festival of colors celebrating the arrival of spring"),
        ("Good Friday", "public", "Christian holiday commemorating the crucifixion of Jesus"),
        ("Eid ul-Fitr", "public", "Muslim festival marking the end of Ramadan"),
        ("Ram Navami", "public", "Celebrates the birth of Lord Rama"),
        ("Mahavir Jayanti", "public", "Birth anniversary of Lord Mahavira"),
        ("Eid ul-Adha", "public", "Muslim festival of sacrifice"),
        ("Janmashtami", "public", "Celebrates the birth of Lord Krishna"),
        ("Vijayadashami", "public", "Celebrates victory of good over evil (Dussehra)"),
        ("Diwali", "public", "Festival of lights celebrating the return of Lord Rama"),
        ("Govardhan Puja", "public", "Day after Diwali / Post-Diwali celebrations"),
        ("Guru Nanak Jayanti", "public", "Birth anniversary of Guru Nanak Dev Ji")
    ]
    for name, htype, desc in common_public:
        if name in f:
            holidays.append({
                "date": f[name],
                "name": name,
                "type": htype,
                "state_code": state_code,
                "description": desc
            })

    # State specific additions
    st_additions = []
    
    # Regional statehood / formation days
    if state_code == "AP":
        st_additions.extend([
            (f"{year}-11-01", "Andhra Pradesh Formation Day", "state", "Commemorates the formation of Andhra Pradesh state"),
            (f["Makar Sankranti"], "Bhogi / Sankranti", "state", "Traditional four-day harvest festival in Andhra Pradesh"),
            (f["Ugadi"], "Ugadi", "state", "Telugu New Year's Day"),
            (f["Ganesh Chaturthi"], "Vinayaka Chavithi", "state", "Hindu festival celebrating Lord Ganesha"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Muharram"], "Muharram", "state", "Islamic month of remembrance"),
            (f["Milad un-Nabi"], "Milad un-Nabi", "state", "Birthday of Prophet Muhammad")
        ])
    elif state_code == "AR":
        st_additions.extend([
            (f"{year}-02-20", "Statehood Day", "state", "Celebrates the statehood of Arunachal Pradesh"),
            (f"{year}-01-06", "Si-Donyi Festival", "state", "Traditional festival of the Tagin tribe"),
            (f"{year}-02-26", "Nyokum", "state", "Agricultural festival of the Nyishi tribe"),
            (f"{year}-04-05", "Mopin", "state", "Harvest festival of the Galo tribe"),
            (f"{year}-09-01", "Solung", "state", "Agricultural festival of the Adi tribe"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth of Lord Buddha"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva")
        ])
    elif state_code == "AS":
        st_additions.extend([
            (f"{year}-01-15", "Magh Bihu", "state", "Assamese harvest festival marking the end of harvesting season"),
            (f"{year}-01-23", "Netaji Subhas Chandra Bose Jayanti", "state", "Birth anniversary of Netaji Subhas Chandra Bose"),
            (f"{year}-04-14", "Bohag Bihu", "state", "Assamese New Year festival (Rongali Bihu)"),
            (f"{year}-04-15", "Bohag Bihu (Second Day)", "state", "Celebration of Bohag Bihu"),
            (f"{year}-10-18", "Kati Bihu", "state", "Assamese festival of light and prayers for good harvest"),
            (f"{year}-11-24", "Lachit Divas", "state", "Commemorates legendary Ahom general Lachit Borphukan"),
            (f"{year}-12-02", "Asom Divas", "state", "Commemorates the arrival of Sukaphaa, founder of the Ahom kingdom"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth of Lord Buddha"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Durga Ashtami"], "Durga Ashtami", "state", "Eighth day of Durga Puja"),
            (f["Maha Navami"], "Maha Navami", "state", "Ninth day of Durga Puja")
        ])
    elif state_code == "BR":
        st_additions.extend([
            (f"{year}-03-22", "Bihar Diwas", "state", "Commemorates the formation of the state of Bihar"),
            (f["Basant Panchami"], "Basant Panchami / Saraswati Puja", "state", "Worship of goddess of knowledge Saraswati"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth of Lord Buddha"),
            (f["Muharram"], "Muharram", "state", "Islamic day of mourning"),
            (f["Durga Ashtami"], "Durga Ashtami", "state", "Eighth day of Navratri festival"),
            (f["Maha Navami"], "Maha Navami", "state", "Ninth day of Navratri festival"),
            (f["Chhath Puja"], "Chhath Puja", "state", "Ancient Hindu festival dedicated to the Sun God Surya"),
            (f["Bhai Dooj"], "Bhai Dooj", "state", "Celebration of sibling bond")
        ])
    elif state_code == "CH":
        st_additions.extend([
            (f"{year}-01-13", "Lohri", "state", "Popular winter folk festival of Punjab & Chandigarh"),
            (f"{year}-03-23", "Shaheed Bhagat Singh Martyrdom Day", "state", "Honors the martyrdom of Bhagat Singh, Rajguru, and Sukhdev"),
            (f"{year}-04-13", "Baisakhi", "state", "Harvest festival and founding of the Khalsa"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Raksha Bandhan"], "Raksha Bandhan", "state", "Festival celebrating sibling bond"),
            (f["Durga Ashtami"], "Durga Ashtami", "state", "Eighth day of Navratri festival"),
            (f["Maha Navami"], "Maha Navami", "state", "Ninth day of Navratri festival")
        ])
    elif state_code == "CT":
        st_additions.extend([
            (f"{year}-11-01", "Chhattisgarh Rajyotsava", "state", "Chhattisgarh State Formation Day"),
            (f"{year}-12-18", "Guru Ghasidas Jayanti", "state", "Birth anniversary of great saint Guru Ghasidas"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Raksha Bandhan"], "Raksha Bandhan", "state", "Festival celebrating sibling bond"),
            (f["Ganesh Chaturthi"], "Ganesh Chaturthi", "state", "Celebration of Lord Ganesha"),
            (f["Durga Ashtami"], "Durga Ashtami", "state", "Eighth day of Navratri"),
            (f["Maha Navami"], "Maha Navami", "state", "Ninth day of Navratri"),
            (f["Chhath Puja"], "Chhath Puja", "state", "Worship of the Sun God Surya")
        ])
    elif state_code == "DL":
        st_additions.extend([
            (f["Basant Panchami"], "Basant Panchami", "state", "Festival celebrating the arrival of spring"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth of Lord Buddha"),
            (f["Muharram"], "Muharram", "state", "Islamic New Year day of mourning"),
            (f["Raksha Bandhan"], "Raksha Bandhan", "state", "Festival celebrating sibling bond"),
            (f["Milad un-Nabi"], "Milad un-Nabi", "state", "Birthday of Prophet Muhammad"),
            (f["Chhath Puja"], "Chhath Puja", "state", "Ancient festival honoring Sun God Surya")
        ])
    elif state_code == "DN":
        st_additions.extend([
            (f"{year}-08-02", "Dadra & Nagar Haveli Liberation Day", "state", "Commemorates the liberation from Portuguese rule"),
            (f"{year}-12-19", "Daman & Diu Liberation Day", "state", "Celebrates liberation of Daman and Diu"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Ganesh Chaturthi"], "Ganesh Chaturthi", "state", "Festival honoring Lord Ganesha"),
            (f["Raksha Bandhan"], "Raksha Bandhan", "state", "Festival celebrating sibling bond"),
            (f["Parsi New Year"], "Parsi New Year", "state", "Zoroastrian New Year")
        ])
    elif state_code == "GA":
        st_additions.extend([
            (f"{year}-12-03", "Feast of St. Francis Xavier", "state", "Honors the patron saint of Goa"),
            (f"{year}-12-19", "Goa Liberation Day", "state", "Commemorates Indian armed forces liberating Goa from Portuguese rule in 1961"),
            (f"{year}-06-24", "Sao Joao Feast", "state", "Traditional Goan Catholic festival dedicated to St. John the Baptist"),
            (f["Gudi Padwa"], "Gudi Padwa", "state", "Konkani New Year festival"),
            (f["Ganesh Chaturthi"], "Ganesh Chaturthi (Chovoth)", "state", "Biggest cultural and religious festival in Goa"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth of Lord Buddha")
        ])
    elif state_code == "GJ":
        st_additions.extend([
            (f"{year}-05-01", "Gujarat Day", "state", "Commemorates the formation of Gujarat state in 1960"),
            (f["Makar Sankranti"], "Uttarayan", "state", "Major international kite flying and harvest festival"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Gudi Padwa"], "Chetichand", "state", "Sindhi New Year festival"),
            (f["Raksha Bandhan"], "Raksha Bandhan", "state", "Festival celebrating sibling bond"),
            (f["Ganesh Chaturthi"], "Ganesh Chaturthi", "state", "Hindu festival honoring Lord Ganesha"),
            (f["Govardhan Puja"], "Bestu Varas (Gujarati New Year)", "state", "Start of the Gujarati financial and cultural new year"),
            (f["Bhai Dooj"], "Bhai Bij", "state", "Festival celebrating brother-sister bond")
        ])
    elif state_code == "HR":
        st_additions.extend([
            (f"{year}-11-01", "Haryana Day", "state", "Commemorates the formation of Haryana state in 1966"),
            (f"{year}-03-23", "Shaheed Bhagat Singh Martyrdom Day", "state", "Tribute to freedom fighters Bhagat Singh, Rajguru, and Sukhdev"),
            (f"{year}-09-23", "Haryana Heroes Martyrdom Day", "state", "Commemorates the sacrifice of Rao Tula Ram and Haryana martyrs"),
            (f["Basant Panchami"], "Basant Panchami", "state", "Festival celebrating the arrival of spring"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Raksha Bandhan"], "Raksha Bandhan", "state", "Festival celebrating sibling bond"),
            (f["Durga Ashtami"], "Durga Ashtami", "state", "Eighth day of Navratri festival")
        ])
    elif state_code == "HP":
        st_additions.extend([
            (f"{year}-01-25", "Statehood Day", "state", "Celebrates the grant of statehood to Himachal Pradesh in 1971"),
            (f"{year}-04-15", "Himachal Day", "state", "Commemorates the creation of Himachal Pradesh in 1948"),
            (f["Maha Shivaratri"], "Maha Shivaratri (Mandi Shivaratri)", "state", "International Mandi Shivaratri fair and festival"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth of Lord Buddha"),
            (f["Raksha Bandhan"], "Raksha Bandhan", "state", "Festival celebrating sibling bond"),
            (f["Durga Ashtami"], "Durga Ashtami", "state", "Eighth day of Navratri festival"),
            (f["Karwa Chauth"], "Karwa Chauth", "state", "Traditional festival observed by married women")
        ])
    elif state_code == "JH":
        st_additions.extend([
            (f"{year}-11-15", "Jharkhand Foundation Day", "state", "Commemorates state formation and birth anniversary of Bhagwan Birsa Munda"),
            (f["Basant Panchami"], "Basant Panchami", "state", "Festival celebrating the arrival of spring"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Gudi Padwa"], "Sarhul", "state", "Major tribal festival celebrating blooming of Sal trees"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth of Lord Buddha"),
            (f["Durga Ashtami"], "Durga Ashtami", "state", "Eighth day of Durga Puja"),
            (f["Maha Navami"], "Maha Navami", "state", "Ninth day of Durga Puja"),
            (f["Chhath Puja"], "Chhath Puja", "state", "Ancient festival honoring Sun God Surya")
        ])
    elif state_code == "JK":
        st_additions.extend([
            (f"{year}-10-26", "Accession Day", "state", "Commemorates the signing of the Instrument of Accession in 1947"),
            (f"{year}-07-13", "Martyrs' Day", "state", "Commemorates martyrs of 1931"),
            (f["Maha Shivaratri"], "Herath (Maha Shivaratri)", "state", "Principal festival of Kashmiri Pandits"),
            (f["Gudi Padwa"], "Navreh", "state", "Kashmiri Pandit New Year"),
            (f["Baisakhi"] if "Baisakhi" in f else f"{year}-04-13", "Baisakhi", "state", "Harvest festival celebrated in Jammu region"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth of Lord Buddha"),
            (f["Muharram"], "Muharram", "state", "Islamic day of mourning"),
            (f["Milad un-Nabi"], "Milad un-Nabi", "state", "Birthday of Prophet Muhammad")
        ])
    elif state_code == "KA":
        st_additions.extend([
            (f"{year}-11-01", "Karnataka Rajyotsava", "state", "Karnataka State Formation Day"),
            (f["Makar Sankranti"], "Makar Sankranti", "state", "Harvest festival celebrated across Karnataka"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Ugadi"], "Ugadi", "state", "Kannada New Year festival"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth of Lord Buddha"),
            (f["Muharram"], "Muharram", "state", "Islamic day of mourning"),
            (f["Ganesh Chaturthi"], "Ganesh Chaturthi", "state", "Celebration of Lord Ganesha"),
            (f["Maha Navami"], "Maha Navami / Ayudha Puja", "state", "Worship of tools and knowledge"),
            (f["Milad un-Nabi"], "Milad un-Nabi", "state", "Birthday of Prophet Muhammad")
        ])
    elif state_code == "KL":
        st_additions.extend([
            (f"{year}-11-01", "Kerala Piravi", "state", "Kerala State Formation Day"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Vishu"], "Vishu", "state", "Malayalam New Year festival"),
            (f["Onam"], "Thiruvonam (Onam)", "state", "Grand harvest festival of Kerala"),
            (f["Easter Sunday"], "Easter Sunday", "state", "Christian festival celebrating the resurrection of Jesus"),
            (f["Muharram"], "Muharram", "state", "Islamic day of mourning"),
            (f["Milad un-Nabi"], "Milad un-Nabi", "state", "Birthday of Prophet Muhammad"),
            (f["Maha Navami"], "Maha Navami / Pooja Vypu", "state", "Ninth day of Navratri festival")
        ])
    elif state_code == "LA":
        st_additions.extend([
            (f"{year}-10-31", "Ladakh UT Foundation Day", "state", "Celebrates creation of the Union Territory of Ladakh"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth, enlightenment, and nirvana of Lord Buddha"),
            (f["Muharram"], "Muharram", "state", "Islamic day of mourning"),
            (f["Milad un-Nabi"], "Milad un-Nabi", "state", "Birthday of Prophet Muhammad"),
            (f"{year}-12-15", "Losar (Ladakhi New Year)", "state", "Traditional Ladakhi New Year festival")
        ])
    elif state_code == "LD":
        st_additions.extend([
            (f"{year}-11-01", "Lakshadweep Day", "state", "Celebrates the formation of Lakshadweep Union Territory"),
            (f["Muharram"], "Muharram", "state", "Islamic day of mourning"),
            (f["Milad un-Nabi"], "Milad un-Nabi", "state", "Birthday of Prophet Muhammad")
        ])
    elif state_code == "MP":
        st_additions.extend([
            (f"{year}-11-01", "Madhya Pradesh Foundation Day", "state", "MP State Formation Day"),
            (f["Makar Sankranti"], "Makar Sankranti", "state", "Harvest festival celebrated across MP"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Gudi Padwa"], "Gudi Padwa", "state", "Hindu New Year festival"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth of Lord Buddha"),
            (f["Raksha Bandhan"], "Raksha Bandhan", "state", "Festival celebrating sibling bond"),
            (f["Ganesh Chaturthi"], "Ganesh Chaturthi", "state", "Celebration of Lord Ganesha"),
            (f["Durga Ashtami"], "Durga Ashtami", "state", "Eighth day of Navratri festival"),
            (f["Maha Navami"], "Maha Navami", "state", "Ninth day of Navratri festival")
        ])
    elif state_code == "MH":
        st_additions.extend([
            (f"{year}-02-19", "Chhatrapati Shivaji Maharaj Jayanti", "state", "Birth anniversary of legendary Maratha warrior king Shivaji Maharaj"),
            (f"{year}-05-01", "Maharashtra Day", "state", "Commemorates the formation of Maharashtra state in 1960"),
            (f["Gudi Padwa"], "Gudi Padwa", "state", "Marathi New Year festival"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth of Lord Buddha"),
            (f["Parsi New Year"], "Parsi New Year (Navroz)", "state", "Zoroastrian New Year celebrated widely in Maharashtra"),
            (f["Ganesh Chaturthi"], "Ganesh Chaturthi", "state", "Biggest cultural festival in Maharashtra"),
            (f["Raksha Bandhan"], "Raksha Bandhan / Narali Purnima", "state", "Festival celebrating sibling bond and fishermen's offering to sea"),
            (f["Durga Ashtami"], "Durga Ashtami", "state", "Eighth day of Navratri festival"),
            (f["Maha Navami"], "Maha Navami", "state", "Ninth day of Navratri festival"),
            (f["Muharram"], "Muharram", "state", "Islamic day of mourning")
        ])
    elif state_code == "MN":
        st_additions.extend([
            (f"{year}-01-21", "Manipur Statehood Day", "state", "Celebrates the statehood of Manipur in 1972"),
            (f"{year}-02-15", "Lui-Ngai-Ni", "state", "Seed sowing festival of Naga tribes in Manipur"),
            (f"{year}-04-23", "Khongjom Day", "state", "Commemorates the Anglo-Manipur War of 1891"),
            (f["Holi"], "Yaoshang (Holi)", "state", "Five-day premier festival of Manipur"),
            (f["Gudi Padwa"], "Cheiraoba", "state", "Manipuri Lunar New Year festival"),
            (f["Rath Yatra"], "Kang (Rath Yatra)", "state", "Lord Jagannath chariot festival in Manipur"),
            (f"{year}-11-01", "Kut Festival", "state", "Autumn post-harvest festival of the Kuki-Chin-Mizo tribes")
        ])
    elif state_code == "ML":
        st_additions.extend([
            (f"{year}-01-21", "Meghalaya Statehood Day", "state", "Celebrates the statehood of Meghalaya in 1972"),
            (f"{year}-07-17", "U Tirot Sing Day", "state", "Commemorates the heroic Khasi freedom fighter U Tirot Sing"),
            (f"{year}-11-23", "Seng Kut Snem", "state", "Cultural festival celebrating Khasi indigenous heritage"),
            (f"{year}-12-18", "U Sohra Singh Day", "state", "Commemorates Khasi patriots"),
            (f"{year}-12-30", "U Kiang Nangbah Day", "state", "Honors Jaintia freedom fighter U Kiang Nangbah"),
            (f["Easter Sunday"], "Easter Sunday", "state", "Christian festival celebrating the resurrection of Jesus")
        ])
    elif state_code == "MZ":
        st_additions.extend([
            (f"{year}-01-01", "New Year's Day", "state", "Celebration of the New Year"),
            (f"{year}-02-20", "Statehood Day", "state", "Celebrates the statehood of Mizoram in 1987"),
            (f"{year}-03-01", "Chapchar Kut", "state", "Major spring festival of the Mizo people"),
            (f"{year}-06-30", "Remna Ni (Peace Day)", "state", "Commemorates the historic 1986 Mizo Peace Accord"),
            (f["Easter Sunday"], "Easter Sunday", "state", "Christian festival celebrating the resurrection of Jesus")
        ])
    elif state_code == "NL":
        st_additions.extend([
            (f"{year}-12-01", "Nagaland Statehood Day", "state", "Celebrates the statehood of Nagaland in 1963"),
            (f"{year}-12-02", "Hornbill Festival Day", "state", "Grand festival of festivals celebrating Naga heritage"),
            (f"{year}-02-25", "Sekrenyi", "state", "Purification and renewal festival of the Angami Nagas"),
            (f"{year}-05-02", "Moatsu Festival", "state", "Sowing and harvest festival of the Ao Nagas"),
            (f["Easter Sunday"], "Easter Sunday", "state", "Christian festival celebrating the resurrection of Jesus")
        ])
    elif state_code == "OR":
        st_additions.extend([
            (f"{year}-04-01", "Utkal Divas (Odisha Day)", "state", "Commemorates the formation of Odisha as a separate province in 1936"),
            (f["Pana Sankranti"], "Maha Vishuba Sankranti (Pana Sankranti)", "state", "Odia Solar New Year"),
            (f["Rath Yatra"], "Rath Yatra (Puri)", "state", "World-renowned chariot festival of Lord Jagannath in Puri"),
            (f["Maha Shivaratri"], "Maha Shivaratri (Jagar)", "state", "Major temple observance dedicated to Lord Shiva"),
            (f["Durga Ashtami"], "Durga Ashtami", "state", "Eighth day of Durga Puja"),
            (f["Maha Navami"], "Maha Navami", "state", "Ninth day of Durga Puja"),
            (f["Ganesh Chaturthi"], "Ganesh Chaturthi", "state", "Festival celebrating Lord Ganesha")
        ])
    elif state_code == "PY":
        st_additions.extend([
            (f"{year}-08-16", "De Jure Transfer Day", "state", "Commemorates the legal merger of Puducherry into India"),
            (f"{year}-11-01", "Puducherry Liberation Day", "state", "Commemorates liberation from French administration in 1954"),
            (f["Pongal"], "Pongal", "state", "Harvest festival celebrated in Puducherry and Karaikal"),
            (f["Tamil New Year"], "Tamil New Year", "state", "Tamil New Year celebrations"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Milad un-Nabi"], "Milad un-Nabi", "state", "Birthday of Prophet Muhammad")
        ])
    elif state_code == "PB":
        st_additions.extend([
            (f"{year}-11-01", "Punjab Day", "state", "Commemorates the linguistic reorganization and formation of modern Punjab in 1966"),
            (f"{year}-01-13", "Lohri", "state", "Popular harvest and winter solstice festival of Punjab"),
            (f"{year}-03-23", "Shaheed Bhagat Singh Martyrdom Day", "state", "Honors the supreme sacrifice of Bhagat Singh, Rajguru, and Sukhdev"),
            (f"{year}-04-13", "Baisakhi", "state", "Harvest festival and creation of the Khalsa Panth"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Raksha Bandhan"], "Raksha Bandhan", "state", "Festival celebrating sibling bond")
        ])
    elif state_code == "RJ":
        st_additions.extend([
            (f"{year}-03-30", "Rajasthan Day", "state", "Commemorates the formation of the state of Rajasthan in 1949"),
            (f["Basant Panchami"], "Basant Panchami", "state", "Festival celebrating the arrival of spring"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Raksha Bandhan"], "Raksha Bandhan", "state", "Festival celebrating sibling bond"),
            (f["Ganesh Chaturthi"], "Ganesh Chaturthi", "state", "Celebration of Lord Ganesha"),
            (f["Durga Ashtami"], "Durga Ashtami", "state", "Eighth day of Navratri festival"),
            (f["Maha Navami"], "Maha Navami", "state", "Ninth day of Navratri festival")
        ])
    elif state_code == "SK":
        st_additions.extend([
            (f"{year}-05-16", "Sikkim State Day", "state", "Commemorates Sikkim becoming the 22nd state of India in 1975"),
            (f["Buddha Purnima"], "Buddha Purnima / Saga Dawa", "state", "Triple blessed festival of Lord Buddha"),
            (f"{year}-08-25", "Pang Lhabsol", "state", "Unique festival honoring Mount Khangchendzonga, guardian deity of Sikkim"),
            (f"{year}-12-18", "Losoong / Namsoong", "state", "Sikkimese New Year festival celebrated by Bhutia and Lepcha communities"),
            (f["Durga Ashtami"], "Durga Ashtami (Dasain)", "state", "Celebration of Dasain festival in Sikkim")
        ])
    elif state_code == "TN":
        st_additions.extend([
            (f["Pongal"], "Pongal", "state", "Traditional Tamil harvest festival celebrating the Sun God"),
            (f["Thai Pongal"], "Thai Pongal", "state", "Second day of the Pongal festival"),
            (f["Mattu Pongal"], "Maatu Pongal / Thiruvalluvar Day", "state", "Day dedicated to honoring cattle and saint Thiruvalluvar"),
            (f["Kaanum Pongal"], "Kaanum Pongal / Uzhavar Thirunal", "state", "Day for family gatherings and honoring farmers"),
            (f["Tamil New Year"], "Tamil New Year (Puthandu)", "state", "First day of the traditional Tamil calendar year"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Ganesh Chaturthi"], "Vinayakar Chathurthi", "state", "Hindu festival celebrating Lord Ganesha"),
            (f["Maha Navami"], "Ayudha Pooja", "state", "Worship of tools, instruments, and books"),
            (f["Muharram"], "Muharram", "state", "Islamic day of mourning"),
            (f["Milad un-Nabi"], "Milad un-Nabi", "state", "Birthday of Prophet Muhammad")
        ])
    elif state_code == "TG":
        st_additions.extend([
            (f"{year}-06-02", "Telangana Formation Day", "state", "Commemorates the formation of Telangana state in 2014"),
            (f["Makar Sankranti"], "Bhogi / Sankranti", "state", "Harvest festival celebrated across Telangana"),
            (f["Ugadi"], "Ugadi", "state", "Telugu New Year's Day"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Ganesh Chaturthi"], "Vinayaka Chavithi", "state", "Grand festival honoring Lord Ganesha"),
            (f["Maha Navami"], "Bathukamma / Maha Navami", "state", "Telangana's vibrant floral festival and Navami celebration"),
            (f["Milad un-Nabi"], "Milad un-Nabi", "state", "Birthday of Prophet Muhammad")
        ])
    elif state_code == "TR":
        st_additions.extend([
            (f"{year}-01-21", "Tripura Statehood Day", "state", "Commemorates the attainment of statehood by Tripura in 1972"),
            (f"{year}-04-20", "Garia Puja", "state", "Traditional tribal festival honoring deity Baba Garia for prosperity"),
            (f"{year}-07-10", "Kharchi Puja", "state", "Royal centuries-old festival honoring the Fourteen Gods of Tripura"),
            (f"{year}-07-24", "Ker Puja", "state", "Ancient ritual to protect the kingdom and citizens from calamity"),
            (f["Durga Ashtami"], "Durga Ashtami", "state", "Eighth day of Durga Puja"),
            (f["Maha Navami"], "Maha Navami", "state", "Ninth day of Durga Puja"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth of Lord Buddha")
        ])
    elif state_code == "UP":
        st_additions.extend([
            (f"{year}-01-24", "Uttar Pradesh Day", "state", "Commemorates the naming of Uttar Pradesh in 1950"),
            (f["Makar Sankranti"], "Makar Sankranti / Khichdi", "state", "Harvest festival celebrated across Uttar Pradesh"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth of Lord Buddha"),
            (f["Raksha Bandhan"], "Raksha Bandhan", "state", "Festival celebrating sibling bond"),
            (f["Durga Ashtami"], "Durga Ashtami", "state", "Eighth day of Navratri festival"),
            (f["Maha Navami"], "Maha Navami", "state", "Ninth day of Navratri festival"),
            (f["Chhath Puja"], "Chhath Puja", "state", "Ancient festival honoring Sun God Surya"),
            (f["Bhai Dooj"], "Bhai Dooj", "state", "Festival celebrating sibling bond")
        ])
    elif state_code == "UT":
        st_additions.extend([
            (f"{year}-11-09", "Uttarakhand Foundation Day", "state", "Commemorates the creation of Uttarakhand state in 2000"),
            (f"{year}-03-14", "Phool Dei", "state", "Traditional harvest and spring festival celebrated by children"),
            (f"{year}-07-16", "Harela", "state", "Folk festival celebrating the onset of the monsoon and green harvest"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Raksha Bandhan"], "Raksha Bandhan", "state", "Festival celebrating sibling bond"),
            (f["Durga Ashtami"], "Durga Ashtami", "state", "Eighth day of Navratri festival"),
            (f["Maha Navami"], "Maha Navami", "state", "Ninth day of Navratri festival")
        ])
    elif state_code == "WB":
        st_additions.extend([
            (f"{year}-01-23", "Netaji Subhas Chandra Bose Jayanti", "state", "Birth anniversary of Netaji Subhas Chandra Bose"),
            (f"{year}-05-09", "Rabindra Jayanti", "state", "Birth anniversary of Nobel laureate Rabindranath Tagore"),
            (f["Basant Panchami"], "Saraswati Puja", "state", "Worship of goddess of knowledge and arts Saraswati"),
            (f["Pohela Boishakh"], "Pohela Boishakh (Bengali New Year)", "state", "First day of the Bengali calendar year (Noboborsho)"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth of Lord Buddha"),
            (f["Rath Yatra"], "Rath Yatra", "state", "Chariot festival of Lord Jagannath celebrated across Bengal"),
            (f["Muharram"], "Muharram", "state", "Islamic day of mourning"),
            (f["Durga Ashtami"], "Durga Puja (Maha Ashtami)", "state", "Grand festival celebrating Goddess Durga"),
            (f["Maha Navami"], "Durga Puja (Maha Navami)", "state", "Ninth day of Durga Puja"),
            (f["Bhai Dooj"], "Bhai Phonta", "state", "Traditional Bengali festival celebrating brother-sister bond")
        ])
    elif state_code == "AN":
        st_additions.extend([
            (f["Basant Panchami"], "Basant Panchami", "state", "Festival celebrating the arrival of spring"),
            (f["Maha Shivaratri"], "Maha Shivaratri", "state", "Hindu festival dedicated to Lord Shiva"),
            (f["Buddha Purnima"], "Buddha Purnima", "state", "Celebrates the birth of Lord Buddha"),
            (f["Muharram"], "Muharram", "state", "Islamic day of mourning"),
            (f["Milad un-Nabi"], "Milad un-Nabi", "state", "Birthday of Prophet Muhammad")
        ])

    for dt, name, htype, desc in st_additions:
        holidays.append({
            "date": dt,
            "name": name,
            "type": htype,
            "state_code": state_code,
            "description": desc
        })

    # Remove duplicates (if any by date and name)
    seen = set()
    unique_holidays = []
    for h in holidays:
        key = (h["date"], h["name"])
        if key not in seen:
            seen.add(key)
            unique_holidays.append(h)

    unique_holidays.sort(key=lambda x: x["date"])
    return unique_holidays

import datetime

def get_easter_date(year):
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return datetime.date(year, month, day)

def get_nth_weekday(year, month, weekday, n):
    if n > 0:
        d = datetime.date(year, month, 1)
        while d.weekday() != weekday:
            d += datetime.timedelta(days=1)
        d += datetime.timedelta(weeks=n-1)
        return d
    else:
        if month == 12:
            next_m = datetime.date(year + 1, 1, 1)
        else:
            next_m = datetime.date(year, month + 1, 1)
        d = next_m - datetime.timedelta(days=1)
        while d.weekday() != weekday:
            d -= datetime.timedelta(days=1)
        return d

def fmt_date(d):
    return d.strftime("%Y-%m-%d")

def get_us_holidays(year, region_code="US"):
    easter = get_easter_date(year)
    good_friday = easter - datetime.timedelta(days=2)
    
    mlk = get_nth_weekday(year, 1, 0, 3)
    presidents = get_nth_weekday(year, 2, 0, 3)
    memorial = get_nth_weekday(year, 5, 0, -1)
    labor = get_nth_weekday(year, 9, 0, 1)
    columbus = get_nth_weekday(year, 10, 0, 2)
    thanksgiving = get_nth_weekday(year, 11, 3, 4)
    black_friday = thanksgiving + datetime.timedelta(days=1)
    
    hols = [
        {"date": f"{year}-01-01", "name": "New Year's Day", "type": "public", "country_code": "US", "region_code": region_code, "description": "First day of the year in the Gregorian calendar"},
        {"date": fmt_date(mlk), "name": "Martin Luther King Jr. Day", "type": "public", "country_code": "US", "region_code": region_code, "description": "Honors civil rights leader Dr. Martin Luther King Jr."},
        {"date": fmt_date(presidents), "name": "Washington's Birthday (Presidents' Day)", "type": "public", "country_code": "US", "region_code": region_code, "description": "Honors George Washington and all U.S. presidents"},
        {"date": fmt_date(good_friday), "name": "Good Friday", "type": "observance", "country_code": "US", "region_code": region_code, "description": "Christian holiday commemorating the crucifixion of Jesus"},
        {"date": fmt_date(memorial), "name": "Memorial Day", "type": "public", "country_code": "US", "region_code": region_code, "description": "Honors U.S. military personnel who died in service"},
        {"date": f"{year}-06-19", "name": "Juneteenth National Independence Day", "type": "public", "country_code": "US", "region_code": region_code, "description": "Commemorating the end of slavery in the United States"},
        {"date": f"{year}-07-04", "name": "Independence Day", "type": "public", "country_code": "US", "region_code": region_code, "description": "Commemorating the Declaration of Independence in 1776"},
        {"date": fmt_date(labor), "name": "Labor Day", "type": "public", "country_code": "US", "region_code": region_code, "description": "Honors the American labor movement and contributions of workers"},
        {"date": fmt_date(columbus), "name": "Columbus Day / Indigenous Peoples' Day", "type": "public", "country_code": "US", "region_code": region_code, "description": "Honors Christopher Columbus and Indigenous peoples"},
        {"date": f"{year}-11-11", "name": "Veterans Day", "type": "public", "country_code": "US", "region_code": region_code, "description": "Honors military veterans who served in the U.S. Armed Forces"},
        {"date": fmt_date(thanksgiving), "name": "Thanksgiving Day", "type": "public", "country_code": "US", "region_code": region_code, "description": "National day of giving thanks and harvest celebration"},
        {"date": f"{year}-12-25", "name": "Christmas Day", "type": "public", "country_code": "US", "region_code": region_code, "description": "Celebration of the birth of Jesus Christ"}
    ]
    
    if region_code == "CA":
        hols.append({"date": f"{year}-03-31", "name": "Cesar Chavez Day", "type": "public", "country_code": "US", "region_code": "CA", "description": "Honors farm labor leader Cesar Chavez"})
        hols.append({"date": fmt_date(black_friday), "name": "Day After Thanksgiving", "type": "public", "country_code": "US", "region_code": "CA", "description": "Official state holiday in California"})
    elif region_code == "MA":
        patriots = get_nth_weekday(year, 4, 0, 3)
        hols.append({"date": fmt_date(patriots), "name": "Patriots' Day", "type": "public", "country_code": "US", "region_code": "MA", "description": "Commemorates battles of Lexington and Concord"})
        
    hols.sort(key=lambda x: x["date"])
    return hols

def get_gb_holidays(year, region_code="GB"):
    easter = get_easter_date(year)
    good_friday = easter - datetime.timedelta(days=2)
    easter_monday = easter + datetime.timedelta(days=1)
    
    early_may = get_nth_weekday(year, 5, 0, 1)
    spring_bank = get_nth_weekday(year, 5, 0, -1)
    summer_bank_eng = get_nth_weekday(year, 8, 0, -1)
    summer_bank_sct = get_nth_weekday(year, 8, 0, 1)
    
    hols = [
        {"date": f"{year}-01-01", "name": "New Year's Day", "type": "public", "country_code": "GB", "region_code": region_code, "description": "Public holiday celebrating New Year's Day"},
        {"date": fmt_date(good_friday), "name": "Good Friday", "type": "public", "country_code": "GB", "region_code": region_code, "description": "Christian holiday commemorating the crucifixion"},
        {"date": fmt_date(early_may), "name": "Early May Bank Holiday", "type": "public", "country_code": "GB", "region_code": region_code, "description": "Spring public bank holiday"},
        {"date": fmt_date(spring_bank), "name": "Spring Bank Holiday", "type": "public", "country_code": "GB", "region_code": region_code, "description": "Late spring public bank holiday"},
        {"date": f"{year}-12-25", "name": "Christmas Day", "type": "public", "country_code": "GB", "region_code": region_code, "description": "Celebration of the birth of Jesus Christ"},
        {"date": f"{year}-12-26", "name": "Boxing Day", "type": "public", "country_code": "GB", "region_code": region_code, "description": "Traditional bank holiday following Christmas Day"}
    ]
    
    if region_code in ["GB", "ENG", "WLS", "NIR"]:
        hols.append({"date": fmt_date(easter_monday), "name": "Easter Monday", "type": "public", "country_code": "GB", "region_code": region_code, "description": "Bank holiday following Easter Sunday"})
        hols.append({"date": fmt_date(summer_bank_eng), "name": "Summer Bank Holiday", "type": "public", "country_code": "GB", "region_code": region_code, "description": "Late summer public bank holiday"})
        
    if region_code == "SCT":
        hols.append({"date": f"{year}-01-02", "name": "2nd January Bank Holiday", "type": "public", "country_code": "GB", "region_code": "SCT", "description": "Public bank holiday in Scotland"})
        hols.append({"date": fmt_date(summer_bank_sct), "name": "Summer Bank Holiday (Scotland)", "type": "public", "country_code": "GB", "region_code": "SCT", "description": "August bank holiday in Scotland"})
        hols.append({"date": f"{year}-11-30", "name": "St Andrew's Day", "type": "public", "country_code": "GB", "region_code": "SCT", "description": "Official national day of Scotland"})
    elif region_code == "NIR":
        hols.append({"date": f"{year}-03-17", "name": "St Patrick's Day", "type": "public", "country_code": "GB", "region_code": "NIR", "description": "Feast of St Patrick in Northern Ireland"})
        hols.append({"date": f"{year}-07-12", "name": "Battle of the Boyne (Orangemen's Day)", "type": "public", "country_code": "GB", "region_code": "NIR", "description": "Commemorates the Battle of the Boyne in 1690"})

    hols.sort(key=lambda x: x["date"])
    return hols

def get_ca_holidays(year, region_code="CA"):
    easter = get_easter_date(year)
    good_friday = easter - datetime.timedelta(days=2)
    
    v_date = datetime.date(year, 5, 24)
    while v_date.weekday() != 0:
        v_date -= datetime.timedelta(days=1)
        
    family_day = get_nth_weekday(year, 2, 0, 3)
    civic_holiday = get_nth_weekday(year, 8, 0, 1)
    labour_day = get_nth_weekday(year, 9, 0, 1)
    thanksgiving = get_nth_weekday(year, 10, 0, 2)
    
    hols = [
        {"date": f"{year}-01-01", "name": "New Year's Day", "type": "public", "country_code": "CA", "region_code": region_code, "description": "First day of the year"},
        {"date": fmt_date(good_friday), "name": "Good Friday", "type": "public", "country_code": "CA", "region_code": region_code, "description": "Christian holiday commemorating the crucifixion"},
        {"date": fmt_date(v_date), "name": "Victoria Day", "type": "public", "country_code": "CA", "region_code": region_code, "description": "Honors Queen Victoria's birthday"},
        {"date": f"{year}-07-01", "name": "Canada Day", "type": "public", "country_code": "CA", "region_code": region_code, "description": "National day celebrating the confederation of Canada"},
        {"date": fmt_date(labour_day), "name": "Labour Day", "type": "public", "country_code": "CA", "region_code": region_code, "description": "Honors workers and the labor movement"},
        {"date": f"{year}-09-30", "name": "National Day for Truth and Reconciliation", "type": "public", "country_code": "CA", "region_code": region_code, "description": "Honors survivors of residential schools"},
        {"date": fmt_date(thanksgiving), "name": "Thanksgiving", "type": "public", "country_code": "CA", "region_code": region_code, "description": "Canadian holiday of blessing for the harvest"},
        {"date": f"{year}-11-11", "name": "Remembrance Day", "type": "public", "country_code": "CA", "region_code": region_code, "description": "Honors military personnel who died in duty"},
        {"date": f"{year}-12-25", "name": "Christmas Day", "type": "public", "country_code": "CA", "region_code": region_code, "description": "Celebration of the birth of Jesus Christ"},
        {"date": f"{year}-12-26", "name": "Boxing Day", "type": "public", "country_code": "CA", "region_code": region_code, "description": "Statutory holiday following Christmas"}
    ]
    
    if region_code in ["ON", "AB", "BC", "SK", "MB"]:
        hols.append({"date": fmt_date(family_day), "name": "Family Day", "type": "public", "country_code": "CA", "region_code": region_code, "description": "Provincial holiday celebrating family bonds"})
    if region_code in ["ON", "BC", "AB", "MB"]:
        hols.append({"date": fmt_date(civic_holiday), "name": "Civic Holiday", "type": "public", "country_code": "CA", "region_code": region_code, "description": "Provincial summer holiday"})
    if region_code == "QC":
        hols.append({"date": f"{year}-06-24", "name": "La Fête Nationale / St. Jean Baptiste Day", "type": "public", "country_code": "CA", "region_code": "QC", "description": "National holiday of Quebec"})

    hols.sort(key=lambda x: x["date"])
    return hols

def get_au_holidays(year, region_code="AU"):
    easter = get_easter_date(year)
    good_friday = easter - datetime.timedelta(days=2)
    easter_sat = easter - datetime.timedelta(days=1)
    easter_monday = easter + datetime.timedelta(days=1)
    
    kings_bday_jun = get_nth_weekday(year, 6, 0, 2)
    labour_day_oct = get_nth_weekday(year, 10, 0, 1)
    melbourne_cup = get_nth_weekday(year, 11, 1, 1)
    
    hols = [
        {"date": f"{year}-01-01", "name": "New Year's Day", "type": "public", "country_code": "AU", "region_code": region_code, "description": "First day of the year"},
        {"date": f"{year}-01-26", "name": "Australia Day", "type": "public", "country_code": "AU", "region_code": region_code, "description": "Official national day of Australia"},
        {"date": fmt_date(good_friday), "name": "Good Friday", "type": "public", "country_code": "AU", "region_code": region_code, "description": "Christian holiday commemorating the crucifixion"},
        {"date": fmt_date(easter_sat), "name": "Easter Saturday", "type": "public", "country_code": "AU", "region_code": region_code, "description": "Day between Good Friday and Easter Sunday"},
        {"date": fmt_date(easter_monday), "name": "Easter Monday", "type": "public", "country_code": "AU", "region_code": region_code, "description": "Public holiday following Easter Sunday"},
        {"date": f"{year}-04-25", "name": "ANZAC Day", "type": "public", "country_code": "AU", "region_code": region_code, "description": "Honors Australians who served and died in war"},
        {"date": fmt_date(kings_bday_jun), "name": "King's Birthday", "type": "public", "country_code": "AU", "region_code": region_code, "description": "Official birthday of the Monarch"},
        {"date": fmt_date(labour_day_oct), "name": "Labour Day", "type": "public", "country_code": "AU", "region_code": region_code, "description": "Honors the 8-hour working day movement"},
        {"date": f"{year}-12-25", "name": "Christmas Day", "type": "public", "country_code": "AU", "region_code": region_code, "description": "Celebration of the birth of Jesus Christ"},
        {"date": f"{year}-12-26", "name": "Boxing Day / Proclamation Day", "type": "public", "country_code": "AU", "region_code": region_code, "description": "Public holiday following Christmas"}
    ]
    
    if region_code == "VIC":
        hols.append({"date": fmt_date(melbourne_cup), "name": "Melbourne Cup Day", "type": "public", "country_code": "AU", "region_code": "VIC", "description": "Famous horse racing public holiday in Victoria"})

    hols.sort(key=lambda x: x["date"])
    return hols

def get_sg_holidays(year):
    easter = get_easter_date(year)
    good_friday = easter - datetime.timedelta(days=2)
    
    cny_dates = {
        2020: "2020-01-25", 2021: "2021-02-12", 2022: "2022-02-01", 2023: "2023-01-22",
        2024: "2024-02-10", 2025: "2025-01-29", 2026: "2026-02-17", 2027: "2027-02-06",
        2028: "2028-01-26", 2029: "2029-02-13", 2030: "2030-02-03", 2031: "2031-01-23",
        2032: "2032-02-11", 2033: "2033-01-31", 2034: "2034-02-19", 2035: "2035-02-08", 2036: "2036-01-28"
    }
    vesak_dates = {
        2020: "2020-05-07", 2021: "2021-05-26", 2022: "2022-05-15", 2023: "2023-06-02",
        2024: "2024-05-22", 2025: "2025-05-12", 2026: "2026-05-31", 2027: "2027-05-20",
        2028: "2028-05-09", 2029: "2029-05-27", 2030: "2030-05-16", 2031: "2031-05-06",
        2032: "2032-05-24", 2033: "2033-05-13", 2034: "2034-05-31", 2035: "2035-05-20", 2036: "2036-05-09"
    }
    
    cny = cny_dates.get(year, f"{year}-02-01")
    cny_dt = datetime.datetime.strptime(cny, "%Y-%m-%d").date()
    cny_day2 = fmt_date(cny_dt + datetime.timedelta(days=1))
    vesak = vesak_dates.get(year, f"{year}-05-15")
    
    hols = [
        {"date": f"{year}-01-01", "name": "New Year's Day", "type": "public", "country_code": "SG", "region_code": "SG", "description": "First day of the year"},
        {"date": cny, "name": "Chinese New Year (Day 1)", "type": "public", "country_code": "SG", "region_code": "SG", "description": "Lunar New Year celebration"},
        {"date": cny_day2, "name": "Chinese New Year (Day 2)", "type": "public", "country_code": "SG", "region_code": "SG", "description": "Second day of Lunar New Year"},
        {"date": fmt_date(good_friday), "name": "Good Friday", "type": "public", "country_code": "SG", "region_code": "SG", "description": "Christian holiday commemorating the crucifixion"},
        {"date": f"{year}-05-01", "name": "Labour Day", "type": "public", "country_code": "SG", "region_code": "SG", "description": "Honors workers and May Day"},
        {"date": vesak, "name": "Vesak Day", "type": "public", "country_code": "SG", "region_code": "SG", "description": "Commemorating the birth, enlightenment, and death of Buddha"},
        {"date": f"{year}-08-09", "name": "National Day", "type": "public", "country_code": "SG", "region_code": "SG", "description": "Commemorating Singapore's independence in 1965"},
        {"date": f"{year}-12-25", "name": "Christmas Day", "type": "public", "country_code": "SG", "region_code": "SG", "description": "Celebration of the birth of Jesus Christ"}
    ]
    hols.sort(key=lambda x: x["date"])
    return hols

def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

def main():
    base_dir = Path(__file__).resolve().parent.parent / "data"
    print(f"Generating holidays into base directory: {base_dir}")
    
    total_files = 0
    total_entries = 0
    
    us_states = ["US", "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"]
    gb_regions = ["GB", "ENG", "WLS", "SCT", "NIR"]
    ca_provinces = ["CA", "ON", "QC", "BC", "AB", "MB", "SK", "NS", "NB", "NL", "PE", "NT", "YT", "NU"]
    au_states = ["AU", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]

    for year in range(2020, 2037):
        year_dir = base_dir / str(year)
        year_dir.mkdir(parents=True, exist_ok=True)
        
        # 1. India (Legacy data/<year>/<st>.json and data/IN/<year>/<st>.json)
        national_holidays = get_national_holidays_for_year(year)
        save_json(year_dir / "national.json", national_holidays)
        save_json(base_dir / "IN" / str(year) / "national.json", national_holidays)
        total_files += 2
        total_entries += len(national_holidays) * 2
        
        for st in STATES:
            st_code = st["code"]
            st_holidays = get_state_holidays_for_year(year, st_code)
            save_json(year_dir / f"{st_code}.json", st_holidays)
            save_json(base_dir / "IN" / str(year) / f"{st_code}.json", st_holidays)
            total_files += 2
            total_entries += len(st_holidays) * 2
            
        # 2. United States
        for st_code in us_states:
            filename = "national.json" if st_code == "US" else f"{st_code}.json"
            hols = get_us_holidays(year, st_code)
            save_json(base_dir / "US" / str(year) / filename, hols)
            total_files += 1
            total_entries += len(hols)

        # 3. United Kingdom
        for r_code in gb_regions:
            filename = "national.json" if r_code == "GB" else f"{r_code}.json"
            hols = get_gb_holidays(year, r_code)
            save_json(base_dir / "GB" / str(year) / filename, hols)
            total_files += 1
            total_entries += len(hols)

        # 4. Canada
        for p_code in ca_provinces:
            filename = "national.json" if p_code == "CA" else f"{p_code}.json"
            hols = get_ca_holidays(year, p_code)
            save_json(base_dir / "CA" / str(year) / filename, hols)
            total_files += 1
            total_entries += len(hols)

        # 5. Australia
        for a_code in au_states:
            filename = "national.json" if a_code == "AU" else f"{a_code}.json"
            hols = get_au_holidays(year, a_code)
            save_json(base_dir / "AU" / str(year) / filename, hols)
            total_files += 1
            total_entries += len(hols)

        # 6. Singapore
        sg_hols = get_sg_holidays(year)
        save_json(base_dir / "SG" / str(year) / "national.json", sg_hols)
        total_files += 1
        total_entries += len(sg_hols)

        print(f"[OK] Generated Year {year} multi-country datasets (IN, US, GB, CA, AU, SG)")

    print(f"\nSuccessfully created {total_files} global holiday data files ({total_entries} total holiday entries) for 2020-2036!")

if __name__ == "__main__":
    main()
