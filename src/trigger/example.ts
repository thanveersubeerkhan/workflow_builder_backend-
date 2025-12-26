import { task } from "@trigger.dev/sdk/v3";

export const helloWorldTask = task({
  id: "hello-world",
  // Set an optional maxDuration for this specific task
  run: async (payload: { name: string }) => {
    console.log(`Hello, ${payload.name}!`);
    return {
      message: `Hello, ${payload.name}!`,
    };
  },
});
