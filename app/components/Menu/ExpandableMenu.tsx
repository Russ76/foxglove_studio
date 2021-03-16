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
import ChevronUpIcon from "@mdi/svg/svg/chevron-up.svg";
import { ReactNode } from "react";
import styled from "styled-components";

import Icon from "@foxglove-studio/app/components/Icon";

import Item from "./Item";

const STitleWrapper = styled.div`
  line-height: 15px;
  flex: 1 1 auto;
`;

type Props = {
  title: ReactNode;
  icon?: ReactNode;
  isOpen: boolean;
  setIsOpen: (arg0: boolean) => void;
  children: ReactNode[];
  disableOpenClose?: boolean;
  dataTest?: string;
};

export default function ExpandableMenu({
  title,
  children,
  icon,
  isOpen,
  setIsOpen,
  disableOpenClose,
  dataTest,
}: Props) {
  const rootItem = (
    <Item
      icon={icon}
      dataTest={dataTest}
      style={{ height: 28 }}
      onClick={() => {
        if (!disableOpenClose) {
          setIsOpen(!isOpen);
        }
      }}
    >
      <STitleWrapper>{title}</STitleWrapper>
      {!disableOpenClose && <Icon small>{isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}</Icon>}
    </Item>
  );

  if (!isOpen) {
    return rootItem;
  }

  return (
    <>
      {rootItem}
      {children}
    </>
  );
}
