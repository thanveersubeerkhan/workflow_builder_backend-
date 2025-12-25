import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_beagybtiodxykfcukrju",
  runtime: "node",
  logLevel: "log",
  // The default maximum duration for a task run in seconds
  maxDuration: 3600, 
  // The directory where your tasks are located
  dirs: ["src/trigger"],
});
