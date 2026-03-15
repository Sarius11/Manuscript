type ProcessShim = {
  env: Record<string, string | undefined>;
};

const processHolder = globalThis as {
  process?: ProcessShim;
};

if (!processHolder.process) {
  processHolder.process = { env: {} };
}

processHolder.process.env.NODE_ENV ??= import.meta.env.MODE;
processHolder.process.env.TAMAGUI_TARGET ??= "web";
