const DEFAULT_ENV_FILE = ".env.dev";
const NODE_ENV_FALLBACKS: Record<string, string> = {
  production: ".env.production",
  staging: ".env.staging",
  test: ".env.test",
};

function getNodeEnvFallback(): string {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  if (!nodeEnv) {
    return DEFAULT_ENV_FILE;
  }
  return NODE_ENV_FALLBACKS[nodeEnv] ?? DEFAULT_ENV_FILE;
}

export function getEnvFileName(options?: {
  scope?: "server" | "client";
}): string {
  const scope = options?.scope ?? "client";

  if (scope === "server") {
    return (
      process.env.CONFIG_ENV_FILE ||
      process.env.NEXT_PUBLIC_ENV_FILE ||
      getNodeEnvFallback()
    );
  }

  return process.env.NEXT_PUBLIC_ENV_FILE || getNodeEnvFallback();
}
