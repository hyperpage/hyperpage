import fs from "fs";
import path from "path";

import dotenv from "dotenv";

import { getEnvFileName } from "@/lib/config/env-file";

const globalEnvState = globalThis as typeof globalThis & {
  __HYPERPAGE_ENV_LOADED__?: boolean;
};

if (!globalEnvState.__HYPERPAGE_ENV_LOADED__) {
  const envFileName = getEnvFileName({ scope: "server" });
  const envPath = path.isAbsolute(envFileName)
    ? envFileName
    : path.join(process.cwd(), envFileName);

  if (fs.existsSync(envPath)) {
    dotenv.config({
      path: envPath,
      override: false,
    });
  }

  globalEnvState.__HYPERPAGE_ENV_LOADED__ = true;
}
