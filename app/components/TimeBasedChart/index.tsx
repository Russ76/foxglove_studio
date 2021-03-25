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
import { ChartOptions, ScaleOptionsByType, ChartDataset } from "chart.js";
import { AnnotationOptions } from "chartjs-plugin-annotation";
import { ZoomOptions } from "chartjs-plugin-zoom/types/options";
import { sortedUniqBy, uniqBy } from "lodash";
import React, { memo, useEffect, useCallback, useState, useRef, ComponentProps } from "react";
import DocumentEvents from "react-document-events";
import ReactDOM from "react-dom";
import { useDispatch } from "react-redux";
import { Time } from "rosbag";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";

import { clearHoverValue, setHoverValue } from "@foxglove-studio/app/actions/hoverValue";
import Button from "@foxglove-studio/app/components/Button";
import KeyListener from "@foxglove-studio/app/components/KeyListener";
import {
  MessageAndData,
  MessagePathDataItem,
} from "@foxglove-studio/app/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useMessagePipeline } from "@foxglove-studio/app/components/MessagePipeline";
import ChartComponent from "@foxglove-studio/app/components/ReactChartjs/index";
import { RpcElement, RpcScales } from "@foxglove-studio/app/components/ReactChartjs/types";
import TimeBasedChartLegend from "@foxglove-studio/app/components/TimeBasedChart/TimeBasedChartLegend";
import Tooltip from "@foxglove-studio/app/components/Tooltip";
import mixins from "@foxglove-studio/app/styles/mixins.module.scss";
import { isBobject } from "@foxglove-studio/app/util/binaryObjects";
import { useDeepChangeDetector } from "@foxglove-studio/app/util/hooks";
import { defaultGetHeaderStamp } from "@foxglove-studio/app/util/synchronizeMessages";
import { maybeGetBobjectHeaderStamp } from "@foxglove-studio/app/util/time";

import HoverBar from "./HoverBar";
import TimeBasedChartTooltip from "./TimeBasedChartTooltip";

export type TooltipItem = {
  queriedData: MessagePathDataItem[];
  receiveTime: Time;
  headerStamp?: Time;
};

export const getTooltipItemForMessageHistoryItem = (item: MessageAndData): TooltipItem => {
  const { message } = item.message;
  const headerStamp = isBobject(message)
    ? maybeGetBobjectHeaderStamp(message)
    : defaultGetHeaderStamp(message);
  return { queriedData: item.queriedData, receiveTime: item.message.receiveTime, headerStamp };
};

export type TimeBasedChartTooltipData = {
  x: number;
  y: number | string;
  datasetKey?: string;
  item: TooltipItem;
  path: string;
  value: number | boolean | string;
  constantName?: string;
  startTime: Time;
  source?: number;
};

export type DataPoint = {
  x: number;
  y: number | string;
  label?: string;
  labelColor?: string;
};

const SRoot = styled.div`
  position: relative;
`;

const SResetZoom = styled.div`
  position: absolute;
  bottom: 33px;
  right: 10px;
`;

const SLegend = styled.div`
  display: flex;
  width: 10%;
  min-width: 90px;
  overflow-y: auto;
  flex-direction: column;
  align-items: flex-start;
  justify-content: start;
  padding: 30px 0px 10px 0px;
`;

const SBar = styled.div<{ xAxisIsPlaybackTime: boolean }>`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 9px;
  margin-left: -4px;
  display: block;
  border-style: solid;
  border-color: #f7be00 transparent;
  background: ${(props) =>
    props.xAxisIsPlaybackTime ? "#F7BE00 padding-box" : "#248EFF padding-box"};
  border-width: ${(props) => (props.xAxisIsPlaybackTime ? "4px" : "0px 4px")};
`;

const MemoizedTooltips = memo(function Tooltips() {
  return (
    <>
      <Tooltip contents={<div>Hold v to zoom vertically, or b to zoom both axes</div>} delay={0}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 30, bottom: 0 }} />
      </Tooltip>
    </>
  );
});

type FollowPlaybackState = Readonly<{
  xOffsetMin: number; // -1 means the left edge of the plot is one second before the current time.
  xOffsetMax: number; // 1 means the right edge of the plot is one second after the current time.
}>;

type Point = Readonly<{ x: number; y: number | string }>;

type DataSet = ChartDataset<"scatter">;

const screenCoord = (value: number, valuePerPixel?: number) =>
  !valuePerPixel ? value : Math.trunc(value / valuePerPixel);
