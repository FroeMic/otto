import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import { EventEmitter } from "node:events";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export class MinimalWebSocketClient extends EventEmitter {
  constructor(url, options = {}) {
    super();
    this.url = new URL(url);
    this.headers = options.headers ?? {};
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    this.fragmentOpcode = null;
    this.fragments = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      const isTls = this.url.protocol === "wss:";
      const port = Number(this.url.port || (isTls ? 443 : 80));
      const host = this.url.hostname;
      const key = crypto.randomBytes(16).toString("base64");
      const expectedAccept = crypto
        .createHash("sha1")
        .update(`${key}${GUID}`)
        .digest("base64");

      const socket = isTls
        ? tls.connect({ host, port, servername: host })
        : net.connect({ host, port });
      this.socket = socket;

      let handshakeBuffer = Buffer.alloc(0);
      let settled = false;

      const fail = (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        } else {
          this.emit("error", error);
        }
      };

      socket.once("error", fail);
      socket.once(isTls ? "secureConnect" : "connect", () => {
        const path = `${this.url.pathname || "/"}${this.url.search}`;
        const hostHeader =
          this.url.port && !["80", "443"].includes(this.url.port)
            ? `${this.url.hostname}:${this.url.port}`
            : this.url.hostname;
        const requestHeaders = {
          Host: hostHeader,
          Upgrade: "websocket",
          Connection: "Upgrade",
          "Sec-WebSocket-Key": key,
          "Sec-WebSocket-Version": "13",
          ...this.headers,
        };
        const request = [
          `GET ${path} HTTP/1.1`,
          ...Object.entries(requestHeaders).map(([name, value]) => `${name}: ${value}`),
          "\r\n",
        ].join("\r\n");
        socket.write(request);
      });

      socket.on("data", (chunk) => {
        if (!settled) {
          handshakeBuffer = Buffer.concat([handshakeBuffer, chunk]);
          const end = handshakeBuffer.indexOf("\r\n\r\n");
          if (end < 0) {
            return;
          }

          const head = handshakeBuffer.subarray(0, end).toString("utf8");
          const rest = handshakeBuffer.subarray(end + 4);
          const [statusLine, ...headerLines] = head.split("\r\n");
          const statusMatch = /^HTTP\/1\.[01]\s+(\d+)/u.exec(statusLine ?? "");
          const status = statusMatch ? Number(statusMatch[1]) : 0;
          const responseHeaders = parseHeaders(headerLines);
          const accept = responseHeaders["sec-websocket-accept"];

          if (status !== 101 || accept !== expectedAccept) {
            fail(new Error(`WebSocket upgrade failed with HTTP ${status || "unknown"}.`));
            socket.destroy();
            return;
          }

          settled = true;
          socket.off("error", fail);
          socket.on("error", (error) => this.emit("error", error));
          socket.on("close", () => {
            this.closed = true;
            this.emit("close");
          });
          this.emit("open");
          resolve();
          if (rest.length > 0) {
            this.consume(rest);
          }
          return;
        }

        this.consume(chunk);
      });
    });
  }

  sendText(text) {
    if (!this.socket || this.closed) {
      throw new Error("WebSocket is not open.");
    }
    this.socket.write(encodeFrame(Buffer.from(text, "utf8"), 0x1));
  }

  close(code = 1000, reason = "client closed") {
    if (this.closed) {
      return;
    }
    this.closed = true;
    try {
      const payload = Buffer.alloc(2 + Buffer.byteLength(reason));
      payload.writeUInt16BE(code, 0);
      payload.write(reason, 2);
      this.socket?.write(encodeFrame(payload, 0x8));
    } catch {
      // Best-effort close.
    }
    this.socket?.end();
  }

  consume(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (true) {
      const parsed = decodeFrame(this.buffer);
      if (!parsed) {
        return;
      }
      this.buffer = this.buffer.subarray(parsed.consumed);
      this.handleFrame(parsed);
    }
  }

  handleFrame(frame) {
    if (frame.opcode === 0x8) {
      this.closed = true;
      this.socket?.end();
      this.emit("close");
      return;
    }
    if (frame.opcode === 0x9) {
      this.socket?.write(encodeFrame(frame.payload, 0xa));
      return;
    }
    if (frame.opcode === 0xa) {
      return;
    }

    if (frame.opcode === 0x1 || frame.opcode === 0x2) {
      if (frame.fin) {
        this.emit("message", frame.payload.toString("utf8"));
        return;
      }
      this.fragmentOpcode = frame.opcode;
      this.fragments = [frame.payload];
      return;
    }

    if (frame.opcode === 0x0 && this.fragmentOpcode) {
      this.fragments.push(frame.payload);
      if (frame.fin) {
        const payload = Buffer.concat(this.fragments);
        this.fragments = [];
        this.fragmentOpcode = null;
        this.emit("message", payload.toString("utf8"));
      }
    }
  }
}

function parseHeaders(lines) {
  const headers = {};
  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator < 0) {
      continue;
    }
    headers[line.slice(0, separator).trim().toLowerCase()] = line
      .slice(separator + 1)
      .trim();
  }
  return headers;
}

function encodeFrame(payload, opcode) {
  const length = payload.length;
  const lengthBytes = length < 126 ? 0 : length <= 0xffff ? 2 : 8;
  const header = Buffer.alloc(2 + lengthBytes + 4);
  header[0] = 0x80 | opcode;
  header[1] = 0x80 | (length < 126 ? length : lengthBytes === 2 ? 126 : 127);
  let offset = 2;
  if (lengthBytes === 2) {
    header.writeUInt16BE(length, offset);
    offset += 2;
  } else if (lengthBytes === 8) {
    header.writeBigUInt64BE(BigInt(length), offset);
    offset += 8;
  }
  const mask = crypto.randomBytes(4);
  mask.copy(header, offset);
  offset += 4;
  const masked = Buffer.alloc(length);
  for (let index = 0; index < length; index += 1) {
    masked[index] = payload[index] ^ mask[index % 4];
  }
  return Buffer.concat([header.subarray(0, offset), masked]);
}

function decodeFrame(buffer) {
  if (buffer.length < 2) {
    return null;
  }
  const first = buffer[0];
  const second = buffer[1];
  const fin = Boolean(first & 0x80);
  const opcode = first & 0x0f;
  const masked = Boolean(second & 0x80);
  let length = second & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < offset + 2) {
      return null;
    }
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) {
      return null;
    }
    const bigLength = buffer.readBigUInt64BE(offset);
    if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("WebSocket frame is too large.");
    }
    length = Number(bigLength);
    offset += 8;
  }
  const maskLength = masked ? 4 : 0;
  if (buffer.length < offset + maskLength + length) {
    return null;
  }
  const mask = masked ? buffer.subarray(offset, offset + 4) : undefined;
  offset += maskLength;
  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (mask) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4];
    }
  }
  return { consumed: offset + length, fin, opcode, payload };
}
