"""Private reference processor. No public scanner or document-content logging.

Linux container deployment is required for resource limits and the isolated parser.
The default extraction emits plain text only; career facts remain unknown for review.
"""
import hashlib
import hmac
import io
import json
import os
from pathlib import Path
import re
import socket
import struct
import subprocess
import sys
import tempfile
import time
import zipfile
from http.server import BaseHTTPRequestHandler, HTTPServer
import xml.etree.ElementTree as ET

MAX_FILE = 10 * 1024 * 1024
MAX_EXPANDED = 50 * 1024 * 1024
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
POLICY_VERSION = "private-clamav-poppler-ooxml-v1"


def extract_labeled_fields(text):
    """Copy recognizable source sections; never synthesize missing career facts."""
    headings = {"summary": "summary", "professional summary": "summary", "career summary": "summary",
                "experience": "workHistory", "work experience": "workHistory", "employment history": "workHistory",
                "education": "education", "projects": "projects", "certifications": "certifications", "skills": "skills", "technical skills": "skills"}
    sections = {}
    current = None
    for raw in text.splitlines():
        line = raw.strip()
        heading = line.lower().strip(":")
        if heading in headings:
            current = headings[heading]
            sections.setdefault(current, [])
        elif current and line:
            sections[current].append(line)
    fields = {}
    for key, lines in sections.items():
        if key == "skills":
            values = [value.strip(" •-\t") for value in re.split(r"[,;|\n]", "\n".join(lines))]
            fields[key] = list(dict.fromkeys(value for value in values if value and len(value) <= 120))[:50]
        else:
            fields[key] = "\n".join(lines)[:10000]
    return fields


