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

import styled from "styled-components";

import { getLinkedGlobalVariable } from "../interactionUtils";
import useLinkedGlobalVariables, { LinkedGlobalVariable } from "../useLinkedGlobalVariables";
import LinkToGlobalVariable from "./LinkToGlobalVariable";
import SGlobalVariableLink from "./SGlobalVariableLink";
import UnlinkGlobalVariable from "./UnlinkGlobalVariable";
import UnlinkWrapper from "./UnlinkWrapper";

const SWrapper = styled.span`
  display: inline-flex;
  align-items: center;
`;

export const SP = styled.p`
  line-height: 1.4;
  margin-bottom: 12px;
`;

const SValue = styled.span`
  padding: 0;
`;

type Props = {
  addLinkTooltip?: React.ReactNode;
  hasNestedValue?: boolean;
  highlight?: boolean;
  label?: string;
  linkedGlobalVariable?: LinkedGlobalVariable;
  markerKeyPath?: string[];
  nestedValueStyle?: any;
  onlyRenderAddLink?: boolean;
  style?: any;
  topic?: string;
  unlinkTooltip?: React.ReactNode;
  variableValue?: any;
};

export default function GlobalVariableLink({
  addLinkTooltip,
  hasNestedValue,
  highlight,
  label,
  linkedGlobalVariable,
  markerKeyPath,
  nestedValueStyle = { marginLeft: 8 },
  onlyRenderAddLink,
  style = { marginLeft: 4 },
  topic,
  unlinkTooltip,
  variableValue,
}: Props) {
  const { linkedGlobalVariables } = useLinkedGlobalVariables();
  let linkedGlobalVariableLocal: LinkedGlobalVariable | undefined = linkedGlobalVariable;
  if (!linkedGlobalVariableLocal && topic && markerKeyPath) {
    linkedGlobalVariableLocal = getLinkedGlobalVariable({
      topic,
      markerKeyPath,
      linkedGlobalVariables,
    });
  }

  const isArrayBuffer = ArrayBuffer.isView(variableValue);
  const renderUnlink = !!linkedGlobalVariableLocal;
  const addToLinkedGlobalVariable =
    topic && markerKeyPath ? { topic, markerKeyPath, variableValue } : undefined;
  const renderAddLink = !renderUnlink && !isArrayBuffer && addToLinkedGlobalVariable;
  if (!(renderUnlink || renderAddLink)) {
    return ReactNull;
  }

  const arrayBufferStyle = isArrayBuffer ? style : { cursor: "pointer" };
  let wrapperStyle = hasNestedValue ? nestedValueStyle : style;
  wrapperStyle = { ...arrayBufferStyle, ...wrapperStyle };

  return (
    <SWrapper>
      {label && <SValue>{label}</SValue>}
      <SGlobalVariableLink style={wrapperStyle}>
        {linkedGlobalVariableLocal && !onlyRenderAddLink && (
          <UnlinkWrapper linkedGlobalVariable={linkedGlobalVariableLocal} tooltip={unlinkTooltip}>
            {({ setIsOpen, linkedGlobalVariable: linkedVar }) => (
              <UnlinkGlobalVariable linkedGlobalVariable={linkedVar} setIsOpen={setIsOpen} />
            )}
          </UnlinkWrapper>
        )}
        {renderAddLink && addToLinkedGlobalVariable && (
          <LinkToGlobalVariable
            highlight={highlight}
            tooltip={addLinkTooltip}
            addToLinkedGlobalVariable={addToLinkedGlobalVariable}
          />
        )}
      </SGlobalVariableLink>
    </SWrapper>
  );
}
