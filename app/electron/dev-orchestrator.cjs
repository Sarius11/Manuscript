const net = require("node:net");
const { spawn } = require("node:child_process");

const DEFAULT_PORT = 5173;
const MAX_PORT_ATTEMPTS = 50;

function parsePort(value) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 65535) {
    return null;
  }

  return parsed;
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "127.0.0.1");
  });
}

async function resolveDevPort() {
  const requestedPort = parsePort(process.env.VITE_DEV_SERVER_PORT);
  if (requestedPort !== null) {
    return requestedPort;
  }

  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
    const candidate = DEFAULT_PORT + offset;
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to find a free development port between ${DEFAULT_PORT} and ${
      DEFAULT_PORT + MAX_PORT_ATTEMPTS - 1
    }.`
  );
}

async function main() {
  const devPort = await resolveDevPort();
  const appRoot = process.cwd();
  const devUrl = `http://127.0.0.1:${devPort}`;

  console.log(`[atramentum] using renderer dev server ${devUrl}`);

  const child = spawn("npm run dev:internal", {
    cwd: appRoot,
    env: {
      ...process.env,
      VITE_DEV_SERVER_PORT: String(devPort),
      VITE_DEV_SERVER_URL: devUrl
    },
    stdio: "inherit",
    shell: true
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

