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

import cx from "classnames";

import Tooltip from "@foxglove-studio/app/components/Tooltip";

import styles from "./icon.module.scss";

type Props = {
  children: React.ReactNode;
  xlarge?: boolean;
  large?: boolean;
  medium?: boolean;
  small?: boolean;
  xsmall?: boolean;
  xxsmall?: boolean;
  active?: boolean;
  fade?: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  clickable?: boolean;
  className?: string;
  style?: {
    [key: string]: any;
  };
  tooltip?: React.ReactNode;
  tooltipProps?: React.ComponentProps<typeof Tooltip>;
  dataTest?: string;
};

const Icon = (props: Props) => {
  const {
    children,
    xlarge,
    large,
    medium,
    small,
    xsmall,
    xxsmall,
    onClick,
    clickable,
    active,
    fade,
    className,
    style,
    tooltip,
    tooltipProps,
    dataTest,
  } = props;
  const classNames = cx("icon", styles.icon, className, {
    [styles.fade]: fade,
    [styles.clickable]: !!onClick || clickable == undefined || clickable,
    [styles.active]: active,
    [styles.xlarge]: xlarge,
    [styles.large]: large,
    [styles.medium]: medium,
    [styles.small]: small,
    [styles.xsmall]: xsmall,
    [styles.xxsmall]: xxsmall,
  });

  // if we have a click handler
  // cancel the bubbling on the event and process it
  // in our click handler callback; otherwise, let it bubble
  const clickHandler = (e: any) => {
    if (onClick) {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    }
  };

  return (
    <Tooltip contents={tooltip} {...tooltipProps}>
      <span className={classNames} onClick={clickHandler} style={style} data-test={dataTest}>
        {children}
      </span>
    </Tooltip>
  );
};

Icon.displayName = "Icon";

export const WrappedIcon = (props: Props) => {
  return (
    <Icon
      {...props}
      style={{
        display: "block",
        padding: "10px",
        minHeight: "40px",
        minWidth: "40px",
        ...props.style,
      }}
      className={cx(styles.wrappedIcon, props.className)}
    />
  );
};

WrappedIcon.displayName = "Icon";

export default Icon;
