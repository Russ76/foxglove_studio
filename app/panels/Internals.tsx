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

import { groupBy, sortBy } from "lodash";
import { Fragment } from "react";
import styled from "styled-components";

import * as PanelAPI from "@foxglove-studio/app/PanelAPI";
import Button from "@foxglove-studio/app/components/Button";
import Dropdown from "@foxglove-studio/app/components/Dropdown";
import Flex from "@foxglove-studio/app/components/Flex";
import { Item } from "@foxglove-studio/app/components/Menu";
import { useMessagePipeline } from "@foxglove-studio/app/components/MessagePipeline";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import TextContent from "@foxglove-studio/app/components/TextContent";
import {
  Topic,
  Message,
  SubscribePayload,
  AdvertisePayload,
} from "@foxglove-studio/app/players/types";
import { downloadTextFile } from "@foxglove-studio/app/util";
import filterMap from "@foxglove-studio/app/util/filterMap";
import { getTopicsByTopicName } from "@foxglove-studio/app/util/selectors";

const { useCallback } = React;

const RECORD_ALL = "RECORD_ALL";

const Container = styled.div`
  padding: 16px;
  overflow-y: auto;
  ul {
    font-size: 10px;
    margin-left: 8px;
  }
  li {
    margin: 4px 0;
  }
  h1 {
    font-size: 1.5em;
    margin-bottom: 0.5em;
  }
  section {
    flex: 1 1 50%;
    overflow: hidden;
  }
`;

function getSubscriptionGroup({ requester }: SubscribePayload): string {
  if (!requester) {
    return "<unknown>";
  }
  switch (requester.type) {
    case "panel":
      return `Panel “${requester.name}”`;
    case "node":
      return `Node “${requester.name}”`;
    case "other":
      return requester.name;
  }
}

function getPublisherGroup({ advertiser }: AdvertisePayload): string {
  if (!advertiser) {
    return "<unknown>";
  }
  switch (advertiser.type) {
    case "panel":
      return `Panel “${advertiser.name}”`;
  }
}

type RecordedData = {
  readonly topics: Topic[];
  readonly frame: {
    [key: string]: readonly Message[];
  };
};

const HistoryRecorder = React.memo(function HistoryRecorder({
  topicsByName,
  recordingTopics,
  recordedData,
}: {
  topicsByName: { [topic: string]: Topic };
  recordingTopics: string[];
  recordedData: React.MutableRefObject<RecordedData | undefined>;
}) {
  const frame = PanelAPI.useMessagesByTopic({ topics: recordingTopics, historySize: 1 });
  recordedData.current = {
    topics: filterMap(recordingTopics, (name) => topicsByName[name]),
    frame,
  };
  return ReactNull;
});

// Display internal state for debugging and viewing topic dependencies.
function Internals(): React.ReactNode {
  const { topics } = PanelAPI.useDataSourceInfo();
  const topicsByName = React.useMemo(() => getTopicsByTopicName(topics), [topics]);
  const subscriptions = useMessagePipeline(
    useCallback(({ subscriptions: pipelineSubscriptions }) => pipelineSubscriptions, []),
  );
  const publishers = useMessagePipeline(
    useCallback(({ publishers: pipelinePublishers }) => pipelinePublishers, []),
  );

  const [groupedSubscriptions, subscriptionGroups] = React.useMemo(() => {
    const grouped = groupBy(subscriptions, getSubscriptionGroup);
    return [grouped, Object.keys(grouped)];
  }, [subscriptions]);

  const renderedSubscriptions = React.useMemo(() => {
    if (subscriptions.length === 0) {
      return "(none)";
    }
    return Object.keys(groupedSubscriptions)
      .sort()
      .map((key) => {
        return (
          <Fragment key={key}>
            <div style={{ marginTop: 16 }}>{key}:</div>
            <ul>
              {sortBy(groupedSubscriptions[key], (sub) => sub.topic).map((sub, i) => (
                <li key={i}>
                  <code>
                    {sub.topic}
                    {topicsByName[sub.topic] &&
                      topicsByName[sub.topic].originalTopic &&
                      ` (original topic: ${topicsByName[sub.topic].originalTopic})`}
                  </code>
                </li>
              ))}
            </ul>
          </Fragment>
        );
      });
  }, [groupedSubscriptions, subscriptions.length, topicsByName]);

  const renderedPublishers = React.useMemo(() => {
    if (publishers.length === 0) {
      return "(none)";
    }
    const groupedPublishers = groupBy(publishers, getPublisherGroup);
    return Object.keys(groupedPublishers)
      .sort()
      .map((key) => {
        return (
          <Fragment key={key}>
            <div style={{ marginTop: 16 }}>{key}:</div>
            <ul>
              {sortBy(groupedPublishers[key], (sub) => sub.topic).map((sub, i) => (
                <li key={i}>
                  <code>{sub.topic}</code>
                </li>
              ))}
            </ul>
          </Fragment>
        );
      });
  }, [publishers]);

  const [recordGroup, setRecordGroup] = React.useState<string>(RECORD_ALL);
  const [recordingTopics, setRecordingTopics] = React.useState<string[] | undefined>();
  const recordedData = React.useRef<RecordedData | undefined>();

  function onRecordClick() {
    if (recordingTopics) {
      recordedData.current = undefined;
      setRecordingTopics(undefined);
      return;
    }
    const recordSubs =
      recordGroup === RECORD_ALL ? subscriptions : groupedSubscriptions[recordGroup];
    setRecordingTopics(recordSubs.map((sub) => sub.topic));
  }

  function downloadJSON() {
    downloadTextFile(JSON.stringify(recordedData.current) || "{}", "fixture.json");
  }

  return (
    <Container>
      <PanelToolbar floating />
      <h1>Recording</h1>
      <TextContent>
        Press to start recording topic data for debug purposes. The latest messages on each topic
        will be kept and formatted into a fixture that can be used to create a test.
      </TextContent>
      <Flex row wrap style={{ padding: "8px 0 32px" }}>
        <Button isPrimary small onClick={onRecordClick} data-test="internals-record-button">
          {recordingTopics ? `Recording ${recordingTopics.length} topics…` : "Record raw data"}
        </Button>
        <Dropdown
          disabled={!!recordingTopics}
          text={`Record from: ${recordGroup === RECORD_ALL ? "All panels" : recordGroup}`}
          value={recordGroup}
          onChange={(value) => setRecordGroup(value)}
        >
          {/* @ts-expect-error value is required for Dropdown */}
          <Item value={RECORD_ALL}>All panels</Item>
          {subscriptionGroups.map((group) => (
            /* @ts-expect-error value is required for Dropdown */
            <Item key={group} value={group}>
              {group}
            </Item>
          ))}
        </Dropdown>
        {recordingTopics && (
          <Button small onClick={downloadJSON} data-test="internals-download-button">
            Download JSON
          </Button>
        )}
        {recordingTopics && (
          <HistoryRecorder
            topicsByName={topicsByName}
            recordingTopics={recordingTopics}
            recordedData={recordedData}
          />
        )}
      </Flex>
      <Flex row>
        <section data-test="internals-subscriptions">
          <h1>Subscriptions</h1>
          {renderedSubscriptions}
        </section>
        <section data-test="internals-publishers">
          <h1>Publishers</h1>
          {renderedPublishers}
        </section>
      </Flex>
    </Container>
  );
}
Internals.panelType = "Internals";
Internals.defaultConfig = {};

export default Panel(Internals as any);
