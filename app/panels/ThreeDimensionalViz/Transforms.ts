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

import { mat4, vec3, quat, vec4 } from "gl-matrix";

import { TF, MutablePose, Pose, Point, Orientation } from "@foxglove-studio/app/types/Messages";

// allocate some temporary variables
// so we can copy/in out of them during tf application
// this reduces GC as this code gets called lot
const tempMat: mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const tempPos: vec3 = [0, 0, 0];
const tempScale: vec3 = [0, 0, 0];
const tempOrient: vec4 = [0, 0, 0, 0];

function stripLeadingSlash(name: string) {
  return name.startsWith("/") ? name.slice(1) : name;
}

export class Transform {
  id: string;
  matrix: mat4 = mat4.create();
  parent?: Transform;
  _hasValidMatrix: boolean = false;

  constructor(id: string) {
    this.id = stripLeadingSlash(id);
  }

  set(position: Point, orientation: Orientation) {
    mat4.fromRotationTranslation(
      this.matrix,
      quat.set(tempOrient, orientation.x, orientation.y, orientation.z, orientation.w),
      vec3.set(tempPos, position.x, position.y, position.z),
    );
    this._hasValidMatrix = true;
  }

  isValid(rootId: string) {
    return this._hasValidMatrix || this.id === rootId;
  }

  isChildOfTransform(rootId: string): boolean {
    rootId = stripLeadingSlash(rootId);
    if (!this.parent) {
      return this.id === rootId;
    }
    return this.parent.isChildOfTransform(rootId);
  }

  rootTransform(): Transform {
    if (!this.parent) {
      return this;
    }
    return this.parent.rootTransform();
  }

  apply(output: MutablePose, input: Pose, rootId: string): MutablePose | undefined {
    rootId = stripLeadingSlash(rootId);
    if (!this.isValid(rootId)) {
      return undefined;
    }

    if (this.id === rootId) {
      output.position.x = input.position.x;
      output.position.y = input.position.y;
      output.position.z = input.position.z;
      output.orientation.x = input.orientation.x;
      output.orientation.y = input.orientation.y;
      output.orientation.z = input.orientation.z;
      output.orientation.w = input.orientation.w;
      return output;
    }

    // Can't apply if this transform doesn't map to the root transform.
    if (!this.isChildOfTransform(rootId)) {
      return undefined;
    }

    const { position, orientation } = input;
    // set a transform matrix from the input pose
    mat4.fromRotationTranslation(
      tempMat,
      quat.set(tempOrient, orientation.x, orientation.y, orientation.z, orientation.w),
      vec3.set(tempPos, position.x, position.y, position.z),
    );

    // set transform matrix to (our matrix * pose transform matrix)
    mat4.multiply(tempMat, this.matrix, tempMat);

    // copy the transform matrix components out into temp variables
    mat4.getTranslation(tempPos, tempMat);

    // Normalize the values in the matrix by the scale. This ensures that we get the correct rotation
    // out even if the scale isn't 1 in each axis. The logic from this comes from the threejs
    // implementation and an SO answer:
    // - https://github.com/mrdoob/three.js/blob/master/src/math/Matrix4.js#L790-L815
    // - https://math.stackexchange.com/a/1463487
    mat4.getScaling(tempScale, tempMat);
    if (mat4.determinant(tempMat) < 0) {
      tempScale[0] *= -1;
    }
    vec3.inverse(tempScale, tempScale);
    mat4.scale(tempMat, tempMat, tempScale);

    mat4.getRotation(tempOrient, tempMat);

    // mutate the output w/ the temp values
    output.position.x = tempPos[0];
    output.position.y = tempPos[1];
    output.position.z = tempPos[2];
    output.orientation.x = tempOrient[0];
    output.orientation.y = tempOrient[1];
    output.orientation.z = tempOrient[2];
    output.orientation.w = tempOrient[3];

    if (!this.parent) {
      return output;
    }
    return this.parent.apply(output, output, rootId);
  }
}

class TfStore {
  #storage = new Map<string, Transform>();

  get(key: string): Transform {
    key = stripLeadingSlash(key);
    let result = this.#storage.get(key);
    if (result) {
      return result;
    }
    result = new Transform(key);
    this.#storage.set(key, result);
    return result;
  }

  has(key: string): boolean {
    return this.#storage.has(key);
  }

  values(): Array<Transform> {
    return Array.from(this.#storage.values());
  }
}

export default class Transforms {
  storage = new TfStore();
  empty = true;

  // consume a tf message
  consume(tfMessage: TF) {
    // child_frame_id is the id of the tf
    const id = tfMessage.child_frame_id;
    const parentId = tfMessage.header.frame_id;
    const tf = this.storage.get(id);
    const { rotation, translation } = tfMessage.transform;
    tf.set(translation, rotation);
    tf.parent = this.storage.get(parentId);
    this.empty = false;
  }

  // Apply the tf hierarchy to the original pose and update the pose supplied in the output parameter.
  // This follows the same calling conventions in the gl-mat4 lib, which takes an 'out' parameter as their first argument.
  // This allows the caller to decide if they want to update the pose by reference
  // (by reference by supplying it as both the first and second arguments)
  // or return a new one by calling with apply({ position: { }, orientation: {} }, original).
  // Returns the output pose, or the input pose if no transform was needed, or undefined if the transform
  // is not available -- the return value must not be ignored.
  apply(
    output: MutablePose,
    original: Pose,
    frameId: string,
    rootId: string,
  ): MutablePose | undefined {
    const tf = this.storage.get(frameId);
    return tf.apply(output, original, rootId);
  }

  rootOfTransform(transformID: string): Transform {
    return this.get(transformID).rootTransform();
  }

  // Return true if a transform with id _key_ exists in our transforms
  has(key: string) {
    return this.storage.has(key);
  }

  get(key: string) {
    return this.storage.get(key);
  }

  values(): Array<Transform> {
    return this.storage.values();
  }
}
