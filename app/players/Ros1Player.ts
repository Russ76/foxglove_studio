// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEqual, sortBy, partition } from "lodash";
import { MessageReader, Time } from "rosbag";
import { v4 as uuidv4 } from "uuid";

import {
  AdvertisePayload,
  BobjectMessage,
  Message,
  Player,
  PlayerCapabilities,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
  ParsedMessageDefinitionsByTopic,
} from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
// import { objectValues } from "@foxglove-studio/app/util";
// import { bagConnectionsToDatatypes } from "@foxglove-studio/app/util/bagConnectionsHelper";
import { wrapJsObject } from "@foxglove-studio/app/util/binaryObjects";
import debouncePromise from "@foxglove-studio/app/util/debouncePromise";
// import { FREEZE_MESSAGES } from "@foxglove-studio/app/util/globalConstants";
import { getTopicsByTopicName } from "@foxglove-studio/app/util/selectors";
import sendNotification from "@foxglove-studio/app/util/sendNotification";
import { fromMillis, TimestampMethod } from "@foxglove-studio/app/util/time";
import { RosNode } from "@foxglove/ros1";
import { RosApiRenderer } from "@foxglove/ros1-electron/src/browser";

const capabilities = [PlayerCapabilities.advertise];
const NO_WARNINGS = Object.freeze({});

export default class Ros1Player implements Player {
  _url: string; // rosmaster URL
  _rosClient?: RosNode; // Our own ROS node for connecting to the network
  _id: string = uuidv4(); // Unique ID for this player
  _listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState()
  _closed: boolean = false; // Whether the player has been completely closed using close()
  _providerTopics?: Topic[]; // Topics published in the ROS graph
  _providerDatatypes?: RosDatatypes; // Datatypes for published topics
  _messageReadersByDatatype: {
    [datatype: string]: MessageReader;
  } = {};
  _start?: Time; // The time at which we started playing
  _requestedSubscriptions: SubscribePayload[] = []; // Requested subscriptions by setSubscriptions()
  _parsedMessages: Message[] = []; // Queue of messages that we'll send in next _emitState() call
  _bobjects: BobjectMessage[] = []; // Queue of bobjects that we'll send in next _emitState() call
  _messageOrder: TimestampMethod = "receiveTime";
  _requestTopicsTimeout?: ReturnType<typeof setTimeout>; // setTimeout() handle for _requestTopics()
  // _topicPublishers: { [topicName: string]: unknown } = {};
  _parsedMessageDefinitionsByTopic: ParsedMessageDefinitionsByTopic = {};
  _bobjectTopics: Set<string> = new Set();
  _parsedTopics: Set<string> = new Set();

  constructor(url: string) {
    this._url = url;
    this._start = fromMillis(Date.now());
    this._open();
  }

  _open = async (): Promise<void> => {
    if (this._closed) {
      return;
    }

    const rosApi: RosApiRenderer = Ros1Player.Api();
    const url = new URL(this._url);
    const xmlRpcClient = await rosApi.XmlRpcCreateClient({ url });
    const rosClient = new RosNode({
      name: "/foxglove",
      xmlRpcClient,
      xmlRpcCreateClient: rosApi.XmlRpcCreateClient,
      xmlRpcCreateServer: rosApi.XmlRpcCreateServer,
      tcpSocketCreate: rosApi.TcpSocketCreate,
      getPid: rosApi.GetPid,
      getHostname: rosApi.GetHostname,
    });

    await rosClient.start();

    this._rosClient = rosClient;
    this._requestTopics();

    // rosClient.on("connection", () => {
    //   if (this._closed) {
    //     return;
    //   }
    //   this._rosClient = rosClient;
    //   this._requestTopics();
    // });

    // rosClient.on("error", (error) => {
    //   // TODO(JP): Figure out which kinds of errors we can get here, and which ones we should
    //   // actually show to the user.
    //   console.warn("WebSocket error", error);
    // });

    // rosClient.on("close", () => {
    //   if (this._requestTopicsTimeout) {
    //     clearTimeout(this._requestTopicsTimeout);
    //   }
    //   for (const [topicName, topic] of this._topicSubscriptions) {
    //     topic.unsubscribe();
    //     this._topicSubscriptions.delete(topicName);
    //   }
    //   delete this._rosClient;
    //   this._emitState();

    //   // Try connecting again.
    //   setTimeout(this._open, 1000);
    // });
  };

  _requestTopics = async (): Promise<void> => {
    if (this._requestTopicsTimeout) {
      clearTimeout(this._requestTopicsTimeout);
    }
    const rosClient = this._rosClient;
    if (!rosClient || this._closed) {
      return;
    }

    try {
      const topics: Topic[] = (await rosClient.getPublishedTopics()).map(([name, datatype]) => {
        return { name, datatype };
      });

      // Sort them for easy comparison. If nothing has changed here, bail out
      const sortedTopics = sortBy(topics, "name");
      if (isEqual(sortedTopics, this._providerTopics)) {
        return;
      }

      this._providerTopics = sortedTopics;
      // this._providerDatatypes = bagConnectionsToDatatypes(datatypeDescriptions);
      // this._messageReadersByDatatype = messageReaders;

      // Try subscribing again, since we might now be able to subscribe to some new topics
      this.setSubscriptions(this._requestedSubscriptions);
      this._emitState();
    } catch (error) {
      sendNotification("Error fetching ROS topics", error, "app", "error");
    } finally {
      // Regardless of what happens, request topics again in a little bit
      this._requestTopicsTimeout = setTimeout(this._requestTopics, 3000);
    }
  };

