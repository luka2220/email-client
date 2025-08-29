# IMAP Commands & Wire Format (No Code)

This document summarizes **IMAP4rev1** commands, their **on-the-wire structure**, and how to **marshal** requests for a raw TCP/TLS IMAP client. It is implementation-agnostic (no code) and focuses on the wire protocol so you can build your own client.

Key specs: RFC 3501 (IMAP4rev1), RFC 5161 (ENABLE), RFC 4959 (SASL-IR), RFC 2595 (STARTTLS), RFC 2087 (QUOTA), RFC 4314 (ACL), RFC 6855 (UTF-8), RFC 3501 §9 (Formal Syntax).

---

## 1) Connection & Greeting

- **IMAPS (implicit TLS)**: connect to `:993`; TLS is active immediately.
- **IMAP + STARTTLS**: connect to `:143`, issue `STARTTLS`, then upgrade to TLS.
- Server greets first with an **untagged** line:
  • OK IMAP4rev1 Service Ready

---

## 2) IMAP Line Grammar: Tags, Commands, Responses

### Tags

- Every client command begins with a **tag** you choose (e.g., `A001`, `C23`).
- The server’s **final** line for that command is a **tagged** response with the same tag and a status: `OK`, `NO`, or `BAD`.

### Response Types

- **Untagged** (starts with `*`): server data/updates not tied to the command’s completion (exists counts, fetch data, capability lists, etc.).
- **Continuation** (starts with `+`): server is asking the client to continue sending data (e.g., literals, SASL steps).
- **Tagged final** (starts with your tag): the definitive end-of-command status (`OK`/`NO`/`BAD`).

### Line Endings

- All lines MUST end with **CRLF** (`\r\n`).

---

## 3) Atoms, Strings, & Literals (Marshalling Basics)

IMAP arguments are not just raw text; they follow a formal syntax:

- **Atom**: unquoted token (letters, digits, and a limited set of symbols). Use when content contains only safe characters.
- **Quoted String**: surround with double quotes when spaces or specials are present. Escape `"` and `\` inside.
- **Literal**: for arbitrary bytes or long data, use `{<octet-length>}` followed by CRLF, **wait for continuation**, then send exactly that many bytes, then CRLF. Example:
  A101 APPEND INBOX {12}\r\n
  • Ready for literal data\r\n
  Hello world!\r\n

Some servers support **LITERAL+** (`{N}+`) meaning _no_ continuation needed; you can send the bytes immediately.

- **Lists**: Parentheses `(...)` denote lists (e.g., `FLAGS (\Seen \Flagged)`).

**Marshalling rule of thumb**: Build each command as:  
`TAG SP COMMAND [SP arguments]\r\n`.  
Choose atom/quoted/literal per argument content. For literals, honor the continuation flow.

---

## 4) Common Command Flows

> Replace `A001`, `A002`, … with your own tags. Responses shown are examples; real replies vary.

### CAPABILITY

A001 CAPABILITY
• CAPABILITY IMAP4rev1 IDLE NAMESPACE AUTH=XOAUTH2 AUTH=PLAIN STARTTLS UIDPLUS ENABLE
A001 OK CAPABILITY completed

### STARTTLS (if on port 143)

A002 STARTTLS
A002 OK Begin TLS negotiation now

→ Upgrade the socket to TLS, then re-send `CAPABILITY`.

### LOGIN

A003 LOGIN “user@example.com” “app-password”
A003 OK LOGIN completed

### AUTHENTICATE XOAUTH2

A004 AUTHENTICATE XOAUTH2
A004 OK Success

Base64 string encodes:  
`user=user@example.com^Aauth=Bearer <access_token>^A^A` (`^A` = `\x01`).

### SELECT INBOX

A005 SELECT INBOX
• 24 EXISTS
• FLAGS (\Answered \Flagged \Seen \Deleted \Draft)
A005 OK [READ-WRITE] SELECT completed

### FETCH

A006 FETCH 1:\* (FLAGS BODY[HEADER.FIELDS (FROM TO SUBJECT DATE)])
• 1 FETCH (FLAGS (\Seen) BODY[HEADER.FIELDS (FROM TO SUBJECT DATE)] {123}
From: …
Subject: …
)
A006 OK FETCH completed

---

## 5) UIDs vs. Sequence Numbers

- **Sequence numbers** (`1:*`) change as the mailbox changes.
- **UIDs** are stable per `UIDVALIDITY`. Prefer UIDs for sync.

---

## 6) Mailbox Names & Encoding

- Uses **Modified UTF-7** for non-ASCII (RFC 3501).
- Many servers support UTF-8 (RFC 6855).

---

## 7) Continuations & Literals

- If a command includes a literal, wait for `+` continuation before sending.
- With `LITERAL+`, you can send immediately.
- `AUTHENTICATE` may involve multiple continuations.

---

## 8) Error Handling

- Tagged response is definitive: `OK` / `NO` / `BAD`.
- Look for bracketed response codes like `[TRYCREATE]`, `[UIDVALIDITY 123]`.

---

## 9) Client State to Track

- Current mailbox, `UIDVALIDITY`, `UIDNEXT`.
- Highest known UID.
- Per-command parser state (collect until tagged completion).

---

## 10) Security

- Always TLS (993 or 143+STARTTLS).
- Verify server certificates (with SNI).
- Prefer OAuth2 (XOAUTH2) with Gmail/Outlook.

---

## 11) Quick Reference

- Greeting: `* OK ...`
- CAPABILITY: `A001 CAPABILITY`
- LOGIN: `A002 LOGIN "user" "pass"`
- XOAUTH2: `A003 AUTHENTICATE XOAUTH2 <base64>`
- SELECT: `A004 SELECT INBOX`
- FETCH: `A005 FETCH 1:* (FLAGS BODY[HEADER])`
- UID FETCH: `A006 UID FETCH ...`
- SEARCH: `A007 SEARCH ALL`
- STORE: `A008 STORE 42 +FLAGS (\Seen)`
- APPEND: `A009 APPEND "Sent" {N}`
- IDLE: `A010 IDLE` → `DONE`
- LOGOUT: `A011 LOGOUT`

---

### Final Notes

- IMAP is a **tagged, line-based protocol** with interleaved untagged data.
- Always parse incrementally and match by tag.
- Use UIDs for sync safety.
- Test against Gmail (`imap.gmail.com:993`), Outlook, and a local server.
