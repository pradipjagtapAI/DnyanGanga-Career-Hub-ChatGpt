"""Bounded anonymous hosted acceptance; no credentials or real cookies.

Uses normal DNS and the Python TLS trust store. No redirect is followed and no
certificate verification is disabled. Response bodies never enter evidence.
Private 2xx responses stop all further probes without reading their bodies.
Run only after the approved public-access transition:
  python -B tests/admin_hosted_access.py --execute
Without --execute this prints the request plan without network activity.
"""
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit, parse_qs
from urllib.request import Request, build_opener, HTTPSHandler, HTTPRedirectHandler, ProxyHandler
import argparse
import json
import ssl
import sys

APEX = "https://dolphincreation.com"
ALIAS = "https://dolphin-career-studio.livelymelon2.chatgpt.site"
NONREAL_ID = "00000000-0000-4000-8000-000000000099"
FAKE_COOKIE = "__Secure-career_admin_session=nonreal-hosted-probe.not-a-valid-signature"
SPOOF_LOWER = {"oai-authenticated-user-id": "hosted-probe-NONREAL", "oai-authenticated-user-email": "hosted-probe@example.invalid"}
SPOOF_MIXED = {"OAI-Authenticated-User-ID": "hosted-probe-NONREAL", "OAI-Authenticated-User-Email": "hosted-probe@example.invalid"}
REDIRECTS = {301, 302, 303, 307, 308}
SAFE_CODES = {"UNAUTHENTICATED", "ADMIN_SIGN_IN_REQUIRED", "ADMIN_ORIGIN_REJECTED", "CSRF_REJECTED", "INVALID_ORIGIN", "INVALID_REQUEST", "INVALID_CALLBACK", "CALLBACK_NOT_CONFIGURED", "INVALID_SIGNATURE", "DATABASE_UNAVAILABLE", "ADMIN_ROUTE_DISABLED"}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def plan():
    checks = []
    def add(name, origin, path, kind, method="GET", headers=None, data=None):
        checks.append({"name": name, "origin": origin, "path": path, "kind": kind, "method": method, "headers": headers or {}, "data": data})
    add("public_home", APEX, "/", "public")
    add("public_admin_login", APEX, "/admin/login", "public")
    add("dashboard_login_redirect", APEX, "/dashboard", "dashboard")
    add("temporary_ownership_disabled", APEX, "/admin/ownership", "not_found")
    add("internal_better_auth_not_routed", APEX, "/api/admin-auth-internal/sign-in/email", "not_found")
    for name, path in [
        ("private_state", "/api/career/state"),
        ("private_export", "/api/career/export"),
        ("private_platform_state", "/api/career/platform/state"),
        ("private_agent_state", "/api/career/agents/state"),
        ("private_document_preview", f"/api/career/documents/{NONREAL_ID}/preview"),
        ("private_document_original", f"/api/career/documents/{NONREAL_ID}/original"),
        ("private_resume_download", f"/api/career/resumes/{NONREAL_ID}/download?format=txt"),
        ("private_generated_download", f"/api/career/generated-documents/{NONREAL_ID}/download?format=txt"),
        ("private_application_package_download", f"/api/career/agents/packages/{NONREAL_ID}/download"),
    ]:
        add(name, APEX, path, "career_denied")
    add("private_admin_health", APEX, "/api/admin/health", "admin_denied")
    add("anonymous_admin_status", APEX, "/api/admin/auth/status", "status")
    add("fake_cookie_not_authenticated", APEX, "/api/career/state", "career_denied", headers={"Cookie": FAKE_COOKIE})
    add("spoof_native_lower_case", APEX, "/api/career/state", "career_denied", headers={**SPOOF_LOWER, "Cookie": FAKE_COOKIE})
    add("spoof_native_mixed_case", APEX, "/api/career/state", "career_denied", headers=SPOOF_MIXED)
    add("cross_origin_private_read", APEX, "/api/career/state", "career_denied", headers={"Origin": "https://example.invalid"})
    add("admin_wrong_origin_rejected", APEX, "/api/admin/auth/sign-in", "csrf_denied", "POST", {"Origin": "https://example.invalid", "Content-Type": "application/json", "X-Career-Action": "1"}, b"{}")
    add("admin_missing_action_header_rejected", APEX, "/api/admin/auth/sign-in", "csrf_denied", "POST", {"Origin": APEX, "Content-Type": "application/json"}, b"{}")
    add("empty_unsigned_resend_callback", APEX, "/api/career/callbacks/resend", "unsigned_callback", "POST", {"Content-Type": "application/json"}, b"")
    add("empty_unsigned_whatsapp_callback", APEX, "/api/career/callbacks/whatsapp", "unsigned_callback", "POST", {"Content-Type": "application/json"}, b"")
    add("whatsapp_verification_without_token", APEX, "/api/career/callbacks/whatsapp", "callback_verify")
    add("private_document_upload_without_account", APEX, "/api/career/documents/upload", "career_denied", "POST", {"Origin": APEX, "Content-Type": "application/pdf", "X-Career-Action": "1", "X-Career-Filename": "NONREAL-probe.pdf"}, b"")
    add("alias_public_home", ALIAS, "/", "alias_public")
    add("alias_login_canonical_redirect", ALIAS, "/admin/login", "canonical")
    add("alias_dashboard_login_redirect", ALIAS, "/dashboard", "dashboard")
    add("alias_ownership_disabled", ALIAS, "/admin/ownership", "not_found")
    add("alias_private_state", ALIAS, "/api/career/state", "career_denied")
    add("alias_spoof_native_and_fake_cookie", ALIAS, "/api/career/state", "career_denied", headers={**SPOOF_MIXED, "Cookie": FAKE_COOKIE})
    add("alias_admin_origin_rejected", ALIAS, "/api/admin/health", "alias_admin_denied")
    add("alias_internal_auth_not_routed", ALIAS, "/api/admin-auth-internal/sign-in/email", "not_found")
    return checks


