// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import ClipboardOutlineIcon from "@mdi/svg/svg/clipboard-outline.svg";
import { cloneDeepWith } from "lodash";
import React, { useCallback } from "react";
import styled from "styled-components";

import Icon from "@foxglove-studio/app/components/Icon";
import { Message } from "@foxglove-studio/app/players/types";
import { deepParse, isBobject } from "@foxglove-studio/app/util/binaryObjects";
import clipboard from "@foxglove-studio/app/util/clipboard";
import { formatTimeRaw } from "@foxglove-studio/app/util/time";

import { getMessageDocumentationLink } from "./utils";

const SMetadata = styled.div`
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.3;
  color: #aaa;
`;
type Props = {
  data: any;
  diffData: any;
  diff: any;
  datatype?: string;
  message: Message;
  diffMessage?: Message;
};

function CopyMessageButton({ text, onClick }: any) {
  return (
    <a onClick={onClick} href="#" style={{ textDecoration: "none" }}>
      <Icon tooltip="Copy entire message to clipboard" style={{ position: "relative", top: -1 }}>
        <ClipboardOutlineIcon style={{ verticalAlign: "middle" }} />
      </Icon>{" "}
      {text}
    </a>
  );
}

export default function Metadata({ data, diffData, diff, datatype, message, diffMessage }: Props) {
  const onClickCopy = useCallback(
    (maybeBobject) => (e: React.MouseEvent<HTMLSpanElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const dataToCopy = isBobject(maybeBobject) ? deepParse(maybeBobject) : maybeBobject;
      const dataWithoutLargeArrays = cloneDeepWith(dataToCopy, (value) => {
        if (typeof value === "object" && value.buffer) {
          return "<buffer>";
        }
        return undefined;
      });
      clipboard.copy(JSON.stringify(dataWithoutLargeArrays, undefined, 2) || "");
    },
    [],
  );
  return (
    <SMetadata>
      {!diffMessage && datatype && (
        <a
          style={{ color: "inherit" }}
          target="_blank"
          rel="noopener noreferrer"
          href={getMessageDocumentationLink(datatype) as any}
        >
          {datatype}
        </a>
      )}
      {message.receiveTime &&
        `${diffMessage ? " base" : ""} @ ${formatTimeRaw(message.receiveTime)} ROS `}
      <CopyMessageButton onClick={onClickCopy(data)} text="Copy msg" />

      {diffMessage && diffMessage.receiveTime && (
        <>
          <div>
            {`diff @ ${formatTimeRaw(diffMessage.receiveTime)} ROS `}
            <CopyMessageButton onClick={onClickCopy(diffData)} text="Copy msg" />
          </div>
          <CopyMessageButton onClick={onClickCopy(diff)} text="Copy diff of msgs" />
        </>
      )}
    </SMetadata>
  );
}