def extract_docx(data):
    """Runs in a resource-limited child. ZIP paths are never extracted to disk."""
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        if not 3 <= len(entries) <= 2000:
            raise ValueError("archive count")
        names = set()
        expanded = 0
        for entry in entries:
            name = entry.filename
            if name in names or "\\" in name or name.startswith("/") or any(p in (".", "..") for p in name.split("/")):
                raise ValueError("archive path")
            if re.search(r"vbaProject|activeX|embeddings|\.(exe|dll|js|vbs|bat|cmd|bin)$", name, re.I):
                raise ValueError("active content")
            if entry.flag_bits & 1 or entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                raise ValueError("unsupported compression")
            expanded += entry.file_size
            if expanded > MAX_EXPANDED or entry.file_size > max(1024 * 1024, entry.compress_size * 100):
                raise ValueError("decompression limit")
            names.add(name)
        if not {"[Content_Types].xml", "_rels/.rels", "word/document.xml"}.issubset(names):
            raise ValueError("not OOXML")
        for name in names:
            if name.endswith(".xml") or name.endswith(".rels"):
                raw = archive.read(name)  # CRC is verified by ZipFile.
                if re.search(rb"<!DOCTYPE|<!ENTITY|macroEnabled|vbaProject|oleObject|attachedTemplate", raw, re.I):
                    raise ValueError("unsafe XML")
                if name.endswith(".rels"):
                    relations = ET.fromstring(raw)
                    for relation in relations:
                        if relation.attrib.get("TargetMode", "").lower() == "external" and "hyperlink" not in relation.attrib.get("Type", "").lower():
                            raise ValueError("external object")
        root = ET.fromstring(archive.read("word/document.xml"))
        paragraphs = []
        for paragraph in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
            paragraphs.append("".join(node.text or "" for node in paragraph.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t")))
        return "\n".join(paragraphs).strip()


def child_limits():
    import resource
    resource.setrlimit(resource.RLIMIT_CPU, (8, 8))
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_FSIZE, (512 * 1024, 512 * 1024))
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def scan_private(data):
    # ClamD TCP is deliberately reachable only on the private Docker network.
    # It provides no authentication itself; never publish port 3310.
    with socket.create_connection(("scanner", 3310), timeout=8) as client:
        client.settimeout(8)
        client.sendall(b"zINSTREAM\0")
        for offset in range(0, len(data), 65536):
            chunk = data[offset:offset + 65536]
            client.sendall(struct.pack("!I", len(chunk)) + chunk)
        client.sendall(struct.pack("!I", 0))
        result = bytearray()
        while len(result) < 4096:
            chunk = client.recv(512)
            if not chunk:
                break
            result.extend(chunk)
            if b"\0" in chunk:
                break
        if bytes(result).rstrip(b"\0\n") != b"stream: OK":
            raise ValueError("scan did not verify clean")


def ensure_fresh_signatures():
    daily = [p for p in Path("/signatures").glob("daily.*") if p.suffix in (".cvd", ".cld")]
    if not daily or time.time() - max(p.stat().st_mtime for p in daily) > 48 * 3600:
        raise ValueError("scanner signatures unavailable or stale")


def process(data, mime, expected_hash):
    digest = hashlib.sha256(data).hexdigest()
    if not hmac.compare_digest(digest, expected_hash):
        raise ValueError("hash mismatch")
    if not 0 < len(data) <= MAX_FILE or mime not in ("application/pdf", DOCX):
        raise ValueError("unsupported input")
    ensure_fresh_signatures()
    scan_private(data)  # Clean is required before any converter opens the file.
    with tempfile.TemporaryDirectory(prefix="career-") as directory:
        source = Path(directory) / "source"
        output = Path(directory) / "preview.txt"
        source.write_bytes(data)
        if mime == "application/pdf":
            if not data.startswith(b"%PDF-") or re.search(rb"/(Encrypt|JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|XFA)\b", data):
                raise ValueError("unsafe PDF")
            command = ["pdftotext", "-layout", "-enc", "UTF-8", str(source), str(output)]
        else:
            command = [sys.executable, "-I", str(Path(__file__).resolve()), "--extract-docx", str(source), str(output)]
        completed = subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10, check=False, preexec_fn=child_limits, env={"PATH": "/usr/local/bin:/usr/bin:/bin", "LANG": "C.UTF-8"})
        if completed.returncode != 0 or not output.exists() or output.stat().st_size > 240000:
            raise ValueError("conversion failed")
        text = output.read_text(encoding="utf-8").strip()
        if not text or len(text) > 60000:
            raise ValueError("empty, scanned-only, or too large text")
        fields = extract_labeled_fields(text)
        return {"scanStatus": "clean", "sha256": digest, "parserVersion": POLICY_VERSION, "text": text,
                "extracted": {"fields": fields, "uncertainFields": list(dict.fromkeys([*fields, "workHistory", "education", "skills", "dates"])),
                              "notes": ["Recognized section text is copied without interpreting employers, dates, qualifications or achievements. Review every field; section boundaries may be uncertain and fields are capped at 10,000 characters. Contacts are not inferred."], "documentContacts": {}}}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass  # Neither tokens nor document content are logged.

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def reply(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True

    def do_POST(self):
        token = Path("/run/secrets/document_token").read_text().strip()
        if len(token) < 32 or not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + token):
            return self.reply(403, {"error": "unauthorized"})
        try:
            if self.path != "/process" or self.headers.get("Transfer-Encoding"):
                raise ValueError("invalid route or encoding")
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_FILE:
                raise ValueError("invalid length")
            digest = self.headers.get("X-Document-SHA256", "")
            if not re.fullmatch(r"[a-f0-9]{64}", digest):
                raise ValueError("invalid digest")
            data = self.rfile.read(length)
            if len(data) != length:
                raise ValueError("incomplete body")
            return self.reply(200, process(data, self.headers.get("Content-Type", ""), digest))
        except (ValueError, OSError, ET.ParseError, zipfile.BadZipFile, subprocess.SubprocessError):
            return self.reply(422, {"error": "document_checks_failed"})


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--extract-docx":
        Path(sys.argv[3]).write_text(extract_docx(Path(sys.argv[2]).read_bytes()), encoding="utf-8")
    else:
        if sys.platform != "linux":
            raise SystemExit("Use the isolated Linux container; resource limits are required.")
        if not Path("/run/secrets/document_token").exists():
            raise SystemExit("A private processor secret is required.")
        HTTPServer(("0.0.0.0", 8088), Handler).serve_forever()
