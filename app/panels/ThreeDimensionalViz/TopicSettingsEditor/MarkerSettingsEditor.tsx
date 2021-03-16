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

import { Color } from "regl-worldview";

import Checkbox from "@foxglove-studio/app/components/Checkbox";
import Flex from "@foxglove-studio/app/components/Flex";
import { Marker, MarkerArray } from "@foxglove-studio/app/types/Messages";
import { LINED_CONVEX_HULL_RENDERING_SETTING } from "@foxglove-studio/app/util/globalConstants";

import { TopicSettingsEditorProps } from ".";
import ColorPickerForTopicSettings from "./ColorPickerForTopicSettings";
import { SLabel, SDescription } from "./common";

type MarkerSettings = {
  overrideColor?: Color;
  overrideCommand?: string;
};

export default function MarkerSettingsEditor(
  props: TopicSettingsEditorProps<Marker | MarkerArray, MarkerSettings>,
) {
  const { settings = {}, onFieldChange } = props;
  return (
    <Flex col>
      <SLabel>Color</SLabel>
      <SDescription>
        Overrides <code>color</code>/<code>colors</code> for all markers on this topic.
      </SDescription>
      <ColorPickerForTopicSettings
        color={settings.overrideColor}
        onChange={(newColor) => onFieldChange("overrideColor", newColor)}
      />
      <SLabel>Line marker click events override</SLabel>
      <SDescription>
        {`
        Optionally allow treating line markers as polygons, so that clicking inside the lines in the line marker selects
        the marker. The default behavior for line markers requires the user to click exactly on the line to select the
        line marker. This option can reduce performance and will not work on instanced line markers (those with "type":
        105).
        `}
      </SDescription>
      <Checkbox
        checked={settings.overrideCommand === LINED_CONVEX_HULL_RENDERING_SETTING}
        label="Allow clicking inside line markers that form polygons"
        onChange={(checked) =>
          onFieldChange(
            "overrideCommand",
            checked ? LINED_CONVEX_HULL_RENDERING_SETTING : undefined,
          )
        }
        style={{ marginBottom: 12 }}
        labelStyle={{ lineHeight: 1.2 }}
      />
    </Flex>
  );
}

MarkerSettingsEditor.canEditNamespaceOverrideColor = true;
