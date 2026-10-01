#!/usr/bin/env node

import {
  GitHubSetupProbe,
  NodeCommandRunner,
  RepositorySetupTarget,
  buildSetupPreview,
  discoverSetup,
  loadSetupManifest,
  packageName,
  packageVersion,
  reconcileSetup,
} from "./index.js";

const [command] = process.argv.slice(2);

if (command === "--version" || command === "-V") {
  console.log(packageVersion);
} else if (command === "setup-preview") {
  const discovery = await discoverSetup(
    new GitHubSetupProbe(new NodeCommandRunner(), process.cwd()),
  );
  console.log(JSON.stringify(buildSetupPreview(discovery), null, 2));
} else if (command === "setup-apply" && process.argv.includes("--confirm")) {
  const root = process.cwd();
  const runner = new NodeCommandRunner();
  const result = await reconcileSetup(
    new RepositorySetupTarget(runner, root),
    await loadSetupManifest(root),
    true,
  );
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`${packageName} ${packageVersion}`);
}