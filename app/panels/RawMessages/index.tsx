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
import ConsoleLineIcon from "@mdi/svg/svg/console-line.svg";
import PlusMinusIcon from "@mdi/svg/svg/plus-minus.svg";
import LessIcon from "@mdi/svg/svg/unfold-less-horizontal.svg";
import MoreIcon from "@mdi/svg/svg/unfold-more-horizontal.svg";
// eslint-disable-next-line no-restricted-imports
import { first, isEqual, get, last } from "lodash";
import React, { useState, useCallback, useMemo } from "react";
import ReactHoverObserver from "react-hover-observer";
import Tree from "react-json-tree";

import { HighlightedValue, SDiffSpan, MaybeCollapsedValue } from "./Diff";
import Metadata from "./Metadata";
import RawMessagesIcons from "./RawMessagesIcons";
import {
  ValueAction,
  getValueActionForValue,
  getStructureItemForPath,
} from "./getValueActionForValue";
import helpContent from "./index.help.md";
import styles from "./index.module.scss";
import { DATA_ARRAY_PREVIEW_LIMIT, getItemString, getItemStringForDiff } from "./utils";
import { useDataSourceInfo, useMessagesByTopic } from "@foxglove-studio/app/PanelAPI";
import Dropdown from "@foxglove-studio/app/components/Dropdown";
import DropdownItem from "@foxglove-studio/app/components/Dropdown/DropdownItem";
import EmptyState from "@foxglove-studio/app/components/EmptyState";
import Flex from "@foxglove-studio/app/components/Flex";
import Icon from "@foxglove-studio/app/components/Icon";
import MessagePathInput from "@foxglove-studio/app/components/MessagePathSyntax/MessagePathInput";
import {
  RosPath,
  MessagePathStructureItem,
} from "@foxglove-studio/app/components/MessagePathSyntax/constants";
import {
  messagePathStructures,
  traverseStructure,
} from "@foxglove-studio/app/components/MessagePathSyntax/messagePathsForDatatype";
import parseRosPath from "@foxglove-studio/app/components/MessagePathSyntax/parseRosPath";
import {
  useCachedGetMessagePathDataItems,
  MessagePathDataItem,
} from "@foxglove-studio/app/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useLatestMessageDataItem } from "@foxglove-studio/app/components/MessagePathSyntax/useLatestMessageDataItem";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import Tooltip from "@foxglove-studio/app/components/Tooltip";
import getDiff, {
  diffLabels,
  diffLabelsByLabelText,
} from "@foxglove-studio/app/panels/RawMessages/getDiff";
import { cast, Topic } from "@foxglove-studio/app/players/types";
import { PanelConfig } from "@foxglove-studio/app/types/panels";
import { objectValues } from "@foxglove-studio/app/util";
import {
  ArrayView,
  deepParse,
  fieldNames,
  getField,
  getIndex,
  isArrayView,
  isBobject,
} from "@foxglove-studio/app/util/binaryObjects";
import { jsonTreeTheme, SECOND_SOURCE_PREFIX } from "@foxglove-studio/app/util/globalConstants";
import { enumValuesByDatatypeAndField } from "@foxglove-studio/app/util/selectors";

export const CUSTOM_METHOD = "custom";
export const PREV_MSG_METHOD = "previous message";
export const OTHER_SOURCE_METHOD = "other source";
export type RawMessagesConfig = {
  topicPath: string;
  diffMethod: "custom" | "previous message" | "other source";
  diffTopicPath: string;
  diffEnabled: boolean;
  showFullMessageForDiff: boolean;
};

type Props = {
  config: RawMessagesConfig;
  saveConfig: (arg0: Partial<RawMessagesConfig>) => void;
  openSiblingPanel: (arg0: string, cb: (arg0: PanelConfig) => PanelConfig) => void;
};

const isSingleElemArray = (obj: any) => {
  if (!Array.isArray(obj) && !isArrayView(obj)) {
    return false;
  }
  const arr = isArrayView(obj) ? cast<ArrayView<any>>(obj).toArray() : cast<any[]>(obj);
  return arr.filter((a) => a != null).length === 1;
};
const dataWithoutWrappingArray = (data: any) => {
  return isSingleElemArray(data) && typeof getIndex(data, 0) === "object"
    ? getIndex(data, 0)
    : data;
};

