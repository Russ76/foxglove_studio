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

import { Chart, ChartData, ChartOptions, ChartDataset, ChartType } from "chart.js";
import type { Context as DatalabelContext } from "chartjs-plugin-datalabels";
import { Zoom as ZoomPlugin } from "chartjs-plugin-zoom";
import EventEmitter from "eventemitter3";

type Unpack<A> = A extends Array<infer E> ? E : A;
//type Meta = ReturnType<Chart["getDatasetMeta"]>;
//type MetaData = Unpack<Meta["data"]>;

// allows us to override the chart.ctx instance field which zoom plugin uses for adding event listeners
type MutableContext = Omit<Chart, "ctx"> & { ctx: any };

type EventElement = {
  data: Unpack<ChartDataset["data"]>;
  //view: MetaData["_view"];
};

function addEventListener(emitter: EventEmitter) {
  return (eventName: string, fn?: () => void) => {
    const existing = emitter.listeners(eventName);
    if (!fn || existing.includes(fn)) {
      return;
    }

    emitter.on(eventName, fn);
  };
}

function removeEventListener(emitter: EventEmitter) {
  return (eventName: string, fn?: () => void) => {
    fn && emitter.off(eventName, fn);
  };
}

export default class ChartJSManager {
  #chartInstance: Chart;
  #fakeNodeEvents = new EventEmitter();
  #fakeDocumentEvents = new EventEmitter();
  #lastDatalabelClickContext?: DatalabelContext = undefined;

