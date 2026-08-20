import json
from pathlib import Path

DATA_FILE = (
    Path(__file__).resolve().parent.parent
    / "frontend"
    / "data"
    / "hslu_data"
    / "modules"
    / "F25_modules.json"
)

EXAM_MARKERS = ("Prüfung",)
WORK_MARKERS = ("Arbeit",)


def is_exam(mode: str) -> bool:
    return any(m in mode for m in EXAM_MARKERS)


def is_work(mode: str) -> bool:
    return any(m in mode for m in WORK_MARKERS)


def classify(modes: list[str]) -> str:
    if not modes:
        return "other"
    has_work = any(is_work(m) for m in modes)
    has_exam = any(is_exam(m) for m in modes)
    if has_work and not has_exam:
        return "work_only"
    if has_work and has_exam:
        return "mixed"
    if has_exam and not has_work:
        return "exam_only"
    return "other"


def offerings(module: dict) -> str:
    seen = []
    for offer in module.get("ModuleOffers", []) or []:
        prog = offer.get("DegreeProgramme", "?")
        mtype = offer.get("ModuleType", "?")
        season = offer.get("CourseOffering", "?")
        classes = ",".join(offer.get("OfferedToClasses", []) or [])
        seen.append(f"{prog}|{mtype}|{season}|{classes}")
    return "; ".join(seen) if seen else "-"


def main() -> None:
    raw = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    modules = raw["data"] if isinstance(raw, dict) and "data" in raw else raw

    buckets: dict[str, list[dict]] = {
        "work_only": [],
        "mixed": [],
        "exam_only": [],
        "other": [],
    }

    for m in modules:
        modes = m.get("ModeOfAssessments") or []
        key = classify(modes)
        buckets[key].append(m)

    titles = {
        "work_only": "WORK-ONLY (Arbeit, no exam)  -- best fit",
        "mixed": "MIXED (Arbeit + exam)",
        "exam_only": "EXAM-ONLY (written/oral, no Arbeit)",
        "other": "OTHER / UNCLEAR",
    }
    order = ["work_only", "mixed", "exam_only", "other"]

    for key in order:
        mods = buckets[key]
        print(f"\n=== {titles[key]}  ({len(mods)}) ===")
        for m in sorted(mods, key=lambda x: x.get("ShortName", "")):
            modes = m.get("ModeOfAssessments") or []
            print(
                f"- {m.get('ShortName','?'):14} | {m.get('Name','?')[:55]:55} | "
                f"ECTS {m.get('Ects','?')} | {modes} | {offerings(m)}"
            )


if __name__ == "__main__":
    main()