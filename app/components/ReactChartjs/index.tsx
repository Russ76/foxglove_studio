// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ChartOptions, ChartData, Scale } from "chart.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { RpcScales } from "@foxglove-studio/app/components/ReactChartjs/types";
import WebWorkerManager from "@foxglove-studio/app/util/WebWorkerManager";

// Webworker Manager wants a constructor so we need to have a "class" wrapper
class ChartJSWorker {
  constructor() {
    return new Worker(new URL("./worker/main", import.meta.url));
  }
}

type Props = {
  id?: string;
  data: ChartData;
  options: ChartOptions;
  type: string;
  height: number;
  width: number;
  onClick?: (arg0: React.MouseEvent<HTMLCanvasElement>, datalabel: unknown) => void;
  //onPanZoom?: (arg0: ScaleBounds[]) => void;

  // called when the chart scales have updated
  onScalesUpdate?: (scales: RpcScales) => void;

  // fixme - I think the message pipeline needs this to know when rendering is complete
  onChartUpdate?: () => void;
};

const devicePixelRatio = window.devicePixelRatio ?? 1;

// why do we limit to 4 workers? why not 2? 8?
const webWorkerManager = new WebWorkerManager(ChartJSWorker, 4);

// turn a React.MouseEvent into an object we can send over rpc
function rpcMouseEvent(event: React.MouseEvent<HTMLCanvasElement>) {
  const boundingRect = event.currentTarget.getBoundingClientRect();

  return {
    cancelable: false,
    clientX: event.clientX,
    clientY: event.clientY,
    target: {
      boundingClientRect: boundingRect.toJSON(),
    },
  };
}

// Chart component renders data using workers with chartjs offscreen canvas
function Chart(props: Props) {
  // note that props.id is only used on first render
  const [id] = useState(props.id ?? uuidv4);
  const initialized = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(ReactNull);
  const [currentScales, setScales] = useState<RpcScales | undefined>(undefined);

  const zoomEnabled = props.options.plugins?.zoom?.zoom?.enabled;

  const { type, data, options, width, height } = props;

  const rpc = useMemo(() => {
    return webWorkerManager.registerWorkerListener(id);
  }, [id]);

  // helper function to send rpc to our worker - all invocations need an _id_ so we inject it here
  const rpcSend = useCallback(
    (topic: string, payload?: any, transferrables?: unknown[]) => {
      return rpc.send<RpcScales>(topic, { id, ...payload }, transferrables);
    },
    [id, rpc],
  );

  useEffect(() => {
    return () => {
      // If this component will unmount, resolve any pending update callbacks.
      //objectValues(this._onEndChartUpdateCallbacks).forEach((callback) => callback());
      //this._onEndChartUpdateCallbacks = {};

      rpcSend("destroy");
      webWorkerManager.unregisterWorkerListener(id);
    };
  }, [id, rpcSend]);

  const maybeUpdateScales = useCallback((newScales: RpcScales) => {
    setScales((oldScales) => {
      // cheap hack to only update the scales when the values change
      // avoids triggering handlers that depend on scales
      const oldStr = JSON.stringify(oldScales);
      const newStr = JSON.stringify(newScales);
      return oldStr === newStr ? oldScales : newScales;
    });
  }, []);

  // trigger when scales update
  const onScalesUpdate = props.onScalesUpdate;
  useEffect(() => {
    if (currentScales) {
      onScalesUpdate?.(currentScales);
    }
  }, [onScalesUpdate, currentScales]);

  // on mount
  useEffect(() => {
    // initialization happens once - even if the props for this effect change
    if (initialized.current) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (!canvas.transferControlToOffscreen) {
      throw new Error(
        "ReactChartJS currently only works with browsers with offscreen canvas support",
      );
    }

    initialized.current = true;
    const offscreenCanvas = canvas.transferControlToOffscreen();

    (async function () {
      const scales = await rpcSend(
        "initialize",
        {
          node: offscreenCanvas,
          type,
          data,
          options,
          devicePixelRatio,
          width,
          height,
        },
        [offscreenCanvas],
      );
      maybeUpdateScales(scales);
    })();
  }, [type, data, options, width, height, rpcSend, maybeUpdateScales]);

  // update remote data
  useEffect(() => {
    (async function () {
      const scales = await rpcSend("update", {
        data,
        options,
        width,
        height,
      });
      maybeUpdateScales(scales);
    })();
  }, [data, height, maybeUpdateScales, options, rpcSend, width]);

  const onWheel = useCallback(
    async (event: React.WheelEvent<HTMLCanvasElement>) => {
      if (!zoomEnabled) {
        return;
      }

      const boundingRect = event.currentTarget.getBoundingClientRect();
      const scales = await rpcSend("wheel", {
        event: {
          cancelable: false,
          deltaY: event.deltaY,
          deltaX: event.deltaX,
          clientX: event.clientX,
          clientY: event.clientY,
          target: {
            boundingClientRect: boundingRect.toJSON(),
          },
        },
      });
      maybeUpdateScales(scales);
    },
    [zoomEnabled, rpcSend, maybeUpdateScales],
  );

  const onMouseDown = useCallback(
    async (event: React.MouseEvent<HTMLCanvasElement>) => {
      const scales = await rpcSend("mousedown", {
        event: rpcMouseEvent(event),
      });

      maybeUpdateScales(scales);
    },
    [maybeUpdateScales, rpcSend],
  );

  const onMouseUp = useCallback(
    async (event: React.MouseEvent<HTMLCanvasElement>) => {
      rpcSend("mouseup", {
        event: rpcMouseEvent(event),
      });
    },
    [rpcSend],
  );

  const onMouseMove = useCallback(
    async (event: React.MouseEvent<HTMLCanvasElement>) => {
      // fixme if not down we don't need to send to rpc?

      const scales = await rpcSend("mousemove", {
        event: rpcMouseEvent(event),
      });
      maybeUpdateScales(scales);
    },
    [maybeUpdateScales, rpcSend],
  );

  const onClick = useCallback(
    async (event: React.MouseEvent<HTMLCanvasElement>): Promise<void> => {
      if (!props.onClick) {
        return;
      }

      // fixme - maybe we don't need to pass event to onClick and instead user only cares about the values?
      // then we don't need to persist the event
      event.persist();

      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // maybe we should forward the click event and add support for datalabel listeners
      // the rpc channel doesn't have a way to send rpc back...
      const datalabel = await rpcSend("getDatalabelAtEvent", {
        event: { x, y, type: "click" },
      });
      props.onClick?.(event, datalabel);
    },
    [props, rpcSend],
  );

  return (
    <canvas
      ref={canvasRef}
      height={height / devicePixelRatio}
      width={width / devicePixelRatio}
      id={id}
      onWheel={onWheel}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      style={{ width, height }}
    />
  );
}

export default Chart;
