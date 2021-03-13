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

import DotsVerticalIcon from "@mdi/svg/svg/dots-vertical.svg";
import EarthIcon from "@mdi/svg/svg/earth.svg";
import { groupBy, defaults } from "lodash";
import { useCallback, useContext, useMemo, useState } from "react";
import styled from "styled-components";

import { TREE_SPACING } from "./TopicTree";
import { ROW_HEIGHT, SLeft, SRightActions, SToggles, STreeNodeRow } from "./TreeNodeRow";
import VisibilityToggle from "./VisibilityToggle";
import ChildToggle from "@foxglove-studio/app/components/ChildToggle";
import Icon from "@foxglove-studio/app/components/Icon";
import Menu, { Item } from "@foxglove-studio/app/components/Menu";
import Modal from "@foxglove-studio/app/components/Modal";
import { RenderToBodyComponent } from "@foxglove-studio/app/components/RenderToBodyComponent";
import Tooltip from "@foxglove-studio/app/components/Tooltip";
import useGlobalVariables from "@foxglove-studio/app/hooks/useGlobalVariables";
import { getDefaultColorOverrideBySourceIdx } from "@foxglove-studio/app/panels/ThreeDimensionalViz/GlobalVariableStyles";
import { ThreeDimensionalVizContext } from "@foxglove-studio/app/panels/ThreeDimensionalViz/ThreeDimensionalVizContext";
import {
  ColorPickerSettingsPanel,
  PICKER_SIZE,
  getHexFromColorSettingWithDefault,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicSettingsEditor/ColorPickerForTopicSettings";
import {
  TreeUINode,
  TooltipRow,
  TooltipTable,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicTree/renderTreeNodes";
import { Color } from "@foxglove-studio/app/types/Messages";
import filterMap from "@foxglove-studio/app/util/filterMap";
import { SECOND_SOURCE_PREFIX } from "@foxglove-studio/app/util/globalConstants";
import { joinTopics } from "@foxglove-studio/app/util/topicUtils";

// TODO: Dedupe from renderNamespaceNodes
const OUTER_LEFT_MARGIN = 12;

export const SDisplayName = styled.div`
  font-size: 13px;
  line-height: 1.4;
  margin: 0 4px;
  word-break: break-word;
  /* disallow selection to prevent shift + click from accidentally select */
  user-select: none;
  width: 100%;
`;

export function renderStyleExpressionNodes({
  width,
  isXSWidth,
  topicName,
  hasFeatureColumn,
  linkedGlobalVariablesByTopic,
}: any): TreeUINode[] {
  const rowWidth = width - (isXSWidth ? 0 : TREE_SPACING * 2) - OUTER_LEFT_MARGIN;
  const linkedGlobalVariablesByVariableName = groupBy(
    linkedGlobalVariablesByTopic[topicName] || [],
    ({ name }) => name,
  );
  return Object.keys(linkedGlobalVariablesByVariableName).map((variableName, rowIndex) => {
    const title = (
      <StyleExpressionNode
        {...{
          linkedGlobalVariables: linkedGlobalVariablesByVariableName[variableName],
          topic: topicName,
          hasFeatureColumn,
          rowWidth,
          rowIndex,
          variableName,
        }}
      />
    );
    return { key: `${topicName}~${variableName}`, title } as any;
  });
}

const SItemContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;
const SColorPickerWrapper = styled.span`
  display: inline-flex;
  align-items: center;
`;

const SColorTrigger = styled.span<any>`
  display: inline-block;
  cursor: pointer;
  background: ${({ hexColor }) => hexColor};
  width: ${PICKER_SIZE.SMALL.size}px;
  height: ${PICKER_SIZE.SMALL.size}px;
  border-radius: ${PICKER_SIZE.SMALL.size / 2}px;
`;

function StyleExpressionNode(props: any) {
  const { topic, rowWidth, rowIndex, hasFeatureColumn, linkedGlobalVariables } = props;
  const [editingColorForSourceIdx, setEditingColorForSourceIdx] = useState(false);

  const {
    colorOverrideBySourceIdxByVariable,
    setColorOverrideBySourceIdxByVariable,
    setHoveredMarkerMatchers,
  } = useContext(ThreeDimensionalVizContext);

  const { globalVariables } = useGlobalVariables();
  const { markerKeyPath, name } = linkedGlobalVariables[0];

  const value = globalVariables[name];
  const colorOverridesByColumnIdx = defaults(
    [],
    colorOverrideBySourceIdxByVariable[name],
    getDefaultColorOverrideBySourceIdx(rowIndex),
  );
  const activeRowActive = colorOverridesByColumnIdx.some((colorOverride) => colorOverride?.active);

  // Callbacks
  const updateSettingsForGlobalVariable = useCallback(
    (globalVariableName, settings: { active: boolean; color: Color }, sourceIdx = 0) => {
      const updatedSettings = new Array(2)
        .fill(0)
        .map((_, i) => colorOverrideBySourceIdxByVariable[globalVariableName]?.[i]);
      updatedSettings[sourceIdx] = settings;
      setColorOverrideBySourceIdxByVariable({
        ...colorOverrideBySourceIdxByVariable,
        [globalVariableName]: updatedSettings,
      });
    },
    [colorOverrideBySourceIdxByVariable, setColorOverrideBySourceIdxByVariable],
  );

  // Mouse-hover handlers
  const onMouseLeave = useCallback(() => setHoveredMarkerMatchers([]), [setHoveredMarkerMatchers]);
  const mouseEventHandlersByColumnIdx = useMemo(() => {
    const topicNameByColumnIdx = [topic, joinTopics(SECOND_SOURCE_PREFIX, topic)];
    return topicNameByColumnIdx.map((_topic) => ({
      onMouseEnter: () =>
        setHoveredMarkerMatchers([{ topic: _topic, checks: [{ markerKeyPath, value }] }]),
      onMouseLeave,
    }));
  }, [markerKeyPath, onMouseLeave, setHoveredMarkerMatchers, topic, value]);

  const tooltipContent = (
    <TooltipRow>
      <TooltipTable>
        <tbody>
          <tr>
            <th>Topic:</th>
            <td>
              <code>{topic}</code>
            </td>
          </tr>
          <tr>
            <th>Expression:</th>
            <td>
              <code>
                .{markerKeyPath.join(".")} == {value}
              </code>
            </td>
          </tr>
        </tbody>
      </TooltipTable>
    </TooltipRow>
  );

  return (
    <STreeNodeRow
      visibleInScene={activeRowActive}
      style={{
        width: rowWidth,
        marginLeft: `-${OUTER_LEFT_MARGIN}px`,
      }}
    >
      <SLeft data-test={`ns~${name}`}>
        <Icon style={{ color: "rgba(255,255,255, 0.3)" }}>
          <EarthIcon style={{ width: 16, height: 16 }} />
        </Icon>
        <Tooltip contents={tooltipContent} placement="top">
          <SDisplayName>
            .{markerKeyPath.join(".")} == ${name}
          </SDisplayName>
        </Tooltip>
      </SLeft>
      <SRightActions>
        {colorOverridesByColumnIdx && (
          <SToggles>
            {filterMap(colorOverridesByColumnIdx, (override, sourceIdx) => {
              if (!hasFeatureColumn && sourceIdx === 1) {
                return null;
              }
              const { active, color } = override || { active: false, color: null };
              return (
                <VisibilityToggle
                  available={true}
                  checked={active}
                  dataTest={`visibility-toggle T:${topic} ${name} ${sourceIdx}`}
                  key={sourceIdx}
                  onAltToggle={() =>
                    updateSettingsForGlobalVariable(name, { active: !active, color }, sourceIdx)
                  }
                  onToggle={() =>
                    updateSettingsForGlobalVariable(name, { active: !active, color }, sourceIdx)
                  }
                  overrideColor={color}
                  size="SMALL"
                  unavailableTooltip={""}
                  visibleInScene={active}
                  diffModeEnabled={false}
                  columnIndex={sourceIdx}
                  {...mouseEventHandlersByColumnIdx[sourceIdx]}
                />
              );
            })}
          </SToggles>
        )}
        <ChildToggle position="below" dataTest={`topic-row-menu-${topic}`}>
          <Icon
            small
            fade
            style={{
              padding: "4px 0px",
              height: ROW_HEIGHT,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <DotsVerticalIcon />
          </Icon>
          <Menu>
            <Item
              onClick={() => setEditingColorForSourceIdx(0 as any)}
              style={{ padding: "0 12px", height: 28 }}
            >
              <SItemContent>
                <span style={{ paddingRight: 8 }}>Marker color</span>
                <SColorPickerWrapper>
                  <SColorTrigger
                    hexColor={getHexFromColorSettingWithDefault(
                      (colorOverridesByColumnIdx[0] as any).color,
                    )}
                  />
                </SColorPickerWrapper>
                {/* @ts-expect-error-error fix comparison operator */}
                {editingColorForSourceIdx === 0 && (
                  <ColorPickerOverlay
                    color={(colorOverridesByColumnIdx[0] as any).color}
                    onChangeColor={(color) => {
                      updateSettingsForGlobalVariable(
                        name,
                        { color, active: (colorOverridesByColumnIdx[0] as any).active },
                        0,
                      );
                    }}
                    onRequestClose={() => setEditingColorForSourceIdx(-1 as any)}
                  />
                )}
              </SItemContent>
            </Item>
            {hasFeatureColumn && (
              <Item
                onClick={() => setEditingColorForSourceIdx(1 as any)}
                style={{ padding: "0 12px", height: 28 }}
              >
                <SItemContent>
                  <span style={{ paddingRight: 8 }}>Feature marker color</span>
                  <SColorPickerWrapper>
                    <SColorTrigger
                      hexColor={getHexFromColorSettingWithDefault(
                        (colorOverridesByColumnIdx[1] as any).color,
                      )}
                    />
                  </SColorPickerWrapper>
                  {/* @ts-expect-error-error fix comparison operator */}
                  {editingColorForSourceIdx === 1 && (
                    <ColorPickerOverlay
                      color={(colorOverridesByColumnIdx[1] as any).color}
                      onChangeColor={(color) => {
                        const active = (colorOverridesByColumnIdx[1] as any).active;
                        updateSettingsForGlobalVariable(name, { color, active }, 1);
                      }}
                      onRequestClose={() => setEditingColorForSourceIdx(-1 as any)}
                    />
                  )}
                </SItemContent>
              </Item>
            )}
          </Menu>
        </ChildToggle>
      </SRightActions>
    </STreeNodeRow>
  );
}

function ColorPickerOverlay({
  onChangeColor,
  onRequestClose,
  color,
}: {
  color: Color;
  onChangeColor: (color: Color) => void;
  onRequestClose: () => void;
}) {
  return (
    <RenderToBodyComponent>
      <Modal
        onRequestClose={onRequestClose}
        contentStyle={{
          maxHeight: "calc(100vh - 200px)",
          maxWidth: 480,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ColorPickerSettingsPanel color={color} onChange={onChangeColor} />
      </Modal>
    </RenderToBodyComponent>
  );
}