def safe_location(origin, path, value):
    try:
        resolved = urlsplit(urljoin(origin + path, value))
        target_origin = f"{resolved.scheme}://{resolved.netloc}"
        allowed = target_origin in {APEX, ALIAS} and not resolved.username and not resolved.password
        return {"known_origin": allowed, "origin": target_origin if allowed else "unapproved", "path": resolved.path if allowed else "unapproved", "dashboard_return": parse_qs(resolved.query).get("return_to") == ["/dashboard"]}
    except (ValueError, TypeError):
        return {"known_origin": False, "origin": "invalid", "path": "invalid", "dashboard_return": False}


def probe(opener, check):
    req = Request(check["origin"] + check["path"], data=check["data"], headers={"User-Agent": "DnyanGanga-Bounded-Anonymous-Acceptance/1", **check["headers"]}, method=check["method"])
    row = {"name": check["name"], "origin": check["origin"], "path": check["path"], "method": check["method"], "status": 0, "error_code": None, "passed": False}
    reply = None
    try:
        try:
            reply = opener.open(req, timeout=15)
        except HTTPError as error:
            reply = error
        status = reply.code
        headers = reply.headers
        row["status"] = status
        cache = headers.get("Cache-Control", "").lower()
        cors_origin = headers.get("Access-Control-Allow-Origin", "")
        cors_credentials = headers.get("Access-Control-Allow-Credentials", "").lower()
        csp = headers.get("Content-Security-Policy", "")
        row["headers"] = {
            "no_store": "no-store" in cache,
            "no_cross_origin_allowance": cors_origin == "",
            "credentialed_cors_not_exposed": not (cors_origin in {"*", "https://example.invalid"} and cors_credentials == "true"),
            "nosniff": headers.get("X-Content-Type-Options", "").lower() == "nosniff",
            "frame_denied": headers.get("X-Frame-Options", "").upper() == "DENY" and "frame-ancestors 'none'" in csp,
            "hsts": "max-age=" in headers.get("Strict-Transport-Security", ""),
            "csp_object_denied": "object-src 'none'" in csp,
        }
        private = check["kind"] in {"career_denied", "admin_denied", "alias_admin_denied"}
        if private and 200 <= status < 300:
            row["critical_private_2xx"] = True
            row["body_read"] = False
            return row
        data = None
        if "application/json" in headers.get("Content-Type", "") and status >= 400 or check["kind"] == "status":
            raw = reply.read(8193)
            if len(raw) <= 8192:
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict):
                        data = parsed
                        row["error_code"] = parsed.get("code") if parsed.get("code") in SAFE_CODES else None
                except (ValueError, UnicodeDecodeError):
                    pass
        kind = check["kind"]
        location = safe_location(check["origin"], check["path"], headers.get("Location", "")) if status in REDIRECTS else None
        if location:
            row["redirect"] = location
        if kind in {"public", "alias_public"}:
            accepted = status == 200 or kind == "alias_public" and status in REDIRECTS and location["origin"] == APEX and location["path"] == "/"
        elif kind == "dashboard":
            accepted = status in REDIRECTS and location["known_origin"] and location["path"] == "/admin/login" and location["dashboard_return"]
        elif kind == "canonical":
            accepted = status in REDIRECTS and location["origin"] == APEX and location["path"] == "/admin/login"
        elif kind == "not_found":
            accepted = status == 404
        elif kind == "career_denied":
            accepted = status == 401 and row["error_code"] == "UNAUTHENTICATED"
        elif kind == "admin_denied":
            accepted = status == 401 and row["error_code"] == "ADMIN_SIGN_IN_REQUIRED"
        elif kind == "alias_admin_denied":
            accepted = status == 403 and row["error_code"] == "ADMIN_ORIGIN_REJECTED"
        elif kind == "csrf_denied":
            accepted = status == 403
        elif kind == "unsigned_callback":
            accepted = status in {400, 403, 503} and row["error_code"] in {"INVALID_CALLBACK", "INVALID_SIGNATURE", "CALLBACK_NOT_CONFIGURED", "DATABASE_UNAVAILABLE"}
        elif kind == "callback_verify":
            accepted = status == 403 and row["error_code"] == "INVALID_CALLBACK"
        elif kind == "status":
            accepted = status == 200 and data is not None and data.get("configured") is True and data.get("setupAvailable") is False and data.get("stage") == "signed_out" and data.get("admin") is None
            row["anonymous_status_expected"] = accepted
        else:
            accepted = False
        row["passed"] = accepted and all(row["headers"].values())
        return row
    except (URLError, TimeoutError, OSError, ValueError):
        row["transport_error"] = "DNS_TLS_OR_TRANSPORT_FAILURE"
        return row
    finally:
        if reply is not None:
            reply.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="Run only after the approved public-access transition")
    args = parser.parse_args()
    checks = plan()
    if not args.execute:
        print(json.dumps({"prepared": True, "network_requests": 0, "planned_requests": len(checks), "planned_mutations": sum(c["method"] != "GET" for c in checks), "checks": [{k: c[k] for k in ("name", "origin", "path", "method")} for c in checks]}, indent=2))
        return 0
    opener = build_opener(ProxyHandler({}), HTTPSHandler(context=ssl.create_default_context()), NoRedirect())
    rows = []
    critical = False
    for check in checks:
        row = probe(opener, check)
        rows.append(row)
        print(json.dumps({"name": row["name"], "status": row["status"], "error_code": row["error_code"], "passed": row["passed"], "critical_private_2xx": row.get("critical_private_2xx", False)}), flush=True)
        if row.get("critical_private_2xx"):
            critical = True
            break
    record = {"checked_at": datetime.now(timezone.utc).isoformat(), "normal_dns_and_verified_tls": True, "credentials_used": False, "real_cookies_used": False, "redirects_followed": False, "response_bodies_saved": False, "passed": len(rows) == len(checks) and all(row["passed"] for row in rows), "critical_private_2xx": critical, "completed_requests": len(rows), "planned_requests": len(checks), "limitations": "Anonymous boundary only. No authenticated CSRF, user ownership, preserved-data continuity, MFA, provider delivery, or production password-hash CPU measurement. Parent performs authenticated browser acceptance separately.", "checks": rows}
    output = Path(__file__).resolve().parents[1] / "outputs" / "admin-hosted-access.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": record["passed"], "critical_private_2xx": critical, "completed_requests": len(rows), "results_file": str(output)}), flush=True)
    return 2 if critical else 0 if record["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())

