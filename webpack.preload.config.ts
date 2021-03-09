// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ESBuildPlugin } from "esbuild-loader";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import path from "path";
import { Configuration, EnvironmentPlugin } from "webpack";

import { WebpackArgv } from "./WebpackArgv";

export default (_: unknown, argv: WebpackArgv): Configuration => {
  const isDev = argv.mode === "development";

  return {
    context: path.resolve("./preload"),
    entry: "./index.ts",
    target: "electron-preload",
    devtool: isDev ? "eval-cheap-module-source-map" : "nosources-source-map",

    output: {
      publicPath: "",
      filename: "preload.js",
      // Put the preload script in main since main becomes the "app path"
      // This simplifies setting the 'preload' webPrefereces option on BrowserWindow
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
      ],
    },

    plugins: [
      new ESBuildPlugin(),
      new EnvironmentPlugin({
        SENTRY_DSN: process.env.SENTRY_DSN ?? null,
      }),
      new ForkTsCheckerWebpackPlugin(),
    ],

    resolve: {
      extensions: [".js", ".ts", ".tsx", ".json"],
      alias: {
        "@sentry/electron": "@sentry/electron/esm/renderer",
      },
    },
  };
};
