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

// @ts-nocheck

import {
  DEPRECATED__ros_lib_dts,
  DEPRECATED__ros_lib_filename,
} from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/typescript/DEPRECATED_ros";
import rawUserUtils from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/typescript/rawUserUtils";
import {
  ros_lib_filename,
  ros_lib_dts,
} from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/typescript/ros";
import { DEFAULT_WEBVIZ_NODE_PREFIX } from "@foxglove-studio/app/util/globalConstants";

import { lib_filename, lib_es6_dts } from "./lib";

export type NodeProjectFile = {
  fileName: string;
  filePath: string;
  sourceCode: string;
};

export type NodeProjectConfig = {
  defaultLibFileName: string;
  declarations: NodeProjectFile[];
  utilityFiles: NodeProjectFile[];
};

const utilityFiles: NodeProjectFile[] = rawUserUtils.map((utility) => ({
  ...utility,
  filePath: `${DEFAULT_WEBVIZ_NODE_PREFIX}${utility.fileName}`,
}));

export function getNodeProjectConfig() {
  // TODO load these from .ts files rather than string consts
  const declarations = [];
  declarations.push({
    fileName: lib_filename,
    filePath: lib_filename,
    sourceCode: lib_es6_dts,
  });
  declarations.push({
    fileName: DEPRECATED__ros_lib_filename,
    filePath: `/node_modules/${DEPRECATED__ros_lib_filename}`,
    sourceCode: DEPRECATED__ros_lib_dts,
  });

  return {
    defaultLibFileName: lib_filename,
    rosLib: {
      fileName: ros_lib_filename,
      filePath: `/node_modules/${ros_lib_filename}`,
      sourceCode: ros_lib_dts, // Default value that is overridden.
    },
    declarations,
    utilityFiles,
  };
}
