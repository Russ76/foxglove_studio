// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { EventEmitter } from "eventemitter3";
import { MessageReader, parseMessageDefinition, RosMsgDefinition } from "rosbag";
import { TextDecoder, TextEncoder } from "web-encoding";

import { Connection, ConnectionStats } from "./Connection";
import { TcpAddress, TcpSocket } from "./TcpTypes";

export class TcpConnection extends EventEmitter implements Connection {
  retries = 0;

  #socket: TcpSocket;
  #readingHeader = true;
  #requestHeader: Map<string, string>;
  #header = new Map<string, string>();
  #stats = {
    bytesSent: 0,
    bytesReceived: 0,
    messagesSent: 0,
    messagesReceived: 0,
    dropEstimate: -1,
  };
  #msgDefinition: RosMsgDefinition[] = [];
  #msgReader: MessageReader | undefined;

  constructor(socket: TcpSocket, requestHeader: Map<string, string>) {
    super();
    this.#socket = socket;
    this.#requestHeader = requestHeader;

    socket.on("connect", this.#handleConnect);
    socket.on("close", this.#handleClose);
    socket.on("error", this.#handleError);
    socket.on("message", this.#handleMessage);
  }

  transportType(): string {
    return "TCPROS";
  }

  remoteAddress(): TcpAddress | undefined {
    return this.#socket.remoteAddress();
  }

  connected(): boolean {
    return this.#socket.connected();
  }

  header(): Map<string, string> {
    return new Map<string, string>(this.#header);
  }

  stats(): ConnectionStats {
    return this.#stats;
  }

  close(): void {
    this.#socket.close();
  }

  async writeHeader(): Promise<void> {
    const data = TcpConnection.SerializeHeader(this.#requestHeader);
    this.#stats.bytesSent += data.byteLength;
    return this.#socket.write(data);
  }

  // e.g. "TCPROS connection on port 59746 to [host:34318 on socket 11]"
  getTransportInfo(): string {
    const localPort = this.#socket.localAddress()?.port ?? -1;
    const addr = this.#socket.remoteAddress();
    const fd = this.#socket.fd() ?? -1;
    if (addr) {
      const { address, port } = addr;
      return `TCPROS connection on port ${localPort} to [${address}:${port} on socket ${fd}]`;
    }
    return `TCPROS not connected [socket ${fd}]`;
  }

  #handleConnect = (): void => {
    this.retries = 0;
    // Write the initial request header. This prompts the publisher to respond
    // with its own header then start streaming messages
    this.writeHeader();
  };

  #handleClose = (): void => {
    // TODO: Enter a reconnect loop
  };

  #handleError = (): void => {
    // TOOD: Enter a reconnect loop
  };

  #handleMessage = (data: Uint8Array): void => {
    this.#stats.bytesReceived += data.byteLength;

    if (this.#readingHeader) {
      this.#readingHeader = false;

      this.#header = TcpConnection.ParseHeader(data);
      this.#msgDefinition = parseMessageDefinition(this.#header.get("message_definition") ?? "");
      this.#msgReader = new MessageReader(this.#msgDefinition);
    } else {
      this.#stats.messagesReceived++;

      if (this.#msgReader) {
        const msg = this.#msgReader.readMessage(
          Buffer.from(data.buffer, data.byteOffset, data.length),
        );
        this.emit("message", msg, data);
      }
    }
  };

  static SerializeHeader(header: Map<string, string>): Uint8Array {
    const encoder = new TextEncoder();
    const encoded = Array.from(header).map(([key, value]) =>
      encoder.encode(`${key}=${value}`),
    ) as Uint8Array[];
    const payloadLen = encoded.reduce((sum, str) => sum + str.length + 4, 0);
    const buffer = new ArrayBuffer(payloadLen + 4);
    const array = new Uint8Array(buffer);
    const view = new DataView(buffer);

    let idx = 0;
    view.setUint32(idx, payloadLen, true);
    idx += 4;

    encoded.forEach((strData) => {
      view.setUint32(idx, strData.length, true);
      idx += 4;
      array.set(strData, idx);
      idx += strData.length;
    });

    return new Uint8Array(buffer);
  }

  static ParseHeader(data: Uint8Array): Map<string, string> {
    const decoder = new TextDecoder();
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const result = new Map<string, string>();

    let idx = 0;
    while (idx + 4 < data.length) {
      const len = Math.min(view.getUint32(idx, true), data.length - idx - 4);
      idx += 4;
      const str = decoder.decode(new Uint8Array(data.buffer, data.byteOffset + idx, len)) as string;
      let equalIdx = str.indexOf("=");
      if (equalIdx < 0) {
        equalIdx = str.length;
      }
      const key = str.substr(0, equalIdx);
      const value = str.substr(equalIdx + 1);
      result.set(key, value);
      idx += len;
    }

    // TODO: Warn if there are leftover bytes

    return result;
  }
}
