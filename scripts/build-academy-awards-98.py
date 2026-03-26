#!/usr/bin/env python3
"""
Resolve 98th Academy Awards (2026 ceremony) nominees to TMDB IDs via Wikidata P4947,
merge with legacy academy-awards.json entries, write data/academy-awards.json (array format).
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "academy-awards.json"
LEGACY = OUT

WIKI_API = "https://en.wikipedia.org/w/api.php"
WD_API = "https://www.wikidata.org/w/api.php"

# (category_slug, won, [wikipedia_page_titles])
# Titles must match en.wikipedia.org/wiki/<title> exactly.
ROWS: list[tuple[str, bool, list[str]]] = [
    ("best_picture", True, ["One_Battle_After_Another"]),
    (
        "best_picture",
        False,
        [
            "Bugonia_(film)",
            "F1_(film)",
            "Frankenstein_(2025_film)",
            "Hamnet_(film)",
            "Marty_Supreme",
            "The_Secret_Agent_(2025_film)",
            "Sentimental_Value",
            "Sinners_(2025_film)",
            "Train_Dreams_(film)",
        ],
    ),
    ("best_director", True, ["One_Battle_After_Another"]),
    (
        "best_director",
        False,
        ["Hamnet_(film)", "Marty_Supreme", "Sentimental_Value", "Sinners_(2025_film)"],
    ),
    ("best_actor", True, ["Sinners_(2025_film)"]),
    (
        "best_actor",
        False,
        ["Marty_Supreme", "One_Battle_After_Another", "Blue_Moon_(2025_film)", "The_Secret_Agent_(2025_film)"],
    ),
    ("best_actress", True, ["Hamnet_(film)"]),
    (
        "best_actress",
        False,
        [
            "If_I_Had_Legs_I'd_Kick_You",
            "Song_Sung_Blue_(2025_film)",
            "Sentimental_Value",
            "Bugonia_(film)",
        ],
    ),
    ("best_supporting_actor", True, ["One_Battle_After_Another"]),
    (
        "best_supporting_actor",
        False,
        ["Frankenstein_(2025_film)", "Sinners_(2025_film)", "Sentimental_Value"],
    ),
    ("best_supporting_actress", True, ["Weapons_(2025_film)"]),
    (
        "best_supporting_actress",
        False,
        ["Sentimental_Value", "Sinners_(2025_film)", "One_Battle_After_Another"],
    ),
    ("best_original_screenplay", True, ["Sinners_(2025_film)"]),
    (
        "best_original_screenplay",
        False,
        ["Blue_Moon_(2025_film)", "It_Was_Just_an_Accident", "Marty_Supreme", "Sentimental_Value"],
    ),
    ("best_adapted_screenplay", True, ["One_Battle_After_Another"]),
    (
        "best_adapted_screenplay",
        False,
        ["Bugonia_(film)", "Frankenstein_(2025_film)", "Hamnet_(film)", "Train_Dreams_(film)"],
    ),
    ("best_animated_feature", True, ["KPop_Demon_Hunters"]),
    (
        "best_animated_feature",
        False,
        ["Arco_(film)", "Elio_(film)", "Little_Amélie_or_the_Character_of_Rain", "Zootopia_2"],
    ),
    ("best_international_feature", True, ["Sentimental_Value"]),
    (
        "best_international_feature",
        False,
        [
            "It_Was_Just_an_Accident",
            "The_Secret_Agent_(2025_film)",
            "Sirāt",
            "The_Voice_of_Hind_Rajab",
        ],
    ),
    ("best_documentary_feature", True, ["Mr_Nobody_Against_Putin"]),
    (
        "best_documentary_feature",
        False,
        [
            "The_Alabama_Solution",
            "Come_See_Me_in_the_Good_Light",
            "Cutting_Through_Rocks",
            "The_Perfect_Neighbor",
        ],
    ),
    ("best_documentary_short", True, ["All_the_Empty_Rooms"]),
    (
        "best_documentary_short",
        False,
        [
            "Armed_Only_with_a_Camera:_The_Life_and_Death_of_Brent_Renaud",
            'Children_No_More:_"Were_and_Are_Gone"',
            "The_Devil_Is_Busy",
            "Perfectly_a_Strangeness",
        ],
    ),
    ("best_live_action_short", True, ["Two_People_Exchanging_Saliva"]),
    ("best_live_action_short", True, ["The_Singers"]),
    (
        "best_live_action_short",
        False,
        ["Butcher's_Stain", "A_Friend_of_Dorothy", "Jane_Austen's_Period_Drama"],
    ),
    ("best_animated_short", True, ["The_Girl_Who_Cried_Pearls"]),
    (
        "best_animated_short",
        False,
        ["Butterfly_(2024_film)", "Forevergreen_(film)", "Retirement_Plan_(film)", "The_Three_Sisters_(2024_film)"],
    ),
    ("best_original_score", True, ["Sinners_(2025_film)"]),
    (
        "best_original_score",
        False,
        ["Bugonia_(film)", "Frankenstein_(2025_film)", "Hamnet_(film)", "One_Battle_After_Another"],
    ),
    ("best_original_song", True, ["KPop_Demon_Hunters"]),
    (
        "best_original_song",
        False,
        ["Diane_Warren:_Relentless", "Sinners_(2025_film)", "Viva_Verdi!", "Train_Dreams_(film)"],
    ),
    ("best_sound", True, ["F1_(film)"]),
    (
        "best_sound",
        False,
        ["Frankenstein_(2025_film)", "One_Battle_After_Another", "Sinners_(2025_film)", "Sirāt"],
    ),
    ("best_casting", True, ["One_Battle_After_Another"]),
    (
        "best_casting",
        False,
        ["Hamnet_(film)", "Marty_Supreme", "The_Secret_Agent_(2025_film)", "Sinners_(2025_film)"],
    ),
    ("best_production_design", True, ["Frankenstein_(2025_film)"]),
    (
        "best_production_design",
        False,
        ["Hamnet_(film)", "Marty_Supreme", "One_Battle_After_Another", "Sinners_(2025_film)"],
    ),
    ("best_cinematography", True, ["Sinners_(2025_film)"]),
    (
        "best_cinematography",
        False,
        ["Frankenstein_(2025_film)", "Marty_Supreme", "One_Battle_After_Another", "Train_Dreams_(film)"],
    ),
    ("best_makeup_hairstyling", True, ["Frankenstein_(2025_film)"]),
    (
        "best_makeup_hairstyling",
        False,
        ["Kokuho_(film)", "Sinners_(2025_film)", "The_Smashing_Machine_(2025_film)", "The_Ugly_Stepsister"],
    ),
    ("best_costume_design", True, ["Frankenstein_(2025_film)"]),
    (
        "best_costume_design",
        False,
        ["Avatar:_Fire_and_Ash", "Hamnet_(film)", "Marty_Supreme", "Sinners_(2025_film)"],
    ),
    ("best_film_editing", True, ["One_Battle_After_Another"]),
    (
        "best_film_editing",
        False,
        ["F1_(film)", "Marty_Supreme", "Sentimental_Value", "Sinners_(2025_film)"],
    ),
    ("best_visual_effects", True, ["Avatar:_Fire_and_Ash"]),
    (
        "best_visual_effects",
        False,
        ["F1_(film)", "Jurassic_World_Rebirth", "The_Lost_Bus", "Sinners_(2025_film)"],
    ),
]

# Manual TMDB overrides when Wikidata has no P4947 (title -> tmdb_id)
MANUAL_TMDb: dict[str, int] = {}


def http_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "movie-draft-oracle/1.0 (academy-awards build)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def wiki_title_to_qid(title: str) -> str | None:
    url = f"{WIKI_API}?action=query&titles={urllib.parse.quote(title)}&prop=pageprops&format=json"
    data = http_json(url)
    pages = data.get("query", {}).get("pages", {})
    for _pid, page in pages.items():
        if page.get("missing"):
            return None
        pp = page.get("pageprops") or {}
        return pp.get("wikibase_item")
    return None


def qid_to_tmdb(qid: str) -> int | None:
    url = f"{WD_API}?action=wbgetentities&ids={qid}&props=claims&format=json"
    data = http_json(url)
    ent = data.get("entities", {}).get(qid, {})
    claims = ent.get("claims", {})
    p4947 = claims.get("P4947", [])
    for c in p4947:
        try:
            val = c["mainsnak"]["datavalue"]["value"]
            if isinstance(val, str) and val.isdigit():
                return int(val)
            if isinstance(val, int):
                return val
        except (KeyError, TypeError, ValueError):
            continue
    return None


def resolve_tmdb(wiki_title: str) -> int | None:
    if wiki_title in MANUAL_TMDb:
        return MANUAL_TMDb[wiki_title]
    qid = wiki_title_to_qid(wiki_title)
    if not qid:
        print(f"MISSING wiki page: {wiki_title}")
        return None
    time.sleep(0.08)
    tmdb = qid_to_tmdb(qid)
    time.sleep(0.08)
    if tmdb is None:
        print(f"MISSING P4947 for {wiki_title} ({qid})")
    return tmdb


def load_legacy_tmdb_status() -> list[dict]:
    if not LEGACY.exists():
        return []
    raw = json.loads(LEGACY.read_text())
    out: list[dict] = []
    if isinstance(raw, dict) and isinstance(raw.get("movies"), list):
        for m in raw["movies"]:
            tid = m.get("tmdb_id")
            st = m.get("status")
            if tid is not None and st in ("winner", "nominee"):
                out.append({"tmdb_id": int(tid), "status": st})
    return out


def main() -> None:
    title_to_tmdb: dict[str, int] = {}
    all_titles = sorted({t for _, _, titles in ROWS for t in titles})
    for wt in all_titles:
        tid = resolve_tmdb(wt)
        if tid is not None:
            title_to_tmdb[wt] = tid

    entries: list[dict] = []
    year = 2026  # ceremony year (honors 2025 releases)
    for cat, won, titles in ROWS:
        movies = []
        for wt in titles:
            tid = title_to_tmdb.get(wt)
            if tid is None:
                continue
            movies.append({"tmdb_id": tid, "title": wt.replace("_", " ")})
        if movies:
            entries.append({"category": cat, "year": year, "won": won, "movies": movies})

    # Preserve legacy { movies: [{tmdb_id, status}] } as synthetic rows
    for leg in load_legacy_tmdb_status():
        # Skip if same tmdb already covered with winner status in new data
        tid = leg["tmdb_id"]
        st = leg["status"]
        entries.append(
            {
                "category": "legacy_repo_seed",
                "year": None,
                "won": st == "winner",
                "movies": [{"tmdb_id": tid}],
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} with {len(entries)} award rows, {len(title_to_tmdb)} resolved titles")


if __name__ == "__main__":
    main()
