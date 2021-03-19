// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createMemoryHistory } from "history";
import { useMemo } from "react";
import { Provider } from "react-redux";

import LayoutStorageContext, {
  Layout,
  LayoutStorage,
} from "@foxglove-studio/app/context/LayoutStorageContext";
import createRootReducer from "@foxglove-studio/app/reducers";
import configureStore from "@foxglove-studio/app/store/configureStore.testing";

import LayoutsContextMenu from "./LayoutsContextMenu";

class FakeLayoutStorage implements LayoutStorage {
  #layouts: Layout[];

  constructor(layouts: Layout[] = []) {
    this.#layouts = layouts;
  }
  list(): Promise<Layout[]> {
    return Promise.resolve(this.#layouts);
  }
  get(_id: string): Promise<Layout | undefined> {
    throw new Error("Method not implemented.");
  }
  put(_layout: unknown): Promise<void> {
    throw new Error("Method not implemented.");
  }
  delete(_id: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export default {
  title: "LayoutsContextMenu",
  component: LayoutsContextMenu,
};

export function Empty(): JSX.Element {
  const storage = useMemo(() => new FakeLayoutStorage(), []);
  const store = useMemo(() => configureStore(createRootReducer(createMemoryHistory())), []);

  return (
    <div style={{ display: "flex" }}>
      <Provider store={store}>
        <LayoutStorageContext.Provider value={storage}>
          <LayoutsContextMenu />
        </LayoutStorageContext.Provider>
      </Provider>
    </div>
  );
}

export function LayoutList(): JSX.Element {
  const storage = useMemo(
    () =>
      new FakeLayoutStorage([
        {
          id: "not-current",
          name: "Another Layout",
          state: undefined,
        },
        {
          id: "test-id",
          name: "Current Layout",
          state: undefined,
        },
        {
          id: "short-id",
          name: "Short",
          state: undefined,
        },
      ]),
    [],
  );
  const store = useMemo(() => {
    const newStore = configureStore(createRootReducer(createMemoryHistory()));

    // set an id for the current panel state so we can see it highlited in the menu
    const state = newStore.getState();
    state.persistedState.panels.id = "test-id";

    return newStore;
  }, []);

  return (
    <div style={{ display: "flex" }}>
      <Provider store={store}>
        <LayoutStorageContext.Provider value={storage}>
          <LayoutsContextMenu />
        </LayoutStorageContext.Provider>
      </Provider>
    </div>
  );
}
