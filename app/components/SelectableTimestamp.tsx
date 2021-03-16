// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import ChevronRightIcon from "@mdi/svg/svg/chevron-right.svg";
import React, { useEffect } from "react";
import { Time } from "rosbag";
import styled from "styled-components";

import CopyText from "@foxglove-studio/app/components/CopyText";
import Icon from "@foxglove-studio/app/components/Icon";
import colors from "@foxglove-studio/app/styles/colors.module.scss";
import mixins from "@foxglove-studio/app/styles/mixins.module.scss";
import { formatDate, formatTime, parseTimeStr } from "@foxglove-studio/app/util/formatTime";
import { parseRosTimeStr, clampTime, formatTimeRaw } from "@foxglove-studio/app/util/time";

const SRoot = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
`;

const DateWrapper = styled.div`
  font-family: ${mixins.monospaceFont};
  font-size: 14px;
  font-weight: normal;
  color: ${colors.grey};
  margin-left: 8px;
`;

const TimestampWrapper = styled.div`
  display: flex;
  font-family: ${mixins.monospaceFont};
  font-size: 14px;
  font-weight: normal;
  color: ${colors.grey};
  align-items: center;
  flex: 0 0 auto;
`;

const RosTimeWrapper = styled.div`
  display: inline-block;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 8px;
`;

const TimeWrapper = styled.div`
  display: inline-block;
  margin: 0 8px;
`;

const ROSText = styled.div`
  color: rgba(255, 255, 255, 0.5);
`;

const SInput = styled.input`
  min-width: 160px;
  padding: 2px 4px;
  background-color: transparentize(${colors.textNormal}, 0.2);
`;

type Props = {
  currentTime: Time;
  startTime: Time;
  endTime: Time;
  pausePlayback: () => void;
  seekPlayback: (arg0: Time) => void;
  timezone?: string;
};

function getValidTime(timeStr: string, start: Time, end: Time, isRosTime: boolean) {
  const validTime = isRosTime ? parseRosTimeStr(timeStr) : parseTimeStr(timeStr);
  return (validTime && clampTime(validTime, start, end)) || undefined;
}

export default React.memo<Props>(function SelectableTimestamp({
  currentTime,
  startTime,
  endTime,
  seekPlayback,
  pausePlayback,
  timezone,
}: Props) {
  const [rosTimeStr, setRosTimeStr] = React.useState<string>(
    `${currentTime.sec}.${currentTime.nsec}`,
  );
  const currentTimeStr = formatTime(currentTime, timezone);
  const [timeStr, setTimeStr] = React.useState<string>(currentTimeStr);
  const [isEditingRosTime, setIsEditingRosTime] = React.useState<boolean>(false);
  const [isEditingTime, setIsEditingTime] = React.useState<boolean>(false);
  const [error, setError] = React.useState<boolean>(false);
  const date = formatDate(currentTime, timezone);

  useEffect(() => {
    // Reset the timeStr when timezone becomes available.
    if (timezone) {
      setTimeStr(currentTimeStr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timezone]);

  const rawTime = formatTimeRaw(currentTime);

  function onSeekTime(ev: any, isRosTime: any) {
    ev.preventDefault();
    setIsEditingRosTime(false);
    setIsEditingTime(false);

    const str = isRosTime ? rosTimeStr : `${date} ${timeStr}`;
    const validTime = getValidTime(str, startTime, endTime, isRosTime);
    if (validTime) {
      seekPlayback(validTime);
    }
  }

  function onTimeChange(ev: any, isRosTime: any) {
    const val = ev.target.value;
    if (isRosTime) {
      setRosTimeStr(val);
    } else {
      setTimeStr(val);
    }
    const str = isRosTime ? val : `${date} ${val}`;
    const validTime = getValidTime(str, startTime, endTime, isRosTime);
    setError(!validTime);
  }

  function onTimeTextClick(isRosTime: any) {
    // pause playback to focus on editing
    pausePlayback();
    setError(false);
    // reset the editing input value base on currentTime
    if (isRosTime) {
      setRosTimeStr(`${currentTime.sec}.${currentTime.nsec}`);
    } else {
      setTimeStr(formatTime(currentTime));
    }
    setIsEditingRosTime(isRosTime);
    setIsEditingTime(!isRosTime);
  }

  return (
    <SRoot>
      <DateWrapper>{date}</DateWrapper>
      <Icon style={{ margin: "0 4px", opacity: "0.5" }} medium clickable={false}>
        <ChevronRightIcon />
      </Icon>
      <TimestampWrapper>
        <TimeWrapper>
          {isEditingTime ? (
            <form onSubmit={(ev) => onSeekTime(ev, false)}>
              <SInput
                style={{ border: error ? "1px solid red" : "none" }}
                value={timeStr}
                onChange={(ev) => onTimeChange(ev, false)}
              />
            </form>
          ) : (
            <span onClick={() => onTimeTextClick(false)}>{currentTimeStr}</span>
          )}
        </TimeWrapper>

        <RosTimeWrapper>
          {isEditingRosTime ? (
            <form onSubmit={(ev) => onSeekTime(ev, true)}>
              <SInput
                style={{ border: error ? "1px solid red" : "none" }}
                value={rosTimeStr}
                onChange={(ev) => onTimeChange(ev, true)}
              />
            </form>
          ) : (
            <span onClick={() => onTimeTextClick(true)}>{rawTime}</span>
          )}
        </RosTimeWrapper>
        <CopyText copyText={rawTime} tooltip="Copy ROS time to clipboard">
          <ROSText>ROS</ROSText>
        </CopyText>
      </TimestampWrapper>
    </SRoot>
  );
});
