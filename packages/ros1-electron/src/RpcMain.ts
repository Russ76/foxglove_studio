// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { BrowserWindow, MessageChannelMain, MessagePortMain } from "electron";

import {
  EventCallback,
  RpcCallback,
  RpcCallPayload,
  RpcEventPayload,
  RpcHandler,
  RpcMainMethodMap,
  RpcRendererMethodMap,
  RpcResponsePayload,
} from "./RpcTypes";

export class RpcMain {
  #clientPort: MessagePortMain;
  #serverPort: MessagePortMain;
  #eventPort: MessagePortMain;
  #callbacks = new Map<number, RpcCallback>();
  #serverHandlers = new Map<string, RpcHandler>();
  #eventHandlers = new Map<string, EventCallback>();
  #nextWaitHandle = 0;

  constructor(
    clientPort: MessagePortMain,
    serverPort: MessagePortMain,
    eventPort: MessagePortMain,
  ) {
    this.#clientPort = clientPort;
    this.#serverPort = serverPort;
    this.#eventPort = eventPort;

    // Listen for responses to RPC calls
    this.#clientPort.addListener("message", (ev: Electron.MessageEvent) => {
      const [waitHandle, errMsg, out] = ev.data as RpcResponsePayload;
      const callback = this.#callbacks.get(waitHandle);
      if (!callback) {
        // TODO: Log a warning
        return;
      }
      this.#callbacks.delete(waitHandle);

      const err = errMsg != undefined ? new Error(errMsg) : undefined;
      callback(err, out);
    });

    // Listen for incoming RPC calls
    this.#serverPort.addListener("message", async (ev: Electron.MessageEvent) => {
      const [method, waitHandle, args] = ev.data as RpcCallPayload;
      const callback = this.#serverHandlers.get(method);
      if (!callback) {
        this.#serverPort.postMessage([waitHandle, `unhandled method "${method}"`, undefined]);
        return;
      }

      try {
        this.#serverPort.postMessage(await callback(args));
      } catch (err) {
        this.#serverPort.postMessage([waitHandle, `${err}`, undefined]);
      }
    });

    // Listen for incoming events
    this.#eventPort.addListener("message", (ev: Electron.MessageEvent) => {
      const [eventName, id, data] = ev.data as RpcEventPayload;
      const callback = this.#eventHandlers.get(`${eventName}-${id}`);
      if (!callback) {
        // TODO: Log a warning
        return;
      }

      callback(data);
    });
  }

  call<K extends keyof RpcMainMethodMap, V extends RpcMainMethodMap[K]>(
    method: K,
    args: V["args"],
  ): Promise<V["out"]> {
    return new Promise<V["out"]>((resolve, reject) => {
      const waitHandle = this.#nextWaitHandle++;

      const prevCallback = this.#callbacks.get(waitHandle);
      if (prevCallback) {
        prevCallback(new Error(`replaced`), undefined);
      }

      this.#callbacks.set(waitHandle, (err, response) => {
        this.#callbacks.delete(waitHandle);
        if (err) {
          return reject(err);
        }
        resolve(response as V["out"]);
      });

      this.#clientPort.postMessage([method, waitHandle, args]);
    });
  }

  handleMethod<K extends keyof RpcRendererMethodMap, V extends RpcRendererMethodMap[K]>(
    method: K,
    handler: (args: V["args"]) => Promise<V["out"]>,
  ): void {
    this.#serverHandlers.set(method, handler as RpcHandler);
  }

  static Create(channel: string, browser: BrowserWindow): RpcMain {
    const a = new MessageChannelMain(); // renderer client, main server
    const b = new MessageChannelMain(); // renderer server, main client
    const events = new MessageChannelMain();

    a.port2.start();
    b.port2.start();
    events.port2.start();

    browser.webContents.postMessage(channel, undefined, [a.port1, b.port1, events.port1]);
    return new RpcMain(b.port2, a.port2, events.port2);
  }
}
