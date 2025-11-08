import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import pino from "pino";

// Initialize pino logger
const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
    },
  },
});

// Configuration for path aliases
const pathConfig = {
  "@/lib": "lib",
  "@/app": "app",
  "@/components": "components",
  "@/tools": "tools",
};

// Function to convert relative path to absolute path
function convertRelativeToAbsolute(relativePath, filePath) {
  const fileDir = path.dirname(filePath);
  const absolutePath = path.resolve(fileDir, relativePath);

  // Determine which alias to use based on the resolved path
  for (const [alias, dir] of Object.entries(pathConfig)) {
    if (absolutePath.startsWith(path.resolve(process.cwd(), dir))) {
      const relativeToAlias = path.relative(
        path.resolve(process.cwd(), dir),
        absolutePath,
      );
      return `${alias}/${relativeToAlias}`.replace(/\\/g, "/");
    }
  }

  // Default to lib if no match
  const relativeToLib = path.relative(
    path.resolve(process.cwd(), "lib"),
    absolutePath,
  );
  return `@/lib/${relativeToLib}`.replace(/\\/g, "/");
}

// Function to process a single file
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    let modifiedContent = content;
    let changesMade = 0;

    // Regular expressions for different import patterns
    const importPatterns = [
      // Named imports from parent directories
      /import\s+{([^}]+)}\s+from\s+['"](\.\.\/[^'"]*)['"]/g,
      // Default imports from parent directories
      /import\s+(\w+)\s+from\s+['"](\.\.\/[^'"]*)['"]/g,
      // Mixed imports from parent directories
      /import\s+([^,]+),\s*{([^}]+)}\s+from\s+['"](\.\.\/[^'"]*)['"]/g,
      // Named imports from same directory
      /import\s+{([^}]+)}\s+from\s+['"](\.\/[^'"]*)['"]/g,
      // Default imports from same directory
      /import\s+(\w+)\s+from\s+['"](\.\/[^'"]*)['"]/g,
      // Mixed imports from same directory
      /import\s+([^,]+),\s*{([^}]+)}\s+from\s+['"](\.\/[^'"]*)['"]/g,
    ];

    importPatterns.forEach((pattern) => {
      modifiedContent = modifiedContent.replace(pattern, (match, ...args) => {
        let imports, relativePath, aliasPath;

        if (args.length === 3) {
          // Mixed import case
          [imports, aliasPath, relativePath] = args;
        } else {
          // Named or default import case
          [imports, relativePath] = args;
        }

        const newPath = convertRelativeToAbsolute(relativePath, filePath);
        changesMade++;

        if (args.length === 3) {
          return `import ${imports}, {${aliasPath}} from '${newPath}'`;
        } else {
          return `import {${imports}} from '${newPath}'`;
        }
      });
    });

    if (changesMade > 0) {
      fs.writeFileSync(filePath, modifiedContent);
      return changesMade;
    }

    return 0;
  } catch (error) {
    logger.error({ err: error, file: filePath }, "Error processing file");
    return 0;
  }
}

// Main execution
function main() {
  logger.info("🔧 Starting comprehensive relative import conversion...");

  // Create backup
  const backupDir = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  logger.info({ backupDir }, "Creating backup directory");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Copy files to backup
  function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        if (
          ![
            "node_modules",
            ".git",
            "backup-*",
            ".next",
            "dist",
            "build",
            "scripts",
          ].includes(entry.name) &&
          !entry.name.startsWith("backup-")
        ) {
          fs.mkdirSync(destPath, { recursive: true });
          copyDir(srcPath, destPath);
        }
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".ts") ||
          entry.name.endsWith(".tsx") ||
          entry.name.endsWith(".js") ||
          entry.name.endsWith(".jsx"))
      ) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  copyDir(".", backupDir);

  let totalChanges = 0;
  const filesProcessed = [];

  // Find and process all TypeScript/JavaScript files
  function findFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(process.cwd(), fullPath);

      if (entry.isDirectory()) {
        if (
          ![
            "node_modules",
            ".git",
            "backup-",
            ".next",
            "dist",
            "build",
            "scripts",
          ].includes(entry.name)
        ) {
          findFiles(fullPath);
        }
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".ts") ||
          entry.name.endsWith(".tsx") ||
          entry.name.endsWith(".js") ||
          entry.name.endsWith(".jsx"))
      ) {
        // Skip script files to prevent recursive modification
        if (relativePath.startsWith("scripts/")) {
          continue;
        }

        const changes = processFile(fullPath);
        if (changes > 0) {
          totalChanges += changes;
          filesProcessed.push(fullPath);
          logger.info(
            { changes, file: fullPath },
            "✅ Converted imports in file",
          );
        }
      }
    }
  }

  findFiles(".");

  logger.info(
    { totalChanges, filesProcessed: filesProcessed.length },
    "📊 Conversion complete!",
  );

  if (filesProcessed.length > 0) {
    logger.info("Processed files:", filesProcessed);
  }

  logger.info("🧪 Testing TypeScript compilation...");

  try {
    execSync("npx tsc --noEmit", { stdio: "inherit" });
    logger.info("✅ TypeScript compilation successful after import conversion");
    logger.info(
      "🎉 All relative imports have been successfully converted to path aliases!",
    );
    logger.info({ backupDir }, "📁 Backup created successfully");
  } catch (error) {
    logger.error(
      { err: error, backupDir },
      "❌ TypeScript compilation failed. Check changes.",
    );
    logger.info({ backupDir }, "You can restore from backup");
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { processFile, convertRelativeToAbsolute };
