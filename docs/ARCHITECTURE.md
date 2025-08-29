# ARCHITECTURE.md

## 1) Overview
A privacy‑first desktop email client built with **Electron** + **TypeScript**. The app is split into three parts:
- **Main process** (Node.js): privileged code (mail protocols, auth, filesystem, keychain, database, background work).
- **Preload**: a narrow, validated bridge that exposes safe, minimal APIs to the UI via `contextBridge`.
- **Renderer** (Vite + React/Tailwind): the UI; no direct access to secrets or Node APIs.

Goals: keep credentials out of the renderer, cache locally for speed/offline, and make all network work deterministic and retryable.

---

## 2) Responsibility Boundaries

### Main (`src/electron/`)
- App lifecycle (windows, menus, updates, notifications).
- **Mail I/O**: SMTP send, IMAP (or provider API) fetch/sync; queues for outbox.
- **Auth**: OAuth2 (Gmail/Outlook) or basic auth; token refresh and expiry handling.
- **Secrets**: store/lookup in OS keychain (via `keytar` wrapper) — never expose to renderer.
- **Storage**: SQLite database and attachments on disk.
- **Background jobs**: periodic sync, backoff/retry, housekeeping.
- **Logging**: structured logs, redaction of secrets.

### Preload (`src/electron/preload.ts`)
- Validates arguments and shapes payloads.
- Exposes **versioned**, minimal IPC APIs (e.g., `mail.send`, `mail.listMailbox`).
- No secrets or direct network access.

### Renderer (`src/ui/…`)
- Presentation (mailbox list, thread list, message view, composer, search, settings).
- Calls preload APIs; responds to events (new mail, network state).
- Never reads secrets or filesystem directly.

---

## 3) Suggested Project Layout

```
src/
  electron/
    main.ts
    preload.ts
    ipc/
      mail.ts            # ipcMain handlers: send, list, getMessage, search, flags
      account.ts         # ipcMain handlers: add/remove/status, auth flows
    services/
      smtp.ts            # sending mail (and outbox queue)
      imap.ts            # mailbox sync (headers, flags, bodies on demand)
      auth.ts            # OAuth2/basic; token refresh; provider configs
      storage.ts         # SQLite access + migrations + FTS search
      attachments.ts     # download/save/open attachments; path mgmt
      keychain.ts        # OS keychain (keytar) wrapper
    utils/
      logger.ts          # pino-like logger with redaction
      net.ts             # retry/backoff helpers, timeouts
      schema.ts          # zod validators for IPC payloads
  ui/
    ...
```

---

## 4) Data Model (SQLite outline)

> Use **SQLite** with **FTS5** for message search. Attachments are files on disk; DB stores metadata and paths.
> Secrets (passwords, OAuth refresh tokens) live in the OS keychain, not in SQLite.

### Tables

- **accounts**
  - `id` (PK, string/uuid)
  - `email` (text, unique within provider)
  - `provider` (text: `imap`, `gmail-api`, `outlook-api`, …)
  - `display_name` (text, nullable)
  - `auth_kind` (text: `oauth2`, `basic`)
  - `created_at`, `updated_at` (iso8601)
  - **No secrets**; reference to keychain entry via `key_id` (text)

- **mailboxes**
  - `id` (PK)
  - `account_id` (FK -> accounts.id)
  - `name` (text, e.g., `INBOX`, `Sent`, or full path for IMAP nested boxes)
  - `uid_validity` (int, IMAP)
  - `last_uid_synced` (int, IMAP high-water mark)
  - `total_count`, `unread_count` (ints, optional cached values)
  - `created_at`, `updated_at`

- **messages**
  - `id` (PK) — internal id
  - `account_id` (FK)
  - `mailbox_id` (FK)
  - `uid` (int, IMAP UID)
  - `message_id` (text, RFC Message-ID)
  - `thread_id` (text, provider/threading key if available)
  - `subject` (text), `from_addr` (text), `to_addrs` (text), `cc_addrs` (text)
  - `date` (int/iso)
  - `flags` (json: seen, flagged, answered, archived, deleted)
  - `snippet` (text) — short preview
  - `has_html` (bool), `has_text` (bool), `has_attachments` (bool)
  - Unique index: (`account_id`,`mailbox_id`,`uid`)

- **message_bodies**
  - `message_id` (FK -> messages.id)
  - `mime_plain` (text, nullable)
  - `mime_html` (text, nullable, sanitized before rendering)
  - Index: `message_id`

- **attachments**
  - `id` (PK)
  - `message_id` (FK)
  - `filename` (text), `mime_type` (text), `size_bytes` (int)
  - `path` (text) — absolute path under app data dir
  - `downloaded_at` (iso), `checksum` (text, optional)

- **outbox**
  - `id` (PK)
  - `account_id` (FK)
  - `to`, `cc`, `bcc` (text)
  - `subject` (text), `text_body` (text), `html_body` (text)
  - `attachments` (json array of file refs)
  - `status` (text: queued, sending, sent, failed)
  - `last_error` (text), `retry_count` (int), `updated_at`

- **fts_messages** (FTS5 virtual table)
  - `docid` = messages.id
  - `subject`, `from_addr`, `to_addrs`, `cc_addrs`, `body_text`
  - Triggers to keep in sync with `messages` and `message_bodies`

