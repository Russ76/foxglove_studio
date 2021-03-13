// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

declare module "worker-loader!*" {
  class WebpackWorker extends Worker {
    constructor();
  }

  export = WebpackWorker;
  export default WebpackWorker;
}

declare module "worker-loader?*" {
  class WebpackWorker extends Worker {
    constructor();
  }

  export = WebpackWorker;
  export default WebpackWorker;
}
