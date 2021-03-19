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
import { PolygonBuilder, MouseEventObject, Polygon } from "regl-worldview";

import CameraInfo from "@foxglove-studio/app/panels/ThreeDimensionalViz/CameraInfo";
import Crosshair from "@foxglove-studio/app/panels/ThreeDimensionalViz/Crosshair";
import DrawingTools, {
  DrawingTabType,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/DrawingTools";
import MeasuringTool, {
  MeasureInfo,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/DrawingTools/MeasuringTool";
import FollowTFControl from "@foxglove-studio/app/panels/ThreeDimensionalViz/FollowTFControl";
import Interactions from "@foxglove-studio/app/panels/ThreeDimensionalViz/Interactions";
import { TabType } from "@foxglove-studio/app/panels/ThreeDimensionalViz/Interactions/Interactions";
import styles from "@foxglove-studio/app/panels/ThreeDimensionalViz/Layout.module.scss";
import MainToolbar from "@foxglove-studio/app/panels/ThreeDimensionalViz/MainToolbar";
import MeasureMarker from "@foxglove-studio/app/panels/ThreeDimensionalViz/MeasureMarker";
import SearchText, {
  SearchTextProps,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/SearchText";
import { LayoutToolbarSharedProps } from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicTree/Layout";

type Props = LayoutToolbarSharedProps &
  SearchTextProps & {
    autoSyncCameraState: boolean;
    debug: boolean;
    interactionsTabType?: TabType;
    measureInfo: MeasureInfo;
    measuringElRef: { current: MeasuringTool | ReactNull };
    onSetDrawingTabType: (arg0?: DrawingTabType) => void;
    onSetPolygons: (polygons: Polygon[]) => void;
    onToggleCameraMode: () => void;
    onToggleDebug: () => void;
    polygonBuilder: PolygonBuilder;
    rootTf?: string;
    selectedObject?: MouseEventObject;
    selectedPolygonEditFormat: "json" | "yaml";
    setInteractionsTabType: (arg0?: TabType) => void;
    setMeasureInfo: (arg0: MeasureInfo) => void;
    showCrosshair?: boolean;
    isHidden: boolean;
  };

function LayoutToolbar({
  autoSyncCameraState,
  cameraState,
  debug,
  followOrientation,
  followTf,
  interactionsTabType,
  isPlaying,
  measureInfo,
  measuringElRef,
  onAlignXYAxis,
  onCameraStateChange,
  onFollowChange,
  onSetDrawingTabType,
  onSetPolygons,
  onToggleCameraMode,
  onToggleDebug,
  polygonBuilder,
  rootTf,
  searchInputRef,
  searchText,
  searchTextMatches,
  searchTextOpen,
  selectedMatchIndex,
  selectedObject,
  selectedPolygonEditFormat,
  setInteractionsTabType,
  setMeasureInfo,
  setSearchText,
  setSearchTextMatches,
  setSelectedMatchIndex,
  showCrosshair,
  isHidden,
  targetPose,
  toggleSearchTextOpen,
  transforms,
}: Props) {
  return isHidden ? (
    ReactNull
  ) : (
    <>
      <MeasuringTool
        ref={measuringElRef}
        measureState={measureInfo.measureState}
        measurePoints={measureInfo.measurePoints}
        onMeasureInfoChange={setMeasureInfo}
      />
      <div className={cx(styles.toolbar, styles.right)}>
        <div className={styles.buttons}>
          <SearchText
            searchTextOpen={searchTextOpen}
            toggleSearchTextOpen={toggleSearchTextOpen}
            searchText={searchText}
            setSearchText={setSearchText}
            setSearchTextMatches={setSearchTextMatches}
            searchTextMatches={searchTextMatches}
            searchInputRef={searchInputRef}
            setSelectedMatchIndex={setSelectedMatchIndex}
            selectedMatchIndex={selectedMatchIndex}
            onCameraStateChange={onCameraStateChange}
            cameraState={cameraState}
            transforms={transforms}
            rootTf={rootTf}
          />
        </div>
        <div className={styles.buttons}>
          <FollowTFControl
            transforms={transforms}
            tfToFollow={followTf ? followTf : undefined}
            followOrientation={followOrientation}
            onFollowChange={onFollowChange}
          />
        </div>
        <MainToolbar
          measureInfo={measureInfo}
          measuringTool={measuringElRef.current ?? undefined}
          perspective={cameraState.perspective}
          debug={debug}
          onToggleCameraMode={onToggleCameraMode}
          onToggleDebug={onToggleDebug}
        />
        {measuringElRef.current && measuringElRef.current.measureDistance}
        <Interactions
          selectedObject={selectedObject}
          interactionsTabType={interactionsTabType}
          setInteractionsTabType={setInteractionsTabType}
        />
        <DrawingTools
          onSetPolygons={onSetPolygons}
          polygonBuilder={polygonBuilder}
          selectedPolygonEditFormat={selectedPolygonEditFormat}
          onSetDrawingTabType={onSetDrawingTabType}
        />
        <CameraInfo
          cameraState={cameraState}
          targetPose={targetPose}
          followOrientation={followOrientation}
          followTf={followTf}
          isPlaying={isPlaying}
          onAlignXYAxis={onAlignXYAxis}
          onCameraStateChange={onCameraStateChange}
          showCrosshair={!!showCrosshair}
          autoSyncCameraState={autoSyncCameraState}
        />
      </div>
      {!cameraState.perspective && showCrosshair && <Crosshair cameraState={cameraState} />}
      <MeasureMarker measurePoints={measureInfo.measurePoints} />
    </>
  );
}

export default React.memo<Props>(LayoutToolbar);
