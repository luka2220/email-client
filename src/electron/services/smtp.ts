// Steps for connecting to an smtp server:
// SMTP is used for sending emails
// - Send a raw TCP connection to smtp.gmail.com:25 (PORT: 465 -> TLS)
//      * SMTP Username: user@gmail.com
//      * SMTP Password: gmail password

import tls from "node:tls";
import dotenv from "dotenv";

dotenv.config();

const gmailUserName = process.env.TEST_GMAIL_USERNAME;
const gmailPassword = process.env.TEST_GMAIL_PASSWORD;

const socket = tls.connect(
  { port: 465, host: "smtp.gmail.com", servername: "smtp.gmail.com" },
  () => console.log("secure connection established")
);

socket.once("data", (buff: Buffer) => {
  console.log("smtp buffer data: ", buff.toString("utf-8"));
});

socket.on("close", () => console.log("smtp server closed"));