const datumStringPixel = (
  { x, y }: Point,
  xScale: number | undefined,
  yScale: number | undefined,
): string => `${screenCoord(x, xScale)},${typeof y === "string" ? y : screenCoord(y, yScale)}`;

// Exported for tests
export const filterDatasets = (
  datasets: readonly DataSet[],
  linesToHide: {
    [key: string]: boolean;
  },
  xScalePerPixel?: number,
  yScalePerPixel?: number,
): DataSet[] =>
  datasets // Only draw enabled lines. Needed for correctness.
    .filter(({ label }) => label && !linesToHide[label]) // Remove redundant points to make drawing the chart more efficient.
    .map((dataset) => {
      const data = dataset.showLine // For line charts, just remove adjacent points on top of each other so we can draw self-
        ? // intersecting (loopy) lines.
          sortedUniqBy(dataset.data.slice(), (datum) =>
            datumStringPixel(datum, xScalePerPixel, yScalePerPixel),
          ) // For scatter charts there's no point in drawing any overlapping points.
        : uniqBy(dataset.data.slice(), (datum) =>
            datumStringPixel(datum, xScalePerPixel, yScalePerPixel),
          );
      return { ...dataset, data };
    });

// Calculation mode for the "reset view" view.
export type ChartDefaultView =
  | void // Zoom to fit
  | { type: "fixed"; minXValue: number; maxXValue: number }
  | { type: "following"; width: number };

export type Props = {
  type: "scatter" | "multicolorLine";
  width: number;
  height: number;
  zoom: boolean;
  data: { datasets: readonly DataSet[]; yLabels?: readonly string[]; minIsZero?: boolean };
  tooltips?: TimeBasedChartTooltipData[];
  xAxes?: ScaleOptionsByType;
  yAxes: ScaleOptionsByType;
  annotations?: AnnotationOptions[];
  drawLegend?: boolean;
  isSynced?: boolean;
  canToggleLines?: boolean;
  toggleLine?: (datasetId: string | typeof undefined, lineToHide: string) => void;
  linesToHide?: {
    [key: string]: boolean;
  };
  datasetId?: string;
  onClick?: (
    ev: React.MouseEvent<HTMLCanvasElement>,
    datalabel: unknown,
    values: {
      [axis: string]: number;
    },
  ) => void;
  saveCurrentView?: (minY: number, maxY: number, width?: number) => void;
  // If the x axis represents playback time ("timestamp"), the hover cursor will be synced.
  // Note, this setting should not be used for other time values.
  xAxisIsPlaybackTime: boolean;
  plugins?: ChartOptions["plugins"];
  currentTime?: number;
  defaultView?: ChartDefaultView;
};