  _emitState = debouncePromise(() => {
    if (!this._listener || this._closed) {
      return Promise.resolve();
    }

    const { _providerTopics, _providerDatatypes, _start } = this;
    if (!_providerTopics || !_providerDatatypes || !_start) {
      return this._listener({
        isPresent: true,
        showSpinner: true,
        showInitializing: !!this._rosClient,
        progress: {},
        capabilities,
        playerId: this._id,
        activeData: undefined,
      });
    }

    // Time is always moving forward even if we don't get messages from the server.
    setTimeout(this._emitState, 100);

    const currentTime = fromMillis(Date.now());
    const messages = this._parsedMessages;
    this._parsedMessages = [];
    const bobjects = this._bobjects;
    this._bobjects = [];
    return this._listener({
      isPresent: true,
      showSpinner: !this._rosClient,
      showInitializing: false,
      progress: {},
      capabilities,
      playerId: this._id,

      activeData: {
        messages,
        bobjects,
        totalBytesReceived: this._rosClient?.receivedBytes() ?? 0,
        messageOrder: this._messageOrder,
        startTime: _start,
        endTime: currentTime,
        currentTime,
        isPlaying: true,
        speed: 1,
        // We don't support seeking, so we need to set this to any fixed value. Just avoid 0 so
        // that we don't accidentally hit falsy checks.
        lastSeekTime: 1,
        topics: _providerTopics,
        datatypes: _providerDatatypes,
        parsedMessageDefinitionsByTopic: this._parsedMessageDefinitionsByTopic,
        playerWarnings: NO_WARNINGS,
      },
    });
  });

  setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this._listener = listener;
    this._emitState();
  }

  close(): void {
    this._closed = true;
    this._rosClient?.shutdown();
  }

  setSubscriptions(subscriptions: SubscribePayload[]): void {
    this._requestedSubscriptions = subscriptions;

    if (!this._rosClient || this._closed) {
      return;
    }

    const [bobjectSubscriptions, parsedSubscriptions] = partition(
      subscriptions,
      ({ format }) => format === "bobjects",
    );
    this._bobjectTopics = new Set(bobjectSubscriptions.map(({ topic }) => topic));
    this._parsedTopics = new Set(parsedSubscriptions.map(({ topic }) => topic));

    // See what topics we actually can subscribe to
    const availableTopicsByTopicName = getTopicsByTopicName(this._providerTopics ?? []);
    const topicNames = subscriptions
      .map(({ topic }) => topic)
      .filter((topicName) => availableTopicsByTopicName[topicName]);

    // Subscribe to all topics that we aren't subscribed to yet.
    for (const topicName of topicNames) {
      if (this._rosClient.subscriptions.has(topicName)) {
        continue;
      }

      const availTopic = availableTopicsByTopicName[topicName];
      if (!availTopic) {
        continue;
      }
      const { datatype } = availTopic;

      const sub = this._rosClient.subscribe({ topic: topicName, type: datatype });

      sub.on("message", (msg) => {
        if (!this._providerTopics) {
          return;
        }

        const receiveTime = fromMillis(Date.now());
        if (this._bobjectTopics.has(topicName) && this._providerDatatypes) {
          this._bobjects.push({
            topic: topicName,
            receiveTime,
            message: wrapJsObject(this._providerDatatypes, datatype, msg),
          });
        }

        if (this._parsedTopics.has(topicName)) {
          this._parsedMessages.push({
            topic: topicName,
            receiveTime,
            message: msg as any,
          });
        }

        this._emitState();
      });
    }

    // Unsubscribe from topics that we are subscribed to but shouldn't be
    const subscribedTopics = Array.from(this._rosClient.subscriptions.keys());
    for (const topicName of subscribedTopics) {
      if (!topicNames.includes(topicName)) {
        this._rosClient.unsubscribe(topicName);
      }
    }
  }

  setPublishers(_publishers: AdvertisePayload[]): void {
    // Implement this when publishing is supported
  }

  publish({ topic }: PublishPayload): void {
    sendNotification(
      "Invalid publish call",
      `Publishing to ROS is not implemented yet. Topic: ${topic}`,
      "app",
      "error",
    );
  }

  // Bunch of unsupported stuff. Just don't do anything for these
  startPlayback(): void {
    // no-op
  }
  pausePlayback(): void {
    // no-op
  }
  seekPlayback(_time: Time): void {
    // no-op
  }
  setPlaybackSpeed(_speedFraction: number): void {
    // no-op
  }
  requestBackfill(): void {
    // no-op
  }
  setGlobalVariables(): void {
    // no-op
  }
}
