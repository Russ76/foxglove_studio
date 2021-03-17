// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";

import { TcpAddress, TcpSocket } from "@foxglove/ros1";

import { RpcRenderer } from "./RpcRenderer";

export class TcpSocketRenderer extends EventEmitter implements TcpSocket {
  #rpc: RpcRenderer;
  #host: string;
  #port: number;
  #socketId: number;
  #localAddress?: TcpAddress;
  #remoteAddress?: TcpAddress;
  #fd?: number;

  constructor(rpc: RpcRenderer, host: string, port: number, socketId: number) {
    super();
    this.#rpc = rpc;
    this.#socketId = socketId;
    this.#host = host;
    this.#port = port;

    rpc.on("TcpSocket_onConnect", this.#socketId, () => {
      this.emit("connect");
    });
    rpc.on("TcpSocket_onClose", this.#socketId, () => {
      this._setClosed();
      this.emit("close");
    });
    rpc.on("TcpSocket_onEnd", this.#socketId, () => {
      this._setClosed();
      this.emit("end");
    });
    rpc.on("TcpSocket_onError", this.#socketId, (err) => {
      this._setClosed();
      this.emit("error", new Error(err));
    });
    rpc.on("TcpSocket_onMessage", this.#socketId, (data) => {
      this.emit("message", data);
    });
    rpc.on("TcpSocket_onTimeout", this.#socketId, () => {
      this.emit("timeout");
    });
  }

  localAddress(): TcpAddress | undefined {
    return this.#localAddress;
  }

  remoteAddress(): TcpAddress | undefined {
    return this.#remoteAddress ?? { port: this.#port, address: this.#host };
  }

  fd(): number | undefined {
    return this.#fd;
  }

  connected(): boolean {
    return this.#localAddress != undefined;
  }

  async connect(): Promise<void> {
    const { remoteAddress, localAddress, fd } = await this.#rpc.call(
      "TcpSocket_connect",
      this.#socketId,
    );
    this.#remoteAddress = remoteAddress;
    this.#localAddress = localAddress;
    this.#fd = fd;
  }

  close(): void {
    this._setClosed();
    this.#rpc.call("TcpSocket_close", this.#socketId);
  }

  write(data: Uint8Array): Promise<void> {
    return this.#rpc.call("TcpSocket_write", [this.#socketId, data]);
  }

  private _setClosed(): void {
    this.#localAddress = undefined;
    this.#fd = undefined;
  }
}
