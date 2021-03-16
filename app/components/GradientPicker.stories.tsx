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
import { useRef, useLayoutEffect, useState } from "react";
import TestUtils from "react-dom/test-utils";
import { Color } from "regl-worldview";

import GradientPicker from "./GradientPicker";

function Story({
  changeMinColorAfterMount,
  changeMaxColorAfterMount,
  initialMinColor,
  initialMaxColor,
}: {
  changeMinColorAfterMount?: boolean;
  changeMaxColorAfterMount?: boolean;
  initialMinColor?: Color;
  initialMaxColor?: Color;
}) {
  const containerRef = useRef<HTMLDivElement>(ReactNull);
  const [minColor, setMinColor] = useState(initialMinColor ?? { r: 0, g: 0, b: 0, a: 0 });
  const [maxColor, setMaxColor] = useState(initialMaxColor ?? { r: 0, g: 0, b: 0, a: 0 });

  useLayoutEffect(() => {
    if (!(changeMinColorAfterMount || changeMaxColorAfterMount)) {
      return;
    }
    const [minTriggerEl, maxTriggerEl] = document.querySelectorAll(".rc-color-picker-trigger");

    if (changeMinColorAfterMount) {
      (minTriggerEl as any).click();
      setImmediate(() => {
        const hexInput = (document.querySelector(
          ".rc-color-picker-panel-params-hex",
        ) as any) as HTMLInputElement;
        hexInput.value = "#d2ff03";
        TestUtils.Simulate.change(hexInput);
        TestUtils.Simulate.blur(hexInput);
      });
    } else {
      (maxTriggerEl as any).click();
      setImmediate(() => {
        const hexInput = (document.querySelector(
          ".rc-color-picker-panel-params-hex",
        ) as any) as HTMLInputElement;
        hexInput.value = "#c501ff";
        TestUtils.Simulate.change(hexInput);
        TestUtils.Simulate.blur(hexInput);
      });
    }
  }, [changeMaxColorAfterMount, changeMinColorAfterMount]);

  return (
    <div ref={containerRef} style={{ width: "400px", padding: "100px" }}>
      <GradientPicker
        minColor={minColor}
        maxColor={maxColor}
        onChange={({ minColor: newMinColor, maxColor: newMaxColor }) => {
          setMinColor(newMinColor);
          setMaxColor(newMaxColor);
        }}
      />
    </div>
  );
}

storiesOf("<GradientPicker>", module)
  .addParameters({
    screenshot: {
      viewport: { width: 585, height: 500 },
    },
  })
  .add("basic", () => (
    <Story
      initialMinColor={{ r: 1, g: 0, b: 0, a: 1 }}
      initialMaxColor={{ r: 0, g: 0, b: 1, a: 1 }}
    />
  ))
  .add("change min color", () => (
    <Story
      initialMinColor={{ r: 1, g: 0, b: 0, a: 1 }}
      initialMaxColor={{ r: 0, g: 0, b: 1, a: 1 }}
      changeMinColorAfterMount
    />
  ))
  .add("change max color", () => (
    <Story
      initialMinColor={{ r: 1, g: 0, b: 0, a: 1 }}
      initialMaxColor={{ r: 0, g: 0, b: 1, a: 1 }}
      changeMaxColorAfterMount
    />
  ));
