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

import ArrowCollapseIcon from "@mdi/svg/svg/arrow-collapse.svg";
import cx from "classnames";
import styled from "styled-components";

import Button from "@foxglove-studio/app/components/Button";
import Flex from "@foxglove-studio/app/components/Flex";
import Icon from "@foxglove-studio/app/components/Icon";

import styles from "./ExpandingToolbar.module.scss";

const PANE_WIDTH = 268;
const PANE_HEIGHT = 240;

export const SToolGroupFixedSizePane = styled.div`
  overflow-x: hidden;
  overflow-y: auto;
  padding: 8px 0;
`;

export function ToolGroup<T>({ children }: { name: T; children: React.ReactElement }) {
  return children;
}

export function ToolGroupFixedSizePane({
  children,
}: {
  children: React.ReactElement | React.ReactElement[];
}) {
  return (
    <SToolGroupFixedSizePane style={{ width: PANE_WIDTH - 28, height: PANE_HEIGHT }}>
      {children}
    </SToolGroupFixedSizePane>
  );
}

type Props<T extends string> = {
  children: React.ReactElement<typeof ToolGroup>[] | React.ReactElement<typeof ToolGroup>;
  className?: string;
  icon: React.ReactNode;
  onSelectTab: (name: T | undefined) => void;
  selectedTab?: T; // collapse the toolbar if selectedTab is undefined
  tooltip: string;
  style?: React.CSSProperties;
};

export default function ExpandingToolbar<T extends string>({
  children,
  className,
  icon,
  onSelectTab,
  selectedTab,
  tooltip,
  style,
}: Props<T>) {
  const expanded = !!selectedTab;
  if (!expanded) {
    let selectedTabLocal = selectedTab;
    if (!selectedTabLocal) {
      // default to the first child's name if no tab is selected
      React.Children.forEach(children, (child) => {
        if (!selectedTabLocal) {
          selectedTabLocal = child.props.name as any;
        }
      });
    }
    return (
      <div className={className}>
        <Button tooltip={tooltip} onClick={() => onSelectTab(selectedTabLocal)}>
          <Icon dataTest={`ExpandingToolbar-${tooltip}`}>{icon}</Icon>
        </Button>
      </div>
    );
  }
  let selectedChild: any;
  React.Children.forEach(children, (child) => {
    if (!selectedChild || child.props.name === selectedTab) {
      selectedChild = child;
    }
  });
  return (
    <div className={cx(className, styles.expanded)}>
      <Flex row className={styles.tabBar}>
        {React.Children.map(children, (child) => {
          return (
            <Button
              className={cx(styles.tab, { [styles.selected]: child === selectedChild })}
              onClick={() => onSelectTab(child.props.name as any)}
            >
              {child.props.name}
            </Button>
          );
        })}
        <div className={styles.spaceSeparator} />
        <Button onClick={() => onSelectTab(undefined)}>
          <Icon>
            <ArrowCollapseIcon />
          </Icon>
        </Button>
      </Flex>
      <div className={styles.tabBody} style={style}>
        {selectedChild}
      </div>
    </div>
  );
}
