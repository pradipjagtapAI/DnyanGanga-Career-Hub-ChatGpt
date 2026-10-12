# Private document processor reference

This is deployable reference source, separate from the Sites web application. Its Linux containers, real ClamAV scan, PDF conversion and private connection have **not** been run in this workspace. Keep `DOCUMENT_PROCESSOR_APPROVED=false` until the operator deploys and independently verifies this boundary. Local unit tests use real bounded ZIP parsing and mocked scanner failures; they are not proof of malware detection.

The website accepts uploads only when private R2 storage, the `CAREER_DOCUMENT_PROCESSOR` service binding and the exact `DOCUMENT_PROCESSOR_APPROVED=true` flag are all present. Setting a flag without an approved processor is insufficient. Managed Sites currently provisions D1/R2; adding an arbitrary service binding must be supported by the hosting operator, or this capability stays disabled.

## Boundary and contract

The application sends `POST https://document-processor.internal/process` through the private service binding. Body is the unchanged document, at most 10 MiB; headers contain its PDF/DOCX MIME type, random document ID and SHA-256 digest. The binding targets `bridge.ts`, a Worker with `workers_dev=false`, `preview_urls=false` and no public routes. The bridge forwards only to its operator-configured protected HTTPS origin, with a server secret, no redirects and a 24-second deadline. User links and filenames never control the destination or filesystem paths.

The processor verifies its bearer secret, content length, digest, supported MIME, fresh local signatures and a private ClamAV result. It then runs conversion in a child limited to 8 CPU seconds, 256 MiB address space, 512 KiB output, 32 open files, no core dumps and a 10-second wall deadline. The converter container has no external network, an immutable filesystem, no Linux capabilities and 64 MiB temporary storage. ClamAV has a separate update network. Do not publish its unauthenticated TCP port.

An accepted JSON response has exactly:

```json
{"scanStatus":"clean","sha256":"same 64-character digest","parserVersion":"private-clamav-poppler-ooxml-v1","text":"selectable plain text","extracted":{"fields":{},"uncertainFields":["workHistory","education","skills","dates"],"notes":["Review extracted text"],"documentContacts":{}}}
```

The reference converter extracts readable text and copies recognized summary, experience, education, project, certification and skill sections into uncertain review fields. It does not infer employers, dates, achievements, qualifications or contacts; unlabeled fields remain unknown. A reviewed private replacement can improve extraction under the same validated contract. DOCX entries, paths, compression ratios, size, XML declarations, embedded objects and external template relationships are checked without extracting arbitrary ZIP paths. PDF active content/encryption is conservatively rejected. Plain-text preview is stored separately, with no HTML rendering. Only a successful scan allows owner-authorized attachment download of the unchanged original. No OCR is provided; image-only documents return a processing error.

The PDF envelope/active-name checks are conservative byte-pattern checks, **not a complete PDF object-graph parser**. Escaped names, compressed object streams, embedded actions and unusual malformed structures require independent scanner/parser verification. ClamAV acceptance is not a guarantee that an original document is harmless. Before enabling uploads, the operator must add or approve a maintained parser that inspects decoded/decompressed PDF objects and rejects executable/embedded actions, then run real adversarial PDF fixtures and verify the same bytes are scanned and downloaded. This remains a launch blocker for accepting real documents; the approval flag stays false by default. The plain-text preview itself never renders or executes original PDF content.

## Deploy and verify

1. On a dedicated Linux host, install maintained Docker/Compose. Put a random secret of at least 32 characters into `document-token.secret` through the host's secret manager. This file is git-ignored; never copy it into source, an image, browser code or logs.
2. From this directory run `docker compose build` then `docker compose up -d`. The example uses the official Python `3.14.8-slim-trixie` image and supported ClamAV feature tag `1.4`. Before production, resolve and pin reviewed image digests, run image vulnerability checks, and confirm the current supported ClamAV release. The package installation receives maintained Debian security updates on rebuild.
3. Wait for real signature download and scanner readiness. Keep signatures updated, alert on scanner failures or daily database older than 48 hours, and permit signature-update egress only to approved ClamAV endpoints. Processor parsing has no egress. Container memory/process limits must actually be enforced by the host.
4. Terminate HTTPS at a private authenticated tunnel or mesh gateway to host-only `127.0.0.1:8088`. Retain bearer authentication and restrict ingress to the private bridge. Store the same secret as the bridge's `DOCUMENT_PROCESSOR_TOKEN` Worker secret, and configure `DOCUMENT_PROCESSOR_ORIGIN` server-side. Protect infrastructure accounts with individual access and MFA.
5. Deploy the private bridge with the supplied Wrangler config; attach it to the web worker as `CAREER_DOCUMENT_PROCESSOR`. Confirm the hosting operator supports this binding. Do not expose a public Worker route.
6. In an authorized environment, test an actual PDF and DOCX, escaped PDF names/compressed object streams/embedded actions, encrypted and corrupt documents, macros, ZIP bombs, external template relationships, the standard harmless EICAR test fixture, missing/outdated signatures, timeout/resource exhaustion, wrong secrets, wrong digests, interrupted storage/database operations and deletion during processing. Verify temporary files disappear and document contents are absent from logs. Test original attachment bytes against their SHA-256 digest.
7. Enable the approval flag only after those checks and independent review. Roll back by disabling the flag; existing safe originals remain owner-protected. Failed/abandoned quarantines require an operator cleanup job that reconciles R2 objects against owned database records; lifecycle policies alone must not delete active clean originals. Keep processing audit metadata without document bodies.

The processor's one-at-a-time HTTP service provides a bounded reference rather than measured production throughput. Scale isolated instances with controlled concurrency and a durable queue after real load testing. End-to-end container runtime, tunnel configuration, service binding and scanning evidence remain launch dependencies.

## Repeat local policy tests

From this directory: `python -B -m unittest test_processor.py`.

These tests exercise real DOCX text extraction, traversal/macros/XML entity/external-template rejection, decompression limits and fail-closed scanner/hash ordering. The Linux resource limits and actual scanner are untested on this Windows host.

Primary documentation reviewed on 2026-10-12: [Cloudflare private service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/), [R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [ClamAV scanning](https://docs.clamav.net/manual/Usage/Scanning.html), [ClamAV Docker operation](https://docs.clamav.net/manual/Installing/Docker.html), [Python ZIP handling](https://docs.python.org/3.14/library/zipfile.html), [Linux resource limits](https://docs.python.org/3.14/library/resource.html), [official Python image tags](https://hub.docker.com/_/python).
