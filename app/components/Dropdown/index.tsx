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

import ChevronDownIcon from "@mdi/svg/svg/chevron-down.svg";
import cx from "classnames";
import { ReactNode, CSSProperties, ReactElement } from "react";

import Tooltip from "@foxglove-studio/app/components/Tooltip";

import ChildToggle from "../ChildToggle";
import Icon from "../Icon";
import Menu, { Item } from "../Menu";
import styles from "./index.module.scss";

type Props = {
  children?: ReactNode;
  value?: any;
  text?: ReactNode;
  position: "above" | "below" | "left" | "right";
  disabled?: boolean;
  closeOnChange?: boolean;
  onChange?: (value: any) => void;
  toggleComponent?: ReactNode;
  flatEdges: boolean;
  tooltip?: string;
  dataTest?: string;
  noPortal?: boolean;
  btnStyle?: CSSProperties;
  btnClassname?: string;
  menuStyle?: CSSProperties;
};

type State = {
  isOpen: boolean;
};

export default class Dropdown extends React.Component<Props, State> {
  state = { isOpen: false };
  toggle = () => {
    if (!this.props.disabled) {
      this.setState({ isOpen: !this.state.isOpen });
    }
  };

  static defaultProps = {
    flatEdges: true,
    closeOnChange: true,
    position: "below",
  };

  onClick = (value: any) => {
    const { onChange, closeOnChange } = this.props;
    if (onChange) {
      if (closeOnChange) {
        this.setState({ isOpen: false });
      }
      onChange(value);
    }
  };

  renderItem(child: ReactElement) {
    const { value } = this.props;
    const checked = Array.isArray(value)
      ? value.includes(child.props.value)
      : child.props.value === value;
    const onClick = () => this.onClick(child.props.value);
    if ((child.type as any).isMenuItem === true) {
      return React.cloneElement(child, { checked, onClick });
    }
    return (
      <Item iconSize="xxsmall" checked={checked} onClick={onClick} isDropdown>
        {child}
      </Item>
    );
  }

  renderChildren() {
    const { children } = this.props;
    return React.Children.map(children, (child, i) => {
      if (child == undefined) {
        return ReactNull;
      }
      const inner = (child as any).props.value != undefined ? this.renderItem(child as any) : child;
      return <span key={i}>{inner}</span>;
    });
  }

  renderButton(): ReactNode {
    if (this.props.toggleComponent) {
      return this.props.toggleComponent;
    }
    const { btnClassname, text, value, disabled, tooltip } = this.props;
    const { isOpen } = this.state;
    const button = (
      <button
        className={cx(styles.button, btnClassname, { disabled })}
        style={{ opacity: isOpen ? 1 : undefined, ...this.props.btnStyle }}
        data-test={this.props.dataTest}
      >
        <span className={styles.title}>{text || value}</span>
        <Icon style={{ marginLeft: 4 }}>
          <ChevronDownIcon style={{ width: 14, height: 14, opacity: 0.5 }} />
        </Icon>
      </button>
    );
    if (tooltip && !isOpen) {
      // The tooltip often occludes the first item of the open menu.
      return <Tooltip contents={tooltip}>{button}</Tooltip>;
    }
    return button;
  }

  render() {
    const { isOpen } = this.state;
    const { position, flatEdges, menuStyle } = this.props;
    const style = {
      borderTopLeftRadius: flatEdges && position !== "above" ? "0" : undefined,
      borderTopRightRadius: flatEdges && position !== "above" ? "0" : undefined,
      borderBottomLeftRadius: flatEdges && position === "above" ? "0" : undefined,
      borderBottomRightRadius: flatEdges && position === "above" ? "0" : undefined,
      ...(position === "above" ? { marginBottom: 4, borderRadius: 4 } : {}),
      ...menuStyle,
    };
    return (
      <ChildToggle
        style={{ maxWidth: "100%", zIndex: 0 }}
        position={position}
        isOpen={isOpen}
        onToggle={this.toggle}
        dataTest={this.props.dataTest}
        noPortal={this.props.noPortal}
      >
        {this.renderButton()}
        <Menu style={style}>{this.renderChildren()}</Menu>
      </ChildToggle>
    );
  }
}
