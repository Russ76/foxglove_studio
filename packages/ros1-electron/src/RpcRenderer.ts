// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  EventCallback,
  RpcCallback,
  RpcCallPayload,
  RpcEventPayload,
  RpcHandler,
  RpcMainEventMap,
  RpcMainMethodMap,
  RpcRendererMethodMap,
  RpcResponsePayload,
} from "./RpcTypes";

export class RpcRenderer {
  #clientPort: MessagePort;
  #serverPort: MessagePort;
  #eventPort: MessagePort;
  #callbacks = new Map<number, RpcCallback>();
  #serverHandlers = new Map<string, RpcHandler>();
  #eventHandlers = new Map<string, EventCallback>();
  #nextWaitHandle = 0;

  constructor(clientPort: MessagePort, serverPort: MessagePort, eventPort: MessagePort) {
    this.#clientPort = clientPort;
    this.#serverPort = serverPort;
    this.#eventPort = eventPort;

    // Listen for responses to RPC calls
    this.#clientPort.addEventListener("message", (ev: MessageEvent<RpcResponsePayload>) => {
      const [waitHandle, errMsg, out] = ev.data;
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
    this.#serverPort.addEventListener("message", async (ev: MessageEvent<RpcCallPayload>) => {
      const [method, waitHandle, args] = ev.data;
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
    this.#eventPort.addEventListener("message", (ev: MessageEvent<RpcEventPayload>) => {
      const [eventName, id, data] = ev.data;
      const callback = this.#eventHandlers.get(`${eventName}-${id}`);
      if (!callback) {
        // TODO: Log a warning
        return;
      }

      callback(data);
    });
  }

  call<K extends keyof RpcRendererMethodMap, V extends RpcRendererMethodMap[K]>(
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

  on<K extends keyof RpcMainEventMap, V extends RpcMainEventMap[K]>(
    eventName: K,
    id: number,
    listener: (data: V) => void,
  ): void {
    this.#eventHandlers.set(`${eventName}-${id}`, listener as EventCallback);
  }

  handleMethod<K extends keyof RpcMainMethodMap, V extends RpcMainMethodMap[K]>(
    method: K,
    handler: (args: V["args"]) => Promise<V["out"]>,
  ): void {
    this.#serverHandlers.set(method, handler as RpcHandler);
  }

  static Create(channel: string): Promise<RpcRenderer> {
    return new Promise((resolve, reject) => {
      window.onmessage = (ev: MessageEvent) => {
        // ev.source === window means the message is coming from the preload
        // script, as opposed to from an <iframe> or other source
        if (ev.source !== window || ev.data !== channel) {
          return;
        }

        const [clientPort, serverPort, eventPort] = ev.ports;
        if (!clientPort || !serverPort || !eventPort) {
          reject(new Error(`received a message on channel ${channel} with missing ports`));
          return;
        }

        resolve(new RpcRenderer(clientPort, serverPort, eventPort));
      };
    });
  }
}
