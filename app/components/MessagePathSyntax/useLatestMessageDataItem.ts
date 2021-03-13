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

import { useCallback, useMemo } from "react";

import parseRosPath from "./parseRosPath";
import {
  useCachedGetMessagePathDataItems,
  MessageAndData,
} from "./useCachedGetMessagePathDataItems";
import * as PanelAPI from "@foxglove-studio/app/PanelAPI";
import { useMessagePipeline } from "@foxglove-studio/app/components/MessagePipeline";
import { Message, MessageFormat } from "@foxglove-studio/app/players/types";
import { useChangeDetector } from "@foxglove-studio/app/util/hooks";

// Get the last message for a path, but *after* applying filters. In other words, we'll keep the
// last message that matched.
export function useLatestMessageDataItem(
  path: string,
  format: MessageFormat,
): MessageAndData | undefined {
  const rosPath = useMemo(() => parseRosPath(path), [path]);
  const topics = useMemo(() => (rosPath ? [rosPath.topicName] : []), [rosPath]);
  const cachedGetMessagePathDataItems = useCachedGetMessagePathDataItems([path]);

  const addMessages = useCallback(
    (prevMessageAndData: MessageAndData | undefined, messages: readonly Message[]) => {
      // Iterate in reverse so we can early-return and not process all messages.
      for (let i = messages.length - 1; i >= 0; --i) {
        const message = messages[i];
        const queriedData = cachedGetMessagePathDataItems(path, message);
        if (queriedData == null) {
          // Invalid path.
          return;
        }
        if (queriedData.length > 0) {
          return { message, queriedData };
        }
      }
      return prevMessageAndData;
    },
    [cachedGetMessagePathDataItems, path],
  );

  const restore = useCallback(
    (prevMessageAndData?: MessageAndData): MessageAndData | undefined => {
      if (prevMessageAndData) {
        const queriedData = cachedGetMessagePathDataItems(path, prevMessageAndData.message);
        if (queriedData && queriedData.length > 0) {
          return { message: prevMessageAndData.message, queriedData };
        }
      }
    },
    [cachedGetMessagePathDataItems, path],
  );

  // A backfill is not automatically requested when the above callbacks' identities change, so we
  // need to do that manually.
  const requestBackfill = useMessagePipeline(
    useCallback(({ requestBackfill: pipelineRequestBackfill }) => pipelineRequestBackfill, []),
  );
  if (useChangeDetector([cachedGetMessagePathDataItems, path], false)) {
    requestBackfill();
  }

  const addMessageCallbackName = format === "parsedMessages" ? "addMessages" : "addBobjects";
  const messageAndData = PanelAPI.useMessageReducer<MessageAndData | undefined>({
    topics,
    [addMessageCallbackName]: addMessages,
    restore,
  });
  return rosPath ? messageAndData : undefined;
}
