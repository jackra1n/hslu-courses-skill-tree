import os
import requests
import json
from pathlib import Path
import time


def _get_required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Environment variable '{name}' is required but not set.")
    return value


REPO_ROOT = Path(__file__).resolve().parent.parent


def _load_env_file():
    candidate_paths = [
        REPO_ROOT / ".env",
        REPO_ROOT / "scraper" / ".env",
    ]
    for env_path in candidate_paths:
        if not env_path.exists():
            continue
        with env_path.open() as env_file:
            for raw_line in env_file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key, value)
        break


_load_env_file()

API_URL = _get_required_env("API_URL")
ACCESS_KEY = _get_required_env("ACCESS_KEY")
BASE_DIR = (
    REPO_ROOT / "frontend" / "static" / "hslu_data"
)  # main directory for all output files
HEADERS = {"X-Access-Key": ACCESS_KEY}
REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "10"))
SESSION = requests.Session()


def make_request(endpoint: str) -> dict | None:
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


def save_json(data: dict, file_path: Path):
    if not data:
        print(f"No data to save for {file_path}. Skipping.")
        return

    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Successfully saved data to {file_path}")


def main():
    print("--- Starting HSLU Data Scraper ---")

    print("\nFetching primary lists...")
    semesters_data = make_request("/semesters")
    study_programmes_data = make_request("/study-programmes")

    save_json(semesters_data, BASE_DIR / "semesters.json")
    save_json(study_programmes_data, BASE_DIR / "study_programmes.json")

    print("\nFetching latest semester...")
    latest_semester_data = make_request("/semesters/latest")
    save_json(latest_semester_data, BASE_DIR / "latest_semester.json")

    if semesters_data and "data" in semesters_data:
        print("\nFetching modules for each semester...")
        semesters_list = semesters_data["data"]
        for semester in semesters_list:
            print(f"  - Fetching modules for {semester}...")
            modules_data = make_request(f"/semesters/{semester}/modules")
            save_json(modules_data, BASE_DIR / "modules" / f"{semester}_modules.json")
            time.sleep(0.1)
    else:
        print("Could not fetch semester list. Skipping module downloads.")

    if study_programmes_data and "data" in study_programmes_data:
        print("\nFetching data for each study programme...")
        programmes_list = study_programmes_data["data"]
        for programme in programmes_list:
            short_name = programme.get("ShortName")
            if not short_name:
                continue

            print(f"  - Fetching majors and minors for {short_name}...")
            majors_minors_data = make_request(f"/majors-minors/{short_name.lower()}")
            save_json(
                majors_minors_data,
                BASE_DIR / "majors_minors" / f"{short_name}_majors_minors.json",
            )
            time.sleep(0.1)

            print(f"  - Fetching ECTS data for {short_name}...")
            ects_data = make_request(f"/ects/{short_name.lower()}")
            save_json(ects_data, BASE_DIR / "ects" / f"{short_name}_ects.json")
            time.sleep(0.1)
    else:
        print("Could not fetch study programme list. Skipping related downloads.")

    print("\n--- Scraper finished successfully! ---")


if __name__ == "__main__":
    main()
