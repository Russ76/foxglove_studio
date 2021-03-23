// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { storiesOf } from "@storybook/react";
import cloneDeep from "lodash/cloneDeep";
import { useState, useCallback } from "react";

import { MockMessagePipelineProvider } from "@foxglove-studio/app/components/MessagePipeline";
import { triggerWheel } from "@foxglove-studio/app/stories/PanelSetup";

import TimeBasedChart from "./index";
import type { Props } from "./index";

const dataX = 0.000057603000000000004;
const dataY = 5.544444561004639;
//const path = "/turtle1/pose.x";
// fixme - this should not be _any_
const tooltipData: any = {
  x: dataX,
  y: dataY,
  item: {
    headerStamp: undefined,
    receiveTime: { sec: 1396293889, nsec: 214366 },
    queriedData: [{ constantName: "", value: 5.544444561004639, path: "/turtle1/pose.x" }],
  },
  path: "/turtle1/pose.x",
  datasetKey: "0",
  value: 5.544444561004639,
  startTime: { sec: 1396293889, nsec: 156763 },
};

const commonProps: Props = {
  isSynced: true,
  zoom: true,
  width: 867.272705078125,
  height: 1139.1051025390625,
  data: {
    datasets: [
      {
        borderColor: "#4e98e2",
        label: "/turtle1/pose.x",
        showLine: true,
        borderWidth: 1,
        pointRadius: 1.5,
        pointHoverRadius: 3,
        pointBackgroundColor: "#74beff",
        pointBorderColor: "transparent",
        //path,
        data: [
          {
            x: dataX,
            y: dataY,
          },
        ],
      },
      {
        borderColor: "#f5774d",
        label: "a42771fb-b547-4c61-bbaa-9059dec68e49",
        showLine: true,
        borderWidth: 1,
        pointRadius: 1.5,
        pointHoverRadius: 3,
        pointBackgroundColor: "#ff9d73",
        pointBorderColor: "transparent",
        data: [],
        //path: "",
      },
    ],
  },
  tooltips: [tooltipData],
  annotations: [],
  type: "scatter",
  xAxes: {
    ticks: { precision: 3 },
    grid: { color: "rgba(255, 255, 255, 0.2)" },
  },
  yAxes: {
    ticks: { precision: 3 },
    grid: { color: "rgba(255, 255, 255, 0.2)" },
  },
  xAxisIsPlaybackTime: true,
};

const DEFAULT_DELAY = 500;

function CleansUpTooltipExample() {
  const [hasRenderedOnce, setHasRenderedOnce] = useState<boolean>(false);
  const refFn = useCallback(() => {
    setTimeout(() => {
      const [canvas] = document.getElementsByTagName("canvas");
      const { top, left } = canvas!.getBoundingClientRect();
      document.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 363 + left, clientY: 650 + top }),
      );
      setTimeout(() => {
        setHasRenderedOnce(true);
      }, 100);
    }, 200);
  }, []);
  return (
    <div style={{ width: "100%", height: "100%", background: "black" }} ref={refFn}>
      <MockMessagePipelineProvider>
        {!hasRenderedOnce && <TimeBasedChart {...commonProps} />}
      </MockMessagePipelineProvider>
    </div>
  );
}

function ZoomExample() {
  const [, forceUpdate] = useState(0);
  const newProps = cloneDeep(commonProps);
  const newDataPoint = cloneDeep(newProps.data.datasets[0].data[0]);
  newDataPoint.x = 20;
  newProps.data.datasets[0].data[1] = newDataPoint;

  const refFn = useCallback(() => {
    setTimeout(() => {
      const canvasEl = document.querySelector("canvas");
      // Zoom is a continuous event, so we need to simulate wheel multiple times
      if (canvasEl) {
        for (let i = 0; i < 5; i++) {
          triggerWheel(canvasEl, 1);
        }
        setTimeout(() => {
          forceUpdate((old) => ++old);
        }, 10);
      }
    }, 200);
  }, []);

  return (
    <div style={{ width: 800, height: 800, background: "black" }} ref={refFn}>
      <MockMessagePipelineProvider>
        <TimeBasedChart {...newProps} width={800} height={800} />
      </MockMessagePipelineProvider>
    </div>
  );
}

