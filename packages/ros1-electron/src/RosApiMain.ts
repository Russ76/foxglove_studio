// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TcpServer, TcpSocket, XmlRpcClient, XmlRpcServer } from "@foxglove/ros1";
import {
  PlatformNode,
  TcpServerNode,
  TcpSocketNode,
  XmlRpcClientNode,
  XmlRpcServerNode,
} from "@foxglove/ros1-nodejs";
import { URL } from "whatwg-url";

import { RpcMain } from "./RpcMain";
import { SocketInfo } from "./RpcTypes";

export class RosApiMain {
  #tcpSockets = new Map<number, TcpSocket>();
  #tcpServers = new Map<number, TcpServer>();
  #xmlRpcClients = new Map<number, XmlRpcClient>();
  #xmlRpcServers = new Map<number, XmlRpcServer>();
  #nextId = 0;

  constructor(rpc: RpcMain) {
    rpc.handleMethod("GetPid", () => PlatformNode.GetPid());

    rpc.handleMethod("GetDefaultRosMasterUri", () =>
      PlatformNode.GetDefaultRosMasterUri().then((url) => String(url)),
    );

    rpc.handleMethod("GetHostname", () => PlatformNode.GetHostname());

    rpc.handleMethod("TcpSocket_Create", async (options) => {
      const socket = await TcpSocketNode.Connect(options);
      const socketId = this._nextId();
      const localAddress = socket.localAddress();
      const remoteAddress = socket.remoteAddress();
      const fd = socket.fd();
      if (!localAddress || !remoteAddress) {
        throw new Error(`tcp socket creation failed`);
      }

      socket.on("close", () => rpc.emit("TcpSocket_onClose", socketId, undefined));
      socket.on("end", () => rpc.emit("TcpSocket_onEnd", socketId, undefined));
      socket.on("timeout", () => rpc.emit("TcpSocket_onTimeout", socketId, undefined));
      socket.on("error", (e) => rpc.emit("TcpSocket_onError", socketId, e.stack ?? String(e)));
      socket.on("message", (data) => rpc.emit("TcpSocket_onMessage", socketId, data));

      this.#tcpSockets.set(socketId, socket);
      return { socketId, localAddress, remoteAddress, fd };
    });

    rpc.handleMethod("TcpSocket_close", (socketId) => {
      const socket = this.#tcpSockets.get(socketId);
      socket?.close();
      return Promise.resolve();
    });

    rpc.handleMethod("TcpSocket_write", ([socketId, data]) => {
      const socket = this.#tcpSockets.get(socketId);
      if (!socket) {
        rpc.emit("TcpSocket_onError", socketId, `tcp socket ${socketId} not found`);
        return Promise.resolve();
      }
      return socket.write(data);
    });

    rpc.handleMethod("TcpServer_Create", async (options) => {
      const server = await TcpServerNode.Listen(options);
      const serverId = this._nextId();
      const address = server.address();
      if (!address) {
        throw new Error(`tcp server creation failed`);
      }

      server.on("close", () => rpc.emit("TcpServer_onClose", serverId, undefined));
      server.on("error", (e) => rpc.emit("TcpServer_onError", serverId, e.stack ?? String(e)));
      server.on("connection", (socket) => {
        const socketId = this._nextId();
        const localAddress = socket.localAddress();
        const remoteAddress = socket.remoteAddress();
        const fd = socket.fd();
        if (!localAddress || !remoteAddress) {
          // TODO: Log a warning about a broken incoming connection
          return;
        }

        this.#tcpSockets.set(socketId, socket);
        const socketInfo: SocketInfo = { socketId, remoteAddress, localAddress, fd };
        rpc.emit("TcpServer_onConnection", serverId, socketInfo);
      });

      this.#tcpServers.set(serverId, server);
      return { serverId, address };
    });

    rpc.handleMethod("XmlRpcClient_Create", async (options) => {
      const url = new URL(options.url);
      const client = await XmlRpcClientNode.Create({ url });
      const clientId = this._nextId();

      this.#xmlRpcClients.set(clientId, client);
      return { clientId };
    });

    rpc.handleMethod("XmlRpcClient_methodCall", async ({ clientId, method, args }) => {
      const client = this.#xmlRpcClients.get(clientId);
      if (!client) {
        throw new Error(`xmlrpc client ${clientId} not found`);
      }
      return client?.methodCall(method, args);
    });

    rpc.handleMethod("XmlRpcServer_Create", async (options) => {
      const server = await XmlRpcServerNode.Create(options);
      const serverId = this._nextId();
      const address = server.address();
      if (!address) {
        throw new Error(`xmlrpc server creation failed`);
      }

      server.on("close", () => rpc.emit("XmlRpcServer_onClose", serverId, undefined));
      server.on("error", (e) => rpc.emit("XmlRpcServer_onError", serverId, e.stack ?? String(e)));

      this.#xmlRpcServers.set(serverId, server);
      return { serverId, address };
    });

    rpc.handleMethod("XmlRpcServer_close", (serverId) => {
      const server = this.#xmlRpcServers.get(serverId);
      server?.close();
      return Promise.resolve();
    });

    rpc.handleMethod("XmlRpcServer_addMethod", ({ serverId, method }) => {
      const server = this.#xmlRpcServers.get(serverId);
      server?.addMethod(method, (args) =>
        rpc.call("XmlRpcServer_onMethodCall", { serverId, method, args }),
      );
      return Promise.resolve();
    });
  }

  private _nextId(): number {
    return this.#nextId++;
  }
}
