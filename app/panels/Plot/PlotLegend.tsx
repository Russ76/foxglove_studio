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

import AlertCircleIcon from "@mdi/svg/svg/alert-circle.svg";
import MenuIcon from "@mdi/svg/svg/menu.svg";
import cx from "classnames";
import { last } from "lodash";
import { Fragment, useCallback, useMemo } from "react";

import Dropdown from "@foxglove-studio/app/components/Dropdown";
import DropdownItem from "@foxglove-studio/app/components/Dropdown/DropdownItem";
import Icon from "@foxglove-studio/app/components/Icon";
import MessagePathInput from "@foxglove-studio/app/components/MessagePathSyntax/MessagePathInput";
import {
  PlotPath,
  BasePlotPath,
  isReferenceLinePlotPathType,
} from "@foxglove-studio/app/panels/Plot/internalTypes";
import { lineColors } from "@foxglove-studio/app/util/plotColors";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";
import { TimestampMethod } from "@foxglove-studio/app/util/time";

import styles from "./PlotLegend.module.scss";
import { plotableRosTypes, PlotConfig, PlotXAxisVal } from "./types";

type PlotLegendProps = {
  paths: PlotPath[];
  saveConfig: (arg0: Partial<PlotConfig>) => void;
  showLegend: boolean;
  xAxisVal: PlotXAxisVal;
  xAxisPath?: BasePlotPath;
  pathsWithMismatchedDataLengths: string[];
};

const shortXAxisLabel = (path: PlotXAxisVal): string => {
  switch (path) {
    case "custom":
      return "path (accum)";
    case "index":
      return "index";
    case "currentCustom":
      return "path (current)";
    case "timestamp":
      return "timestamp";
    default:
      path as never; // Assert the switch is exhaustive

      throw new Error("Satisfy flow");
  }
};

export default function PlotLegend(props: PlotLegendProps) {
  const {
    paths,
    saveConfig,
    showLegend,
    xAxisVal,
    xAxisPath,
    pathsWithMismatchedDataLengths,
  } = props;
  const lastPath = last(paths);

  const onInputChange = useCallback(
    (value: string, index?: number) => {
      if (index == undefined) {
        throw new Error("index not set");
      }
      const newPaths = paths.slice();
      newPaths[index] = { ...newPaths[index], value: value.trim() };
      saveConfig({ paths: newPaths });
    },
    [paths, saveConfig],
  );

  const onInputTimestampMethodChange = useCallback(
    (value: TimestampMethod, index?: number) => {
      if (index == undefined) {
        throw new Error("index not set");
      }
      const newPaths = paths.slice();
      newPaths[index] = { ...newPaths[index], timestampMethod: value };
      saveConfig({ paths: newPaths });
    },
    [paths, saveConfig],
  );

  const { toggleToHideLegend, toggleToShowLegend } = useMemo(
    () => ({
      toggleToHideLegend: () => saveConfig({ showLegend: false }),
      toggleToShowLegend: () => saveConfig({ showLegend: true }),
    }),
    [saveConfig],
  );

  if (!showLegend) {
    return (
      <div className={styles.root}>
        <Icon className={styles.legendToggle} onClick={toggleToShowLegend}>
          <MenuIcon />
        </Icon>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Icon className={styles.legendToggle} onClick={toggleToHideLegend}>
        <MenuIcon />
      </Icon>
      <div className={styles.item}>
        x:
        <div
          className={styles.itemIconContainer}
          style={{ width: "auto", lineHeight: "normal", zIndex: 2 }}
        >
          <Dropdown
            dataTest="plot-legend-x-axis-menu"
            value={xAxisVal}
            text={shortXAxisLabel(xAxisVal)}
            btnStyle={{ backgroundColor: "transparent", padding: 3 }}
            onChange={(newXAxisVal) => saveConfig({ xAxisVal: newXAxisVal })}
            noPortal
          >
            <DropdownItem value="timestamp">
              <span>timestamp</span>
            </DropdownItem>
            <DropdownItem value="index">
              <span>index</span>
            </DropdownItem>
            <DropdownItem value="currentCustom">
              <span>msg path (current)</span>
            </DropdownItem>
            <DropdownItem value="custom">
              <span>msg path (accumulated)</span>
            </DropdownItem>
          </Dropdown>
        </div>
        <div
          className={cx({
            [styles.itemInput]: true,
            [styles.itemInputDisabled]: !xAxisPath?.enabled,
          })}
        >
          {(xAxisVal === "custom" || xAxisVal === "currentCustom") && (
            <MessagePathInput
              path={xAxisPath?.value || "/"}
              onChange={(newXAxisPath) =>
                saveConfig({
                  xAxisPath: { value: newXAxisPath, enabled: xAxisPath ? xAxisPath.enabled : true },
                })
              }
              validTypes={plotableRosTypes}
              placeholder="Enter a topic name or a number"
              disableAutocomplete={xAxisPath && isReferenceLinePlotPathType(xAxisPath)}
              autoSize
            />
          )}
        </div>
      </div>
      {paths.map((path: PlotPath, index: number) => {
        const isReferenceLinePlotPath = isReferenceLinePlotPathType(path);
        let timestampMethod;
        // Only allow chosing the timestamp method if it is applicable (not a reference line) and there is at least
        // one character typed.
        if (!isReferenceLinePlotPath && path.value.length > 0) {
          timestampMethod = path.timestampMethod;
        }
        const hasMismatchedDataLength = pathsWithMismatchedDataLengths.includes(path.value);

        return (
          <Fragment key={index}>
            <div className={styles.item}>
              y:
              <div
                className={styles.itemIconContainer}
                style={{ zIndex: 1 }}
                onClick={() => {
                  const newPaths = paths.slice();
                  newPaths[index] = { ...newPaths[index], enabled: !newPaths[index].enabled };
                  saveConfig({ paths: newPaths });
                }}
              >
                <div
                  className={styles.itemIcon}
                  style={{ color: path.enabled ? lineColors[index % lineColors.length] : "#777" }}
                />
              </div>
              <div
                className={cx({
                  [styles.itemInput]: true,
                  [styles.itemInputDisabled]: !path.enabled,
                })}
              >
                <MessagePathInput
                  path={path.value}
                  onChange={onInputChange}
                  onTimestampMethodChange={onInputTimestampMethodChange}
                  validTypes={plotableRosTypes}
                  placeholder="Enter a topic name or a number"
                  index={index}
                  autoSize
                  disableAutocomplete={isReferenceLinePlotPath}
                  {...(xAxisVal === "timestamp" ? { timestampMethod } : undefined)}
                />
                {hasMismatchedDataLength && (
                  <Icon
                    style={{ color: colors.RED }}
                    clickable={false}
                    small
                    tooltipProps={{ placement: "top" } as any}
                    tooltip="Mismatch in the number of elements in x-axis and y-axis messages"
                  >
                    <AlertCircleIcon />
                  </Icon>
                )}
              </div>
              <div
                className={styles.itemRemove}
                onClick={() => {
                  const newPaths = paths.slice();
                  newPaths.splice(index, 1);
                  saveConfig({ paths: newPaths });
                }}
              >
                ✕
              </div>
            </div>
          </Fragment>
        );
      })}
      <div
        className={styles.addLine}
        onClick={() =>
          saveConfig({
            paths: [
              ...paths,
              {
                value: "",
                enabled: true,
                // For convenience, default to the `timestampMethod` of the last path.
                timestampMethod: lastPath ? lastPath.timestampMethod : "receiveTime",
              },
            ],
          })
        }
      >
        + add line
      </div>
    </div>
  );
}
