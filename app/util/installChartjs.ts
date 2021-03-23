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

import { Chart } from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import datalabelPlugin from "chartjs-plugin-datalabels";

import installMulticolorLineChart from "@foxglove-studio/app/util/multicolorLineChart";

// fixme - this and multicolor should be installed on the chart instance not on global!!
export default function installChartjs(chart: typeof Chart = Chart) {
  chart.register(annotationPlugin);
  chart.register(datalabelPlugin);

  // fixme
  //installMulticolorLineChart(Chart);

  // Otherwise we'd get labels everywhere.
  //chart.defaults.plugins.datalabels = {};
  //chart.defaults.plugins.datalabels.display = false;
}
