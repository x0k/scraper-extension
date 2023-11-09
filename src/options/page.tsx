import { useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { monaco } from "@/lib/monaco";
import { Editor } from "@/components/editor";
import {
  Tab,
  evalForTab,
  getAllTabs,
  loadSyncSettings,
  saveSyncSettings,
} from "@/shared/extension";

import { SendForm } from "./send-form";
import { TabsSelector } from "./tabs-selector";
import { enqueueSnackbar } from "notistack";
import { stringifyError } from "@/lib/error";

const configModel = monaco.editor.createModel("", "yaml");

async function runEvalForTab(tab: Tab | null, { arg }: { arg: string }) {
  if (!tab) {
    throw new Error("Tab not selected");
  }
  return evalForTab(tab.id, arg);
}

async function saveConfig(_: string, { arg }: { arg: string }) {
  await saveSyncSettings({ config: arg });
}

function showError(err: unknown) {
  enqueueSnackbar({
    variant: "error",
    message: stringifyError(err),
  });
}

export function Page() {
  const tabs = useSWR("tabs", getAllTabs);
  const [selectedTab, selectTab] = useState<Tab | null>(null);
  const evalMutation = useSWRMutation(selectedTab, runEvalForTab, {});
  useSWR("settings/sync", loadSyncSettings, {
    onSuccess({ config }) {
      configModel.setValue(config);
    },
    onError: showError,
  });
  const configMutation = useSWRMutation("settings/sync", saveConfig, {
    onError: showError,
  });
  return (
    <Box p={2} height="100vh" display="flex" flexDirection="column" gap={2}>
      <Box display="flex" flexDirection="row" gap={2} alignItems="center">
        <Typography variant="h6" flexGrow={1}>
          Scraper
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          size="small"
          onClick={() => {
            evalMutation.trigger(configModel.getValue());
          }}
          disabled={evalMutation.isMutating || !selectedTab}
        >
          Test
        </Button>
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={() => {
            configMutation.trigger(configModel.getValue());
          }}
        >
          Save
        </Button>
      </Box>
      <Box
        flexGrow={1}
        display="grid"
        gridTemplateColumns="1fr 1fr"
        gridTemplateRows="auto 1fr"
        overflow={"hidden"}
        gap={2}
      >
        <Box gridRow="1 / 3" display="flex" flexDirection="column" gap={2}>
          <Editor model={configModel} />
        </Box>
        <TabsSelector
          tabs={tabs}
          selectedTab={selectedTab}
          onSelect={selectTab}
        />
        <SendForm result={evalMutation} />
      </Box>
    </Box>
  );
}
