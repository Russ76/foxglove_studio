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
import { max, min, flatten, sortedUniqBy, uniqBy } from "lodash";
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
import TimeBasedChartLegend from "@foxglove-studio/app/components/TimeBasedChart/TimeBasedChartLegend";
import Tooltip from "@foxglove-studio/app/components/Tooltip";
import createSyncingComponent from "@foxglove-studio/app/components/createSyncingComponent";
import mixins from "@foxglove-studio/app/styles/mixins.module.scss";
import { isBobject } from "@foxglove-studio/app/util/binaryObjects";
import { useDeepChangeDetector } from "@foxglove-studio/app/util/hooks";
import { defaultGetHeaderStamp } from "@foxglove-studio/app/util/synchronizeMessages";
import { maybeGetBobjectHeaderStamp } from "@foxglove-studio/app/util/time";

import HoverBar from "./HoverBar";
import TimeBasedChartTooltip from "./TimeBasedChartTooltip";

type Bounds = { minX?: number; maxX?: number };
const SyncTimeAxis = createSyncingComponent<Bounds, Bounds>(
  "SyncTimeAxis",
  (dataItems: Bounds[]) => ({
    minX: min(dataItems.map(({ minX }) => (minX == undefined ? undefined : minX))),
    maxX: max(dataItems.map(({ maxX }) => (maxX == undefined ? undefined : maxX))),
  }),
);

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

// Sometimes a click gets fired at the end of a pan. Probably subtle touchpad stuff. Ignore "clicks"
// that happen too soon after a pan.
const PAN_CLICK_SUPPRESS_THRESHOLD_MS = 100;
// Drag-pans and playback following sometimes fight. We suppress automatic following moves during
// drag pans to avoid it.
//const FOLLOW_PLAYBACK_PAN_THRESHOLD_MS = 100;

const MemoizedTooltips = memo(function Tooltips() {
  return (
    <>
      <Tooltip contents={<div>Hold v to zoom vertically, or b to zoom both axes</div>} delay={0}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 30, bottom: 0 }} />
      </Tooltip>
    </>
  );
});

const STEP_SIZES = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60];
const stepSize = ({ min: minValue, max: maxValue, minAlongAxis, maxAlongAxis }: ScaleBounds) => {
  // Pick the smallest step size that gives lines greater than 50px apart
  const secondsPer50Pixels = 50 * ((maxValue - minValue) / (maxAlongAxis - minAlongAxis));
  return STEP_SIZES.find((step) => step > secondsPer50Pixels) ?? 60;
};

type FollowPlaybackState = Readonly<{
  xOffsetMin: number; // -1 means the left edge of the plot is one second before the current time.
  xOffsetMax: number; // 1 means the right edge of the plot is one second after the current time.
}>;

type Point = Readonly<{ x: number; y: number | string }>;

type DataSet = ChartDataset<"scatter">;

