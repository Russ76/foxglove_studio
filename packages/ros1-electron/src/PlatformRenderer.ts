// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { URL } from "whatwg-url";

import { RpcRenderer } from "./RpcRenderer";

export class PlatformRenderer {
  #rpc: RpcRenderer;

  constructor(rpc: RpcRenderer) {
    this.#rpc = rpc;
  }

  getPid(): Promise<number> {
    return this.#rpc.call("GetPid", undefined);
  }

  getDefaultRosMasterUri(): Promise<URL> {
    return this.#rpc.call("GetDefaultRosMasterUri", undefined).then((url) => new URL(url));
  }

  getHostname(): Promise<string> {
    return this.#rpc.call("GetHostname", undefined);
  }
}
