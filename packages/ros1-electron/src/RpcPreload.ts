// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ipcRenderer } from "electron";

export function forwardPortsToRenderer(channel: string): void {
  const windowLoaded = new Promise((resolve) => {
    window.onload = resolve;
  });

  ipcRenderer.on(channel, async (event) => {
    await windowLoaded;
    // We use regular window.postMessage to transfer ports from the isolated
    // world to the main world
    window.postMessage(channel, "*", event.ports);
  });
}
