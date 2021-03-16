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

import { isEqual } from "lodash";
import { ReglClickInfo } from "regl-worldview";

import { Point } from "@foxglove-studio/app/types/Messages";
import { arrayToPoint } from "@foxglove-studio/app/util";

export type MeasureState = "idle" | "place-start" | "place-finish";

export type MeasureInfo = {
  measureState: MeasureState;
  measurePoints: { start?: Point; end?: Point };
};

type Props = MeasureInfo & {
  onMeasureInfoChange: (arg0: MeasureInfo) => void;
};

/* eslint-disable no-restricted-syntax */

export default class MeasuringTool extends React.Component<Props> {
  mouseDownCoords: number[] = [-1, -1];

  toggleMeasureState = () => {
    const newMeasureState = this.props.measureState === "idle" ? "place-start" : "idle";
    this.props.onMeasureInfoChange({
      measureState: newMeasureState,
      measurePoints: { start: undefined, end: undefined },
    });
  };

  reset = () => {
    this.props.onMeasureInfoChange({
      measureState: "idle",
      measurePoints: { start: undefined, end: undefined },
    });
  };

  _canvasMouseDownHandler = (e: MouseEvent, _clickInfo: ReglClickInfo) => {
    this.mouseDownCoords = [e.clientX, e.clientY];
  };

  _canvasMouseUpHandler = (e: MouseEvent, _clickInfo: ReglClickInfo) => {
    const mouseUpCoords = [e.clientX, e.clientY];
    const { measureState, measurePoints, onMeasureInfoChange } = this.props;

    if (!isEqual(mouseUpCoords, this.mouseDownCoords)) {
      return;
    }

    if (measureState === "place-start") {
      onMeasureInfoChange({ measureState: "place-finish", measurePoints });
    } else if (measureState === "place-finish") {
      // Use setImmediate so there is a tick between resetting the measure state and clicking the 3D canvas.
      // If we call onMeasureInfoChange right away, the clicked object context menu will show up upon finishing measuring.
      setImmediate(() => {
        onMeasureInfoChange({ measurePoints, measureState: "idle" });
      });
    }
  };

  _canvasMouseMoveHandler = (e: MouseEvent, clickInfo: ReglClickInfo) => {
    const { measureState, measurePoints, onMeasureInfoChange } = this.props;
    switch (measureState) {
      case "place-start":
        onMeasureInfoChange({
          measureState,
          measurePoints: {
            start: arrayToPoint(clickInfo.ray.planeIntersection([0, 0, 0], [0, 0, 1])),
            end: undefined,
          },
        });
        break;

      case "place-finish":
        onMeasureInfoChange({
          measureState,
          measurePoints: {
            ...measurePoints,
            end: arrayToPoint(clickInfo.ray.planeIntersection([0, 0, 0], [0, 0, 1])),
          },
        });
        break;
    }
  };

  get onMouseMove(): ((arg0: MouseEvent, arg1: ReglClickInfo) => void) | undefined {
    if (!this.measureActive) {
      return undefined;
    }

    return this._canvasMouseMoveHandler;
  }

  get onMouseUp(): ((arg0: MouseEvent, arg1: ReglClickInfo) => void) | undefined {
    if (!this.measureActive) {
      return undefined;
    }

    return this._canvasMouseUpHandler;
  }

  get onMouseDown(): ((arg0: MouseEvent, arg1: ReglClickInfo) => void) | undefined {
    if (!this.measureActive) {
      return undefined;
    }

    return this._canvasMouseDownHandler;
  }

  get measureActive(): boolean {
    const { measureState } = this.props;
    return measureState === "place-start" || measureState === "place-finish";
  }

  get measureDistance(): string {
    const { start, end } = this.props.measurePoints;
    let dist_string = "";
    if (start && end) {
      const dist = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
      dist_string = `${dist.toFixed(2)}m`;
    }

    return dist_string;
  }

  render() {
    return ReactNull;
  }
}
