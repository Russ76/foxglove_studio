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

import { TF_DATATYPE } from "@foxglove-studio/app/util/globalConstants";

import { ThreeDimensionalVizHooks } from "./types";

const sceneBuilderHooks: ThreeDimensionalVizHooks = {
  getSelectionState: () => {
    // no-op
  },
  getTopicsToRender: () => new Set(),
  consumeBobject: (topic, datatype, msg, consumeMethods, { errors }) => {
    // TF messages are consumed by TransformBuilder, not SceneBuilder.
    if (datatype === TF_DATATYPE) {
      return;
    }
    errors.topicsWithError.set(topic, `Unrecognized topic datatype for scene: ${datatype}`);
  },
  addMarkerToCollector: () => false,
  getSyntheticArrowMarkerColor: () => ({ r: 0, g: 0, b: 1, a: 0.5 }),
  getFlattenedPose: () => undefined,
  getOccupancyGridValues: (_topic) => [0.5, "map"],
  getMarkerColor: (topic, markerColor) => markerColor,
  skipTransformFrame: undefined,
};

export default sceneBuilderHooks;
