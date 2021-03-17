// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { URL } from "whatwg-url";

import { TcpServer, TcpSocket, XmlRpcClient, XmlRpcHandler, XmlRpcServer } from "@foxglove/ros1";

import { RpcRenderer } from "./RpcRenderer";
import { TcpServerRenderer } from "./TcpServerRenderer";
import { TcpSocketRenderer } from "./TcpSocketRenderer";
import { XmlRpcClientRenderer } from "./XmlRpcClientRenderer";
import { XmlRpcServerRenderer } from "./XmlRpcServerRenderer";

export class RosApiRenderer {
  #rpc: RpcRenderer;
  #xmlRpcHandlers = new Map<string, XmlRpcHandler>();

  constructor(rpc: RpcRenderer) {
    this.#rpc = rpc;

    rpc.handleMethod("XmlRpcServer_onMethodCall", async ({ serverId, method, args }) => {
      const handler = this.#xmlRpcHandlers.get(`${method}-${serverId}`);
      if (!handler) {
        throw new Error(`no handler for method "${method}" on xmlrpc server ${serverId}`);
      }
      return handler(args);
    });
  }

  GetPid = (): Promise<number> => {
    return this.#rpc.call("GetPid", undefined);
  };

  GetDefaultRosMasterUri = (): Promise<URL> => {
    return this.#rpc.call("GetDefaultRosMasterUri", undefined).then((url) => new URL(url));
  };

  GetHostname = (): Promise<string> => {
    return this.#rpc.call("GetHostname", undefined);
  };

  TcpListen = async (options: {
    host?: string;
    port?: number;
    backlog?: number;
  }): Promise<TcpServer> => {
    const { serverId, address } = await this.#rpc.call("TcpServer_Create", options);
    return new TcpServerRenderer(this.#rpc, serverId, address);
  };

  TcpSocketCreate = async (options: { host: string; port: number }): Promise<TcpSocket> => {
    const socketId = await this.#rpc.call("TcpSocket_Create", options);
    return new TcpSocketRenderer(this.#rpc, options.host, options.port, socketId);
  };

  XmlRpcCreateClient = async (options: { url: URL }): Promise<XmlRpcClient> => {
    const url = String(options.url);
    const { clientId } = await this.#rpc.call("XmlRpcClient_Create", { url });
    return new XmlRpcClientRenderer(this.#rpc, clientId, options.url);
  };

  XmlRpcCreateServer = async (options: {
    hostname: string;
    port?: number;
  }): Promise<XmlRpcServer> => {
    const { serverId, address } = await this.#rpc.call("XmlRpcServer_Create", options);
    return new XmlRpcServerRenderer(this, this.#rpc, serverId, address);
  };

  addXmlRpcServerMethodHandler(method: string, serverId: number, handler: XmlRpcHandler): void {
    this.#xmlRpcHandlers.set(`${method}-${serverId}`, handler);
  }

  static Initialize(): void {
    RpcRenderer.Initialize();
  }

  static async Create(channel: string): Promise<RosApiRenderer> {
    const rpc = await RpcRenderer.Create(channel);
    return new RosApiRenderer(rpc);
  }
}
