import { MutableRefObject, useMemo } from "react";
import { Root } from "react-dom/client";
import { IChangeEvent } from "@rjsf/core";
import { ValidationData } from "@rjsf/utils";
import { Box, Button } from "@mui/material";

import { AsyncFactory, Factory } from "@/lib/factory";
import { ContextActor } from "@/lib/actors/context";
import { makeActorLogic } from "@/lib/actor";
import { stringifyError } from "@/lib/error";
import { noop } from "@/lib/function";
import { Form, FormDataValidatorData } from "@/components/form";
import { monaco } from "@/lib/monaco";
import { stringify } from "yaml";

import { getAllTabs } from "./core";
import {
  ExtensionAction,
  ExtensionActionResults,
  ExtensionActionType,
} from "./action";
import { RootFactory } from "./root-factory";

export function useRootFactory<E extends HTMLElement>(
  rootRef: MutableRefObject<E | null>
): Factory<void, Root> {
  return useMemo(() => new RootFactory(rootRef), []);
}

export function useContextActor<E extends HTMLElement>(
  contextId: string,
  rootRef: MutableRefObject<E | null>,
  asyncValidator: AsyncFactory<
    FormDataValidatorData<unknown>,
    ValidationData<unknown>
  >,
  logsModel: monaco.editor.ITextModel
) {
  const rootFactory = useRootFactory(rootRef);
  return useMemo(
    () =>
      new ContextActor<ExtensionAction, ExtensionActionResults, string>(
        contextId,
        makeActorLogic(
          {
            [ExtensionActionType.AppendLog]: ({ log }) => {
              // TODO: Use editor and fold log
              const lc = logsModel.getLineCount();
              logsModel.applyEdits([
                {
                  range: {
                    startLineNumber: lc,
                    endLineNumber: lc,
                    startColumn: 1,
                    endColumn: 1,
                  },
                  text: `---\n${stringify({
                    [new Date().toISOString()]: log,
                  })}`,
                },
              ]);
            },
            [ExtensionActionType.ShowFrom]: async ({
              schema,
              uiSchema,
              data,
              omitExtraData,
            }) => {
              const root = rootFactory.Create();
              try {
                return await new Promise((resolve, reject) => {
                  function handleSubmit({ formData }: IChangeEvent<unknown>) {
                    resolve(formData);
                  }
                  function handleCancel() {
                    reject(new Error("Form cancelled"));
                  }
                  root.render(
                    <Form
                      schema={schema}
                      uiSchema={uiSchema}
                      formData={data}
                      omitExtraData={omitExtraData}
                      onSubmit={handleSubmit}
                      asyncValidator={asyncValidator}
                    >
                      <Box
                        display="flex"
                        flexDirection="row"
                        gap={2}
                        alignItems="center"
                        p={2}
                      >
                        <Button
                          fullWidth
                          variant="contained"
                          color="secondary"
                          size="small"
                          onClick={handleCancel}
                        >
                          Cancel
                        </Button>
                        <Button
                          fullWidth
                          type="submit"
                          variant="contained"
                          color="primary"
                          size="small"
                        >
                          Save
                        </Button>
                      </Box>
                    </Form>
                  );
                });
              } finally {
                root.unmount();
              }
            },
          },
          stringifyError
        ),
        {
          async sendMessage(message, tabId) {
            if (tabId) {
              chrome.tabs.sendMessage(tabId, message);
              return;
            }
            chrome.runtime.sendMessage(message).catch(noop);
            // TODO: Is it really needed?
            const tabs = await getAllTabs();
            for (const tab of tabs) {
              chrome.tabs.sendMessage(tab.id, message).catch(noop);
            }
          },
        }
      ),
    [contextId, rootFactory, asyncValidator, logsModel]
  );
}