// Create a chart with any y-axis but with an x-axis that shows time since the
// start of the bag, and which is kept in sync with other instances of this
// component. Uses chart.js internally, with a zoom/pan plugin, and with our
// standard tooltips.
export default memo<Props>(function TimeBasedChart(props: Props) {
  const tooltipRef = useRef<HTMLDivElement>(ReactNull);
  const hasUnmounted = useRef<boolean>(false);
  const canvasContainer = useRef<HTMLDivElement>(ReactNull);

  const [hasUserPannedOrZoomed, setHasUserPannedOrZoomed] = useState<boolean>(false);
  const [followPlaybackState, setFollowPlaybackState] = useState<FollowPlaybackState | undefined>();
  const [, forceUpdate] = useState(0);

  const onVisibilityChange = useCallback(() => {
    if (document.visibilityState === "visible") {
      // HACK: There is a Chrome bug that causes 2d canvas elements to get cleared when the page
      // becomes hidden on certain hardware:
      // https://bugs.chromium.org/p/chromium/issues/detail?id=588434
      // https://bugs.chromium.org/p/chromium/issues/detail?id=591374
      // We can hack around this by forcing a re-render when the page becomes visible again.
      // There may be other canvases that this affects, but these seemed like the most important.
      // Ideally we can find a global workaround but we're not sure there is one — can't just
      // twiddle the width/height attribute of the canvas as suggested in one of the comments on
      // a chrome bug; it seems like you really have to redraw the frame from scratch.
      forceUpdate((old) => ++old);
    }
  }, [forceUpdate]);

  useEffect(() => {
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [onVisibilityChange]);

  const pauseFrame = useMessagePipeline(
    useCallback((messagePipeline) => messagePipeline.pauseFrame, []),
  );

  const onChartUpdate = useCallback(() => {
    const resumeFrame = pauseFrame("TimeBasedChart");
    return () => {
      resumeFrame();
    };
  }, [pauseFrame]);

  const { tooltips, yAxes, xAxes } = props;
  const hoverBar = useRef<HTMLDivElement>(ReactNull);

  const origScalesRef = useRef<RpcScales | undefined>();
  const [currentScales, setCurrentScales] = useState<RpcScales | undefined>();
  const [targetScales, setTargetScales] = useState<RpcScales | undefined>();

  // detect changes to the scales, if the scales diverge from te first value, we show a "reset zoom" button
  useEffect(() => {
    if (!origScalesRef.current) {
      origScalesRef.current = currentScales;
      return;
    }

    setTargetScales(undefined);

    const orig = JSON.stringify(origScalesRef.current);
    const current = JSON.stringify(currentScales);
    if (orig !== current) {
      setHasUserPannedOrZoomed(true);
    }
  }, [currentScales]);

  // fixme what should we do with scale updates? we already setCurrentScales
  /*
  const onScaleBoundsUpdate = useCallback(
    (scales: ScaleBounds[]) => {
      scaleBounds.current = scales;
      const firstYScale = scales.find(({ axes }) => axes === "yAxes");
      const firstXScale = scales.find(({ axes }) => axes === "xAxes");
      const width = firstXScale && firstXScale.max - firstXScale.min;
      if (
        firstYScale &&
        saveCurrentView &&
        typeof firstYScale.min === "number" &&
        typeof firstYScale.max === "number"
      ) {
        saveCurrentView(firstYScale.min, firstYScale.max, width);
      }
      if (firstYScale != undefined && hoverBar.current != undefined) {
        const { current } = hoverBar;
        const topPx = Math.min(firstYScale.minAlongAxis, firstYScale.maxAlongAxis);
        const bottomPx = Math.max(firstYScale.minAlongAxis, firstYScale.maxAlongAxis);
        current.style.top = `${topPx}px`;
        current.style.height = `${bottomPx - topPx}px`;
      }
    },
    [saveCurrentView, scaleBounds],
  );
  */

  /*
  // fixme - we have an onClick handler...
  const onClickAddingValues = useCallback(
    (ev: React.MouseEvent<HTMLCanvasElement>, datalabel: ScaleBounds[] | undefined) => {
      if (!onClick) {
        return;
      }
      if (
        lastPanTime.current &&
        // @ts-expect-error while valid js we should fix this arithmatic operation on dates
        new Date() - lastPanTime.current < PAN_CLICK_SUPPRESS_THRESHOLD_MS
      ) {
        // Ignore clicks that happen too soon after a pan. Sometimes clicks get fired at the end of
        // drags on touchpads.
        return;
      }
      const values: { [id: string]: number } = {};
      (scaleBounds.current ?? []).forEach((bounds) => {
        const chartPx =
          bounds.axes === "xAxes"
            ? ev.clientX - (ev.target as Element).getBoundingClientRect().x
            : ev.clientY - (ev.target as Element).getBoundingClientRect().y;
        const value = getChartValue(bounds, chartPx);
        if (value == undefined) {
          return;
        }
        values[bounds.id] = value;
      });
      return onClick(ev, datalabel, values);
    },
    [onClick, scaleBounds, lastPanTime],
  );
  */

  // Keep a ref to props.currentTime so onPanZoom can have stable identity
  // fixme
  /*
  const currentTimeRef = useRef<number | undefined>();
  currentTimeRef.current = props.currentTime;
  const onPanZoom = useCallback(
    (newScaleBounds: RpcScales) => {
      if (!hasUserPannedOrZoomed) {
        setHasUserPannedOrZoomed(true);
      }
      // Preloaded plots follow playback at a fixed zoom and x-offset unless the user is in the
      // initial "zoom to fit" state. Subsequent zooms/pans adjust the offsets.
      const bounds = newScaleBounds.find(({ axes }) => axes === "xAxes");
      if (
        bounds != undefined &&
        bounds.min != undefined &&
        bounds.max != undefined &&
        currentTimeRef.current != undefined
      ) {
        const currentTime = currentTimeRef.current;
        setFollowPlaybackState({
          xOffsetMin: bounds.min - currentTime,
          xOffsetMax: bounds.max - currentTime,
        });
      }
      lastPanTime.current = new Date();
    },
    [hasUserPannedOrZoomed],
  );
  */

  const onResetZoom = useCallback(() => {
    if (origScalesRef.current) {
      setTargetScales(origScalesRef.current);
      setHasUserPannedOrZoomed(false);
    }
    setFollowPlaybackState(undefined);
  }, [setFollowPlaybackState]);

  if (useDeepChangeDetector([props.defaultView], false)) {
    // Reset the view to the default when the default changes.
    if (hasUserPannedOrZoomed) {
      setHasUserPannedOrZoomed(false);
    }
    if (followPlaybackState != undefined) {
      setFollowPlaybackState(undefined);
    }
  }

  const [hasVerticalExclusiveZoom, setHasVerticalExclusiveZoom] = useState<boolean>(false);
  const [hasBothAxesZoom, setHasBothAxesZoom] = useState<boolean>(false);
  let zoomMode: ZoomOptions["mode"] = "x";
  if (hasVerticalExclusiveZoom) {
    zoomMode = "y";
  } else if (hasBothAxesZoom) {
    zoomMode = "xy";
  }

  const keyDownHandlers = React.useMemo(
    () => ({
      v: () => setHasVerticalExclusiveZoom(true),
      b: () => setHasBothAxesZoom(true),
    }),
    [setHasVerticalExclusiveZoom, setHasBothAxesZoom],
  );
  const keyUphandlers = React.useMemo(
    () => ({
      v: () => setHasVerticalExclusiveZoom(false),
      b: () => setHasBothAxesZoom(false),
    }),
    [setHasVerticalExclusiveZoom, setHasBothAxesZoom],
  );

  const removeTooltip = useCallback(() => {
    if (tooltipRef.current) {
      ReactDOM.unmountComponentAtNode(tooltipRef.current);
    }
    if (tooltipRef.current && tooltipRef.current.parentNode) {
      tooltipRef.current.parentNode.removeChild(tooltipRef.current);
      tooltipRef.current = ReactNull;
    }
  }, []);

  // Always clean up tooltips when unmounting.
  useEffect(() => {
    return () => {
      hasUnmounted.current = true;
      removeTooltip();
    };
  }, [removeTooltip]);

  // We use a custom tooltip so we can style it more nicely, and so that it can break
  // out of the bounds of the canvas, in case the panel is small.
  const updateTooltip = useCallback(
    (element?: RpcElement) => {
      // This is an async callback, so it can fire after this component is unmounted. Make sure that we remove the
      // tooltip if this fires after unmount.
      if (!element || hasUnmounted.current) {
        return removeTooltip();
      }

      // fixme - this finds the tooltip data from the tooltips for the one that matches our data x/y
      // We have to iterate through all of the tooltips every time the user hovers over a point. However, the cost of
      // running this search is small (< 10ms even with many tooltips) compared to the cost of indexing tooltips by
      // coordinates and we care more about render time than tooltip responsiveness.
      const tooltipData = tooltips?.find(
        (item) => item.x === element.data?.x && item.y === element.data?.y,
      );
      if (!tooltipData) {
        return removeTooltip();
      }

      if (!tooltipRef.current) {
        tooltipRef.current = document.createElement("div");
        canvasContainer.current?.parentNode?.appendChild(tooltipRef.current);
      }

      ReactDOM.render(
        <TimeBasedChartTooltip tooltip={tooltipData}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(${element.view.x}px, ${element.view.y}px)`,
            }}
          />
        </TimeBasedChartTooltip>,
        tooltipRef.current,
      );
    },
    [removeTooltip, tooltips],
  );

  const [hoverComponentId] = useState(() => uuidv4());
  const { xAxisIsPlaybackTime } = props;
  const dispatch = useDispatch();
  const clearGlobalHoverTime = useCallback(
    () => dispatch(clearHoverValue({ componentId: hoverComponentId })),
    [dispatch, hoverComponentId],
  );
  const setGlobalHoverTime = useCallback(
    (value) =>
      dispatch(
        setHoverValue({
          componentId: hoverComponentId,
          value,
          type: xAxisIsPlaybackTime ? "PLAYBACK_SECONDS" : "OTHER",
        }),
      ),
    [dispatch, hoverComponentId, xAxisIsPlaybackTime],
  );

  // the hover bar works by getting the hover location in the chart
  // for some x mouse position, we get the value in the chart
  // it asumes a time based chart - so given the current chart scale bounds for x axis
  // we convert the x mouse position into those bounds to get th time value

  const onMouseMove = useCallback(
    async (event: MouseEvent) => {
      const xScale = currentScales?.x;
      if (!xScale || !canvasContainer.current) {
        removeTooltip();
        clearGlobalHoverTime();
        return;
      }

      /*
      const isTargetingCanvas = event.target === canvasContainer.current;
      if (!isTargetingCanvas) {
        removeTooltip();
        clearGlobalHoverTime();
        return;
      }
      */

      const canvasContainerRect = canvasContainer.current.getBoundingClientRect();
      const mouseX = event.pageX - canvasContainerRect.left;
      const pixels = xScale.right - xScale.left;
      const range = xScale.max - xScale.min;
      const xVal = (range / pixels) * (mouseX - xScale.left) + xScale.min;

      const xInBounds = xVal >= xScale.min && xVal <= xScale.max;
      if (!xInBounds || isNaN(xVal)) {
        removeTooltip();
        clearGlobalHoverTime();
        return;
      }

      setGlobalHoverTime(xVal);

      // now we need an event for element hover
      //
    },
    [currentScales, setGlobalHoverTime, removeTooltip, clearGlobalHoverTime],
  );

  // Normally we set the x axis step-size and display automatically, but we need consistency when
  // scrolling with playback because the vertical lines can flicker, and x axis labels can have an
  // inconsistent number of digits.
  //const xBounds = scaleBounds.current && scaleBounds.current.find(({ axes }) => axes === "xAxes");
  //const yBounds = scaleBounds.current && scaleBounds.current.find(({ axes }) => axes === "yAxes");

  //const xScaleOptions = followPlaybackState && xBounds ? stepSize(xBounds) : undefined;

  const getChartjsOptions = () => {
    const { currentTime } = props;
    const annotations = [...(props.annotations ?? [])];

    // We create these objects every time so that they can be modified.
    const defaultXTicksSettings: ScaleOptionsByType["ticks"] = {
      font: {
        family: mixins.monospaceFont,
        size: 10,
      },
      color: "#eee",
      maxRotation: 0,
    };
    const defaultYTicksSettings: ScaleOptionsByType["ticks"] = {
      font: {
        family: mixins.monospaceFont,
        size: 10,
      },
      color: "#eee",
      padding: 0,
    };
    const defaultXAxis = {
      id: "X_AXIS_ID",
      ticks: defaultXTicksSettings,
      gridLines: { color: "rgba(255, 255, 255, 0.2)", zeroLineColor: "rgba(255, 255, 255, 0.2)" },
    };

    const newXAxes: typeof props.xAxes = {
      ...defaultXAxis,
      ...xAxes,
      ...targetScales?.x,
      ticks: {
        ...defaultXTicksSettings,
        ...xAxes?.ticks,
      },
    };

    if (currentTime != undefined) {
      annotations.push({
        type: "line",
        drawTime: "beforeDatasetsDraw",
        scaleID: "X_AXIS_ID",
        borderColor: "#aaa",
        borderWidth: 1,
        value: currentTime,
      });
    }

    const ticks = {
      ...defaultYTicksSettings,
      ...yAxes.ticks,
    };

    const newYAxes = {
      ...yAxes,
      ...targetScales?.y,
      ticks,
    };

    // If the user is manually panning or zooming, don't constrain the y-axis
    if (hasUserPannedOrZoomed) {
      delete newYAxes.min;
      delete newYAxes.max;
    }

    const plugins: ChartOptions["plugins"] = {
      ...props.plugins,
      legend: {
        display: false,
      },
      datalabels: {
        display: false,
      },
      tooltip: {
        intersect: false,
        mode: "x",
        enabled: false, // Disable native tooltips since we use custom ones.
      },
      zoom: {
        zoom: {
          enabled: props.zoom,
          mode: zoomMode,
          sensitivity: 3,
          speed: 0.1,
        },
        pan: {
          mode: "xy",
          enabled: true,
          speed: 20,
          threshold: 10,
        },
      },
      annotation: { annotations },
    };

    const options: ChartOptions = {
      maintainAspectRatio: false,
      animation: { duration: 0 },
      // Disable splines, they seem to cause weird rendering artifacts:
      elements: { line: { tension: 0 } },
      hover: {
        intersect: false,
        mode: "x",
      },
      scales: {
        x: newXAxes,
        y: newYAxes,
      },
      plugins,
    };
    // fixme
    //const firstXAxisTicks = options.scales?.x?.ticks;
    /*
    if (firstXAxisTicks) {
      if (followPlaybackState != undefined) {
        // Follow playback, but don't force it if the user has recently panned or zoomed -- playback
        // will fight with the user's action.
        if (
          currentTime != undefined &&
          (lastPanTime.current == undefined ||
            new Date() - lastPanTime.current > FOLLOW_PLAYBACK_PAN_THRESHOLD_MS)
        ) {
          firstXAxisTicks.min = currentTime + followPlaybackState.xOffsetMin;
          firstXAxisTicks.max = currentTime + followPlaybackState.xOffsetMax;
        }
      } else if (!hasUserPannedOrZoomed) {
        firstXAxisTicks.min = minX;
        firstXAxisTicks.max = maxX;
      }
    }
    */
    return options;
  };

  const {
    datasetId,
    type,
    width,
    height,
    drawLegend,
    canToggleLines,
    toggleLine,
    data,
    linesToHide = {},
  } = props;

  /*
  const xVals = flatten(
    data.datasets.map(({ data: pts }) => (pts.length > 1 ? pts.map(({ x }) => x) : undefined)),
  );
  let minX: number;
  let maxX: number;


  if (defaultView == undefined || (defaultView.type === "following" && currentTime == undefined)) {
    // Zoom to fit if the view is "following" but there's no playback cursor. Unlikely.
    minX = min(xVals) ?? 0;
    maxX = max(xVals) ?? 0;
  } else if (defaultView.type === "fixed") {
    minX = defaultView.minXValue;
    maxX = defaultView.maxXValue;
  } else {
    // Following with non-null currentTime.
    if (currentTime == undefined) {
      throw new Error("Flow doesn't know that currentTime != undefined");
    }
    minX = currentTime - defaultView.width / 2;
    maxX = currentTime + defaultView.width / 2;
  }
*/

  const onHover = useCallback(
    (elements: RpcElement[]) => {
      updateTooltip(elements[0]);
    },
    [updateTooltip],
  );

  const chartProps: ComponentProps<typeof ChartComponent> = {
    type,
    width,
    height,
    options: getChartjsOptions(),
    data: {
      ...data,
      datasets: filterDatasets(data.datasets, linesToHide),
    },
    onScalesUpdate: setCurrentScales,
    //onClick: onClickAddingValues,
    onChartUpdate,
    onHover,
  };

  //const hasData = chartProps.data.datasets.some((dataset) => dataset.data.length);
  // fixme - only sync when using x-axis timestamp and actually plotting data. */}
  {
    /*
    {isSynced && currentTime == undefined && xAxisIsPlaybackTime && hasData ? (
      <SyncTimeAxis data={{ minX, maxX }}>
        {(syncedMinMax) => {
          const syncedMinX =
            syncedMinMax.minX != undefined ? min([minX, syncedMinMax.minX]) : minX;
          const syncedMaxX =
            syncedMinMax.maxX != undefined ? max([maxX, syncedMinMax.maxX]) : maxX;
          return (
            <ChartComponent
              {...chartProps}
              options={getChartjsOptions(syncedMinX, syncedMaxX)}
            />
          );
        }}
      </SyncTimeAxis>
    ) : (
    */
  }

  return (
    <div style={{ display: "flex", width: "100%" }}>
      <div style={{ display: "flex", width }}>
        <SRoot onDoubleClick={onResetZoom}>
          <HoverBar
            componentId={hoverComponentId}
            isTimestampScale={xAxisIsPlaybackTime}
            scales={currentScales}
          >
            <SBar xAxisIsPlaybackTime={xAxisIsPlaybackTime} ref={hoverBar} />
          </HoverBar>

          <div ref={canvasContainer}>
            <ChartComponent {...chartProps} />
          </div>

          {hasUserPannedOrZoomed && (
            <SResetZoom>
              <Button tooltip="(shortcut: double-click)" onClick={onResetZoom}>
                reset view
              </Button>
            </SResetZoom>
          )}

          {/* Handle tooltips while dragging by checking all document events. */}
          <DocumentEvents
            capture
            onMouseDown={onMouseMove}
            onMouseUp={onMouseMove}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseMove}
          />
          <KeyListener global keyDownHandlers={keyDownHandlers} keyUpHandlers={keyUphandlers} />
        </SRoot>
      </div>
      {props.zoom && <MemoizedTooltips />}
      {drawLegend && (
        <SLegend>
          <TimeBasedChartLegend
            datasetId={datasetId}
            canToggleLines={canToggleLines}
            datasets={data.datasets}
            linesToHide={linesToHide}
            toggleLine={toggleLine}
          />
        </SLegend>
      )}
    </div>
  );
});