  constructor({
    node,
    type,
    data,
    options,
    devicePixelRatio,
  }: {
    id: string;
    node: OffscreenCanvas;
    type: ChartType;
    data: ChartData;
    options: ChartOptions;
    devicePixelRatio: number;
  }) {
    const fakeNode = {
      addEventListener: addEventListener(this.#fakeNodeEvents),
      removeEventListener: removeEventListener(this.#fakeNodeEvents),
      ownerDocument: {
        addEventListener: addEventListener(this.#fakeDocumentEvents),
        removeEventListener: removeEventListener(this.#fakeDocumentEvents),
      },
    };

    const origZoomStart = ZoomPlugin.start;
    ZoomPlugin.start = (chartInstance: MutableContext, args, pluginOptions) => {
      // swap the canvas with our fake dom node canvas to support zoom plugin addEventListener
      const ctx = chartInstance.ctx;
      chartInstance.ctx = {
        canvas: fakeNode as any,
      };
      const res = origZoomStart?.(chartInstance, args, pluginOptions);
      chartInstance.ctx = ctx;
      return res;
    };

    const chartInstance = new Chart(node, {
      type,
      data,
      options: {
        ...this.addFunctionsToConfig(options),
        devicePixelRatio,
      },
      plugins: [ZoomPlugin],
    });

    ZoomPlugin.start = origZoomStart;
    this.#chartInstance = chartInstance;
  }

  wheel(event: any) {
    event.target.getBoundingClientRect = () => event.target.boundingClientRect;
    this.#fakeNodeEvents.emit("wheel", event);
  }

  mousedown(event: any) {
    event.target.getBoundingClientRect = () => event.target.boundingClientRect;
    this.#fakeNodeEvents.emit("mousedown", event);
  }

  mousemove(event: any) {
    event.target.getBoundingClientRect = () => event.target.boundingClientRect;
    this.#fakeNodeEvents.emit("mousemove", event);
  }

  mouseup(event: any) {
    event.target.getBoundingClientRect = () => event.target.boundingClientRect;
    // up is registered on the _document_ by zoom plugin
    this.#fakeDocumentEvents.emit("mouseup", event);
  }

  update({ data, options }: { data: ChartData; options: ChartOptions }): void {
    data;
    options;
    const instance = this.#chartInstance;

    if (!instance) {
      return;
    }
    /*

    if (options) {
      options = this._addFunctionsToConfig(options, scaleOptions);
      chartInstance.options = Chart.helpers.configMerge(chartInstance.options, options);
    }

    // Pipe datasets to chart instance datasets enabling
    // seamless transitions
    const currentDatasets = this._chartInstance?.config?.data?.datasets ?? [];
    const nextDatasets = (data && data.datasets) || [];
    this._checkDatasets(currentDatasets);

    const currentDatasetsIndexed = keyBy(currentDatasets, datasetKeyProvider);

    const datasets = nextDatasets.map((next) => {
      const current = currentDatasetsIndexed[datasetKeyProvider(next) ?? ""];

      if (current && current.type === next.type && next.data) {
        // Be robust to no data. Relevant for other update mechanisms as in chartjs-plugin-streaming.
        // The data array must be edited in place. As chart.js adds listeners to it.
        if (current.data) {
          current.data.splice(next.data.length);
          if (next.data) {
            const currentData = current.data;
            next.data.forEach(
              // eslint-disable-next-line no-restricted-syntax
              (value: number | number[] | Chart.ChartPoint | null | undefined, pid: number) => {
                currentData[pid] = value;
              },
            );
          }
        }

        const otherDatasetProps = omit(next, "data");
        // Merge properties. Notice a weakness here. If a property is removed
        // from next, it will be retained by current and never disappears.
        // Workaround is to set value to null or undefined in next.
        return {
          ...current,
          ...otherDatasetProps,
        };
      }
      return next;
    });


    const otherDataProps = omit(data, "datasets");

    chartInstance.config.data = {
      ...chartInstance.config.data,
      ...otherDataProps,
    };

    // We can safely replace the dataset array, as long as we retain the _meta property
    // on each dataset.
    chartInstance.config.data.datasets = datasets;
    */

    instance.update();
  }

  destroy(): void {
    this.#chartInstance?.destroy();
  }

  // Get the closest element at the same x-axis value as the cursor.
  // This is a somewhat complex function because we attempt to copy the same behavior that the built-in tooltips have
  // for Chart.js without a direct API for it.
  getElementAtXAxis({ event }: { event: Event }): EventElement | undefined {
    event;
    // fixme I think chartjs has this exposed now
    return undefined;
  }

  getDatalabelAtEvent({ event }: { event: Event }): unknown {
    const chartInstance = this.#chartInstance;
    chartInstance.notifyPlugins("beforeEvent", { event });

    // clear the stored click context - we have consumed it
    const context = this.#lastDatalabelClickContext;
    this.#lastDatalabelClickContext = undefined;

    return context?.dataset.data[context.dataIndex];
  }

  // Since we cannot serialize functions over rpc, we add their handling here
  private addFunctionsToConfig(config: ChartOptions): typeof config {
    if (config.plugins) {
      config.plugins.zoom = {
        zoom: {
          enabled: true,
          speed: 0.1,
          //drag: true,
        },
        pan: {
          enabled: true,
        },
      };
    }

    if (config && config.plugins?.datalabels) {
      // process _click_ events to get the label we clicked on
      // this is because datalabels does not export any public methods to lookup the clicked label
      // maybe we contribute a patch upstream with the explanation for web-worker use
      config.plugins.datalabels.listeners = {
        click: (context: DatalabelContext) => {
          this.#lastDatalabelClickContext = context;
        },
      };

      // This controls which datalabels are displayed. Only display labels for datapoints that include a "label"
      // property.
      config.plugins.datalabels.formatter = (value: any, _context: any) => {
        const label = value?.label;
        // We have to return "null" if we don't want this label to be displayed. Returning "undefined" falls back to the
        // default formatting.
        // eslint-disable-next-line no-restricted-syntax
        return label != undefined ? label : null;
      };

      // Override color so that it can be set per-dataset.
      const staticColor = config.plugins.datalabels.color ?? "white";
      config.plugins.datalabels.color = (context: any) => {
        const value = context.dataset.data[context.dataIndex];
        return value?.labelColor ?? staticColor;
      };
    }

    /*
    if (scaleOptions) {
      for (const scale of config.scales.yAxes) {
        if (scaleOptions.fixedYAxisWidth != undefined) {
          scale.afterFit = (scaleInstance: any) => {
            scaleInstance.width = scaleOptions.fixedYAxisWidth;
          };
        }
        scale.ticks = scale.ticks || {};
        if (scaleOptions.yAxisTicks === "hide") {
          scale.ticks.callback = hideAllTicksScaleCallback;
        } else if (scaleOptions.yAxisTicks === "hideFirstAndLast") {
          scale.ticks.callback = hideFirstAndLastTicksScaleCallback;
        }
      }

      for (const scale of config.scales.xAxes) {
        scale.ticks = scale.ticks || {};
        if (scaleOptions.xAxisTicks) {
          if (scaleOptions.xAxisTicks === "displayXAxesTicksInSeconds") {
            scale.ticks.callback = displayTicksInSecondsCallback;
          } else {
            scale.ticks.callback = hideFirstAndLastTicksScaleCallback;
          }
        }
      }
    }
    */

    return config;
  }
}
