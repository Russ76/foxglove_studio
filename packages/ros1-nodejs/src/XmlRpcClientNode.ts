// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../typings/xmlrpc-rosnodejs.d.ts" />

import { URL } from "whatwg-url";
import { default as xmlrpc } from "xmlrpc-rosnodejs";

import type { XmlRpcClient, XmlRpcValue, XmlRpcResponse } from "@foxglove/ros1";

export class XmlRpcClientNode implements XmlRpcClient {
  readonly serverUrl: URL;

  #client: xmlrpc.Client;

  constructor(serverUrl: URL) {
    this.serverUrl = serverUrl;
    this.#client = xmlrpc.createClient({ url: serverUrl.toString() });
  }

  methodCall(method: string, args: XmlRpcValue[]): Promise<XmlRpcResponse> {
    return new Promise((resolve, reject) => {
      this.#client.methodCall(method, args, (error: Error | undefined, value: XmlRpcResponse) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(value);
      });
    });
  }

  static Create(options: { url: URL }): Promise<XmlRpcClient> {
    return Promise.resolve(new XmlRpcClientNode(options.url));
  }
}
