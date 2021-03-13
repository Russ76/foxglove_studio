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

import WarnIcon from "@mdi/svg/svg/alert.svg";
import InfoIcon from "@mdi/svg/svg/bell.svg";
import NotificationIcon from "@mdi/svg/svg/close-circle.svg";
import moment from "moment";
import * as React from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import styled from "styled-components";
import tinyColor from "tinycolor2";
import { v4 as uuidv4 } from "uuid";

import ChildToggle from "@foxglove-studio/app/components/ChildToggle";
import Icon from "@foxglove-studio/app/components/Icon";
import Menu from "@foxglove-studio/app/components/Menu";
import Modal, { Title } from "@foxglove-studio/app/components/Modal";
import { RenderToBodyComponent } from "@foxglove-studio/app/components/RenderToBodyComponent";
import { getGlobalHooks } from "@foxglove-studio/app/loadWebviz";
import { nbsp } from "@foxglove-studio/app/util/entities";
import minivizAPI from "@foxglove-studio/app/util/minivizAPI";
import {
  DetailsType,
  NotificationType,
  setNotificationHandler,
  unsetNotificationHandler,
  NotificationSeverity,
} from "@foxglove-studio/app/util/sendNotification";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";

export type NotificationMessage = {
  readonly id: string;
  readonly message: string;
  readonly details: DetailsType;
  readonly read: boolean;
  readonly created: Date;
  readonly severity: NotificationSeverity;
};

const Container = styled.div<{ flash: boolean; unread: boolean; color: string }>`
  height: 100%;
  display: flex;
  flex: 1 1 auto;
  justify-content: flex-end;
  align-items: center;
  padding: 0px 8px;
  transition: background-color 200ms linear;
  background-color: ${(props) =>
    props.flash ? tinyColor(props.color).darken(0).toRgbString() : "none"};
  color: ${(props) =>
    props.flash ? "black" : props.unread ? props.color : "rgba(255, 255, 255, 0.5)"};
`;

const Fader = styled.span<{ visible: boolean }>`
  text-align: center;
  font-size: 12px;
  padding-right: 2px
  opacity: ${(props) => (props.visible ? 1 : 0)};
  transition: opacity 200ms linear;
  display: inline-block;
  max-width: 500px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FLASH_DURATION_MILLIS = 1000;

const SItemContainer = styled.div`
  color: ${(props) => props.color};
  cursor: pointer;
  display: flex;
  flex-direction: row;
  padding: 8px;
  min-width: 280px;
  max-width: 500px;
  font-size: 15px;
  &:hover {
    background-color: rgba(0, 0, 0, 0.2);
  }
`;

const SText = styled.div`
  flex: 1 1 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 14px;
`;

const STime = styled.div`
  color: ${colors.TEXT_MUTED};
  font-size: 11px;
  display: flex;
  flex: 0 0 24px;
  align-items: center;
  justify-content: flex-end;
`;

type NotificationItemProps = {
  notification: NotificationMessage;
  onClick: () => void;
};

const displayPropsBySeverity = {
  error: {
    color: colors.RED1,
    name: "Errors",
    IconSvg: NotificationIcon,
  },
  warn: {
    color: colors.YELLOW1,
    name: "Warnings",
    IconSvg: WarnIcon,
  },
  info: {
    color: colors.BLUEL1,
    name: "Messages",
    IconSvg: InfoIcon,
  },
};
const getColorForSeverity = (severity: NotificationSeverity): string =>
  displayPropsBySeverity[severity]?.color ?? colors.BLUEL1;

function NotificationItem(props: NotificationItemProps) {
  const { notification, onClick } = props;
  const color = getColorForSeverity(notification.severity);
  const duration = moment.duration(moment().diff(moment(notification.created)));
  const seconds = duration.asSeconds();
  let timeString = "";
  if (seconds < 60) {
    timeString = `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    timeString = `${Math.round(seconds / 60)}m`;
  } else {
    timeString = `${Math.round(seconds / 3600)}h`;
  }
  return (
    <SItemContainer onClick={onClick} color={color}>
      <SText className="notification-message">{notification.message}</SText>
      {!notification.read && <div style={{ paddingRight: 8 }}>•</div>}
      <STime>{timeString}</STime>
    </SItemContainer>
  );
}

