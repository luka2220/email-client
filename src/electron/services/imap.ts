// IMAP is used to receive/fetch emails from inboxes
// Only offer gmail accounts atm

import tls from "node:tls";
import { Buffer } from "node:buffer";

type ImapStatus = "OK" | "NO" | "BAD" | "PREAUTH" | "BYE";

function makeLineSplitter(sock: tls.TLSSocket, onLine: (line: string) => void) {
  let buf = "";
  sock.on("data", (chunk: Buffer) => {
    buf += chunk.toString("utf-8");
    let idx: number;
    while ((idx = buf.indexOf("\r\n")) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      onLine(line);
    }
  });
}

class Imap {
  private sock: tls.TLSSocket;
  private nextTag = 1;

  private pending = new Map<
    string,
    {
      resolve: (result: {
        line: string;
        status: ImapStatus;
        untagged: string[];
      }) => void;
      reject: (e: Error) => void;
      collect?: RegExp;
      untagged: string[];
    }
  >();

  private readyResolve?: () => void;
  public ready: Promise<void>;

  constructor(host = "imap.gmail.com", port = 993) {
    this.sock = tls.connect({ host, port, servername: host }, () =>
      console.log("secure connection established")
    );

    this.ready = new Promise((res) => (this.readyResolve = res));

    this.sock.on("error", (e) => {
      for (const p of this.pending.values()) p.reject(e);
      this.pending.clear();
    });
    this.sock.on("close", () => {
      for (const p of this.pending.values())
        p.reject(new Error("socket closed"));
      this.pending.clear();
    });

    makeLineSplitter(this.sock, (line) => this.onLine(line));
  }

  private onLine(line: string) {
    if (line.startsWith("* ")) {
      if (/^\* (OK|PREAUTH)\b/i.test(line)) {
        this.readyResolve?.();
        this.readyResolve = undefined;
      }
      if (/^\* BYE\b/i.test(line)) {
        this.sock.end();
      }

      for (const w of this.pending.values()) {
        if (!w.collect || w.collect.test(line)) w.untagged.push(line);
      }
      return;
    }

    const m = line.match(/^([A-Za-z0-9]+)\s+(OK|NO|BAD)\b/i);
    if (m) {
      const [, tag, status] = m as [string, string, ImapStatus];
      const waiter = this.pending.get(tag);
      if (waiter) {
        this.pending.delete(tag);
        waiter.resolve({ line, status, untagged: waiter.untagged });
      }
    }
  }

  private makeTag() {
    return `A${this.nextTag++}`;
  }

  /**
   * Send a command and wait for tagged completion.
   * Optionally collect untagged lines that match `collect`.
   */
  send(
    cmd: string,
    opts?: { timeoutMs?: number; collect?: RegExp }
  ): Promise<{ line: string; status: ImapStatus; untagged: string[] }> {
    const tag = this.makeTag();
    const wire = `${tag} ${cmd}\r\n`;
    const timeoutMs = opts?.timeoutMs ?? 15000;

    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(tag);
        reject(new Error(`Timed out waiting for ${tag}`));
      }, timeoutMs);

      this.pending.set(tag, {
        resolve: (result) => {
          clearTimeout(t);
          resolve(result);
        },
        reject: (e) => {
          clearTimeout(t);
          reject(e);
        },
        collect: opts?.collect,
        untagged: [],
      });

      const ok = this.sock.write(wire);
      if (!ok) this.sock.once("drain", () => {});
    });
  }

  end() {
    this.sock.end();
  }
}

import dotenv from "dotenv";
dotenv.config();

const gmailUserName = process.env.TEST_GMAIL_USERNAME!;
const gmailPassword = process.env.TEST_GMAIL_PASSWORD!;

function parseSearchUids(untagged: string[]): number[] {
  const list = untagged
    .filter((l) => /^\* SEARCH\b/i.test(l))
    .flatMap((l) =>
      l
        .replace(/^\* SEARCH\s*/i, "")
        .trim()
        .split(/\s+/)
    )
    .filter(Boolean)
    .map(Number);
  list.sort((a, b) => a - b);
  return list;
}

function parseFetchHeaders(untagged: string[]) {
  for (const l of untagged) {
    if (/^\* \d+ FETCH /i.test(l)) {
      console.log("FETCH:", l);
    }
  }
}

(async () => {
  const imap = new Imap();

  await imap.ready;

  const login = await imap.send(`LOGIN ${gmailUserName} "${gmailPassword}"`);
  if (login.status !== "OK") throw new Error("Login failed: " + login.line);

  const sel = await imap.send("SELECT INBOX");
  if (sel.status !== "OK") throw new Error("SELECT failed: " + sel.line);

  // Get unread UIDs
  const search = await imap.send("UID SEARCH UNSEEN", {
    collect: /^\* SEARCH /,
  });
  const uids = parseSearchUids(search.untagged);
  if (!uids.length) {
    console.log("No unread.");
  } else {
    const fetch = await imap.send(
      `UID FETCH ${uids.join(
        ","
      )} (UID FLAGS BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)])`,
      { collect: /^\* \d+ FETCH / }
    );
    parseFetchHeaders(fetch.untagged);
  }

  imap.end();
})();
