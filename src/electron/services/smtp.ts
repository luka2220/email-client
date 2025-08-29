// Steps for connecting to an smtp server:
// SMTP is used for sending emails
// - Send a raw TCP connection to smtp.gmail.com:25 (PORT: 587 -> TLS) (PORT: 465 -> SSL)
//      * SMTP Username: user@gmail.com
//      * SMTP Password: gmail password

// IMAP is used to receive/fetch emails

import net from "node:net";
import tls from "node:tls";

// const client = new net.Socket();
// const unSecureSocket = client.connect(
//   { port: 993, host: "imap.gmail.com" },
//   () => {}
// );

const socket = tls.connect(
  { host: "imap.gmail.com", port: 993, servername: "imap.gmail.com" },
  () => console.log("secure connection established")
);
// const securedConnection = tls.connect({ socket: unSecureSocket }, () => {
//   console.log("Google IMAP connected with TLS");
// });

socket.on("data", (data) => {
  console.log(`IMAP data over TLS -> ${data}`);
});

socket.on("end", () => {
  console.log("Close imap connection");
});