type NotificationListProps = {
  notifications: NotificationMessage[];
  onClick: (err: NotificationMessage) => void;
};

// exported for storybook
export class NotificationList extends React.PureComponent<NotificationListProps> {
  render() {
    const { notifications, onClick } = this.props;
    return (
      <Menu style={{ marginTop: 2 }}>
        {notifications.map((er) => (
          <NotificationItem key={er.id} notification={er} onClick={() => onClick(er)} />
        ))}
      </Menu>
    );
  }
}

const ModalBody = styled.div`
  padding: 32px;
  max-width: 600px;
  min-width: 300px;
  max-height: 600px;
  overflow: auto;
`;

// Exporting for tests.
export function NotificationModal({
  notification,
  onRequestClose,
}: {
  notification: NotificationMessage;
  onRequestClose: () => void;
}): React.ReactElement {
  const { renderNotificationDetails } = getGlobalHooks() as any;
  let details = renderNotificationDetails
    ? renderNotificationDetails(notification.details)
    : notification.details;
  if (details instanceof Error) {
    details = details.stack;
  }
  return (
    <RenderToBodyComponent>
      <Modal onRequestClose={onRequestClose}>
        <Title style={{ color: getColorForSeverity(notification.severity) }}>
          {notification.message}
        </Title>
        <hr />
        <ModalBody>
          {typeof details === "string" ? (
            <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.3 }}>{details}</pre>
          ) : (
            details || "No details provided"
          )}
        </ModalBody>
      </Modal>
    </RenderToBodyComponent>
  );
}

export default function NotificationDisplay(): React.ReactElement {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [showMostRecent, setShowMostRecent] = useState(false);
  const [clickedNotification, setClickedNotification] = useState<NotificationMessage>();
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();

  useLayoutEffect(() => {
    setNotificationHandler(
      (
        message: string,
        details: DetailsType,
        type: NotificationType,
        severity: NotificationSeverity,
      ): void => {
        // shift notifications in to the front of the array and keep a max of 100
        setNotifications((notes) => [
          { id: uuidv4(), created: new Date(), read: false, message, details, severity },
          ...notes.slice(0, 100),
        ]);
        setShowMostRecent(true);

        if (hideTimeout.current) {
          clearTimeout(hideTimeout.current);
        }
        hideTimeout.current = setTimeout(() => {
          setShowMostRecent(false);
        }, FLASH_DURATION_MILLIS);

        // Notify the iFrame from here, since we should always have a `window` here since we're not
        // in a React component (and not in a worker).
        minivizAPI.postNotificationMessage({ message, details, type, severity });
      },
    );

    return () => {
      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current);
      }
      unsetNotificationHandler();
    };
  }, []);

  const toggleNotificationList = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      // mark items read on closed
      setNotifications((notes) => notes.map((note) => ({ ...note, read: true })));
    }
  }, []);

  const unreadCount = notifications.reduce((acc, err) => acc + (err.read ? 0 : 1), 0);

  const firstNotification = notifications[0];
  const { name, color, IconSvg } = displayPropsBySeverity[firstNotification?.severity ?? "error"];
  const hasUnread = unreadCount > 0;

  return (
    <Container flash={showMostRecent} unread={hasUnread} color={color}>
      {clickedNotification && (
        <NotificationModal
          notification={clickedNotification}
          onRequestClose={() => setClickedNotification(undefined)}
        />
      )}
      {firstNotification && (
        <ChildToggle position="below" onToggle={toggleNotificationList}>
          <div style={{ display: "flex", flex: "1 1 auto", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                flex: "none",
                alignItems: "center",
              }}
            >
              <Icon small tooltip={name}>
                <IconSvg />
              </Icon>
            </div>
            <Fader visible={showMostRecent} style={{ paddingLeft: 5, cursor: "pointer" }}>
              {firstNotification.message}
            </Fader>
            <div style={{ fontSize: 12 }}>{unreadCount > 1 && `${nbsp}(1 of ${unreadCount})`}</div>
          </div>
          <NotificationList notifications={notifications} onClick={setClickedNotification} />
        </ChildToggle>
      )}
    </Container>
  );
}
