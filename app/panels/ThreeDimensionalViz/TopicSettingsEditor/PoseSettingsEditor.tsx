// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import CheckboxBlankOutlineIcon from "@mdi/svg/svg/checkbox-blank-outline.svg";
import CheckboxMarkedIcon from "@mdi/svg/svg/checkbox-marked.svg";
import InformationIcon from "@mdi/svg/svg/information.svg";

import Flex from "@foxglove-studio/app/components/Flex";
import Icon from "@foxglove-studio/app/components/Icon";
import { getGlobalHooks } from "@foxglove-studio/app/loadWebviz";
import { Color, PoseStamped } from "@foxglove-studio/app/types/Messages";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";

import { TopicSettingsEditorProps } from ".";
import ColorPickerForTopicSettings from "./ColorPickerForTopicSettings";
import { SLabel, SInput } from "./common";

export type PoseSettings = {
  overrideColor?: Color;
  alpha?: number;
  size?: {
    headLength: number;
    headWidth: number;
    shaftWidth: number;
  };
  modelType?: "car-model" | "arrow" | "car-outline";
  addCarOutlineBuffer?: boolean;
};

export default function PoseSettingsEditor(
  props: TopicSettingsEditorProps<PoseStamped, PoseSettings>,
) {
  const { message, settings, onFieldChange, onSettingsChange } = props;

  const settingsByCarType = React.useMemo(() => {
    switch (settings.modelType) {
      case "car-model": {
        const alpha = settings.alpha != undefined ? settings.alpha : 1;
        return (
          <Flex col>
            <SLabel>Alpha</SLabel>
            <SInput
              type="number"
              value={alpha.toString()}
              min={0}
              max={1}
              step={0.1}
              onChange={(e) => onSettingsChange({ ...settings, alpha: parseFloat(e.target.value) })}
            />
          </Flex>
        );
      }
      case "car-outline": {
        return (
          <>
            <SLabel>Color of outline</SLabel>
            <ColorPickerForTopicSettings
              color={settings.overrideColor}
              onChange={(newColor) => onFieldChange("overrideColor", newColor)}
            />
          </>
        );
      }
      case "arrow":
      default: {
        const currentShaftWidth = settings.size?.shaftWidth ?? 2;
        const currentHeadWidth = settings.size?.headWidth ?? 2;
        const currentHeadLength = settings.size?.headLength ?? 0.1;
        return (
          <Flex col>
            <SLabel>Color</SLabel>
            <ColorPickerForTopicSettings
              color={settings.overrideColor as any}
              onChange={(newColor) => onFieldChange("overrideColor", newColor)}
            />
            <SLabel>Shaft width</SLabel>
            <SInput
              type="number"
              value={currentShaftWidth}
              placeholder="2"
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  size: { ...settings.size, shaftWidth: parseFloat(e.target.value) },
                })
              }
            />
            <SLabel>Head width</SLabel>
            <SInput
              type="number"
              value={currentHeadWidth}
              placeholder="2"
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  size: { ...settings.size, headWidth: parseFloat(e.target.value) },
                })
              }
            />
            <SLabel>Head length</SLabel>
            <SInput
              type="number"
              value={currentHeadLength}
              placeholder="0.1"
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  size: { ...settings.size, headLength: parseFloat(e.target.value) },
                })
              }
            />
          </Flex>
        );
      }
    }
  }, [onFieldChange, onSettingsChange, settings]);

  const badModelTypeSetting = React.useMemo(
    () => !["car-model", "car-outline", "arrow"].includes(settings.modelType as any),
    [settings],
  );

  if (!message) {
    return (
      <div style={{ color: colors.TEXT_MUTED }}>
        <small>Waiting for messages...</small>
      </div>
    );
  }

  const CheckboxComponent = settings.addCarOutlineBuffer
    ? CheckboxMarkedIcon
    : CheckboxBlankOutlineIcon;

  const iconProps = {
    width: 16,
    height: 16,
    style: {
      fill: "currentColor",
      position: "relative",
      top: "5px",
    },
  } as any;

  const copy = (getGlobalHooks() as any).perPanelHooks().ThreeDimensionalViz.copy
    .poseSettingsEditor;
  return (
    <Flex col>
      <SLabel>Rendered Car</SLabel>
      <div
        style={{ display: "flex", margin: "4px", flexDirection: "column" }}
        onChange={(e) => {
          onSettingsChange({ ...settings, modelType: (e.target as any).value, alpha: undefined });
        }}
      >
        {[
          { value: "car-model", title: "Car Model" },
          { value: "car-outline", title: "Car Outline" },
          { value: "arrow", title: "Arrow" },
        ].map(({ value, title }) => (
          <div key={value} style={{ marginBottom: "4px", display: "flex" }}>
            <input
              type="radio"
              value={value}
              checked={settings.modelType === value || (value === "arrow" && badModelTypeSetting)}
            />
            <label>{title}</label>
          </div>
        ))}
      </div>

      <Flex style={{ marginBottom: "5px", cursor: "pointer" }}>
        <CheckboxComponent
          {...iconProps}
          onClick={() =>
            onSettingsChange({ ...settings, addCarOutlineBuffer: !settings.addCarOutlineBuffer })
          }
        />
        <SLabel>Show error buffer</SLabel>
        {copy?.errorBuffer && (
          <Icon tooltip={copy.errorBuffer}>
            <InformationIcon />
          </Icon>
        )}
      </Flex>
      {settingsByCarType}
    </Flex>
  );
}

PoseSettingsEditor.canEditNamespaceOverrideColor = true;
