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

import { noop } from "lodash";
import { useContext } from "react";

import Modal, { Title } from "@foxglove-studio/app/components/Modal";
import SegmentedControl from "@foxglove-studio/app/components/SegmentedControl";
import TextContent from "@foxglove-studio/app/components/TextContent";
import ExperimentalFeaturesContext, {
  getDefaultKey,
} from "@foxglove-studio/app/context/ExperimentalFeaturesContext";

export function ExperimentalFeaturesModal(props: {
  onRequestClose?: () => void;
}): React.ReactElement {
  const { settings, features, changeFeature } = useContext(ExperimentalFeaturesContext);
  return (
    <Modal onRequestClose={props.onRequestClose ?? noop}>
      <div style={{ maxWidth: "80vw", maxHeight: "90vh", overflow: "auto" }}>
        <Title>Experimental features</Title>
        <hr />
        <div style={{ padding: "32px" }}>
          <TextContent>
            <p>
              Enable or disable any experimental features. These settings will be stored locally and
              will not be associated with your layout or persisted in any backend.
            </p>
            {Object.keys(features).length === 0 && (
              <p>
                <em>Currently there are no experimental features.</em>
              </p>
            )}
          </TextContent>
          <table style={{ marginTop: 12 }}>
            <tbody>
              {Object.entries(features).map(([id, feature]) => {
                const { enabled = false, manuallySet = false } = settings[id] ?? {};
                return (
                  <tr key={id}>
                    <td style={{ width: "100%", padding: 4 }}>
                      <TextContent>
                        <h2>
                          {feature.name} <code style={{ fontSize: 12 }}>{id}</code>
                        </h2>
                        {feature.description}
                      </TextContent>
                    </td>
                    <td style={{ verticalAlign: "middle" }}>
                      <SegmentedControl
                        selectedId={manuallySet ? (enabled ? "alwaysOn" : "alwaysOff") : "default"}
                        onChange={(value) => {
                          if (
                            value !== "default" &&
                            value !== "alwaysOn" &&
                            value !== "alwaysOff"
                          ) {
                            throw new Error(`Invalid value for radio button: ${value}`);
                          }
                          changeFeature(id, value);
                        }}
                        options={[
                          {
                            id: "default",
                            label: `Default (${feature[getDefaultKey()] ? "on" : "off"})`,
                          },
                          { id: "alwaysOn", label: "On" },
                          { id: "alwaysOff", label: "Off" },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
