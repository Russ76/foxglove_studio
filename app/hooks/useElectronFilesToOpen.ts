// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useState } from "react";

// Hook to get any files the main thread has told us to open
// See the comments in main thread implementation on how the files are injected into this input
export default function useElectronFilesToOpen(): FileList | undefined {
  const [files, setFiles] = useState<FileList>();

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>("#electron-open-file-input");
    if (!input) {
      console.warn(
        "#electron-open-file-input not found - native open-file support will not be available",
      );
      return;
    }

    const update = () => {
      if (input.files) {
        setFiles(input.files);
      }
    };

    // handle any new file open requests
    input.onchange = update;

    update();
    return () => {
      // eslint-disable-next-line no-restricted-syntax
      input.onchange = null;
    };
  }, []);

  return files;
}
