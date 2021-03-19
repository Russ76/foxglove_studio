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

import ApiCheckerDataProvider from "@foxglove-studio/app/dataProviders/ApiCheckerDataProvider";
import BagDataProvider from "@foxglove-studio/app/dataProviders/BagDataProvider";
import IdbCacheWriterDataProvider from "@foxglove-studio/app/dataProviders/IdbCacheWriterDataProvider";
import MeasureDataProvider from "@foxglove-studio/app/dataProviders/MeasureDataProvider";
import RpcDataProviderRemote from "@foxglove-studio/app/dataProviders/RpcDataProviderRemote";
import createGetDataProvider from "@foxglove-studio/app/dataProviders/createGetDataProvider";
import Rpc from "@foxglove-studio/app/util/Rpc";
import { inWebWorker } from "@foxglove-studio/app/util/workers";

const getDataProvider = createGetDataProvider({
  ApiCheckerDataProvider,
  BagDataProvider,
  MeasureDataProvider,
  IdbCacheWriterDataProvider,
});

if (inWebWorker()) {
  // @ts-expect-error not yet using TS Worker lib: FG-64
  new RpcDataProviderRemote(new Rpc(global), getDataProvider);
}
