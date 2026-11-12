#!/usr/bin/env python3
"""Refresh public, aggregated visitor locations without storing individual visits.

MapMyVisitors' public widget only shows recent locations. Its public statistics
page supplies aggregate ``addressPoints`` for the selected report range. Request
the complete tracking period and verify the *returned* range before accepting it.
The provider sometimes returns an enclosing calendar-year range; this is safe
only when it still covers the first tracking date through the fetch date.

No JavaScript from the response is evaluated. A failed fetch or validation leaves
the previous JSON untouched and exits nonzero so GitHub Actions reports a failure.
"""

from __future__ import annotations

import argparse
from datetime import date, datetime, timezone
from html.parser import HTMLParser
import ipaddress
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen


SOURCE_URL = "https://mapmyvisitors.com/web/1c852"
TRACKING_START = date(2026, 9, 10)
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "assets/data/visitor-history.json"
MAX_RESPONSE_BYTES = 5_000_000


class HistoryError(ValueError):
    """A source response is not safe to publish as complete visitor history."""


class ReportParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.scripts: list[str] = []
        self.canonical_urls: list[str] = []
        self.map_totals: list[int] = []
        self._script: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "script" and "src" not in values:
            self._script = []
        if tag == "link" and "canonical" in (values.get("rel") or "").split():
            self.canonical_urls.append(values.get("href") or "")
        if "non_unique_visitor_count-count" in (values.get("class") or "").split():
            count = values.get("data-count") or ""
            if not count.isdigit():
                raise HistoryError("The source map total is missing or invalid.")
            self.map_totals.append(int(count))

    def handle_data(self, data: str) -> None:
        if self._script is not None:
            self._script.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._script is not None:
            self.scripts.append("".join(self._script))
            self._script = None


def single_match(pattern: str, text: str, label: str) -> str:
    matches = re.findall(pattern, text)
    if len(matches) != 1:
        raise HistoryError(f"Expected exactly one {label}; the source format may have changed.")
    return matches[0]


