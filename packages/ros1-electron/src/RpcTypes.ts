// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { HttpAddress, TcpAddress, XmlRpcResponse, XmlRpcValue } from "@foxglove/ros1";

export type RpcValue =
  | string
  | number
  | boolean
  | Uint8Array
  | RpcValue[]
  | { [key: string]: RpcValue }
  | undefined
  | void;

export type RpcCallPayload = [method: string, waitHandle: number, args: RpcValue];

export type RpcResponsePayload = [waitHandle: number, error: string | undefined, out: RpcValue];

export type RpcEventPayload = [eventName: string, id: number, data: RpcValue];

export type RpcPorts = [clientPort: MessagePort, serverPort: MessagePort, eventPort: MessagePort];

export type RpcCallback = (err: Error | undefined, res: unknown) => void;

export type RpcHandler = (args: RpcValue) => Promise<RpcResponsePayload>;

export type EventCallback = (data: RpcValue) => void;

export type SocketInfo = {
  socketId: number;
  remoteAddress: TcpAddress;
  localAddress: TcpAddress;
  fd?: number;
};

export interface RpcCall<Args extends RpcValue, Return extends RpcValue> {
  args: Args;
  out: Return;
}

// RPC methods callable from the renderer and handled by the main process
export interface RpcRendererMethodMap {
  GetPid: RpcCall<void, number>;
  GetDefaultRosMasterUri: RpcCall<void, string>;
  GetHostname: RpcCall<void, string>;

  TcpSocket_Create: RpcCall<{ host: string; port: number }, SocketInfo>;
  TcpSocket_close: RpcCall<number, void>;
  TcpSocket_write: RpcCall<[socketId: number, data: Uint8Array], void>;

  TcpServer_Create: RpcCall<
    { host?: string; port?: number; backlog?: number },
    { serverId: number; address: TcpAddress }
  >;
  TcpServer_close: RpcCall<number, void>;

  XmlRpcClient_Create: RpcCall<{ url: string }, { clientId: number }>;
  XmlRpcClient_methodCall: RpcCall<
    { clientId: number; method: string; args: XmlRpcValue[] },
    XmlRpcResponse
  >;

  XmlRpcServer_Create: RpcCall<
    { hostname: string; port?: number },
    { serverId: number; address: HttpAddress }
  >;
  XmlRpcServer_close: RpcCall<number, void>;
  XmlRpcServer_addMethod: RpcCall<{ serverId: number; method: string }, void>;
}

// RPC methods callable from the main process and received by the renderer
export interface RpcMainMethodMap {
  XmlRpcServer_onMethodCall: RpcCall<
    { serverId: number; method: string; args: XmlRpcValue[] },
    XmlRpcResponse
  >;
}

// RPC events triggered from the main process and received by the renderer
export interface RpcMainEventMap {
  TcpSocket_onClose: undefined;
  TcpSocket_onEnd: undefined;
  TcpSocket_onTimeout: undefined;
  TcpSocket_onError: string;
  TcpSocket_onMessage: Uint8Array;

  TcpServer_onClose: undefined;
  TcpServer_onError: string;
  TcpServer_onConnection: SocketInfo;

  XmlRpcServer_onClose: undefined;
  XmlRpcServer_onError: string;
}
