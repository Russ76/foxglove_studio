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

import RawMessages, {
  PREV_MSG_METHOD,
  OTHER_SOURCE_METHOD,
} from "@foxglove-studio/app/panels/RawMessages";
import PanelSetup from "@foxglove-studio/app/stories/PanelSetup";
import { SECOND_SOURCE_PREFIX } from "@foxglove-studio/app/util/globalConstants";

import {
  fixture,
  enumFixture,
  enumAdvancedFixture,
  withMissingData,
  topicsToDiffFixture,
  topicsWithIdsToDiffFixture,
  multipleNumberMessagesFixture,
} from "./fixture";

const noDiffConfig = {
  diffMethod: "custom",
  diffTopicPath: "",
  diffEnabled: false,
  showFullMessageForDiff: false,
};
const diffConfig = {
  topicPath: "/baz/enum_advanced",
  diffMethod: "custom",
  diffTopicPath: "/another/baz/enum_advanced",
  diffEnabled: true,
};
const expandAll = () => {
  const allLabels = document.querySelectorAll("label");
  for (const label of allLabels) {
    label.click();
  }
};
const scrollToBottom = () => {
  const scrollContainer = document.querySelectorAll(".Flex-module__scroll___3l7to")[0];
  scrollContainer.scrollTop = scrollContainer.scrollHeight;
};

storiesOf("<RawMessages>", module)
  .add("folded", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 350 }}>
        <RawMessages config={{ topicPath: "/msgs/big_topic", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("with receiveTime", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 350 }}>
        <RawMessages config={{ topicPath: "/foo", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display big value – num", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 350 }}>
        <RawMessages config={{ topicPath: "/baz/num.value", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display big value – text", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 350 }}>
        <RawMessages config={{ topicPath: "/baz/text.value", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display big value – text truncated", () => {
    return (
      <PanelSetup
        fixture={fixture}
        style={{ width: 350 }}
        onMount={() => setImmediate(scrollToBottom)}
      >
        <RawMessages config={{ topicPath: "/baz/text.value_long", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display big value – text with newlines", () => {
    return (
      <PanelSetup
        fixture={fixture}
        style={{ width: 350 }}
        onMount={() => setImmediate(scrollToBottom)}
      >
        <RawMessages
          config={{ topicPath: "/baz/text.value_with_newlines", ...noDiffConfig } as any}
        />
      </PanelSetup>
    );
  })
  .add("display big value – single element array", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 350 }}>
        <RawMessages config={{ topicPath: "/baz/array.value", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display single object array", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 350 }}>
        <RawMessages config={{ topicPath: "/baz/array/obj.value", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display basic enum", () => {
    return (
      <PanelSetup fixture={enumFixture} style={{ width: 350 }}>
        <RawMessages config={{ topicPath: "/baz/enum", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display advanced enum usage", () => {
    return (
      <PanelSetup fixture={enumAdvancedFixture} style={{ width: 350 }}>
        <RawMessages config={{ topicPath: "/baz/enum_advanced", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("with missing data", () => {
    return (
      <PanelSetup fixture={withMissingData} style={{ width: 350 }}>
        <RawMessages config={{ topicPath: "/baz/missing_data", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("with a truncated long string", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 350 }}>
        <RawMessages config={{ topicPath: "/baz/text", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display geometry types - length", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 350 }}>
        <RawMessages config={{ topicPath: "/geometry/types", ...noDiffConfig } as any} />
      </PanelSetup>
    );
  })
  .add("display diff", () => {
    return (
      <PanelSetup fixture={topicsToDiffFixture} style={{ width: 500 }} onMount={expandAll}>
        <RawMessages config={{ ...diffConfig, showFullMessageForDiff: false } as any} />
      </PanelSetup>
    );
  })
  .add("display full diff", () => {
    return (
      <PanelSetup fixture={topicsToDiffFixture} style={{ width: 500 }} onMount={expandAll}>
        <RawMessages config={{ ...diffConfig, showFullMessageForDiff: true } as any} />
      </PanelSetup>
    );
  })
  .add("display diff with ID fields", () => {
    const config = {
      ...diffConfig,
      topicPath: "/baz/enum_advanced_array.value",
      diffTopicPath: "/another/baz/enum_advanced_array.value",
      showFullMessageForDiff: false,
    };
    return (
      <PanelSetup fixture={topicsWithIdsToDiffFixture} style={{ width: 350 }} onMount={expandAll}>
        <RawMessages config={config as any} />
      </PanelSetup>
    );
  })
  .add("empty diff message", () => {
    return (
      <PanelSetup fixture={{ topics: [], frame: {} }} style={{ width: 350 }}>
        <RawMessages config={{ ...diffConfig, showFullMessageForDiff: false } as any} />
      </PanelSetup>
    );
  })
  .add("diff same messages", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 350 }}>
        <RawMessages
          config={{
            topicPath: "/foo",
            diffMethod: "custom",
            diffTopicPath: "/foo",
            diffEnabled: true,
            showFullMessageForDiff: false,
          }}
        />
      </PanelSetup>
    );
  })
  .add("diff consecutive messages", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 350 }} onMount={expandAll}>
        <RawMessages
          config={{
            topicPath: "/foo",
            diffMethod: PREV_MSG_METHOD,
            diffTopicPath: "",
            diffEnabled: true,
            showFullMessageForDiff: true,
          }}
        />
      </PanelSetup>
    );
  })
  .add("display correct message when diff is disabled, even with diff method & topic set", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 350 }} onMount={expandAll}>
        <RawMessages
          config={{
            topicPath: "/foo",
            diffMethod: PREV_MSG_METHOD,
            diffTopicPath: "/another/baz/enum_advanced",
            diffEnabled: false,
            showFullMessageForDiff: true,
          }}
        />
      </PanelSetup>
    );
  })
  .add("diff messages from different sources", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 350 }} onMount={expandAll}>
        <RawMessages
          config={{
            topicPath: "/foo",
            diffMethod: OTHER_SOURCE_METHOD,
            diffTopicPath: "",
            diffEnabled: true,
            showFullMessageForDiff: true,
          }}
        />
      </PanelSetup>
    );
  })
  .add("diff messages from different sources when base topic is from second source", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 350 }} onMount={expandAll}>
        <RawMessages
          config={{
            topicPath: `${SECOND_SOURCE_PREFIX}/foo`,
            diffMethod: OTHER_SOURCE_METHOD,
            diffTopicPath: "",
            diffEnabled: true,
            showFullMessageForDiff: true,
          }}
        />
      </PanelSetup>
    );
  })
  .add("display empty state if second source is not available", () => {
    return (
      <PanelSetup fixture={fixture} style={{ width: 350 }} onMount={expandAll}>
        <RawMessages
          config={{
            topicPath: "/baz/text",
            diffMethod: OTHER_SOURCE_METHOD,
            diffTopicPath: "/foo",
            diffEnabled: true,
            showFullMessageForDiff: true,
          }}
        />
      </PanelSetup>
    );
  })
  .add("multiple messages with top-level filter", () => {
    return (
      <PanelSetup fixture={multipleNumberMessagesFixture} style={{ width: 350 }}>
        <RawMessages
          config={
            {
              topicPath: "/multiple_number_messages{value==2}",
              ...noDiffConfig,
            } as any
          }
        />
      </PanelSetup>
    );
  });