const maybeShallowParse = (obj: unknown): unknown => {
  if (!isBobject(obj)) {
    return obj;
  }
  if (isArrayView(obj)) {
    return cast<ArrayView<any>>(obj).toArray();
  }
  const ret: any = {};
  fieldNames(obj).forEach((field) => {
    ret[field] = getField(obj, field);
  });
  return ret;
};

const maybeDeepParse = (obj: unknown): unknown => {
  if (!isBobject(obj)) {
    return obj;
  }
  return deepParse(obj);
};

function RawMessages(props: Props) {
  const { config, saveConfig, openSiblingPanel } = props;
  const { topicPath, diffMethod, diffTopicPath, diffEnabled, showFullMessageForDiff } = config;
  const { topics, datatypes } = useDataSourceInfo();

  const topicRosPath: RosPath | null | undefined = useMemo(() => parseRosPath(topicPath), [
    topicPath,
  ]);
  const topic: Topic | null | undefined = useMemo(
    () => topicRosPath && topics.find(({ name }) => name === topicRosPath.topicName),
    [topicRosPath, topics],
  );
  const rootStructureItem: MessagePathStructureItem | null | undefined = useMemo(() => {
    if (!topic || !topicRosPath) {
      return;
    }
    return traverseStructure(
      messagePathStructures(datatypes)[topic.datatype],
      topicRosPath.messagePath,
    ).structureItem;
  }, [datatypes, topic, topicRosPath]);

  // When expandAll is unset, we'll use expandedFields to get expanded info
  const [expandAll, setExpandAll] = useState(false);
  const [expandedFields, setExpandedFields] = useState(() => new Set());

  const topicName = topicRosPath?.topicName || "";
  const consecutiveMsgs = useMessagesByTopic({
    topics: [topicName],
    historySize: 2,
    format: "bobjects",
  })[topicName];
  const cachedGetMessagePathDataItems = useCachedGetMessagePathDataItems([topicPath]);
  const prevTickMsg = consecutiveMsgs[consecutiveMsgs.length - 2];
  const [prevTickObj, currTickObj] = [
    prevTickMsg && {
      message: prevTickMsg,
      queriedData: cachedGetMessagePathDataItems(topicPath, prevTickMsg) || [],
    },
    useLatestMessageDataItem(topicPath, "bobjects"),
  ];

  const otherSourceTopic = topicName.startsWith(SECOND_SOURCE_PREFIX)
    ? topicName.replace(SECOND_SOURCE_PREFIX, "")
    : `${SECOND_SOURCE_PREFIX}${topicName}`;
  const inOtherSourceDiffMode = diffEnabled && diffMethod === OTHER_SOURCE_METHOD;
  const diffTopicObj = useLatestMessageDataItem(
    diffEnabled ? (inOtherSourceDiffMode ? otherSourceTopic : diffTopicPath) : "",
    "parsedMessages",
  );

  const inTimetickDiffMode = diffEnabled && diffMethod === PREV_MSG_METHOD;
  const baseItem = inTimetickDiffMode ? prevTickObj : currTickObj;
  const diffItem = inTimetickDiffMode ? currTickObj : diffTopicObj;

  const onTopicPathChange = useCallback(
    (newTopicPath: string) => {
      saveConfig({ topicPath: newTopicPath });
    },
    [saveConfig],
  );

  const onDiffTopicPathChange = useCallback(
    (newDiffTopicPath: string) => {
      saveConfig({ diffTopicPath: newDiffTopicPath });
    },
    [saveConfig],
  );

  const onToggleDiff = useCallback(() => {
    saveConfig({ diffEnabled: !diffEnabled });
  }, [diffEnabled, saveConfig]);

  const onToggleExpandAll = useCallback(() => {
    setExpandedFields(new Set());
    setExpandAll((currVal) => !currVal);
  }, []);

  const onLabelClick = useCallback(
    (keypath: string[]) => {
      // Create a unique key according to the keypath / raw
      const key = keypath.join("~");
      const expandedFieldsCopy = new Set(expandedFields);
      if (expandedFieldsCopy.has(key)) {
        expandedFieldsCopy.delete(key);
        setExpandedFields(expandedFieldsCopy);
      } else {
        expandedFieldsCopy.add(key);
        setExpandedFields(expandedFieldsCopy);
      }
      setExpandAll(null as any);
    },
    [expandedFields],
  );

  const valueRenderer = useCallback(
    (
      structureItem: MessagePathStructureItem | null | undefined,
      data: unknown[],
      queriedData: MessagePathDataItem[],
      label: string,
      itemValue: unknown,
      ...keyPath: (number | string)[]
    ) => (
      <ReactHoverObserver className={styles.iconWrapper}>
        {({ isHovering }: any) => {
          const lastKeyPath: number = last(keyPath) as any;
          let valueAction: ValueAction | null | undefined;
          if (isHovering && structureItem) {
            valueAction = getValueActionForValue(
              data[lastKeyPath],
              structureItem,
              keyPath.slice(0, -1).reverse(),
            );
          }

          let constantName: string | null | undefined;
          if (structureItem) {
            const childStructureItem = getStructureItemForPath(
              structureItem,
              keyPath.slice(0, -1).reverse().join(","),
            );
            if (childStructureItem) {
              const field = keyPath[0];
              if (typeof field === "string") {
                const enumMapping = enumValuesByDatatypeAndField(datatypes);
                const datatype = childStructureItem.datatype;
                if (
                  enumMapping[datatype] &&
                  enumMapping[datatype][field] &&
                  enumMapping[datatype][field][itemValue as any]
                ) {
                  constantName = enumMapping[datatype][field][itemValue as any];
                }
              }
            }
          }
          const basePath: string = queriedData[lastKeyPath] && queriedData[lastKeyPath].path;
          let itemLabel = label;
          // output preview for the first x items if the data is in binary format
          // sample output: Int8Array(331776) [-4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, ...]
          let smallNumberArrayStr = "";
          if (ArrayBuffer.isView(itemValue)) {
            // @ts-expect-error whatever log is here is not correct for ArrayBufferView
            const itemPart = itemValue.slice(0, DATA_ARRAY_PREVIEW_LIMIT).join(", ");
            // @ts-expect-error whatever log is here is not correct for ArrayBufferView
            const length = itemValue.length;
            smallNumberArrayStr = `(${length}) [${itemPart}${
              length >= DATA_ARRAY_PREVIEW_LIMIT ? ", ..." : ""
            }] `;
            itemLabel = itemValue.constructor.name;
          }
          if (constantName) {
            itemLabel = `${itemLabel} (${constantName})`;
          }
          return (
            <span>
              <HighlightedValue itemLabel={itemLabel} />
              {smallNumberArrayStr && (
                <>
                  {smallNumberArrayStr}
                  <Icon
                    fade
                    className={styles.icon}
                    // eslint-disable-next-line no-restricted-syntax
                    onClick={() => console.log(itemValue)}
                    tooltip="Log data to browser console"
                  >
                    <ConsoleLineIcon />
                  </Icon>
                </>
              )}
              <span className={styles.iconBox}>
                {valueAction && (
                  <RawMessagesIcons
                    valueAction={valueAction}
                    basePath={basePath}
                    onTopicPathChange={onTopicPathChange}
                    openSiblingPanel={openSiblingPanel}
                  />
                )}
              </span>
            </span>
          );
        }}
      </ReactHoverObserver>
    ),
    [datatypes, onTopicPathChange, openSiblingPanel],
  );

  const renderSingleTopicOrDiffOutput = useCallback(() => {
    let shouldExpandNode;
    if (expandAll !== null) {
      shouldExpandNode = () => expandAll;
    } else {
      shouldExpandNode = (keypath: any) => {
        return expandedFields.has(keypath.join("~"));
      };
    }

    if (!topicPath) {
      return <EmptyState>No topic selected</EmptyState>;
    }
    if (diffEnabled && diffMethod === CUSTOM_METHOD && (!baseItem || !diffItem)) {
      return (
        <EmptyState>{`Waiting to diff next messages from "${topicPath}" and "${diffTopicPath}"`}</EmptyState>
      );
    }
    if (diffEnabled && diffMethod === OTHER_SOURCE_METHOD && (!baseItem || !diffItem)) {
      return (
        <EmptyState>{`Waiting to diff next messages from "${topicPath}" and "${otherSourceTopic}"`}</EmptyState>
      );
    }
    if (!baseItem) {
      return <EmptyState>Waiting for next message</EmptyState>;
    }

    const data = dataWithoutWrappingArray(baseItem.queriedData.map(({ value }) => value as any));
    const hideWrappingArray =
      baseItem.queriedData.length === 1 && typeof baseItem.queriedData[0].value === "object";
    const shouldDisplaySingleVal =
      (data !== undefined && typeof data !== "object") ||
      (isSingleElemArray(data) &&
        getIndex(data, 0) != null &&
        typeof getIndex(data, 0) !== "object");
    const singleVal = isSingleElemArray(data) ? getIndex(data, 0) : data;

    const diffData =
      diffItem && dataWithoutWrappingArray(diffItem.queriedData.map(({ value }) => value as any));
    const diff =
      diffEnabled &&
      getDiff(maybeDeepParse(data), maybeDeepParse(diffData), null, showFullMessageForDiff);
    const diffLabelTexts = objectValues(diffLabels).map(({ labelText }) => labelText);

    const CheckboxComponent = showFullMessageForDiff
      ? CheckboxMarkedIcon
      : CheckboxBlankOutlineIcon;
    return (
      <Flex col clip scroll className={styles.container}>
        <Metadata
          data={data}
          diffData={diffData}
          diff={diff}
          datatype={topic?.datatype}
          message={baseItem.message}
          diffMessage={diffItem?.message}
        />
        {shouldDisplaySingleVal ? (
          <div className={styles.singleVal}>
            <MaybeCollapsedValue itemLabel={String(singleVal)} />
          </div>
        ) : diffEnabled && isEqual({}, diff) ? (
          <EmptyState>No difference found</EmptyState>
        ) : (
          <>
            {diffEnabled && (
              <div
                style={{ cursor: "pointer", fontSize: "11px" }}
                onClick={() => saveConfig({ showFullMessageForDiff: !showFullMessageForDiff })}
              >
                <Icon style={{ verticalAlign: "middle" }}>
                  <CheckboxComponent />
                </Icon>{" "}
                Show full msg
              </div>
            )}
            <Tree
              labelRenderer={(raw) => (
                <SDiffSpan onClick={() => onLabelClick(raw as any)}>{first(raw)}</SDiffSpan>
              )}
              shouldExpandNode={shouldExpandNode}
              hideRoot
              invertTheme={false}
              getItemString={diffEnabled ? (getItemStringForDiff as any) : (getItemString as any)}
              valueRenderer={(...args) => {
                if (diffEnabled) {
                  return valueRenderer(null, diff, diff, ...args);
                }
                if (hideWrappingArray) {
                  // When the wrapping array is hidden, put it back here.
                  return valueRenderer(rootStructureItem, [data], baseItem.queriedData, ...args, 0);
                }
                return valueRenderer(rootStructureItem, data, baseItem.queriedData, ...args);
              }}
              postprocessValue={(rawVal: unknown) => {
                const val = maybeShallowParse(rawVal);
                if (
                  val != null &&
                  typeof val === "object" &&
                  Object.keys(val as any).length === 1 &&
                  diffLabelTexts.includes(Object.keys(val as any)[0])
                ) {
                  if (Object.keys(val as any)[0] !== diffLabels.ID.labelText) {
                    return objectValues(val as any)[0];
                  }
                }
                return val;
              }}
              theme={{
                ...jsonTreeTheme,
                tree: { margin: 0 },
                nestedNode: ({ style }, keyPath) => {
                  const baseStyle = {
                    ...style,
                    padding: "2px 0 2px 5px",
                    marginTop: 2,
                    textDecoration: "inherit",
                  };
                  if (!diffEnabled) {
                    return { style: baseStyle };
                  }
                  let backgroundColor;
                  let textDecoration;
                  if (diffLabelsByLabelText[keyPath[0]]) {
                    // @ts-expect-error backgroundColor is not a property?
                    backgroundColor = diffLabelsByLabelText[keyPath[0]].backgroundColor;
                    textDecoration =
                      keyPath[0] === diffLabels.DELETED.labelText ? "line-through" : "none";
                  }
                  const nestedObj = get(diff, keyPath.slice().reverse(), {});
                  const nestedObjKey = Object.keys(nestedObj)[0];
                  if (diffLabelsByLabelText[nestedObjKey]) {
                    // @ts-expect-error backgroundColor is not a property?
                    backgroundColor = diffLabelsByLabelText[nestedObjKey].backgroundColor;
                    textDecoration =
                      nestedObjKey === diffLabels.DELETED.labelText ? "line-through" : "none";
                  }
                  return {
                    style: {
                      ...baseStyle,
                      backgroundColor,
                      textDecoration: textDecoration || "inherit",
                    },
                  };
                },
                nestedNodeLabel: ({ style }) => ({
                  style: { ...style, textDecoration: "inherit" },
                }),
                nestedNodeChildren: ({ style }) => ({
                  style: { ...style, textDecoration: "inherit" },
                }),
                value: ({ style }, nodeType, keyPath) => {
                  const baseStyle = { ...style, textDecoration: "inherit" };
                  if (!diffEnabled) {
                    return { style: baseStyle };
                  }
                  let backgroundColor;
                  let textDecoration;
                  const nestedObj = get(diff, keyPath.slice().reverse(), {});
                  const nestedObjKey = Object.keys(nestedObj)[0];
                  if (diffLabelsByLabelText[nestedObjKey]) {
                    // @ts-expect-error backgroundColor is not a property?
                    backgroundColor = diffLabelsByLabelText[nestedObjKey].backgroundColor;
                    textDecoration =
                      nestedObjKey === diffLabels.DELETED.labelText ? "line-through" : "none";
                  }
                  return {
                    style: {
                      ...baseStyle,
                      backgroundColor,
                      textDecoration: textDecoration || "inherit",
                    },
                  };
                },
                label: { textDecoration: "inherit" },
              }}
              data={diffEnabled ? diff : data}
            />
          </>
        )}
      </Flex>
    );
  }, [
    baseItem,
    diffEnabled,
    diffItem,
    diffMethod,
    diffTopicPath,
    expandAll,
    expandedFields,
    onLabelClick,
    otherSourceTopic,
    rootStructureItem,
    saveConfig,
    showFullMessageForDiff,
    topic,
    topicPath,
    valueRenderer,
  ]);

  return (
    <Flex col clip style={{ position: "relative" }}>
      <PanelToolbar helpContent={helpContent}>
        <Icon tooltip="Toggle diff" medium fade onClick={onToggleDiff} active={diffEnabled}>
          <PlusMinusIcon />
        </Icon>
        <Icon
          tooltip={expandAll ? "Collapse all" : "Expand all"}
          medium
          fade
          onClick={onToggleExpandAll}
          style={{ position: "relative", top: 1 }}
        >
          {expandAll ? <LessIcon /> : <MoreIcon />}
        </Icon>
        <div className={styles.topicInputs}>
          <MessagePathInput
            index={0}
            path={topicPath}
            onChange={onTopicPathChange}
            inputStyle={{ height: "100%" }}
          />
          {diffEnabled && (
            <Flex>
              <Tooltip contents="Diff method" placement="top">
                <>
                  <Dropdown
                    value={diffMethod}
                    onChange={(newDiffMethod) => saveConfig({ diffMethod: newDiffMethod })}
                    noPortal
                  >
                    <DropdownItem value={PREV_MSG_METHOD}>
                      <span>{PREV_MSG_METHOD}</span>
                    </DropdownItem>
                    <DropdownItem value={OTHER_SOURCE_METHOD}>
                      <span>{OTHER_SOURCE_METHOD}</span>
                    </DropdownItem>
                    <DropdownItem value={CUSTOM_METHOD}>
                      <span>custom</span>
                    </DropdownItem>
                  </Dropdown>
                </>
              </Tooltip>
              {diffMethod === CUSTOM_METHOD ? (
                <MessagePathInput
                  index={1}
                  path={diffTopicPath}
                  onChange={onDiffTopicPathChange}
                  inputStyle={{ height: "100%" }}
                  {...{ prioritizedDatatype: topic?.datatype }}
                />
              ) : null}
            </Flex>
          )}
        </div>
      </PanelToolbar>
      {renderSingleTopicOrDiffOutput()}
    </Flex>
  );
}

RawMessages.defaultConfig = {
  topicPath: "",
  diffTopicPath: "",
  diffMethod: CUSTOM_METHOD,
  diffEnabled: false,
  showFullMessageForDiff: false,
};
RawMessages.panelType = "RawMessages";

export default Panel<RawMessagesConfig>(RawMessages as any);
