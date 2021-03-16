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

import LinkPlusIcon from "@mdi/svg/svg/link-plus.svg";
import classNames from "classnames";
import React, { FormEvent } from "react";

import Button from "@foxglove-studio/app/components/Button";
import ChildToggle from "@foxglove-studio/app/components/ChildToggle";
import Icon from "@foxglove-studio/app/components/Icon";
import useGlobalVariables from "@foxglove-studio/app/hooks/useGlobalVariables";
import GlobalVariableName from "@foxglove-studio/app/panels/ThreeDimensionalViz/Interactions/GlobalVariableName";
import colors from "@foxglove-studio/app/styles/colors.module.scss";

import useLinkedGlobalVariables from "../useLinkedGlobalVariables";
import SGlobalVariableForm from "./SGlobalVariableForm";
import UnlinkGlobalVariables from "./UnlinkGlobalVariables";

type AddToLinkedGlobalVariable = {
  topic: string;
  markerKeyPath: string[];
  variableValue: any;
};

type Props = {
  highlight?: boolean;
  addToLinkedGlobalVariable: AddToLinkedGlobalVariable;
  style?: any;
  tooltip?: React.ReactNode;
};

function getInitialName(markerKeyPath: string[]) {
  return markerKeyPath.slice(0, 2).reverse().join("_");
}

export default function LinkToGlobalVariable({
  style = {},
  addToLinkedGlobalVariable: { topic, variableValue, markerKeyPath },
  tooltip,
  highlight,
}: Props) {
  const [isOpen, _setIsOpen] = React.useState<boolean>(false);
  const [name, setName] = React.useState(() => getInitialName(markerKeyPath));

  const setIsOpen = React.useCallback(
    (newValue: boolean) => {
      _setIsOpen(newValue);
      if (newValue) {
        setName(getInitialName(markerKeyPath));
      }
    },
    [markerKeyPath],
  );

  const { setGlobalVariables } = useGlobalVariables();
  const { linkedGlobalVariables, setLinkedGlobalVariables } = useLinkedGlobalVariables();

  const addLink = (ev: FormEvent) => {
    ev.preventDefault();
    setGlobalVariables({ [name]: variableValue });
    const newLinkedGlobalVariables = [...linkedGlobalVariables, { topic, markerKeyPath, name }];
    setLinkedGlobalVariables(newLinkedGlobalVariables);
    setIsOpen(false);
  };

  const highlightIconStyle = highlight ? { color: colors.highlight } : {};

  return (
    <ChildToggle
      dataTest={`link-${name}`}
      position="above"
      onToggle={setIsOpen}
      isOpen={isOpen}
      style={style}
    >
      <Icon
        className={classNames("link-icon", { highlight })}
        style={highlightIconStyle}
        fade={!highlight}
        tooltip={tooltip || "Link this field to a global variable"}
        tooltipProps={{ placement: "top" }}
      >
        <LinkPlusIcon />
      </Icon>
      <SGlobalVariableForm onSubmit={addLink} data-test="link-form">
        <p style={{ marginTop: 0, lineHeight: "1.4" }}>
          When linked, clicking a new object from {topic} will update the global variable&nbsp;
          <GlobalVariableName name={name} />.
        </p>
        <UnlinkGlobalVariables name={name} showList />
        <input
          autoFocus
          type="text"
          value={`$${name}`}
          onChange={(e) => setName(e.target.value.replace(/^\$/, ""))}
        />
        <p data-test="action-buttons">
          <Button primary={!!name} disabled={!name} onClick={addLink}>
            Add Link
          </Button>
          <Button onClick={() => setIsOpen(false)}>Cancel</Button>
        </p>
      </SGlobalVariableForm>
    </ChildToggle>
  );
}
