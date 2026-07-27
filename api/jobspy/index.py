"""
Vercel Python Function: JobSpy scraper.

Scrapes public job-board listings via the open-source JobSpy library
(https://github.com/speedyapply/JobSpy, MIT) and returns normalized JSON.
It ONLY reads public listings — it never logs in, creates accounts, fills
forms, or submits applications. All classification, deduplication, and
persistence happen in the TypeScript pipeline that calls this function
(see src/lib/discovery/jobspy.ts); this function is stateless and DB-free.

Invoked by the TS cron route POST /api/cron/jobspy, which passes the search
config as a JSON body and a shared secret in the Authorization header. LinkedIn
is intentionally NOT enabled by the caller (aggressive blocking / ToS risk).

Request  (POST): { "searches": [{ "search": str, "location": str,
                                  "resultsWanted": int, "hoursOld": int,
                                  "googleSearchTerm": str? }],
                   "sites": [str], "countryIndeed": str }
Response (JSON): { "ok": bool, "count": int, "postings": [ ... ] }
"""

from http.server import BaseHTTPRequestHandler
import json
import os


def _authorized(headers) -> bool:
    secret = os.environ.get("JOBSPY_SECRET") or os.environ.get("CRON_SECRET")
    if not secret:
        return False
    return headers.get("Authorization") == f"Bearer {secret}"


def _clean(value):
    """Coerce pandas/numpy scalars into JSON-serializable values."""
    try:
        import pandas as pd

        if value is None or (not isinstance(value, (list, dict)) and pd.isna(value)):
            return None
    except Exception:
        if value is None:
            return None
    # Dates / timestamps → ISO strings.
    if hasattr(value, "isoformat"):
        return value.isoformat()
    # numpy scalars → native python.
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass
    return value


def _run(payload: dict) -> dict:
    from jobspy import scrape_jobs

    sites = payload.get("sites") or ["indeed", "google", "zip_recruiter", "glassdoor"]
    country_indeed = payload.get("countryIndeed") or "USA"
    searches = payload.get("searches") or []

    seen_urls = set()
    postings = []

    for s in searches:
        search_term = s.get("search")
        if not search_term:
            continue
        df = scrape_jobs(
            site_name=sites,
            search_term=search_term,
            google_search_term=s.get("googleSearchTerm") or search_term,
            location=s.get("location") or "United States",
            results_wanted=int(s.get("resultsWanted") or 25),
            hours_old=int(s.get("hoursOld") or 72),
            country_indeed=country_indeed,
            # Never fetch LinkedIn descriptions (LinkedIn is not in `sites`),
            # and keep requests read-only and modest.
            linkedin_fetch_description=False,
            verbose=0,
        )
        if df is None or len(df) == 0:
            continue

        records = df.to_dict("records")
        for r in records:
            url = _clean(r.get("job_url"))
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            postings.append(
                {
                    "site": _clean(r.get("site")),
                    "title": _clean(r.get("title")),
                    "company": _clean(r.get("company")),
                    "companyUrl": _clean(r.get("company_url")),
                    "location": _clean(r.get("location")),
                    "jobUrl": url,
                    "description": _clean(r.get("description")),
                    "datePosted": _clean(r.get("date_posted")),
                    "isRemote": _clean(r.get("is_remote")),
                    "minAmount": _clean(r.get("min_amount")),
                    "maxAmount": _clean(r.get("max_amount")),
                    "currency": _clean(r.get("currency")),
                    "interval": _clean(r.get("interval")),
                    "searchTerm": search_term,
                }
            )

    return {"ok": True, "count": len(postings), "postings": postings}


class handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: dict):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        if not _authorized(self.headers):
            self._send(401, {"ok": False, "error": "Unauthorized"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            payload = json.loads(raw or b"{}")
        except Exception as e:
            self._send(400, {"ok": False, "error": f"Invalid JSON body: {e}"})
            return
        try:
            result = _run(payload)
            self._send(200, result)
        except Exception as e:
            self._send(500, {"ok": False, "error": str(e)})

    def do_GET(self):
        # Health check only; scraping requires POST with a body + secret.
        self._send(200, {"ok": True, "service": "jobspy", "method": "POST"})
