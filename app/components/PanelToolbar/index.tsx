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

import ArrowSplitHorizontalIcon from "@mdi/svg/svg/arrow-split-horizontal.svg";
import ArrowSplitVerticalIcon from "@mdi/svg/svg/arrow-split-vertical.svg";
import CheckboxMultipleBlankOutlineIcon from "@mdi/svg/svg/checkbox-multiple-blank-outline.svg";
import CodeJsonIcon from "@mdi/svg/svg/code-json.svg";
import CogIcon from "@mdi/svg/svg/cog.svg";
import DragIcon from "@mdi/svg/svg/drag.svg";
import FullscreenIcon from "@mdi/svg/svg/fullscreen.svg";
import TrashCanOutlineIcon from "@mdi/svg/svg/trash-can-outline.svg";
import cx from "classnames";
import { useContext, useState, useCallback, useMemo } from "react";
import { MosaicContext, MosaicWindowContext } from "react-mosaic-component";
import { useDispatch, useSelector, ReactReduxContext } from "react-redux";
import { bindActionCreators } from "redux";

import {
  savePanelConfigs,
  changePanelLayout,
  closePanel,
  splitPanel,
  swapPanel,
} from "@foxglove-studio/app/actions/panels";
import ChildToggle from "@foxglove-studio/app/components/ChildToggle";
import Dimensions from "@foxglove-studio/app/components/Dimensions";
import Dropdown from "@foxglove-studio/app/components/Dropdown";
import Icon from "@foxglove-studio/app/components/Icon";
import { Item, SubMenu } from "@foxglove-studio/app/components/Menu";
import PanelContext, { usePanelContext } from "@foxglove-studio/app/components/PanelContext";
import { getPanelTypeFromMosaic } from "@foxglove-studio/app/components/PanelToolbar/utils";
import ShareJsonModal from "@foxglove-studio/app/components/ShareJsonModal";
import PanelList, { PanelSelection } from "@foxglove-studio/app/panels/PanelList";
import { State } from "@foxglove-studio/app/reducers";
import frameless from "@foxglove-studio/app/util/frameless";
import { TAB_PANEL_TYPE } from "@foxglove-studio/app/util/globalConstants";
import logEvent, { getEventNames, getEventTags } from "@foxglove-studio/app/util/logEvent";

import HelpButton from "./HelpButton";
import MosaicDragHandle from "./MosaicDragHandle";
import styles from "./index.module.scss";

type Props = {
  // eslint-disable-next-line react/no-unused-prop-types
  children?: React.ReactNode;
  floating?: boolean;
  helpContent?: React.ReactNode;
  menuContent?: React.ReactNode;
  additionalIcons?: React.ReactNode;
  // eslint-disable-next-line react/no-unused-prop-types
  hideToolbars?: boolean;
  showHiddenControlsOnHover?: boolean;
  isUnknownPanel?: boolean;
};