def positive_count(value: object, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise HistoryError(f"Invalid {label} in a location aggregate.")
    return value


def coordinate(value: object, limit: int) -> float:
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise HistoryError("Invalid coordinate type in a location aggregate.")
    try:
        number = float(value)
    except (ValueError, OverflowError) as exc:
        raise HistoryError("Invalid coordinate in a location aggregate.") from exc
    if not math.isfinite(number) or not -limit <= number <= limit:
        raise HistoryError("Out-of-range coordinate in a location aggregate.")
    return number


def location_name(value: object) -> str:
    if not isinstance(value, str):
        raise HistoryError("Invalid location name.")
    name = value.strip()
    if not name or len(name) > 200 or re.search(r"[<>\x00-\x1f]", name):
        raise HistoryError("Invalid location name.")
    # Only place labels belong in the published file, never URLs or IP addresses.
    if "://" in name or re.search(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", name):
        raise HistoryError("The source contains a non-geographic location label.")
    try:
        ipaddress.ip_address(name)
    except ValueError:
        return name
    raise HistoryError("The source contains an IP address instead of a location label.")


def parse_report(html: str, fetched_at: datetime) -> dict:
    if not html.strip() or not re.search(r"</html\s*>\s*$", html, re.IGNORECASE):
        raise HistoryError("The source response is empty or truncated.")
    parser = ReportParser()
    parser.feed(html)
    parser.close()
    if parser.canonical_urls != [SOURCE_URL]:
        raise HistoryError("The source is not the expected public statistics page.")

    report_scripts = [script for script in parser.scripts if re.search(r"\bvar\s+addressPoints\s*=", script)]
    if len(report_scripts) != 1:
        raise HistoryError("The source location array is absent or ambiguous.")
    script = report_scripts[0]
    start_text = single_match(r'\bvar\s+start\s*=\s*"(\d{2}/\d{2}/\d{4})"\s*;', script, "report start date")
    end_text = single_match(r'\bvar\s+end\s*=\s*"(\d{2}/\d{2}/\d{4})"\s*;', script, "report end date")
    try:
        served_start = datetime.strptime(start_text, "%m/%d/%Y").date()
        served_end = datetime.strptime(end_text, "%m/%d/%Y").date()
    except ValueError as exc:
        raise HistoryError("The source report dates are invalid.") from exc
    fetch_date = fetched_at.astimezone(timezone.utc).date()
    if not served_start <= TRACKING_START <= fetch_date <= served_end:
        raise HistoryError("The returned date range does not cover the complete tracking history.")

    declaration = re.search(r"\bvar\s+addressPoints\s*=\s*", script)
    assert declaration is not None
    try:
        rows, array_end = json.JSONDecoder().raw_decode(script[declaration.end():])
    except (ValueError, json.JSONDecodeError) as exc:
        raise HistoryError("The source location array is not valid JSON.") from exc
    if not re.match(r"\s*;", script[declaration.end() + array_end:]):
        raise HistoryError("Unsupported location array expression.")
    if not isinstance(rows, list) or not rows or len(rows) > 100_000:
        raise HistoryError("The source location array is empty or unsupported.")

    locations: dict[tuple[str, float, float], int] = {}
    unlocated_visits = 0
    total_visits = 0
    for row in rows:
        if not isinstance(row, list) or len(row) != 5:
            raise HistoryError("The source location row format has changed.")
        latitude = coordinate(row[0], 90)
        longitude = coordinate(row[1], 180)
        name = location_name(row[2])
        visits = positive_count(row[3], "visit count")
        unique_visits = positive_count(row[4], "unique visit count")
        if unique_visits > visits:
            raise HistoryError("The source location counts are inconsistent.")
        total_visits += visits
        if re.search(r"\bunknown\b|\bunlocated\b|\bunspecified\b", name, re.IGNORECASE):
            # Unknown Location's coordinates are synthetic map placeholders.
            unlocated_visits += visits
            continue
        key = (name, latitude, longitude)
        locations[key] = locations.get(key, 0) + visits

    if len(parser.map_totals) != 1 or parser.map_totals[0] != total_visits:
        raise HistoryError("Location totals do not match the source map; refusing incomplete data.")

    return {
        "schemaVersion": 1,
        "source": {"name": "MapMyVisitors", "url": SOURCE_URL},
        "generatedAt": fetched_at.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "rangeStart": TRACKING_START.isoformat(),
        "rangeEnd": fetch_date.isoformat(),
        "providerRangeStart": served_start.isoformat(),
        "providerRangeEnd": served_end.isoformat(),
        "locations": [
            {"name": name, "latitude": latitude, "longitude": longitude, "visits": visits}
            for (name, latitude, longitude), visits in sorted(locations.items())
        ],
        "unlocatedVisits": unlocated_visits,
    }


def fetch_report(fetch_date: date) -> str:
    requested_range = f"custom|{TRACKING_START.isoformat()}|{fetch_date.isoformat()}"
    request = Request(SOURCE_URL, headers={
        "User-Agent": "RuixiangLiuVisitorHistory/1.0 (+https://ruixiang-liu.github.io/)",
        "Accept": "text/html",
        "Cookie": f"daterange={quote(requested_range, safe='')}",
        "Cache-Control": "no-cache",
    })
    with urlopen(request, timeout=30) as response:
        final_url = urlsplit(response.url)
        if final_url.scheme != "https" or final_url.netloc != "mapmyvisitors.com" or final_url.path.rstrip("/") != "/web/1c852":
            raise HistoryError("The source redirected away from the public statistics page.")
        if response.headers.get_content_type() != "text/html":
            raise HistoryError("The source response is not HTML.")
        body = response.read(MAX_RESPONSE_BYTES + 1)
        if len(body) > MAX_RESPONSE_BYTES:
            raise HistoryError("The source response is unexpectedly large.")
        return body.decode(response.headers.get_content_charset() or "utf-8", errors="strict")


def atomic_write(output: Path, data: dict) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n", dir=output.parent,
                                         prefix=f".{output.name}.", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(data, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    try:
        fetched_at = datetime.now(timezone.utc)
        data = parse_report(fetch_report(fetched_at.date()), fetched_at)
        atomic_write(args.output, data)
    except (HistoryError, HTTPError, URLError, OSError, UnicodeError) as exc:
        print(f"Visitor history update failed; previous file retained: {exc}", file=sys.stderr)
        return 1
    print(f"Updated {args.output} with {len(data['locations'])} aggregated locations; no individual visit data saved.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
