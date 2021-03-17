// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";

import { TcpAddress, TcpServer } from "@foxglove/ros1";

import { RpcRenderer } from "./RpcRenderer";
import { TcpSocketRenderer } from "./TcpSocketRenderer";

export class TcpServerRenderer extends EventEmitter implements TcpServer {
  #rpc: RpcRenderer;
  #serverId: number;
  #address?: TcpAddress;

  constructor(rpc: RpcRenderer, serverId: number, address: TcpAddress) {
    super();
    this.#rpc = rpc;
    this.#serverId = serverId;
    this.#address = address;

    rpc.on("TcpServer_onClose", this.#serverId, () => {
      this.#address = undefined;
      this.emit("close");
    });
    rpc.on("TcpServer_onConnection", this.#serverId, (socketInfo) => {
      const socket = new TcpSocketRenderer(this.#rpc, socketInfo);
      this.emit("connection", socket);
    });
    rpc.on("TcpServer_onError", this.#serverId, (err) => {
      this.#address = undefined;
      this.emit("error", new Error(err));
    });
  }

  address(): TcpAddress | undefined {
    return this.#address;
  }

  close(): void {
    this.#address = undefined;
    this.#rpc.call("TcpServer_close", this.#serverId);
  }
}
