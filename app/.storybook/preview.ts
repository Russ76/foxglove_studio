import "@foxglove-studio/app/styles/global.scss";
import "./styles.scss";
import { getGlobalConfig } from "@foxglove-studio/app/GlobalConfig";
import waitForFonts from "@foxglove-studio/app/util/waitForFonts";
import { withScreenshot } from "storycap";

let loaded = false;

export const loaders = [
  async () => {
    // These loaders are run once for each story when you switch between stories,
    // but the global config can't be safely loaded more than once.
    if (!loaded) {
      await waitForFonts();
      await getGlobalConfig().load();
      loaded = true;
    }
  },
];

export const decorators = [withScreenshot];

export const parameters = {
  // Disable default padding around the page body
  layout: "fullscreen",

  screenshot: {
    // We've seen flaky screenshot sizes like 800x601.
    viewport: { width: 800, height: 600 },
  },
};
