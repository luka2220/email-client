## Baseline

**Goal:** Have a safe, reproducible environment to experiment with SMTP.

**Environment**

- Create a new Node.js project workspace (any manager: npm/pnpm/yarn).
- Pick an editor with debugger support (VS Code recommended).
- Install local testing tools:
  - **MailHog** or **GreenMail** (local SMTP server that captures mail)
  - Optional: **Ethereal Email** account for remote testing

**Outputs**

- Project checklist document (what tools you’ll use, versions, how to start/stop test servers)
- Personal glossary (SMTP, EHLO, STARTTLS, AUTH, MIME, envelope vs. headers)

---

## SMTP Core & Message Format

**Goal:** Understand SMTP dialogue and email structure end-to-end.

**Concepts**

- SMTP conversation: banner → `EHLO/HELO` → `MAIL FROM` → `RCPT TO` → `DATA` → `QUIT`
- Status codes (2xx, 3xx, 4xx, 5xx) and enhanced status codes (RFC 3463)
- Internet Message Format (RFC 5322): headers vs. body, folding, line length limits
- MIME basics: multipart/mixed, text/plain, text/html, attachments (at a high level)

**Exercises (no code)**

- Using a terminal mail tool (e.g., `telnet`/`nc`) **simulate** an SMTP session **by hand** against MailHog/GreenMail:
  - Read the server banner; note capabilities after `EHLO`.
  - Walk through a complete delivery for a simple text message.
  - Intentionally trigger common errors (bad recipient, missing `DATA` terminator, etc.) and record server replies.
- Draft a message blueprint document:
  - List required headers for a minimal email (Date, From, To, Subject, Message-ID, MIME-Version, Content-Type)
  - Define rules you must follow (CRLF, dot-stuffing awareness, 7-bit lines)

**References**

- RFC 5321 (SMTP), RFC 5322 (Internet Message Format)
- Postmark SMTP Guide (overview)

**Outputs**

- A written SMTP dialogue transcript with annotations of each step and status code
- A message format checklist (headers you will always set, validation rules)

---

## Security & Authentication

**Goal:** Understand how to secure SMTP connections and authenticate.

**Concepts**

- **STARTTLS** (RFC 3207): upgrading a plain TCP connection to TLS
- Submission ports: 25 vs 587 vs 465 (implicit TLS) — differences and when to use which
- SMTP AUTH (RFC 4954): mechanisms (PLAIN, LOGIN, CRAM-MD5, XOAUTH2 at a high level)
- Credential handling: secrets storage, environment variables, and OS keychain

**Exercises (no code)**

- Write a decision matrix for connection modes you will support: STARTTLS on 587, implicit TLS on 465
- Map provider requirements (Gmail, Outlook, custom IMAP/SMTP): which ports, which AUTH, whether app passwords/OAuth2 are needed
- Design a **secrets strategy** for a desktop client:
  - Which values must live in the OS keychain (never in plaintext)?
  - Which values are ephemeral (access tokens) and can be memory-only?

**References**

- RFC 3207 (STARTTLS), RFC 4954 (AUTH)
- Provider docs (Gmail SMTP submission, Microsoft 365 SMTP AUTH)

**Outputs**

- Security policy document: ports, TLS requirements, supported AUTH mechanisms, secret storage policy

---

## Robustness, Queues, and Deliverability

**Goal:** Move from “can send a message” to “reliable client that users trust.”

**Concepts**

- Connection pooling, timeouts, retries with exponential backoff and jitter
- Outbox queue: pending → sending → sent → failed (with reason)
- Error taxonomy: network errors, TLS handshake errors, transient vs. permanent SMTP codes
- Deliverability basics (SPF/DKIM/DMARC are server-side, but understand their impact on testing)

**Exercises (no code)**

- Define a state machine for the **Outbox** (include transitions, retry ceilings, and circuit-breaker conditions)
- Draft an error catalog with stable error codes/messages you will surface to the UI
- Design a logging schema (fields: timestamp, level, module, correlation id, smtp status code, remote host)

**References**

- RFC 3463 (Enhanced status codes)
- Queueing patterns (idempotency, at-least-once vs. at-most-once semantics)

**Outputs**

- Outbox design doc (states, persistence, reconciliation rules)
- Error taxonomy + logging schema

---

## Integration & UX (Desktop Client)

**Goal:** Integrate SMTP sending into an Electron desktop app safely.

**Concepts**

- Electron boundaries: main vs. preload vs. renderer; minimal IPC surface
- Input validation at the boundary (schema-based); no secrets in renderer
- Attachment handling: safe filenames, size caps, streaming/downloading policies
- Drafts: autosave locally; only send on explicit action

**Exercises (no code)**

- Define the **preload API contract** for mail send:
  - `mail.send({ accountId, to, cc?, bcc?, subject, text?, html?, attachments? })`
  - Input constraints (non-empty recipients, max recipients, max subject length, attachment limits)
- Write an end-to-end manual test plan:
  - Happy path (single recipient, small body)
  - Multiple recipients + attachments
  - TLS failure → retry/backoff → user-visible error
  - Auth failure → re-auth flow

**Outputs**

- IPC contract document (types, constraints, error codes)
- Test plan with acceptance criteria

---

## Stretch Topics (Optional)

- **XOAUTH2** for Gmail/Microsoft: desktop OAuth flow, token refresh cadence
- **Internationalization**: IDN emails, UTF-8 headers (RFC 6532), 8BITMIME
- **MIME tooling choices**: builder vs. templating, inline images (Content-ID)
- **Rate limiting**: provider-specific quotas; queue pacing
- **Telemetry**: diagnostic mode toggle that redacts PII

---

## Reference Checklist (Quick) — No Code

- [ ] You can explain each SMTP step and typical status codes
- [ ] You can list the minimal RFC 5322 headers and when to use MIME
- [ ] You know when to use 587+STARTTLS vs 465 implicit TLS
- [ ] You picked AUTH mechanisms and a secrets storage policy
- [ ] You have an Outbox state machine with retry/backoff rules
- [ ] You defined an IPC contract and validation rules for a desktop app
- [ ] You have a manual test plan covering happy paths and failures

---

## Useful Resources (Read-Only)

- RFC 5321 — Simple Mail Transfer Protocol
- RFC 5322 — Internet Message Format
- RFC 3207 — SMTP Service Extension for Secure SMTP over TLS (STARTTLS)
- RFC 4954 — SMTP Service Extension for Authentication
- RFC 3463 — Enhanced Mail System Status Codes
- Postmark SMTP Guide (overview)
- MailHog / GreenMail (local servers for testing)
- Ethereal Email (fake SMTP service for dev/testing)

---

### Final Notes

This roadmap avoids code on purpose so you focus on _what_ to build and _why_. When you’re ready to implement, start with a tiny, single-message send against a local SMTP server, then layer on TLS, AUTH, and the Outbox. Keep your secrets in the OS keychain and your UI free of direct network access.