### Attachment storage on disk
```
~/Library/Application Support/YourApp/attachments/<account>/<mailbox>/<messageId>/<filename>
```
- Ensure safe filenames, prevent path traversal, and allow “Reveal in Finder/Explorer” from main.

---

## 5) IPC API (preload → main)

> All IPC requests are validated (e.g., with zod) in **preload** and forwarded via `ipcRenderer.invoke`. Main implements handlers via `ipcMain.handle`.

**Mail**
- `mail.listMailbox({ mailboxId, page, pageSize }) -> { messages, nextPage }`
- `mail.getMessage({ id }) -> { headers, body, attachments }`
- `mail.search({ query, mailboxId? }) -> { messages }`
- `mail.send({ accountId, to, cc?, bcc?, subject, text?, html?, attachments? }) -> { messageId }`
- `mail.setFlag({ messageId, flag, value }) -> { ok }`
- `mail.move({ messageId, fromMailboxId, toMailboxId }) -> { ok }` (optional)

**Account**
- `account.add({ provider, email, authKind }) -> { accountId }` (kicks off OAuth/basic flow in main)
- `account.remove({ accountId }) -> { ok }`
- `account.status({ accountId }) -> { connected, lastSync }`

**Events (via `ipcRenderer.on`)**
- `mail:new` (payload: mailboxId, messageIds[])
- `sync:state` (payload: accountId, state: idle/syncing/error, details)
- `auth:state` (payload: accountId, state: connected/expired/error)

Channel names and payloads should be **versioned** (e.g., prefix `v1/…`).

---

## 6) Authentication

- **OAuth2** for Gmail/Outlook:
  - Launch an auth BrowserWindow from main with PKCE.
  - Handle redirect, exchange code → tokens in main.
  - Store refresh token in **keychain**; keep only non-secret metadata in SQLite.
  - Background refresh when needed; emit `auth:state` on changes.

- **Basic auth** (custom IMAP/SMTP):
  - Store credentials in keychain; never in SQLite or renderer memory.
  - Consider app-level encryption if local policy requires it.

---

## 7) Sync Strategy

- **Initial sync**: recent window (e.g., last 30–90 days) — headers only first for fast first load.
- **Incremental sync**: IDLE/NOOP (IMAP) or polling; track `UIDVALIDITY`, `UIDNEXT`, `HIGHESTMODSEQ` if available.
- **Bodies on demand**: fetch and cache when opening a message; sanitize HTML before rendering.
- **Flags reconciliation**: queue local changes and apply server-side; resolve conflicts (server usually wins for flags; client for unsent drafts).
- **Backoff**: exponential with jitter; cap retries; persist last error for UX.

---

## 8) Security

- Renderer sandboxed: `nodeIntegration: false`, `contextIsolation: true`.
- Strictly **whitelist** IPC channels; validate inputs; no dynamic eval.
- **Secrets in keychain** only; redact logs.
- Sanitize message HTML; block remote content by default; strict CSP in message viewer.
- Safe file paths for attachments; no arbitrary disk writes without user intent.

---

## 9) Logging & Diagnostics

- Structured logs in main with levels (debug/info/warn/error).
- Include module name, accountId (when relevant), error code.
- Rolling files under app data dir; user action to “Copy diagnostics” for support.
- Avoid logging PII; if necessary, hash or redact addresses/subjects.

---

## 10) Packaging & Updates

- Use `electron-builder` for dmg/exe; keep config in repo.
- Code signing for macOS and Windows when distributing.
- Optional auto-update flow via GitHub Releases/private server; verify signatures.

---

## 11) Testing

- **Unit (main)**: smtp/imap/auth/storage using mocks or local servers (MailHog/GreenMail).
- **Integration**: IPC contract tests; ensure preload validators and main handlers agree.
- **Renderer**: component tests; preload API mocked.
- **E2E**: Playwright to open app, add account, list messages, send email.
- **Perf**: large mailbox fixtures; virtualization for lists; long-running sync tests.

---

## 12) Milestones

1) **MVP Send**: add one account, compose, send (outbox + logs).  
2) **MVP Read**: list inbox headers, open message, lazy body, cache.  
3) **Drafts & Attachments**: autosave draft, attach files, download/open.  
4) **Search**: local FTS (subject/from/to/body), filters.  
5) **Sync polish**: flags, background sync, notifications, badge count.  
6) **Settings**: account management, signatures, preferences.  
7) **Ship**: packaging, signing, update channel.

---

## 13) Operational Notes

- All long-running tasks are cancelable (window close, account removal).
- Keep provider differences behind adapters; prefer IMAP baseline + provider special-cases.
- Single event bus in main; debounce high-frequency sync events to avoid UI thrash.
- Provide “Reset app data” for debugging (clears DB + attachments, keeps keychain entries only if confirmed).

---

### Summary
- **Main** owns sensitive logic and storage; **Preload** gates IPC with validation; **Renderer** is UI only.  
- Use **SQLite + FTS5** for local cache/search; **keychain** for secrets; **attachments** on disk.  
- Build iteratively: send → read → drafts/attachments → search → sync polish → settings → ship.
