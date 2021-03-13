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

import { useRef, useLayoutEffect, useMemo } from "react";
import { useResizeDetector } from "react-resize-detector";

type Draw = (context: CanvasRenderingContext2D, width: number, height: number) => void;

type AutoSizingCanvasProps = {
  draw: Draw;
  overrideDevicePixelRatioForTest?: number;
};

const AutoSizingCanvas = ({ draw, overrideDevicePixelRatioForTest }: AutoSizingCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width: maybeWidth, height: maybeHeight } = useResizeDetector({ targetRef: canvasRef });

  const { ratio, width, height } = useMemo(() => {
    return {
      ratio: overrideDevicePixelRatioForTest ?? window.devicePixelRatio ?? 1,
      width: maybeWidth ?? 0,
      height: maybeHeight ?? 0,
    };
  }, [maybeHeight, maybeWidth, overrideDevicePixelRatioForTest]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(ctx, width, height);
  });

  return (
    <canvas
      ref={canvasRef}
      width={width * ratio}
      height={height * ratio}
      style={{ width, height }}
    />
  );
};

export default AutoSizingCanvas;
