// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Cloneable, RpcCall, RpcResponse } from "../shared/Rpc";
import { TcpServerRenderer } from "./TcpServerRenderer";
import { TcpSocketRenderer } from "./TcpSocketRenderer";

export class Sockets {
  // The renderer ("main world") side of the original message channel connecting
  // the renderer to the preloader ("isolated world"). Function calls such as
  // createSocket() and createServer() are sent over this port, and function
  // call return values are received back over it
  #messagePort: MessagePort;
  // Completion callbacks for any in-flight RPC calls
  #callbacks = new Map<number, (args: Cloneable[], ports?: readonly MessagePort[]) => void>();
  // Asynchronous RPC calls are tracked using a callId integer
  #nextCallId = 0;

  // A map of created `Sockets` instances, or a promise if creation is in progress
  static registeredSockets = new Map<string, Sockets | Promise<Sockets>>();

  constructor(messagePort: MessagePort) {
    this.#messagePort = messagePort;

    messagePort.onmessage = (ev: MessageEvent<RpcResponse>) => {
      const callId = ev.data[0];
      const args = ev.data.slice(1);
      const callback = this.#callbacks.get(callId);
      if (callback) {
        this.#callbacks.delete(callId);
        callback(args, ev.ports);
      }
    };
  }

  createSocket(transformName?: string): Promise<TcpSocketRenderer> {
    return new Promise((resolve, reject) => {
      const callId = this.#nextCallId++;
      this.#callbacks.set(callId, (_, ports) => {
        const port = ports?.[0];
        if (!port) {
          return reject(new Error("no port returned"));
        }

        resolve(new TcpSocketRenderer(port));
      });

      const msg: RpcCall = ["createSocket", callId, transformName];
      this.#messagePort.postMessage(msg);
    });
  }

  createServer(transformName?: string): Promise<TcpServerRenderer> {
    return new Promise((resolve, reject) => {
      const callId = this.#nextCallId++;
      this.#callbacks.set(callId, (_, ports) => {
        const port = ports?.[0];
        if (!port) {
          return reject(new Error("no port returned"));
        }

        resolve(new TcpServerRenderer(port));
      });

      const msg: RpcCall = ["createServer", callId, transformName];
      this.#messagePort.postMessage(msg);
    });
  }

  // Initialize electron-socket on the renderer side. This method should be called
  // before the window is loaded
  static async Create(channel: string = "__electron_socket"): Promise<Sockets> {
    const entry = Sockets.registeredSockets.get(channel);
    if (entry) {
      const promise = entry as Promise<Sockets>;
      if (typeof promise.then === "function") {
        return promise;
      }
      return Promise.resolve(entry as Sockets);
    }

    const promise = new Promise<Sockets>((resolve) => {
      const messageListener = (windowEv: MessageEvent<string>) => {
        if (windowEv.target !== window || windowEv.data !== channel) {
          return;
        }

        const messagePort = windowEv.ports[0] as MessagePort;
        const sockets = new Sockets(messagePort);
        Sockets.registeredSockets.set(channel, sockets);

        window.removeEventListener("message", messageListener);
        resolve(sockets);
      };
      window.addEventListener("message", messageListener);
    });

    Sockets.registeredSockets.set(channel, promise);
    return promise;
  }
}
