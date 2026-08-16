const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo support: watch the workspace root so Metro can resolve the
// `@lablens/*` workspace packages (which expose TypeScript sources).
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules")
];

// Allow bundling raw OCR model assets (.ort) and dictionaries (.txt).
config.resolver.assetExts = [
  ...config.resolver.assetExts.filter((ext) => ext !== "txt"),
  "ort",
  "txt"
];

module.exports = config;
