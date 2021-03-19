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
import { Component } from "react";

import Button from "@foxglove-studio/app/components/Button";
import Flex from "@foxglove-studio/app/components/Flex";
import Modal from "@foxglove-studio/app/components/Modal";
import { downloadTextFile } from "@foxglove-studio/app/util";
import clipboard from "@foxglove-studio/app/util/clipboard";
import sendNotification from "@foxglove-studio/app/util/sendNotification";

import styles from "./ShareJsonModal.module.scss";

type Props = {
  onRequestClose: () => void;
  onChange?: (value: any) => void;
  // the panel state from redux
  // this will be serialized to json & displayed
  value: any;
  noun: string;
};

type State = {
  value: string;
  error: boolean;
  copied: boolean;
};

function encode(value: any): string {
  try {
    return JSON.stringify(value, undefined, 2);
  } catch (e) {
    sendNotification("Error encoding value", e, "app", "error");
    return "";
  }
}

function decode(value: any): string {
  try {
    return JSON.parse(value);
  } catch (err) {
    return JSON.parse(atob(value));
  }
}

function selectText(element?: HTMLTextAreaElement | ReactNull): void {
  if (element) {
    element.focus();
    element.select();
  }
}

export default class ShareJsonModal extends Component<Props, State> {
  state = {
    value: encode(this.props.value),
    error: false,
    copied: false,
  };

  onChange = () => {
    const { onChange, onRequestClose } = this.props;
    let { value } = this.state;
    if (value.length === 0) {
      value = JSON.stringify({});
    }
    try {
      onChange?.(decode(value));
      onRequestClose();
    } catch (e) {
      if (process.env.NODE_ENV !== "test") {
        console.error("Error parsing value from base64 json", e);
      }
      this.setState({ error: true });
    }
  };

  onCopy = () => {
    const { value } = this.state;
    clipboard.copy(value).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 1500);
    });
  };

  onDownload = () => {
    const { value } = this.state;
    downloadTextFile(value, "layout.json");
  };

  renderError() {
    const { error } = this.state;
    if (!error) {
      return ReactNull;
    }
    return <div className="notification is-danger">The input you provided is invalid.</div>;
  }

  render() {
    const { value, copied } = this.state;

    return (
      <Modal
        onRequestClose={this.props.onRequestClose}
        contentStyle={{
          height: 400,
          width: 600,
          display: "flex",
        }}
      >
        <Flex col className={styles.container}>
          <p style={{ lineHeight: "22px" }}>
            <em>Paste a new {this.props.noun} to use it, or copy this one to share it:</em>
          </p>
          <textarea
            className={cx("textarea", styles.textarea)}
            value={value}
            onChange={(e) => this.setState({ value: e.target.value })}
            data-nativeundoredo="true"
            ref={selectText}
          />
          {this.renderError()}
          <div className={styles.buttonBar}>
            <Button primary onClick={this.onChange} className="test-apply">
              Apply
            </Button>
            <Button onClick={this.onDownload}>Download</Button>
            <Button onClick={this.onCopy}>{copied ? "Copied!" : "Copy"}</Button>
            <Button onClick={() => this.setState({ value: "{}" })}>Clear</Button>
          </div>
        </Flex>
      </Modal>
    );
  }
}
