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

import { first, omit, sortBy } from "lodash";
import * as React from "react";
import Tree from "react-json-tree";
import { MouseEventObject } from "regl-worldview";
import styled from "styled-components";

import GlobalVariableLink from "./GlobalVariableLink/index";
import { InteractionData } from "./types";
import Dropdown from "@foxglove-studio/app/components/Dropdown";
import DropdownItem from "@foxglove-studio/app/components/Dropdown/DropdownItem";
import { Renderer } from "@foxglove-studio/app/panels/ThreeDimensionalViz/index";
import { getInstanceObj } from "@foxglove-studio/app/panels/ThreeDimensionalViz/threeDimensionalVizUtils";
import { deepParse, isBobject } from "@foxglove-studio/app/util/binaryObjects";
import { jsonTreeTheme } from "@foxglove-studio/app/util/globalConstants";
import logEvent, { getEventNames, getEventTags } from "@foxglove-studio/app/util/logEvent";

// Sort the keys of objects to make their presentation more predictable
const PREFERRED_OBJECT_KEY_ORDER = [
  "id",
  "ns",
  "type",
  "action",
  "header",
  "lifetime",
  "color",
  "colors",
  "pose",
  "points",
].reverse();

const SObjectDetails = styled.div`
  padding: 12px 0 16px 0;
`;

type CommonProps = { readonly interactionData: InteractionData | null | undefined };

type WrapperProps = CommonProps & { readonly selectedObject: MouseEventObject };

type Props = CommonProps & { readonly objectToDisplay: any };

// Used for switching between views of individual and combined objects.
// TODO(steel): Only show the combined object when the individual objects are semantically related.
function ObjectDetailsWrapper({
  interactionData,
  selectedObject: { object, instanceIndex },
}: WrapperProps) {
  const [showInstance, setShowInstance] = React.useState(true);
  const instanceObject = getInstanceObj(object, instanceIndex);
  const dropdownText = {
    instance: "Show instance object",
    full: "Show full object",
  };

  const updateShowInstance = (shouldShowInstance: any) => {
    setShowInstance(shouldShowInstance);
    logEvent({
      name: getEventNames()["3D_PANEL.OBJECT_DETAILS_SHOW_INSTANCE"],
      tags: { [getEventTags().PANEL_TYPE]: Renderer.panelType },
    });
  };

  const objectToDisplay = instanceObject && showInstance ? instanceObject : object;
  const parsedObject = React.useMemo(
    () => (isBobject(objectToDisplay) ? deepParse(objectToDisplay) : objectToDisplay),
    [objectToDisplay],
  );
  return (
    <div>
      {instanceObject && (
        <Dropdown
          position="below"
          value={showInstance}
          text={showInstance ? dropdownText.instance : dropdownText.full}
          onChange={updateShowInstance}
        >
          <DropdownItem value={true}>
            <span>{dropdownText.instance}</span>
          </DropdownItem>
          <DropdownItem value={false}>
            <span>{dropdownText.full}</span>
          </DropdownItem>
        </Dropdown>
      )}
      <ObjectDetails interactionData={interactionData} objectToDisplay={parsedObject} />
    </div>
  );
}

function ObjectDetails({ interactionData, objectToDisplay }: Props) {
  const topic = interactionData?.topic ?? "";
  const originalObject = omit(objectToDisplay, "interactionData");

  if (!topic) {
    // show the original object directly if there is no interaction data. e.g. DrawPolygons
    return (
      <SObjectDetails>
        <Tree
          data={objectToDisplay}
          shouldExpandNode={(markerKeyPath, data, level) => level < 2}
          invertTheme={false}
          theme={{ ...jsonTreeTheme, tree: { margin: 0 } }}
          hideRoot
        />
      </SObjectDetails>
    );
  }

  const sortedDataObject = Object.fromEntries(
    sortBy(
      Object.keys(originalObject),
      (key) => -PREFERRED_OBJECT_KEY_ORDER.indexOf(key),
    ).map((key) => [key, originalObject[key]]),
  );

  return (
    <SObjectDetails>
      <Tree
        data={sortedDataObject}
        shouldExpandNode={() => false}
        invertTheme={false}
        theme={{ ...jsonTreeTheme, tree: { margin: 0 } }}
        hideRoot
        getItemString={(type, data, itemType, itemString) => <span>{itemString}</span>}
        labelRenderer={(markerKeyPath, p1, p2, hasChildren) => {
          const label = first(markerKeyPath);
          if (!hasChildren) {
            return <span style={{ padding: "0 4px" }}>{label}</span>;
          }

          let objectForPath = sortedDataObject;
          for (let i = markerKeyPath.length - 1; i >= 0; i--) {
            objectForPath = objectForPath[markerKeyPath[i]];
            if (!objectForPath) {
              break;
            }
          }

          if (objectForPath) {
            return (
              <GlobalVariableLink
                hasNestedValue
                style={{ marginLeft: 4 }}
                label={label as any}
                markerKeyPath={markerKeyPath as any}
                topic={topic}
                variableValue={objectForPath}
              />
            );
          }
          return <></>;
        }}
        valueRenderer={(label: string, itemValue: any, ...markerKeyPath: (string | number)[]) => {
          return (
            <GlobalVariableLink
              style={{ marginLeft: 16 }}
              label={label}
              markerKeyPath={markerKeyPath as any}
              topic={topic}
              variableValue={itemValue}
            />
          );
        }}
      />
    </SObjectDetails>
  );
}

export default ObjectDetailsWrapper;
