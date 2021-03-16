// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PlatformNode } from "@foxglove/ros1-nodejs";

import { RpcMain } from "./RpcMain";

export class PlatformMain {
  constructor(rpc: RpcMain) {
    rpc.handleMethod("GetPid", () => PlatformNode.GetPid());
    rpc.handleMethod("GetDefaultRosMasterUri", () =>
      PlatformNode.GetDefaultRosMasterUri().then((url) => String(url)),
    );
    rpc.handleMethod("GetHostname", () => PlatformNode.GetHostname());
  }
}
