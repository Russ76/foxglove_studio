// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import {
  Chart,
  LineElement,
  PointElement,
  LineController,
  ScatterController,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  TimeScale,
  TimeSeriesScale,
  Filler,
  Legend,
  Title,
  Tooltip,
} from "chart.js";

import { RpcLike } from "@foxglove-studio/app/util/FakeRpc";
import Rpc from "@foxglove-studio/app/util/Rpc";
import { setupWorker } from "@foxglove-studio/app/util/RpcWorkerUtils";

import ChartJSManager from "./ChartJSManager";

// fixme - move these into the specific chart instance in ChartJSManager
Chart.register(
  LineElement,
  PointElement,
  LineController,
  ScatterController,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  TimeScale,
  TimeSeriesScale,
  Filler,
  Legend,
  Title,
  Tooltip,
);

// Since we use a capped number of web-workers, a single web-worker may be running multiple chartjs instances
// The ChartJsWorkerMux forwards an rpc request for a specific chartjs instance id to the appropriate instance
export default class ChartJsMux {
  #rpc: RpcLike;
  #managers = new Map<string, ChartJSManager>();

  constructor(rpc: RpcLike) {
    this.#rpc = rpc;

    // fixme - why are we checking instanceof here?
    if (this.#rpc instanceof Rpc) {
      setupWorker(this.#rpc);
    }

    // create a new chartjs instance
    // this must be done before sending any other rpc requests to the instance
    rpc.receive("initialize", (args: any) => {
      const manager = new ChartJSManager(args);
      this.#managers.set(args.id, manager);
      return manager.getScales();
    });
    rpc.receive("wheel", (args: any) => this.#managers.get(args.id)?.wheel(args.event));
    rpc.receive("mousedown", (args: any) => this.#managers.get(args.id)?.mousedown(args.event));
    rpc.receive("mousemove", (args: any) => this.#managers.get(args.id)?.mousemove(args.event));
    rpc.receive("mouseup", (args: any) => this.#managers.get(args.id)?.mouseup(args.event));

    rpc.receive("update", (args: any) => this.#managers.get(args.id)?.update(args));
    rpc.receive("destroy", (args: any) => {
      const manager = this.#managers.get(args.id);
      if (manager) {
        manager.destroy();
        this.#managers.delete(args.id);
      }
    });
    rpc.receive("getElementsAtEvent", (args: any) =>
      this.#managers.get(args.id)?.getElementsAtEvent(args),
    );
    rpc.receive("getDatalabelAtEvent", (args: any) =>
      this.#managers.get(args.id)?.getDatalabelAtEvent(args),
    );
  }
}
