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

import * as monacoApi from "monaco-editor/esm/vs/editor/editor.api";
// @ts-expect-error why doesn't this import the base monaco?
import { StaticServices } from "monaco-editor/esm/vs/editor/standalone/browser/standaloneServices";
import { ReactElement } from "react";
import MonacoEditor from "react-monaco-editor";

import getPrettifiedCode from "@foxglove-studio/app/panels/NodePlayground/prettier";
import { Script, EditorSelection } from "@foxglove-studio/app/panels/NodePlayground/script";
import vsWebvizTheme from "@foxglove-studio/app/panels/NodePlayground/theme/vs-webviz.json";
import { getNodeProjectConfig } from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/typescript/projectConfig";
import inScreenshotTests from "@foxglove-studio/app/stories/inScreenshotTests";

const VS_WEBVIZ_THEME = "vs-webviz";

const codeEditorService = StaticServices.codeEditorService.get();

type Props = {
  script?: Script;
  setScriptCode: (code: string) => void;
  autoFormatOnSave: boolean;
  rosLib: string;

  /* A minor hack to tell the monaco editor to resize when dimensions change. */
  resizeKey: string;
  save: (code: string) => void;
  setScriptOverride: (script: Script) => void;
};

// Taken from:
// https://github.com/microsoft/vscode/blob/master/src/vs/editor/standalone/browser/standaloneCodeServiceImpl.ts
const gotoSelection = (editor: any, selection?: EditorSelection) => {
  if (selection) {
    if (selection.endLineNumber && selection.endColumn) {
      // These fields indicate a range was selected, set the range and reveal it.
      editor.setSelection(selection);
      editor.revealRangeInCenter(
        selection,
        1,
        /* Immediate */
      );
    } else {
      // Otherwise it's just a position
      const pos = {
        lineNumber: selection.startLineNumber,
        column: selection.startColumn,
      };
      editor.setPosition(pos);
      editor.revealPositionInCenter(
        pos,
        1,
        /* Immediate */
      );
    }
  }
};

const projectConfig = getNodeProjectConfig();
const Editor = ({
  autoFormatOnSave,
  script,
  setScriptCode,
  resizeKey,
  save,
  setScriptOverride,
  rosLib,
}: Props): ReactElement | ReactNull => {
  const editorRef = React.useRef<any>(ReactNull);
  const autoFormatOnSaveRef = React.useRef(autoFormatOnSave);
  autoFormatOnSaveRef.current = autoFormatOnSave;

  React.useEffect(() => {
    monacoApi.languages.typescript.typescriptDefaults.addExtraLib(
      rosLib,
      `file:///node_modules/@types/${projectConfig.rosLib.fileName}`,
    );
  }, [rosLib]);

  /*
  In order to support go-to across files we override the code editor service doOpenEditor method.
  Default implementation checks if the requested resource is the current model and no ops if it isn't.
  Our implementation looks across all of our models to find the one requested and then queues that as
  an override along with the requested selection (containing line # etc). When we're told to load
  this override script we'll end up loading the model in the useEffect below, and then using this
  selection to move to the correct line.
  */
  codeEditorService.doOpenEditor = React.useCallback(
    (editor: any, input: any) => {
      const requestedModel = monacoApi.editor.getModel(input.resource);
      if (!requestedModel) {
        return editor;
      }

      // If we are jumping to a definition within the user node, don't push
      // to script override.
      if (requestedModel.uri.path === script?.filePath) {
        gotoSelection(editor, input.options.selection);
        return;
      }

      setScriptOverride({
        filePath: requestedModel.uri.path,
        code: requestedModel.getValue(),
        readOnly: true,
        selection: input.options ? input.options.selection : undefined,
      });
      return editor;
    },
    [script, setScriptOverride],
  );

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editorRef || !script) {
      return;
    }
    const filePath = monacoApi.Uri.parse(`file://${script.filePath}`);
    const model =
      monacoApi.editor.getModel(filePath) ??
      monacoApi.editor.createModel(script.code, "typescript", filePath);

    // Update the model's code if it was updated outside the Editor.
    // Without this, monaco can continue to show old code if the userScripts are changed outside of the Editor
    if (model.getValue() !== script.code) {
      model.setValue(script.code);
    }

    editor.setModel(model);
    gotoSelection(editor, script.selection);
  }, [script]);

  const options = React.useMemo(() => {
    return {
      wordWrap: "on",
      minimap: {
        enabled: false,
      },
      readOnly: script?.readOnly,
    };
  }, [script]);

  const willMount = React.useCallback(
    (monaco) => {
      if (!script) {
        return;
      }
      monaco.editor.defineTheme(VS_WEBVIZ_THEME, vsWebvizTheme);

      // Set eager model sync to enable intellisense between the user code and utility files
      monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
      monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

      monaco.languages.registerDocumentFormattingEditProvider("typescript", {
        provideDocumentFormattingEdits: async (model: any) => {
          try {
            return [
              {
                range: model.getFullModelRange(),
                text: await getPrettifiedCode(model.getValue()),
              },
            ];
          } catch (e) {
            return [];
          }
        },
      });

      // Disable validation in screenshots to avoid flaky tests
      if (inScreenshotTests()) {
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSyntaxValidation: true,
          noSemanticValidation: true,
        });
      }

      // Load declarations and additional utility files from project config

      // This ensures the type defs we enforce in
      // the 'compile' step match that of monaco. Adding the 'lib'
      // this way (instead of specifying it in the compiler options)
      // is a hack to overwrite the default type defs since the
      // typescript language service does not expose such a method.
      projectConfig.declarations.forEach((lib) =>
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          lib.sourceCode,
          `file:///node_modules/@types/${lib.fileName}`,
        ),
      );
      projectConfig.utilityFiles.forEach((sourceFile) => {
        const filePath = monacoApi.Uri.parse(`file://${sourceFile.filePath}`);
        const model =
          monaco.editor.getModel(filePath) ||
          monaco.editor.createModel(sourceFile.sourceCode, "typescript", filePath);
        model.updateOptions({ tabSize: 2 });
      });

      const filePath = monacoApi.Uri.parse(`file://${script.filePath}`);
      const model =
        monaco.editor.getModel(filePath) ||
        monaco.editor.createModel(script.code, "typescript", filePath);

      // Because anything else is blasphemy.
      model.updateOptions({ tabSize: 2 });
      return {
        model,
      };
    },
    [script],
  );

  const saveCode = React.useCallback(async () => {
    const model = editorRef.current && editorRef.current.getModel();
    if (model && script && !script.readOnly) {
      // We have to use a ref for autoFormatOnSaveRef because of how monaco scopes the action callbacks
      if (autoFormatOnSaveRef.current) {
        await editorRef.current.getAction("editor.action.formatDocument").run();
      }
      save(model.getValue());
    }
  }, [save, script]);

  const didMount = React.useCallback(
    (editor) => {
      editorRef.current = editor;
      editor.addAction({
        id: "ctrl-s",
        label: "Save current node",
        keybindings: [monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.KEY_S],
        run: saveCode,
      });
    },
    [saveCode],
  );

  const onChange = React.useCallback((srcCode: string) => setScriptCode(srcCode), [setScriptCode]);

  if (!script) {
    // No script to load
    return ReactNull;
  }

  return (
    <MonacoEditor
      key={resizeKey}
      language="typescript"
      theme={VS_WEBVIZ_THEME}
      editorWillMount={willMount}
      editorDidMount={didMount}
      options={options as any}
      onChange={onChange}
    />
  );
};

export default Editor;
