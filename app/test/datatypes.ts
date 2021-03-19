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

import { groupBy } from "lodash";
import { RosMsgField } from "rosbag";

import { Frame, Message, Topic, TypedMessage } from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import { wrapJsObject } from "@foxglove-studio/app/util/binaryObjects";

type InferredObject = {
  [field: string]: FieldType;
};

export type FieldType =
  | { type: "string"; isArray: boolean }
  | { type: "json"; isArray: boolean }
  | { type: "bool"; isArray: boolean }
  | { type: "float64"; isArray: boolean }
  | { type: "message"; isArray: boolean; object: InferredObject }
  | { type: "unknown"; isArray: boolean };

const maybeInferJsonFieldType = (value: any, fieldName: string): FieldType | undefined => {
  // Current heuristic: "Looks like metadata in a marker".
  // This heuristic doesn't cover every case of JSON data we might want to support, so we might want
  // to make this pluggable in the future.
  // "Markers" sometimes have some missing fields, but these ones always seem to be present:
  const hasMarkerFields = ["header", "ns", "id", "type", "action", "pose"].every(
    (field) => value[field] != undefined,
  );
  if (!hasMarkerFields) {
    return undefined;
  }
  if (fieldName === "metadata" || fieldName === "metadataByIndex") {
    return { type: "json", isArray: false };
  }
  if (fieldName.toLowerCase().includes("json")) {
    return { type: "json", isArray: false };
  }
  return undefined;
};

export const inferDatatypes = (fieldType: FieldType, value: any): FieldType => {
  if (fieldType.type === "json") {
    // Don't do object structure inference on something we think is a JSON field.
    // Do this check first in case it's a JSON-encoded string or something.
    return fieldType;
  } else if (typeof value === "string") {
    if (fieldType.type !== "string" && fieldType.type !== "unknown") {
      throw new Error("Type mismatch");
    }
    return { isArray: fieldType.isArray, type: "string" };
  } else if (typeof value === "number") {
    if (fieldType.type !== "float64" && fieldType.type !== "unknown") {
      throw new Error("Type mismatch");
    }
    return { isArray: fieldType.isArray, type: "float64" };
  } else if (typeof value === "boolean") {
    if (fieldType.type !== "bool" && fieldType.type !== "unknown") {
      throw new Error("Type mismatch");
    }
    return { isArray: fieldType.isArray, type: "bool" };
  } else if (ArrayBuffer.isView(value)) {
    return { isArray: true, type: "float64" };
  } else if (value == undefined) {
    // Shouldn't happen, but we should be robust against it. Keep whatever information we have.
    return fieldType;
  } else if (value instanceof Array) {
    return value.reduce(inferDatatypes, fieldType);
  }
  // Message. Make a new type if the field is currently of unknown type.
  const ret =
    fieldType.type === "unknown"
      ? { type: "message", isArray: fieldType.isArray, object: {} }
      : fieldType;

  if (ret.type !== "message") {
    throw new Error("Type mismatch");
  }
  const inferredObject: any = ret.object;
  Object.keys(value).forEach((fieldName) => {
    const fieldValue = value[fieldName];
    if (inferredObject[fieldName] == undefined) {
      const jsonFieldType = maybeInferJsonFieldType(value, fieldName);
      inferredObject[fieldName] = jsonFieldType ?? {
        type: "unknown",
        isArray: fieldValue instanceof Array,
      };
    }
    inferredObject[fieldName] = inferDatatypes(inferredObject[fieldName], fieldValue);
  });
  return ret as any;
};

const addRosDatatypes = (
  datatypes: RosDatatypes,
  object: InferredObject,
  datatype: string,
  getTypeName: () => string,
): void => {
  const fields = Object.entries(object).map(
    ([fieldName, inferredField]): RosMsgField => {
      const inferredType = inferredField.type;
      switch (inferredField.type) {
        case "bool":
        case "float64":
        case "string":
        case "json":
        case "unknown": {
          const type = inferredField.type === "unknown" ? "bool" : inferredField.type;
          return { name: fieldName, isComplex: false, isArray: inferredField.isArray, type };
        }
        case "message": {
          const type = getTypeName();
          addRosDatatypes(datatypes, inferredField.object, type, getTypeName);
          return { name: fieldName, isComplex: true, isArray: inferredField.isArray, type };
        }
        default:
          throw new Error(`Bad type ${inferredType}`);
      }
    },
  );
  datatypes[datatype] = { fields };
};

export const createRosDatatypesFromFrame = (
  topics: readonly Topic[],
  frame: Frame,
): RosDatatypes => {
  // Note: datatypes are duplicated when they appear in multiple places, and "common" datatypes like
  // markers and times do not get their "real" names. We might consider adding a "seed" set of known
  // datatypes, and doing structural deduplication in a post-processing step.
  const ret = {};
  topics.forEach(({ name, datatype }) => {
    const messages = frame[name];
    if (messages == undefined) {
      return;
    }
    // We run type inference on every message because some messages may contain empty arrays,
    // leaving full message definitions incomplete.
    const schema = messages
      .map(({ message }) => message)
      .reduce(inferDatatypes, { type: "unknown", isArray: false });
    // If there are no messages it'll just be unknown. Probably fine.
    if (schema.type === "message") {
      let typesDeclared = 0;
      const getTypeName = () => `test_msgs${name}/auto_${typesDeclared++}`;
      addRosDatatypes(ret, schema.object, datatype, getTypeName);
    }
  });
  return ret;
};

export const wrapMessages = <T>(messages: readonly Message[]): TypedMessage<T>[] => {
  const frame = groupBy(messages, "topic");
  const topics = Object.keys(frame).map((topic) => ({ name: topic, datatype: topic }));
  const datatypes = createRosDatatypesFromFrame(topics, frame);
  return messages.map(({ topic, receiveTime, message }) => ({
    topic,
    receiveTime,
    message: wrapJsObject(datatypes, topic, message),
  }));
};

export const wrapMessage = <T>(message: Message): TypedMessage<T> => wrapMessages<T>([message])[0]!;

// Objects are assumed to be of the same type
export const wrapObjects = <T>(objects: readonly any[]): T[] => {
  const messages = objects.map((message) => ({
    receiveTime: { sec: 0, nsec: 0 },
    topic: "dummy",
    message,
  }));
  return wrapMessages<T>(messages).map(({ message }) => message);
};
