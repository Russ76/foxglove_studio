// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import * as PanelApi from "@foxglove-studio/app/PanelAPI";
import Panel from "@foxglove-studio/app/components/Panel";

type Config = {
  placeholder: string;
};

// this would come from the local extension directory
const src = `
return function() {
    const topicMessages = foxglove.useMessagesByTopic({
        topics: ["/tf"],
        historySize: 1,
    });

    return React.createElement('div', undefined, 'Hello World! ' + String(JSON.stringify(topicMessages["/tf"])));
}
`;

function Extension() {
  const Component = useMemo(() => {
    const blockedGlobals = ["window", "document", "localStorage"];
    // fetch?... this list is really long... and how do we differentiate language features from DOM

    // we inject React since we only want one copy of that
    // we inject panel apis as "foxglove"
    const args = ["React", "foxglove", ...blockedGlobals, src];

    // eslint-disable-next-line no-new-func
    const fn = new Function(...args);
    return fn.call(undefined, React, PanelApi);
  }, []);
  return <Component />;
}

Extension.panelType = "extension";
Extension.defaultConfig = {
  placeholder: "foo",
};

export default Panel<Config>(Extension);
