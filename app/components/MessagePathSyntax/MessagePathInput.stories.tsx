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

import { storiesOf } from "@storybook/react";

import Flex from "@foxglove-studio/app/components/Flex";
import MockPanelContextProvider from "@foxglove-studio/app/components/MockPanelContextProvider";
import PanelSetup from "@foxglove-studio/app/stories/PanelSetup";

import MessagePathInput from "./MessagePathInput";

const fixture = {
  datatypes: {
    "msgs/PoseDebug": {
      fields: [
        { name: "header", type: "std_msgs/Header", isArray: false },
        { name: "pose", type: "msgs/Pose", isArray: false },
      ],
    },
    "msgs/Pose": {
      fields: [
        { name: "header", type: "std_msgs/Header", isArray: false },
        { name: "x", type: "float64", isArray: false },
        { name: "y", type: "float64", isArray: false },
        { name: "travel", type: "float64", isArray: false },
        { name: "velocity", type: "float64", isArray: false },
        { name: "acceleration", type: "float64", isArray: false },
        { name: "heading", type: "float64", isArray: false },
      ],
    },
    "msgs/State": {
      fields: [
        { name: "header", type: "std_msgs/Header", isArray: false },
        { name: "items", type: "msgs/OtherState", isArray: true },
        { name: "foo_id", type: "uint32", isArray: false },
      ],
    },
    "msgs/OtherState": {
      fields: [
        { name: "id", type: "int32", isArray: false },
        { name: "speed", type: "float32", isArray: false },
        { name: "name", type: "string", isArray: false },
        { name: "valid", type: "bool", isArray: false },
      ],
    },
    "msgs/Log": {
      fields: [
        { name: "id", type: "int32", isArray: false },
        { name: "myJson", type: "json", isArray: false },
        { name: "severity", type: "float32", isArray: false },
      ],
    },
    "std_msgs/Header": {
      fields: [
        { name: "seq", type: "uint32", isArray: false },
        {
          name: "stamp",
          type: "time",
          isArray: false,
        },
        { name: "frame_id", type: "string", isArray: false },
      ],
    },
  },
  topics: [
    { name: "/some_topic/location", datatype: "msgs/PoseDebug" },
    { name: "/some_topic/state", datatype: "msgs/State" },
    {
      name:
        "/very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_long_topic_name/state",
      datatype: "msgs/State",
    },
    { name: "/some_logs_topic", datatype: "msgs/Log" },
  ],
  frame: {},
  globalVariables: { global_var_1: 42, global_var_2: 10 },
};

const clickInput = (el: any) => {
  const firstInput = el.querySelector("input");
  if (firstInput) {
    firstInput.focus();
  }
};

function MessagePathInputStory(props: { path: string; prioritizedDatatype?: string }) {
  const [path, setPath] = React.useState(props.path);

  return (
    <MockPanelContextProvider>
      <PanelSetup fixture={fixture} onMount={clickInput}>
        <Flex style={{ margin: "10px" }}>
          <MessagePathInput
            autoSize
            path={path}
            prioritizedDatatype={props.prioritizedDatatype}
            onChange={(newPath) => setPath(newPath)}
            timestampMethod="receiveTime"
          />
        </Flex>
      </PanelSetup>
    </MockPanelContextProvider>
  );
}

storiesOf("<MessagePathInput>", module)
  .add("autocomplete topics", () => {
    return <MessagePathInputStory path="/" />;
  })
  .add("autocomplete messagePath", () => {
    return <MessagePathInputStory path="/some_topic/location.po" />;
  })
  .add("autocomplete filter", () => {
    return <MessagePathInputStory path="/some_topic/state.items[:]{}" />;
  })
  .add("autocomplete top level filter", () => {
    return <MessagePathInputStory path="/some_topic/state{}" />;
  })
  .add("autocomplete for globalVariables variables", () => {
    return <MessagePathInputStory path="/some_topic/state{foo_id==0}.items[:]{id==$}" />;
  })
  .add("path with valid globalVariables variable", () => {
    return <MessagePathInputStory path="/some_topic/state.items[:]{id==$global_var_2}" />;
  })
  .add("path with invalid globalVariables variable", () => {
    return <MessagePathInputStory path="/some_topic/state.items[:]{id==$global_var_3}" />;
  })
  .add("path with incorrectly prefixed globalVariables variable", () => {
    return <MessagePathInputStory path="/some_topic/state.items[:]{id==global_var_2}" />;
  })
  .add("autocomplete for path with globalVariables variable in slice (single idx)", () => {
    return <MessagePathInputStory path="/some_topic/state.items[$]" />;
  })
  .add("autocomplete for path with globalVariables variable in slice (start idx)", () => {
    return <MessagePathInputStory path="/some_topic/state.items[$:]" />;
  })
  .add("autocomplete for path with globalVariables variable in slice (end idx)", () => {
    return <MessagePathInputStory path="/some_topic/state.items[:$]" />;
  })
  .add("autocomplete for path with globalVariables variables in slice (start and end idx)", () => {
    return <MessagePathInputStory path="/some_topic/state.items[$global_var_2:$]" />;
  })
  .add("autocomplete when prioritized datatype is available", () => {
    return <MessagePathInputStory path="/" prioritizedDatatype="msgs/State" />;
  })
  .add("autocomplete for message with json field", () => {
    return <MessagePathInputStory path="/some_logs_topic." />;
  })
  .add("autocomplete for path with existing filter", () => {
    return <MessagePathInputStory path="/some_topic/state.items[:]{id==1}." />;
  })
  .add("autocomplete for path with existing filter using a global variable", () => {
    return <MessagePathInputStory path="/some_topic/state.items[:]{id==$global_var_2}." />;
  })
  .add("path for field inside json object", () => {
    return <MessagePathInputStory path="/some_logs_topic.myJson" />;
  })
  .add("path for multiple levels of nested fields inside json object", () => {
    return <MessagePathInputStory path="/some_logs_topic.myJson.a.b.c" />;
  });
