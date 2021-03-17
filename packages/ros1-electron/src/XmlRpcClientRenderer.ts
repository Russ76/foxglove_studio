// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { URL } from "whatwg-url";

import { XmlRpcClient, XmlRpcResponse, XmlRpcValue } from "@foxglove/ros1";

import { RpcRenderer } from "./RpcRenderer";

export class XmlRpcClientRenderer implements XmlRpcClient {
  readonly serverUrl: URL;
  #rpc: RpcRenderer;
  #clientId: number;

  constructor(rpc: RpcRenderer, clientId: number, serverUrl: URL) {
    this.#rpc = rpc;
    this.#clientId = clientId;
    this.serverUrl = serverUrl;
  }

  methodCall(method: string, args: XmlRpcValue[]): Promise<XmlRpcResponse> {
    const clientId = this.#clientId;
    return this.#rpc.call("XmlRpcClient_methodCall", { clientId, method, args });
  }
}
