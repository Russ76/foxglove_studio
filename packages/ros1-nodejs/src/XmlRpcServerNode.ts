// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../typings/xmlrpc-rosnodejs.d.ts" />

import type { XmlRpcValue, XmlRpcResponse, XmlRpcServer, HttpAddress } from "@foxglove/ros1";
import EventEmitter from "eventemitter3";
import { default as xmlrpc } from "xmlrpc-rosnodejs";

export class XmlRpcServerNode extends EventEmitter implements XmlRpcServer {
  #server: xmlrpc.Server;
  #address?: HttpAddress;

  constructor(server: xmlrpc.Server, address: HttpAddress) {
    super();
    this.#server = server;
    this.#address = address;
  }

  address(): HttpAddress | undefined {
    return this.#address;
  }

  close(): void {
    this.#server.httpServer.close();
    this.#address = undefined;
  }

  addMethod(method: string, handler: (args: XmlRpcValue[]) => Promise<XmlRpcResponse>): this {
    this.#server.on(method, (err, params, callback) => {
      if (err) {
        callback(err, undefined);
        return;
      }

      if (!Array.isArray(params)) {
        params = [params];
      }

      handler(params)
        .then((value) => {
          callback(undefined, value);
        })
        .catch((error) => {
          callback(error, undefined);
        });
    });
    return this;
  }

  static Create(options: { hostname: string; port?: number }): Promise<XmlRpcServer> {
    return new Promise((resolve, reject) => {
      const server = xmlrpc.createServer(options, () => {
        const address = server.httpServer.address();
        if (address !== null && typeof address !== "string") {
          resolve(
            new XmlRpcServerNode(server, {
              hostname: options.hostname,
              port: address.port,
              secure: false,
            }),
          );
        } else {
          reject(
            new Error(`Failed to create an XMLRPC server at ${options.hostname}:${options.port}`),
          );
        }
      });
    });
  }
}