function PauseFrameExample(props: Props) {
  const [, forceUpdate] = useState(0);
  const [unpauseFrameCount, setUnpauseFrameCount] = useState(0);
  const pauseFrame = useCallback(() => {
    return () => {
      // Set a limit here to avoid unlimited cascading updates.
      if (unpauseFrameCount < 2) {
        setUnpauseFrameCount(unpauseFrameCount + 1);
      }
    };
  }, [unpauseFrameCount, setUnpauseFrameCount]);

  const refFn = useCallback(() => {
    setTimeout(() => {
      forceUpdate(1);
    }, 200);
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", background: "black" }} ref={refFn}>
      <div style={{ fontSize: 20, padding: 6 }}>
        Finished pause frame count: {unpauseFrameCount}
      </div>
      <MockMessagePipelineProvider pauseFrame={pauseFrame}>
        <TimeBasedChart {...props} data={{ ...props.data }} />
      </MockMessagePipelineProvider>
    </div>
  );
}

// We should still call resumeFrame exactly once when removed in the middle of an update.
// The way this test works:
// - start by rendering the chart normally
// - after the timeout (chart should be rendered), force a re-render of the chart.
// - This rerender updates the chart, which calls `pauseFrame` until the chart has finished updating
// - in `pauseFrame`, trigger an update that removes the chart. This happens before the returned function
// (`resumeFrame`) fires.
// - `resumeFrame` should then fire exactly once.
function RemoveChartExample(props: Props) {
  const [, forceUpdate] = useState(0);
  const [showChart, setShowChart] = useState(true);
  const [statusMessage, setStatusMessage] = useState("FAILURE - START");
  const pauseFrame = useCallback(() => {
    if (showChart) {
      setShowChart(false);
    }
    return () => {
      if (statusMessage === "FAILURE - START") {
        setStatusMessage("SUCCESS");
      } else {
        setStatusMessage("FAILURE - CANNOT CALL RESUME FRAME TWICE");
      }
    };
  }, [showChart, setShowChart, statusMessage, setStatusMessage]);

  const refFn = useCallback(() => {
    setTimeout(() => {
      forceUpdate(1);
    }, 200);
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", background: "black" }} ref={refFn}>
      <MockMessagePipelineProvider pauseFrame={pauseFrame}>
        <div style={{ fontSize: 48, padding: 50 }}>{statusMessage}</div>
        {showChart && <TimeBasedChart {...props} data={{ ...props.data }} />}
      </MockMessagePipelineProvider>
    </div>
  );
}

storiesOf("<TimeBasedChart>", module)
  .addParameters({
    screenshot: {
      delay: 1500,
    },
  })
  .add("default", () => {
    return (
      <div style={{ width: "100%", height: "100%", background: "black" }}>
        <MockMessagePipelineProvider>
          <TimeBasedChart {...commonProps} />
        </MockMessagePipelineProvider>
      </div>
    );
  })
  .add("with vertical bar, no tooltip", () => {
    return (
      <div
        style={{ width: "100%", height: "100%", background: "black" }}
        ref={() => {
          setTimeout(() => {
            const [canvas] = document.getElementsByTagName("canvas");
            const { top, left } = canvas!.getBoundingClientRect();
            // This will show the vertical bar but not the tooltip because the mouse is on top of a different element
            // (in this case the document), not the canvas itself.
            document.dispatchEvent(
              new MouseEvent("mousemove", { clientX: 363 + left, clientY: 400 + top }),
            );
          }, DEFAULT_DELAY);
        }}
      >
        <MockMessagePipelineProvider>
          <TimeBasedChart {...commonProps} />
        </MockMessagePipelineProvider>
      </div>
    );
  })
  .add("with tooltip and vertical bar", () => {
    return (
      <div
        style={{ width: "100%", height: "100%", background: "black" }}
        ref={() => {
          setTimeout(() => {
            const [canvas] = document.getElementsByTagName("canvas");
            const { top, left } = canvas!.getBoundingClientRect();
            canvas!.dispatchEvent(
              new MouseEvent("mousemove", { clientX: 363 + left, clientY: 400 + top }),
            );
          }, DEFAULT_DELAY);
        }}
      >
        <MockMessagePipelineProvider>
          <TimeBasedChart {...commonProps} />
        </MockMessagePipelineProvider>
      </div>
    );
  })
  .add("can zoom and then update with new data without resetting the zoom", () => <ZoomExample />, {
    screenshot: { delay: 3000 },
  })
  .add("cleans up the tooltip when removing the panel", () => <CleansUpTooltipExample />)
  .add("should call pauseFrame twice", () => <PauseFrameExample {...commonProps} />)
  .add(
    "should still call resumeFrame when removed in the middle of an update (shows `SUCCESS` message with no chart visible)",
    () => <RemoveChartExample {...commonProps} />,
  );
