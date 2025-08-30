// IMAP is used to receive/fetch emails from inboxes
// Only offer gmail accounts atm

import tls from "node:tls";
import dotenv from "dotenv";

dotenv.config();

type GreetResponse = "OK" | "PREAUTH" | "BYE";

const gmailUserName = process.env.TEST_GMAIL_USERNAME;
const gmailPassword = process.env.TEST_GMAIL_PASSWORD;

const socket = tls.connect(
  { host: "imap.gmail.com", port: 993, servername: "imap.gmail.com" },
  () => console.log("secure connection established")
);

// Parse the IMAP greeting message
socket.once("data", (data: Buffer) => {
  const greeting = data.toString("utf-8").split(" ")[1] as GreetResponse;

  switch (greeting) {
    case "OK":
      console.log("OK procees to auth -> ", data.toString("utf-8"));
      break;
    case "PREAUTH":
      console.log("PREAUTH already authenticated -> ", data.toString("utf-8"));
      break;
    case "BYE":
      console.log("BAD server closing -> ", data.toString("utf-8"));
      break;
    default:
      socket.end();
      return;
  }

  parseImapConnectionMessages();
});

const parseImapConnectionMessages = () =>
  socket.on("data", (data: Buffer) => {
    const txt = data.toString("utf-8");
    const lines = txt.split("\r\n");

    for (const line of lines) {
      console.log(line);
    }
  });

socket.on("end", () => {
  console.log("Close imap connection");
});
