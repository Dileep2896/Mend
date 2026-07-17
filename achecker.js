// IBM Equal Access (accessibility-checker) config — gate 4.
// Independent rule engine (NOT axe, NOT Lighthouse). We count `violation`-level
// results and require them non-increasing across a fix round.
module.exports = {
  ruleArchive: "latest",
  policies: ["IBM_Accessibility"],
  failLevels: ["violation"],
  reportLevels: ["violation", "potentialviolation"],
  outputFolder: "runs/engine2-report",
  outputFormat: ["json"],
  outputFilenameTimestamp: false,
  runOptions: { captureScreenshots: false },
};