// separated into a sub-component so it can always skip re-rendering
// it never changes after it initially mounts
function StandardMenuItems({
  tabId,
  isUnknownPanel,
  onEditPanelConfig,
}: {
  tabId?: string;
  isUnknownPanel: boolean;
  onEditPanelConfig: () => void;
}) {
  const { mosaicActions } = useContext(MosaicContext);
  const { mosaicWindowActions } = useContext(MosaicWindowContext);
  const savedProps = useSelector((state: State) => state.persistedState.panels.savedProps);
  const dispatch = useDispatch();
  const actions = useMemo(
    () =>
      bindActionCreators(
        { savePanelConfigs, changePanelLayout, closePanel, splitPanel, swapPanel },
        dispatch,
      ),
    [dispatch],
  );

  const getPanelType = useCallback(
    () => getPanelTypeFromMosaic(mosaicWindowActions, mosaicActions),
    [mosaicActions, mosaicWindowActions],
  );

  const close = useCallback(() => {
    logEvent({
      name: getEventNames().PANEL_REMOVE,
      tags: { [getEventTags().PANEL_TYPE]: getPanelType() },
    });
    actions.closePanel({
      tabId,
      root: mosaicActions.getRoot() as any,
      path: mosaicWindowActions.getPath(),
    });
  }, [actions, getPanelType, mosaicActions, mosaicWindowActions, tabId]);

  const split = useCallback(
    (store, id: string | undefined, direction: "row" | "column") => {
      const type = getPanelType();
      if (!id || !type) {
        throw new Error("Trying to split unknown panel!");
      }
      logEvent({
        name: getEventNames().PANEL_SPLIT,
        tags: { [getEventTags().PANEL_TYPE]: getPanelType() },
      });

      const config = savedProps[id];
      actions.splitPanel({
        id,
        tabId,
        direction,
        root: mosaicActions.getRoot() as any,
        path: mosaicWindowActions.getPath(),
        config,
      });
    },
    [actions, getPanelType, mosaicActions, mosaicWindowActions, savedProps, tabId],
  );

  const swap = useCallback(
    (id?: string) => ({ type, config, relatedConfigs }: PanelSelection) => {
      actions.swapPanel({
        tabId,
        originalId: id as any,
        type,
        root: mosaicActions.getRoot() as any,
        path: mosaicWindowActions.getPath(),
        config: config as any,
        relatedConfigs,
      });
      logEvent({ name: getEventNames().PANEL_SWAP, tags: { [getEventTags().PANEL_TYPE]: type } });
    },
    [actions, mosaicActions, mosaicWindowActions, tabId],
  );

  const { store } = useContext(ReactReduxContext);
  const panelContext = usePanelContext();

  const type = getPanelType();
  if (!type) {
    return ReactNull;
  }

  return (
    <>
      <SubMenu
        text="Change panel"
        icon={<CheckboxMultipleBlankOutlineIcon />}
        dataTest="panel-settings-change"
      >
        <PanelList
          selectedPanelTitle={panelContext?.title}
          onPanelSelect={swap(panelContext?.id)}
        />
      </SubMenu>
      {!isUnknownPanel && (
        <>
          <Item
            icon={<FullscreenIcon />}
            onClick={panelContext?.enterFullscreen}
            dataTest="panel-settings-fullscreen"
            tooltip="(shortcut: ` or ~)"
          >
            Fullscreen
          </Item>
          <Item
            icon={<ArrowSplitHorizontalIcon />}
            onClick={() => split(store, panelContext?.id, "column")}
            dataTest="panel-settings-hsplit"
            tooltip="(shortcut: ` or ~)"
          >
            Split horizontal
          </Item>
          <Item
            icon={<ArrowSplitVerticalIcon />}
            onClick={() => split(store, panelContext?.id, "row")}
            dataTest="panel-settings-vsplit"
            tooltip="(shortcut: ` or ~)"
          >
            Split vertical
          </Item>
        </>
      )}
      <Item
        icon={<TrashCanOutlineIcon />}
        onClick={close}
        dataTest="panel-settings-remove"
        tooltip="(shortcut: ` or ~)"
      >
        Remove panel
      </Item>
      {!isUnknownPanel && (
        <Item
          icon={<CodeJsonIcon />}
          onClick={onEditPanelConfig}
          disabled={type === TAB_PANEL_TYPE}
          dataTest="panel-settings-config"
        >
          Import/export panel settings
        </Item>
      )}
    </>
  );
}

type PanelToolbarControlsProps = Props & {
  isRendered: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  showPanelName?: boolean;
  isUnknownPanel: boolean;
  onEditPanelConfig: () => void;
};

