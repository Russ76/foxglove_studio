// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ESBuildPlugin } from "esbuild-loader";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import path from "path";
import { Configuration, ResolveOptions, DefinePlugin, EnvironmentPlugin } from "webpack";

import { WebpackArgv } from "./WebpackArgv";

export default (_: unknown, argv: WebpackArgv): Configuration => {
  const isServe = argv.env?.WEBPACK_SERVE ?? false;

  const isDev = argv.mode === "development";

  const resolve: ResolveOptions = {
    extensions: [".js", ".ts", ".tsx", ".json"],
  };

  if (!isDev) {
    // Stub out devtools installation for non-dev builds
    resolve.alias = {
      "electron-devtools-installer": false,
    };
  }

  // When running under a development server the renderer entry comes from the server.
  // When making static builds (for packaging), the renderer entry is a file on disk.
  // This switches between the two and is injected below via DefinePlugin as MAIN_WINDOW_WEBPACK_ENTRY
  const rendererEntry = isServe
    ? "'http://localhost:8080/renderer/index.html'"
    : "`file://${require('path').join(__dirname, '..', 'renderer', 'index.html')}`";

  return {
    context: path.resolve("./desktop"),
    entry: "./index.ts",
    target: "electron-main",
    devtool: isDev ? "eval-cheap-module-source-map" : "nosources-source-map",

    output: {
      publicPath: "",
      path: path.resolve(__dirname, ".webpack", "main"),
    },

    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: "esbuild-loader",
            options: {
              loader: "ts",
              target: "es2020",
            },
          },
        },
        {
          test: /\.s?css$/,
          loader: "css-loader",
          options: { modules: { exportOnlyLocals: true } },
        },
        { test: /\.scss$/, loader: "sass-loader" },
      ],
    },

    plugins: [
      new ESBuildPlugin(),
      new DefinePlugin({
        MAIN_WINDOW_WEBPACK_ENTRY: rendererEntry,
        // Should match webpack-defines.d.ts
        APP_NAME: JSON.stringify("Foxglove Studio"),
      }),
      new EnvironmentPlugin({
        SENTRY_DSN: process.env.SENTRY_DSN ?? null,
      }),
      new ForkTsCheckerWebpackPlugin(),
    ],

    resolve,
  };
};
