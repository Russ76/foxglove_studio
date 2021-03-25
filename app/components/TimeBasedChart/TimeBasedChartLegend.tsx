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
import CheckboxBlankOutlineIcon from "@mdi/svg/svg/checkbox-blank-outline.svg";
import CheckboxMarkedIcon from "@mdi/svg/svg/checkbox-marked.svg";
import { ChartDataset } from "chart.js";

import {
  PLOT_DASHED_STYLE,
  PLOT_DOT_DASHED_STYLE,
} from "@foxglove-studio/app/components/TimeBasedChart/constants";

type Props = {
  canToggleLines?: boolean;
  datasets: readonly ChartDataset<"scatter">[];
  linesToHide: {
    [key: string]: boolean;
  };
  toggleLine?: (datasetId: string | typeof undefined, lineToHide: string) => void;
  datasetId?: string;
};

const checkboxStyle = { height: 12, marginBottom: -2 };

export default function TimeBasedChartLegend(props: Props) {
  const onCheckboxClick = (label: string) => () => {
    const { datasetId, toggleLine } = props;
    toggleLine?.(datasetId, label);
  };

  const { canToggleLines, linesToHide } = props;
  return (
    <div>
      {props.datasets.map((dataset, i) => {
        const { label, borderColor, borderDash } = dataset;
        let pointSvg;
        if (borderDash === PLOT_DOT_DASHED_STYLE) {
          pointSvg = (
            <svg width="11" height="10">
              <line
                stroke={String(borderColor)}
                strokeWidth="2"
                strokeDasharray={PLOT_DOT_DASHED_STYLE.join(", ")}
                x1="0"
                x2="18"
                y1="6"
                y2="6"
              />
            </svg>
          );
        } else if (borderDash === PLOT_DASHED_STYLE) {
          pointSvg = <span style={{ fontSize: "12px", fontWeight: "bold" }}>- -</span>;
        } else {
          pointSvg = <span style={{ fontSize: "12px", fontWeight: "bold" }}>––</span>;
        }

        if (label == undefined) {
          return;
        }

        const CheckboxComponent = linesToHide[label]
          ? CheckboxBlankOutlineIcon
          : CheckboxMarkedIcon;
        return (
          <div key={i} style={{ color: String(borderColor), fill: "white", whiteSpace: "nowrap" }}>
            {canToggleLines && (
              <CheckboxComponent style={checkboxStyle} onClick={onCheckboxClick(label)} />
            )}
            {pointSvg} <span style={{ fontSize: "10px" }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