// Keep controls, which don't change often, in a pure component in order to avoid re-rendering the
// whole PanelToolbar when only children change.
const PanelToolbarControls = React.memo(function PanelToolbarControls({
  additionalIcons,
  floating,
  helpContent,
  isRendered,
  isUnknownPanel,
  menuContent,
  onDragEnd,
  onDragStart,
  showHiddenControlsOnHover,
  showPanelName,
  onEditPanelConfig,
}: PanelToolbarControlsProps) {
  const panelData = useContext(PanelContext);

  return (
    <div
      className={styles.iconContainer}
      style={showHiddenControlsOnHover && !isRendered ? { visibility: "hidden" } : {}}
    >
      {showPanelName && panelData && <div className={styles.panelName}>{panelData.title}</div>}
      {additionalIcons}
      {helpContent && <HelpButton>{helpContent}</HelpButton>}
      <Dropdown
        flatEdges={!floating}
        toggleComponent={
          <Icon fade tooltip="Panel settings" dataTest="panel-settings">
            <CogIcon className={styles.icon} />
          </Icon>
        }
      >
        <StandardMenuItems
          tabId={panelData?.tabId}
          isUnknownPanel={isUnknownPanel}
          onEditPanelConfig={onEditPanelConfig}
        />
        {menuContent && <hr />}
        {menuContent}
      </Dropdown>
      {!isUnknownPanel && (
        <MosaicDragHandle onDragStart={onDragStart} onDragEnd={onDragEnd} tabId={panelData?.tabId}>
          {/* Can only nest native nodes into <MosaicDragHandle>, so wrapping in a <span> */}
          <span>
            <Icon fade tooltip="Move panel (shortcut: ` or ~)">
              <DragIcon className={styles.dragIcon} />
            </Icon>
          </span>
        </MosaicDragHandle>
      )}
    </div>
  );
});

// Panel toolbar should be added to any panel that's part of the
// react-mosaic layout.  It adds a drag handle, remove/replace controls
// and has a place to add custom controls via it's children property
export default React.memo<Props>(function PanelToolbar({
  additionalIcons,
  children,
  floating,
  helpContent,
  hideToolbars,
  isUnknownPanel,
  menuContent,
  showHiddenControlsOnHover,
}: Props) {
  const { isHovered = false, id } = useContext(PanelContext) ?? {};
  const [isDragging, setIsDragging] = useState(false);
  const onDragStart = useCallback(() => setIsDragging(true), []);
  const onDragEnd = useCallback(() => setIsDragging(false), []);
  const [containsOpen, setContainsOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const dispatch = useDispatch();

  const { store } = useContext(ReactReduxContext);
  const shareModal = useMemo(() => {
    if (!id || !showShareModal) {
      return ReactNull;
    }
    const panelConfigById = store.getState().persistedState.panels.savedProps;
    return (
      <ShareJsonModal
        onRequestClose={() => setShowShareModal(false)}
        value={panelConfigById[id] ?? {}}
        onChange={(config) =>
          dispatch(savePanelConfigs({ configs: [{ id, config, override: true }] }))
        }
        noun="panel configuration"
      />
    );
  }, [id, showShareModal, store, dispatch]);

  if (frameless() || hideToolbars) {
    return ReactNull;
  }

  const isRendered = isHovered || containsOpen || isDragging || !!isUnknownPanel;
  return (
    <Dimensions>
      {({ width }) => (
        <ChildToggle.ContainsOpen onChange={setContainsOpen}>
          {shareModal}
          <div
            className={cx(styles.panelToolbarContainer, {
              [styles.floating]: floating,
              [styles.floatingShow]: floating && isRendered,
              [styles.hasChildren]: !!children,
            })}
          >
            {(isRendered || !floating) && children}
            {(isRendered || showHiddenControlsOnHover) && (
              <PanelToolbarControls
                isRendered={isRendered}
                showHiddenControlsOnHover={showHiddenControlsOnHover}
                floating={floating}
                helpContent={helpContent}
                menuContent={menuContent}
                showPanelName={width > 360}
                additionalIcons={additionalIcons}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                isUnknownPanel={!!isUnknownPanel}
                onEditPanelConfig={() => setShowShareModal(true)}
              />
            )}
          </div>
        </ChildToggle.ContainsOpen>
      )}
    </Dimensions>
  );
});
