import os
import json
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv


def _get_required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Environment variable '{name}' is required but not set.")
    return value


REPO_ROOT = Path(__file__).resolve().parent.parent


def _load_env_files():
    candidate_paths = (
        REPO_ROOT / ".env",
        REPO_ROOT / "scraper" / ".env",
    )
    for env_path in candidate_paths:
        if load_dotenv(env_path, override=False):
            break


_load_env_files()

API_URL = _get_required_env("API_URL")
ACCESS_KEY = _get_required_env("ACCESS_KEY")
BASE_DIR = (
    REPO_ROOT / "frontend" / "static" / "hslu_data"
)  # main directory for all output files
HEADERS = {"X-Access-Key": ACCESS_KEY}
REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "10"))
SESSION = requests.Session()
REQUEST_DELAY = float(os.getenv("REQUEST_DELAY_SECONDS", "0.1"))


def _throttle():
    if REQUEST_DELAY > 0:
        time.sleep(REQUEST_DELAY)


def make_request(endpoint: str) -> Any:
    full_url = f"{API_URL}{endpoint}"
    print(f"GET {full_url} ...", end=" ", flush=True)
    start = time.perf_counter()
    try:
        response = SESSION.get(full_url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        duration = time.perf_counter() - start
        print(f"OK ({duration:.2f}s)")
        return response.json()
    except requests.exceptions.RequestException as e:
        duration = time.perf_counter() - start
        print(f"FAILED ({duration:.2f}s)")
        print(f"Error fetching data from {full_url}: {e}")
        return None


def save_json(data: Any, file_path: Path):
    if data is None:
        print(f"No data to save for {file_path}. Skipping.")
        return

    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Successfully saved data to {file_path}")


def fetch_and_save(endpoint: str, relative_path: str | Path) -> Any:
    data = make_request(endpoint)
    save_json(data, BASE_DIR / Path(relative_path))
    _throttle()
    return data


def _extract_list(payload: Any) -> list[Any]:
    if isinstance(payload, dict):
        maybe_list = payload.get("data")
        if isinstance(maybe_list, list):
            return maybe_list
    if isinstance(payload, list):
        return payload
    return []


def main():
    print("--- Starting HSLU Data Scraper ---")

    print("\nFetching primary lists...")
    semesters_data = fetch_and_save("/semesters", "semesters.json")
    study_programmes_data = fetch_and_save("/study-programmes", "study_programmes.json")

    print("\nFetching latest semester...")
    fetch_and_save("/semesters/latest", "latest_semester.json")

    semesters_list = _extract_list(semesters_data)
    if semesters_list:
        print("\nFetching modules for each semester...")
        for semester in semesters_list:
            semester_slug = semester if isinstance(semester, str) else str(semester)
            print(f"  - Fetching modules for {semester_slug}...")
            fetch_and_save(
                f"/semesters/{semester_slug}/modules",
                Path("modules") / f"{semester_slug}_modules.json",
            )
    else:
        print("Could not fetch semester list. Skipping module downloads.")

    programmes_list = _extract_list(study_programmes_data)
    if programmes_list:
        print("\nFetching data for each study programme...")
        for programme in programmes_list:
            if not isinstance(programme, dict):
                continue
            short_name = programme.get("ShortName")
            if not short_name:
                continue

            print(f"  - Fetching majors and minors for {short_name}...")
            fetch_and_save(
                f"/majors-minors/{short_name.lower()}",
                Path("majors_minors") / f"{short_name}_majors_minors.json",
            )

            print(f"  - Fetching ECTS data for {short_name}...")
            fetch_and_save(
                f"/ects/{short_name.lower()}",
                Path("ects") / f"{short_name}_ects.json",
            )
    else:
        print("Could not fetch study programme list. Skipping related downloads.")

    print("\n--- Scraper finished successfully! ---")


if __name__ == "__main__":
    main()
