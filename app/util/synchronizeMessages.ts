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

import { mapValues } from "lodash";
import { TimeUtil, Time } from "rosbag";

import { cast, Message, RosObject } from "@foxglove-studio/app/players/types";
import { StampedMessage } from "@foxglove-studio/app/types/Messages";

export const defaultGetHeaderStamp = (
  message: Readonly<RosObject> | null | undefined,
): Time | null | undefined => {
  if (message != null && message.header != null) {
    return cast<StampedMessage>(message).header.stamp;
  }
};

function allMessageStampsNewestFirst(
  messagesByTopic: Readonly<{
    [topic: string]: readonly Message[];
  }>,
  getHeaderStamp?: (itemMessage: Message) => Time | null | undefined,
) {
  const stamps = [];
  for (const topic in messagesByTopic) {
    for (const message of messagesByTopic[topic]) {
      const stamp = getHeaderStamp
        ? getHeaderStamp(message)
        : defaultGetHeaderStamp(message.message);
      if (stamp) {
        stamps.push(stamp);
      }
    }
  }
  return stamps.sort((a, b) => -TimeUtil.compare(a, b));
}

// Get a subset of items matching a particular timestamp
function messagesMatchingStamp(
  stamp: Time,
  messagesByTopic: Readonly<{
    [topic: string]: readonly Message[];
  }>,
  getHeaderStamp?: (itemMessage: Message) => Time | null | undefined,
):
  | Readonly<{
      [topic: string]: readonly Message[];
    }>
  | null
  | undefined {
  const synchronizedMessagesByTopic: Record<string, any> = {};
  for (const topic in messagesByTopic) {
    const synchronizedMessage = messagesByTopic[topic].find((message) => {
      const thisStamp = getHeaderStamp
        ? getHeaderStamp(message)
        : defaultGetHeaderStamp(message.message);
      return thisStamp && TimeUtil.areSame(stamp, thisStamp);
    });
    if (synchronizedMessage != null) {
      synchronizedMessagesByTopic[topic] = [synchronizedMessage];
    } else {
      return null;
    }
  }
  return synchronizedMessagesByTopic;
}

// Return a synchronized subset of the messages in `messagesByTopic` with exactly matching
// header.stamps.
// If multiple sets of synchronized messages are included, the one with the later header.stamp is
// returned.
export default function synchronizeMessages(
  messagesByTopic: Readonly<{
    [topic: string]: readonly Message[];
  }>,
  getHeaderStamp?: (itemMessage: Message) => Time | null | undefined,
):
  | Readonly<{
      [topic: string]: readonly Message[];
    }>
  | null
  | undefined {
  for (const stamp of allMessageStampsNewestFirst(messagesByTopic, getHeaderStamp)) {
    const synchronizedMessagesByTopic = messagesMatchingStamp(
      stamp,
      messagesByTopic,
      getHeaderStamp,
    );
    if (synchronizedMessagesByTopic != null) {
      return synchronizedMessagesByTopic;
    }
  }
  return null;
}

function getSynchronizedMessages(
  stamp: Time,
  topics: readonly string[],
  messages: {
    [topic: string]: Message[];
  },
):
  | {
      [topic: string]: Message;
    }
  | null
  | undefined {
  const synchronizedMessages: Record<string, any> = {};
  for (const topic of topics) {
    const matchingMessage = messages[topic].find(({ message }) => {
      const thisStamp = message?.header?.stamp;
      return thisStamp && TimeUtil.areSame(stamp, thisStamp);
    });
    if (!matchingMessage) {
      return null;
    }
    synchronizedMessages[topic] = matchingMessage;
  }
  return synchronizedMessages;
}

type ReducedValue = {
  messagesByTopic: {
    [topic: string]: Message[];
  };
  synchronizedMessages:
    | {
        [topic: string]: Message;
      }
    | null
    | undefined;
};

function getSynchronizedState(
  topics: readonly string[],
  { messagesByTopic, synchronizedMessages }: ReducedValue,
): ReducedValue {
  let newMessagesByTopic = messagesByTopic;
  let newSynchronizedMessages = synchronizedMessages;

  for (const stamp of allMessageStampsNewestFirst(messagesByTopic)) {
    const syncedMsgs = getSynchronizedMessages(stamp, topics, messagesByTopic);
    if (syncedMsgs) {
      // We've found a new synchronized set; remove messages older than these.
      newSynchronizedMessages = syncedMsgs;
      newMessagesByTopic = mapValues(newMessagesByTopic, (msgsByTopic) =>
        msgsByTopic.filter(({ message }) => {
          const thisStamp = message?.header?.stamp;
          return !TimeUtil.isLessThan(thisStamp, stamp);
        }),
      );
      break;
    }
  }
  return { messagesByTopic: newMessagesByTopic, synchronizedMessages: newSynchronizedMessages };
}

// Returns reducers for use with PanelAPI.useMessageReducer
export function getSynchronizingReducers(topics: readonly string[]) {
  return {
    restore(previousValue: ReducedValue | null | undefined) {
      const messagesByTopic: Record<string, any> = {};
      for (const topic of topics) {
        messagesByTopic[topic] = (previousValue && previousValue.messagesByTopic[topic]) || [];
      }
      return getSynchronizedState(topics, { messagesByTopic, synchronizedMessages: null });
    },
    addMessage({ messagesByTopic, synchronizedMessages }: ReducedValue, newMessage: Message) {
      return getSynchronizedState(topics, {
        messagesByTopic: {
          ...messagesByTopic,
          [newMessage.topic]: messagesByTopic[newMessage.topic]
            ? messagesByTopic[newMessage.topic].concat(newMessage)
            : [newMessage],
        },
        synchronizedMessages,
      });
    },
  };
}
