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

import Extension from "@foxglove-studio/app/panels/Extension";
import GlobalVariableSlider from "@foxglove-studio/app/panels/GlobalVariableSlider";
import GlobalVariables from "@foxglove-studio/app/panels/GlobalVariables";
import ImageViewPanel from "@foxglove-studio/app/panels/ImageView";
import Internals from "@foxglove-studio/app/panels/Internals";
import NodePlayground from "@foxglove-studio/app/panels/NodePlayground";
import NumberOfRenders from "@foxglove-studio/app/panels/NumberOfRenders";
import PlaybackPerformance from "@foxglove-studio/app/panels/PlaybackPerformance";
import Plot from "@foxglove-studio/app/panels/Plot";
import Publish from "@foxglove-studio/app/panels/Publish";
import RawMessages from "@foxglove-studio/app/panels/RawMessages";
import Rosout from "@foxglove-studio/app/panels/Rosout";
import SourceInfo from "@foxglove-studio/app/panels/SourceInfo";
import StateTransitions from "@foxglove-studio/app/panels/StateTransitions";
import SubscribeToList from "@foxglove-studio/app/panels/SubscribeToList";
import Tab from "@foxglove-studio/app/panels/Tab";
import Table from "@foxglove-studio/app/panels/Table";
import ThreeDimensionalViz from "@foxglove-studio/app/panels/ThreeDimensionalViz";
import TwoDimensionalPlot from "@foxglove-studio/app/panels/TwoDimensionalPlot";
import DiagnosticStatusPanel from "@foxglove-studio/app/panels/diagnostics/DiagnosticStatusPanel";
import DiagnosticSummary from "@foxglove-studio/app/panels/diagnostics/DiagnosticSummary";
import { ndash } from "@foxglove-studio/app/util/entities";

export function panelsByCategory() {
  const ros = [
    { title: "Sample Extension", component: Extension },
    { title: "2D Plot", component: TwoDimensionalPlot },
    { title: "3D", component: ThreeDimensionalViz },
    { title: `Diagnostics ${ndash} Summary`, component: DiagnosticSummary },
    { title: `Diagnostics ${ndash} Detail`, component: DiagnosticStatusPanel },
    { title: "Image", component: ImageViewPanel },
    { title: "Plot", component: Plot },
    { title: "Publish", component: Publish },
    { title: "Raw Messages", component: RawMessages },
    { title: "rosout", component: Rosout },
    { title: "State Transitions", component: StateTransitions },
    { title: "Table", component: Table },
  ];

  const utilities = [
    { title: "Global Variables", component: GlobalVariables },
    { title: "Global Variable Slider", component: GlobalVariableSlider },
    { title: "Node Playground", component: NodePlayground },
    { title: "Tab", component: Tab },
    { title: "Data Source Info", component: SourceInfo },
  ];

  const debugging = [
    { title: "Studio Internals", component: Internals },
    { title: "Number of Renders", component: NumberOfRenders },
    { title: "Playback Performance", component: PlaybackPerformance },
    { title: "Subscribe to List", component: SubscribeToList },
  ];

  return { ros, utilities, debugging };
}
