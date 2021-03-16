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

import { Message, PlayerState } from "@foxglove-studio/app/players/types";
import sendNotification from "@foxglove-studio/app/util/sendNotification";

import warnOnOutOfSyncMessages from "./warnOnOutOfSyncMessages";

let lastSeekTimeCounter = 1;
const lastSeekTime = () => {
  lastSeekTimeCounter += 1;
  return lastSeekTimeCounter;
};

const playerStateWithMessages = (messages: any, messageOrder: any): PlayerState => ({
  isPresent: true,
  showSpinner: false,
  showInitializing: false,
  progress: {},
  capabilities: [],
  playerId: "test",
  activeData: {
    topics: [
      { name: "/foo", datatype: "visualization_msgs/Marker" },
      { name: "/bar", datatype: "visualization_msgs/Marker" },
    ],
    datatypes: {},
    parsedMessageDefinitionsByTopic: {},
    currentTime: {
      sec: 1,
      nsec: 11,
    },
    speed: 0.2,
    lastSeekTime: lastSeekTime(),
    startTime: { sec: 0, nsec: 0 },
    endTime: { sec: 2, nsec: 0 },
    isPlaying: false,
    messages,
    bobjects: [],
    messageOrder,
    playerWarnings: {},
    totalBytesReceived: 1234,
  },
});

const message = (
  headerStampSeconds: number | undefined,
  receiveTimeSeconds: number | undefined,
): Message => ({
  topic: "/foo",
  receiveTime:
    receiveTimeSeconds == undefined ? undefined : ({ sec: receiveTimeSeconds, nsec: 1 } as any),
  message: {
    header:
      headerStampSeconds == undefined ? undefined : { stamp: { sec: headerStampSeconds, nsec: 1 } },
  },
});

describe("MessagePipeline/warnOnOutOfSyncMessages", () => {
  describe("when expecting messages ordered by receive time", () => {
    it("calls report error when messages are out of order", () => {
      warnOnOutOfSyncMessages(
        playerStateWithMessages([message(7, 10), message(8, 9)], "receiveTime"),
      );
      sendNotification.expectCalledDuringTest();
    });

    it("does not report an error when messages are in order", () => {
      warnOnOutOfSyncMessages(
        playerStateWithMessages([message(8, 9), message(7, 10)], "receiveTime"),
      );
    });

    it("reports an error when given a message with no receive time", () => {
      warnOnOutOfSyncMessages(playerStateWithMessages([message(7, undefined)], "receiveTime"));
      sendNotification.expectCalledDuringTest();
    });

    it("reports an error when given a message with no timestamps at all", () => {
      warnOnOutOfSyncMessages(
        playerStateWithMessages([message(undefined, undefined)], "receiveTime"),
      );
      sendNotification.expectCalledDuringTest();
    });
  });

  describe("when expecting messages ordered by header stamp", () => {
    it("calls report error when messages are out of order", () => {
      warnOnOutOfSyncMessages(
        playerStateWithMessages([message(8, 9), message(7, 10)], "headerStamp"),
      );
      sendNotification.expectCalledDuringTest();
    });

    it("does not report an error when messages are in order", () => {
      warnOnOutOfSyncMessages(
        playerStateWithMessages([message(7, 10), message(8, 9)], "headerStamp"),
      );
    });

    it("reports an error when given a message with no header stamp", () => {
      warnOnOutOfSyncMessages(playerStateWithMessages([message(undefined, 10)], "headerStamp"));
      sendNotification.expectCalledDuringTest();
    });

    it("reports an error when given a message with no timestamps at all", () => {
      warnOnOutOfSyncMessages(
        playerStateWithMessages([message(undefined, undefined)], "headerStamp"),
      );
      sendNotification.expectCalledDuringTest();
    });

    it("forgives a timestamp-backtracking after a missing header stamp", () => {
      warnOnOutOfSyncMessages(
        playerStateWithMessages(
          [
            message(8, 9),
            message(undefined, 10), // one error
            message(3, 4), // not an error
          ],
          "headerStamp",
        ),
      );
      expect((sendNotification as any).mock.calls.length).toBe(1);
      sendNotification.expectCalledDuringTest();
    });
  });
});
