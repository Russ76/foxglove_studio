// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { EventEmitter } from "eventemitter3";

import { XmlRpcServer, HttpAddress, XmlRpcHandler } from "@foxglove/ros1";

import { RosApiRenderer } from "./RosApiRenderer";
import { RpcRenderer } from "./RpcRenderer";

export class XmlRpcServerRenderer extends EventEmitter implements XmlRpcServer {
  #api: RosApiRenderer;
  #rpc: RpcRenderer;
  #serverId: number;
  #address?: HttpAddress;

  constructor(api: RosApiRenderer, rpc: RpcRenderer, serverId: number, address: HttpAddress) {
    super();
    this.#api = api;
    this.#rpc = rpc;
    this.#serverId = serverId;
    this.#address = address;

    rpc.on("XmlRpcServer_onClose", serverId, () => {
      this.#address = undefined;
      this.emit("close");
    });
    rpc.on("XmlRpcServer_onError", serverId, (err) => {
      this.#address = undefined;
      this.emit("error", new Error(err));
    });
  }

  address(): HttpAddress | undefined {
    return this.#address;
  }

  close(): void {
    this.#address = undefined;
    this.#rpc.call("XmlRpcServer_close", this.#serverId);
  }

  addMethod(method: string, handler: XmlRpcHandler): this {
    const serverId = this.#serverId;
    this.#api.addXmlRpcServerMethodHandler(method, serverId, handler);
    this.#rpc.call("XmlRpcServer_addMethod", { serverId, method });
    return this;
  }
}