const scalePerPixel = (bounds?: ScaleBounds): number | undefined =>
  bounds && Math.abs(bounds.max - bounds.min) / Math.abs(bounds.maxAlongAxis - bounds.minAlongAxis);
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
    .filter(({ label }) => !linesToHide[label]) // Remove redundant points to make drawing the chart more efficient.
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
    arg0: React.MouseEvent<HTMLCanvasElement>,
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
  const chartComponent = useRef<typeof ChartComponent>(ReactNull);
  const tooltip = useRef<HTMLDivElement>(ReactNull);
  const hasUnmounted = useRef<boolean>(false);

  const [hasUserPannedOrZoomed, setHasUserPannedOrZoomed] = useState<boolean>(false);
  const [followPlaybackState, setFollowPlaybackState] = useState<FollowPlaybackState | undefined>(
    undefined,
  );
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

  const { saveCurrentView, yAxes, xAxes } = props;
  const scaleBounds = useRef<readonly ScaleBounds[] | undefined>();
  const hoverBar = useRef<HTMLDivElement>(ReactNull);

  // fixme do we still need this?
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

  const { onClick } = props;
  const lastPanTime = useRef<Date | undefined>();

  /*
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
  const currentTimeRef = useRef<number | undefined>();
  currentTimeRef.current = props.currentTime;
  const onPanZoom = useCallback(
    (newScaleBounds: ScaleBounds[]) => {
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

  const onResetZoom = useCallback(() => {
    if (chartComponent.current) {
      chartComponent.current.resetZoom();
      setHasUserPannedOrZoomed(false);
    }
    setFollowPlaybackState(undefined);
  }, [setHasUserPannedOrZoomed, setFollowPlaybackState]);

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
  let zoomMode = "x";
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
    if (tooltip.current) {
      ReactDOM.unmountComponentAtNode(tooltip.current);
    }
    if (tooltip.current && tooltip.current.parentNode) {
      tooltip.current.parentNode.removeChild(tooltip.current);
      tooltip.current = ReactNull;
    }
  }, []);

  // Always clean up tooltips when unmounting.
  useEffect(() => {
    return () => {
      hasUnmounted.current = true;
      removeTooltip();
    };
  }, [removeTooltip]);

  const tooltips = props.tooltips ?? [];

  // We use a custom tooltip so we can style it more nicely, and so that it can break
  // out of the bounds of the canvas, in case the panel is small.
  const updateTooltip = useCallback(
    (
      currentChartComponent: ChartComponent,
      canvas: HTMLCanvasElement,
      tooltipItem: HoveredElement | undefined,
    ) => {
      // This is an async callback, so it can fire after this component is unmounted. Make sure that we remove the
      // tooltip if this fires after unmount.
      if (!tooltipItem || hasUnmounted.current) {
        return removeTooltip();
      }

      // We have to iterate through all of the tooltips every time the user hovers over a point. However, the cost of
      // running this search is small (< 10ms even with many tooltips) compared to the cost of indexing tooltips by
      // coordinates and we care more about render time than tooltip responsiveness.
      const tooltipData = tooltips.find(
        (_tooltip) =>
          _tooltip.x === tooltipItem.data.x && String(_tooltip.y) === String(tooltipItem.data.y),
      );
      if (!tooltipData) {
        return removeTooltip();
      }

      if (!tooltip.current) {
        tooltip.current = document.createElement("div");
        if (canvas.parentNode) {
          canvas.parentNode.appendChild(tooltip.current);
        }
      }

      if (tooltip.current) {
        ReactDOM.render(
          <TimeBasedChartTooltip tooltip={tooltipData}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: `translate(${tooltipItem.view.x}px, ${tooltipItem.view.y}px)`,
              }}
            />
          </TimeBasedChartTooltip>,
          tooltip.current,
        );
      }
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

  const onMouseMove = useCallback(
    async (event: MouseEvent) => {
      const currentChartComponent = chartComponent.current;
      if (!currentChartComponent || !currentChartComponent.canvas) {
        removeTooltip();
        clearGlobalHoverTime();
        return;
      }
      const { canvas } = currentChartComponent;
      const canvasRect = canvas.getBoundingClientRect();
      const xBounds =
        scaleBounds.current && scaleBounds.current.find(({ axes }) => axes === "xAxes");
      const yBounds =
        scaleBounds.current && scaleBounds.current.find(({ axes }) => axes === "yAxes");
      const xMousePosition = event.pageX - canvasRect.left;
      const yMousePosition = event.pageY - canvasRect.top;
      const isTargetingCanvas = event.target === canvas;
      if (
        !inBounds(xMousePosition, xBounds) ||
        !inBounds(yMousePosition, yBounds) ||
        !isTargetingCanvas
      ) {
        removeTooltip();
        clearGlobalHoverTime();
        return;
      }

      const value = getChartValue(xBounds, xMousePosition);
      if (value != undefined) {
        setGlobalHoverTime(value);
      } else {
        clearGlobalHoverTime();
      }

      if (tooltips && tooltips.length) {
        const tooltipElement = await currentChartComponent.getElementAtXAxis(event);
        updateTooltip(currentChartComponent, canvas, tooltipElement);
      } else {
        removeTooltip();
      }
    },
    [updateTooltip, removeTooltip, tooltips, clearGlobalHoverTime, setGlobalHoverTime, scaleBounds],
  );

  // Normally we set the x axis step-size and display automatically, but we need consistency when
  // scrolling with playback because the vertical lines can flicker, and x axis labels can have an
  // inconsistent number of digits.
  const xBounds = scaleBounds.current && scaleBounds.current.find(({ axes }) => axes === "xAxes");
  const yBounds = scaleBounds.current && scaleBounds.current.find(({ axes }) => axes === "yAxes");

  const xScaleOptions = followPlaybackState && xBounds ? stepSize(xBounds) : undefined;

  const getChartjsOptions = (minX: number | undefined, maxX?: number) => {
    const { currentTime } = props;
    const annotations = [...(props.annotations ?? [])];

    // We create these objects every time so that they can be modified.
    const defaultXTicksSettings = {
      fontFamily: mixins.monospaceFont,
      fontSize: 10,
      fontColor: "#eee",
      maxRotation: 0,
      stepSize: xScaleOptions,
    };
    const defaultYTicksSettings = {
      fontFamily: mixins.monospaceFont,
      fontSize: 10,
      fontColor: "#eee",
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
      tooltip: {
        intersect: false,
        mode: "x",
        enabled: false, // Disable native tooltips since we use custom ones.
      },
      zoom: {
        zoom: {
          enabled: props.zoom,
          mode: "xy",
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
    currentTime,
    datasetId,
    type,
    width,
    height,
    drawLegend,
    canToggleLines,
    toggleLine,
    data,
    isSynced,
    linesToHide = {},
    defaultView,
  } = props;
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

  const chartProps: ComponentProps<typeof ChartComponent> = {
    type,
    width,
    height,
    //ref: chartComponent,
    options: getChartjsOptions(minX, maxX),
    data: {
      ...data,
      datasets: filterDatasets(data.datasets, linesToHide),
    },
    //onClick: onClickAddingValues,
    onChartUpdate,
  };

  const hasData = chartProps.data.datasets.some((dataset) => dataset.data.length);

  return (
    <div style={{ display: "flex", width: "100%" }}>
      <div style={{ display: "flex", width }}>
        <SRoot onDoubleClick={onResetZoom}>
          <HoverBar
            componentId={hoverComponentId}
            isTimestampScale={xAxisIsPlaybackTime}
            scaleBounds={scaleBounds}
          >
            <SBar xAxisIsPlaybackTime={xAxisIsPlaybackTime} ref={hoverBar} />
          </HoverBar>

          {/* only sync when using x-axis timestamp and actually plotting data. */}
          {/*
            // fixme put this back? .. th edifference is the syncedMinx, MaxY
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
          */}

          <ChartComponent {...chartProps} />

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
            toggleLine={
              toggleLine ??
              (() => {
                // no-op
              })
            }
          />
        </SLegend>
      )}
    </div>
  );
});
