// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TcpAddress, TcpSocket } from "@foxglove/ros1";
import EventEmitter from "eventemitter3";

import { RpcRenderer } from "./RpcRenderer";
import { SocketInfo } from "./RpcTypes";

export class TcpSocketRenderer extends EventEmitter implements TcpSocket {
  #rpc: RpcRenderer;
  #socketId: number;
  #localAddress?: TcpAddress;
  #remoteAddress?: TcpAddress;
  #fd?: number;

  constructor(rpc: RpcRenderer, info: SocketInfo) {
    super();
    this.#rpc = rpc;
    this.#socketId = info.socketId;
    this.#localAddress = info.localAddress;
    this.#remoteAddress = info.remoteAddress;
    this.#fd = info.fd;

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
      this._setClosed();
      this.emit("timeout");
    });
  }

  localAddress(): TcpAddress | undefined {
    return this.#localAddress;
  }

  remoteAddress(): TcpAddress | undefined {
    return this.#remoteAddress;
  }

  fd(): number | undefined {
    return this.#fd;
  }

  connected(): boolean {
    return this.#remoteAddress != undefined;
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
    this.#remoteAddress = undefined;
    this.#fd = undefined;
  }

  static async Create(
    rpc: RpcRenderer,
    options: { host: string; port: number },
  ): Promise<TcpSocketRenderer> {
    const socketInfo = await rpc.call("TcpSocket_Create", options);
    return new TcpSocketRenderer(rpc, socketInfo);
  }
}
