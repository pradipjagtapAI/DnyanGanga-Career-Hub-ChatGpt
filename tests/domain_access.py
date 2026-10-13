"""Anonymous checks for the approved private domain; no credentials or user data.
Run: python -B tests/domain_access.py
Uses exact issued proxy IPs to avoid stale DNS while retaining normal TLS validation.
These checks do not test authenticated CSRF, identity continuity or cross-user access.
"""
from datetime import datetime, timezone
from pathlib import Path
import json
import shutil
import subprocess

BASE = "https://dolphincreation.com"
PRIMARY_IP = "162.159.143.30"
SECONDARY_IP = "172.66.3.26"
CHECKS = [
    ("private_home", "GET", "/", {}),
    ("private_api", "GET", "/api/career/state", {}),
    ("private_export", "GET", "/api/career/export", {}),
    ("private_file", "GET", "/api/career/resumes/domain-probe-NONREAL/download", {}),
    ("spoof_identity", "GET", "/dashboard", {
        "oai-authenticated-user-id": "domain-probe-NONREAL",
        "oai-authenticated-user-email": "domain-probe@example.invalid"}),
    ("spoof_identity_mixed_case", "GET", "/dashboard", {
        "OAI-Authenticated-User-ID": "domain-probe-NONREAL",
        "OAI-Authenticated-User-Email": "domain-probe@example.invalid"}),
    ("anonymous_mutation", "PUT", "/api/career/__domain_probe__", {
        "Origin": "https://example.invalid", "X-Career-Action": "1",
        "Content-Type": "application/json"}),
    ("cross_origin_read", "GET", "/api/career/state", {
        "Origin": "https://example.invalid"}),
]
SAFE_HEADERS = {"cache-control", "content-type", "access-control-allow-origin",
                "access-control-allow-credentials", "strict-transport-security",
                "x-content-type-options", "x-frame-options"}


def probe(curl, name, method, path, headers, address=PRIMARY_IP):
    args = [curl, "--silent", "--show-error", "--max-time", "12", "--resolve",
            f"dolphincreation.com:443:{address}", "--request", method,
            "--dump-header", "-", "--write-out", "\nPROBE_HTTP_STATUS:%{http_code}",
            BASE + path]
    for key, value in headers.items():
        args += ["--header", key + ": " + value]
    if method == "PUT":
        args += ["--data", "{}"]
    result = subprocess.run(args, capture_output=True, text=True, timeout=17)
    data, _, status = result.stdout.rpartition("\nPROBE_HTTP_STATUS:")
    head, separator, body = data.partition("\r\n\r\n")
    if not separator:
        head, _, body = data.partition("\n\n")
    observed = {}
    for line in head.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            if key.lower() in SAFE_HEADERS:
                observed[key.lower()] = value.strip()
    code = int(status.strip()) if status.strip().isdigit() else 0
    gated = code == 401 and ("sign in required" in body.lower() or "UNAUTHENTICATED" in body)
    cors_safe = not (observed.get("access-control-allow-origin") in
                    ["*", "https://example.invalid"] and
                    observed.get("access-control-allow-credentials", "").lower() == "true")
    passed = result.returncode == 0 and gated and cors_safe and "no-store" in observed.get("cache-control", "")
    return {"name": name, "method": method, "path": path, "proxy_ip": address,
            "status": code, "curl_exit": result.returncode, "private_gate": gated,
            "cors_credentials_not_exposed": cors_safe, "safe_headers": observed,
            "passed": passed, "error": result.stderr.strip()}


def main():
    curl = shutil.which("curl.exe") or shutil.which("curl")
    if not curl:
        raise SystemExit("curl is required; no checks executed")
    rows = [probe(curl, *check) for check in CHECKS]
    rows.append(probe(curl, "secondary_proxy_private_home", "GET", "/", {}, SECONDARY_IP))
    record = {"checked_at": datetime.now(timezone.utc).isoformat(), "domain": BASE,
              "routing": "Exact issued IPs; normal TLS validation; redirects not followed",
              "scope": "Anonymous native audience perimeter only; authenticated CSRF, identity continuity and cross-user ownership are untested. No cookies, bodies or candidate records saved.",
              "passed": all(row["passed"] for row in rows), "checks": rows}
    output = Path(__file__).resolve().parents[1] / "outputs" / "domain-private-access-2026-10-13.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"checked_at": record["checked_at"], "passed": record["passed"],
                      "checks": [{"name": row["name"], "status": row["status"],
                                  "passed": row["passed"]} for row in rows]}))
    raise SystemExit(0 if record["passed"] else 1)


if __name__ == "__main__":
    main()
