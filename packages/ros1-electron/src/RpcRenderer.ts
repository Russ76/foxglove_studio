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

  static windowMessagePorts = new Map<string, readonly MessagePort[]>();
  static windowMessageHandlers = new Map<string, (ports: readonly MessagePort[]) => void>();

  constructor(clientPort: MessagePort, serverPort: MessagePort, eventPort: MessagePort) {
    this.#clientPort = clientPort;
    this.#serverPort = serverPort;
    this.#eventPort = eventPort;

    // Listen for responses to RPC calls
    this.#clientPort.onmessage = (ev: MessageEvent<RpcResponsePayload>) => {
      const [waitHandle, errMsg, out] = ev.data;
      const callback = this.#callbacks.get(waitHandle);
      if (!callback) {
        // TODO: Log a warning
        return;
      }
      this.#callbacks.delete(waitHandle);

      const err = errMsg != undefined ? new Error(errMsg) : undefined;
      callback(err, out);
    };

    // Listen for incoming RPC calls
    this.#serverPort.onmessage = async (ev: MessageEvent<RpcCallPayload>) => {
      const [method, waitHandle, args] = ev.data;
      const callback = this.#serverHandlers.get(method);
      if (!callback) {
        this.#serverPort.postMessage([waitHandle, `unhandled method "${method}"`, undefined]);
        return;
      }

      const res: RpcResponsePayload = [waitHandle, undefined, undefined];
      try {
        res[2] = await callback(args);
      } catch (err) {
        res[1] = `${err.stack ?? err}`;
      }
      this.#serverPort.postMessage(res);
    };

    // Listen for incoming events
    this.#eventPort.onmessage = (ev: MessageEvent<RpcEventPayload>) => {
      const [eventName, id, data] = ev.data;
      const callback = this.#eventHandlers.get(`${eventName}-${id}`);
      if (!callback) {
        // TODO: Log a warning
        return;
      }

      callback(data);
    };
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
    this.#serverHandlers.set(method, (handler as unknown) as RpcHandler);
  }

  static Initialize(): void {
    window.onmessage = (ev: MessageEvent) => {
      if (ev.target !== window || typeof ev.data !== "string" || ev.ports.length !== 3) {
        return;
      }

      const channel = ev.data as string;
      const handler = RpcRenderer.windowMessageHandlers.get(channel);
      if (handler) {
        RpcRenderer.windowMessageHandlers.delete(channel);
        handler(ev.ports);
      } else {
        RpcRenderer.windowMessagePorts.set(channel, ev.ports);
      }
    };
  }

  static Create(channel: string): Promise<RpcRenderer> {
    return new Promise((resolve, reject) => {
      const resolveWithPorts = (ports: readonly MessagePort[]) => {
        const [clientPort, serverPort, eventPort] = ports;
        if (!clientPort || !serverPort || !eventPort) {
          reject(new Error(`received a message on channel ${channel} with missing ports`));
          return;
        }

        resolve(new RpcRenderer(clientPort, serverPort, eventPort));
      };

      const ports = RpcRenderer.windowMessagePorts.get(channel);
      if (ports != undefined) {
        // The ports were already posted before this call
        RpcRenderer.windowMessagePorts.delete(channel);
        resolveWithPorts(ports);
      } else {
        // The ports have not been posted yet. Register a callback and wait
        RpcRenderer.windowMessageHandlers.set(channel, resolveWithPorts);
      }
    });
  }
}
