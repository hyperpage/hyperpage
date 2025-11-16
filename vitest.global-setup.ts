import { readFileSync } from "fs";
import { join } from "path";

export default function globalSetup() {
  // Load .env.test for test environment
  try {
    const envPath = join(process.cwd(), ".env.test");
    const envContent = readFileSync(envPath, "utf8");

    // Parse the .env file content
    const lines = envContent.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").replace(/^["']|["']$/g, ""); // Remove quotes
          process.env[key] = value;
        }
      }
    }
  } catch (error) {
    console.error("[globalSetup] Failed to load .env.test:", error);
  }
}
