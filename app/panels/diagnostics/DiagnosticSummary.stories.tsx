// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import DiagnosticSummary from "@foxglove-studio/app/panels/diagnostics/DiagnosticSummary";
import {
  DiagnosticStatusArrayMsg,
  getDiagnosticId,
  KeyValue,
  LEVELS,
} from "@foxglove-studio/app/panels/diagnostics/util";
import { TypedMessage } from "@foxglove-studio/app/players/types";
import PanelSetup from "@foxglove-studio/app/stories/PanelSetup";

export default {
  title: "<DiagnosticSummary>",
  excludeStories: ["makeDiagnosticMessage"],
};

export function makeDiagnosticMessage(
  level: number,
  name: string,
  hardware_id: string,
  messages: string[],
  values: KeyValue[] = [],
): TypedMessage<DiagnosticStatusArrayMsg> {
  return {
    topic: "/diagnostics",
    receiveTime: { sec: 2, nsec: 0 },
    message: {
      header: { frame_id: "", stamp: { sec: 1, nsec: 500_000_000 } },
      status: messages.map((message) => ({ level, name, hardware_id, message, values })),
    },
  };
}

const fixture = {
  topics: [{ name: "/diagnostics", datatype: "diagnostic_msgs/DiagnosticArray" }],
  frame: {
    "/diagnostics": [
      makeDiagnosticMessage(LEVELS.OK, "name1", "hardware_id1", ["ok"]),
      makeDiagnosticMessage(42, "name4", "hardware_id4/filter", ["unknown level"]),
      makeDiagnosticMessage(LEVELS.ERROR, "name3", "hardware_id3/filter", ["error"]),
      makeDiagnosticMessage(LEVELS.STALE, "name5", "hardware_id5", ["stale"]),
      makeDiagnosticMessage(LEVELS.WARN, "name2", "hardware_id2/filter", ["warn"]),
    ],
  },
};

export function Empty(): JSX.Element {
  return (
    <PanelSetup fixture={{ ...fixture, frame: {} }}>
      <DiagnosticSummary />
    </PanelSetup>
  );
}

export function Basic(): JSX.Element {
  return (
    <PanelSetup fixture={fixture}>
      <DiagnosticSummary />
    </PanelSetup>
  );
}

export function WithPinnedNodes(): JSX.Element {
  return (
    <PanelSetup fixture={fixture}>
      <DiagnosticSummary
        config={{
          pinnedIds: [
            getDiagnosticId("hardware_id1", "name1"),
            getDiagnosticId("hardware_id4", "name4"),
          ],
          topicToRender: "/diagnostics",
          hardwareIdFilter: "",
        }}
      />
    </PanelSetup>
  );
}

export function WithoutSorting(): JSX.Element {
  return (
    <PanelSetup fixture={fixture}>
      <DiagnosticSummary
        config={{
          pinnedIds: [],
          topicToRender: "/diagnostics",
          hardwareIdFilter: "",
          sortByLevel: false,
        }}
      />
    </PanelSetup>
  );
}

export function Filtered(): JSX.Element {
  return (
    <PanelSetup fixture={fixture}>
      <DiagnosticSummary
        config={{
          pinnedIds: [],
          topicToRender: "/diagnostics",
          hardwareIdFilter: "filter",
          sortByLevel: false,
        }}
      />
    </PanelSetup>
  );
}
