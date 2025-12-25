# Tasks: Overview

> Tasks are functions that can run for a long time and provide strong resilience to failure.

There are different types of tasks including regular tasks and [scheduled tasks](/tasks/scheduled).

## Hello world task and how to trigger it

Here's an incredibly simple task:

```ts /trigger/hello-world.ts theme={null}
import { task } from "@trigger.dev/sdk";

const helloWorld = task({
  //1. Use a unique id for each task
  id: "hello-world",
  //2. The run function is the main function of the task
  run: async (payload: { message: string }) => {
    //3. You can write code that runs for a long time here, there are no timeouts
    console.log(payload.message);
  },
});
```

You can trigger this in two ways:

1. From the dashboard [using the "Test" feature](/run-tests).
2. Trigger it from your backend code. See the [full triggering guide here](/triggering).

Here's how to trigger a single run from elsewhere in your code:

```ts Your backend code theme={null}
import { helloWorld } from "./trigger/hello-world";

async function triggerHelloWorld() {
  //This triggers the task and returns a handle
  const handle = await helloWorld.trigger({ message: "Hello world!" });

  //You can use the handle to check the status of the task, cancel and retry it.
  console.log("Task is running with handle", handle.id);
}
```

You can also [trigger a task from another task](/triggering), and wait for the result.

## Defining a `task`

The task function takes an object with the following fields.

### The `id` field

This is used to identify your task so it can be triggered, managed, and you can view runs in the dashboard. This must be unique in your project – we recommend making it descriptive and unique.

### The `run` function

Your custom code inside `run()` will be executed when your task is triggered. It’s an async function that has two arguments:

1. The run payload - the data that you pass to the task when you trigger it.
2. An object with `ctx` about the run (Context), and any output from the optional `init` function that runs before every run attempt.

Anything you return from the `run` function will be the result of the task. Data you return must be JSON serializable: strings, numbers, booleans, arrays, objects, and null.

### `retry` options

A task is retried if an error is thrown, by default we retry 3 times.

You can set the number of retries and the delay between retries in the `retry` field:

```ts /trigger/retry.ts theme={null}
export const taskWithRetries = task({
  id: "task-with-retries",
  retry: {
    maxAttempts: 10,
    factor: 1.8,
    minTimeoutInMs: 500,
    maxTimeoutInMs: 30_000,
    randomize: false,
  },
  run: async (payload: any, { ctx }) => {
    //...
  },
});
```

For more information read [the retrying guide](/errors-retrying).

It's also worth mentioning that you can [retry a block of code](/errors-retrying) inside your tasks as well.

### `queue` options

Queues allow you to control the concurrency of your tasks. This allows you to have one-at-a-time execution and parallel executions. There are also more advanced techniques like having different concurrencies for different sets of your users. For more information read [the concurrency & queues guide](/queue-concurrency).

```ts /trigger/one-at-a-time.ts theme={null}
export const oneAtATime = task({
  id: "one-at-a-time",
  queue: {
    concurrencyLimit: 1,
  },
  run: async (payload: any, { ctx }) => {
    //...
  },
});
```

### `machine` options

Some tasks require more vCPUs or GBs of RAM. You can specify these requirements in the `machine` field. For more information read [the machines guide](/machines).

```ts /trigger/heavy-task.ts theme={null}
export const heavyTask = task({
  id: "heavy-task",
  machine: {
    preset: "large-1x", // 4 vCPU, 8 GB RAM
  },
  run: async (payload: any, { ctx }) => {
    //...
  },
});
```

### `maxDuration` option

By default tasks can execute indefinitely, which can be great! But you also might want to set a `maxDuration` to prevent a task from running too long. You can set the `maxDuration` on a task, and all runs of that task will be stopped if they exceed the duration.

```ts /trigger/long-task.ts theme={null}
export const longTask = task({
  id: "long-task",
  maxDuration: 300, // 300 seconds or 5 minutes
  run: async (payload: any, { ctx }) => {
    //...
  },
});
```

See our [maxDuration guide](/runs/max-duration) for more information.

## Global lifecycle hooks

<Note>When specifying global lifecycle hooks, we recommend using the `init.ts` file.</Note>

You can register global lifecycle hooks that are executed for all runs, regardless of the task. While you can still define these in the `trigger.config.ts` file, you can also register them anywhere in your codebase:

```ts  theme={null}
import { tasks } from "@trigger.dev/sdk";

tasks.onStart(({ ctx, payload, task }) => {
  console.log("Run started", ctx.run);
});

tasks.onSuccess(({ ctx, output }) => {
  console.log("Run finished", ctx.run);
});

tasks.onFailure(({ ctx, error }) => {
  console.log("Run failed", ctx.run);
});
```

### `init.ts`

If you create a `init.ts` file at the root of your trigger directory, it will be automatically loaded when a task is executed. This is useful if you want to register global lifecycle hooks, or initialize a database connection, etc.

```ts init.ts theme={null}
import { tasks } from "@trigger.dev/sdk";

tasks.onStart(({ ctx, payload, task }) => {
  console.log("Run started", ctx.run);
});
```

## Lifecycle functions

<img src="https://mintcdn.com/trigger/GRVvL72gYSoZFvP1/images/lifecycle-functions.png?fit=max&auto=format&n=GRVvL72gYSoZFvP1&q=85&s=6196168935d136c5440fea7793918591" alt="Lifecycle functions" data-og-width="1428" width="1428" data-og-height="1239" height="1239" data-path="images/lifecycle-functions.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/trigger/GRVvL72gYSoZFvP1/images/lifecycle-functions.png?w=280&fit=max&auto=format&n=GRVvL72gYSoZFvP1&q=85&s=6ecf6b07768a33e17d335136564ccd54 280w, https://mintcdn.com/trigger/GRVvL72gYSoZFvP1/images/lifecycle-functions.png?w=560&fit=max&auto=format&n=GRVvL72gYSoZFvP1&q=85&s=80ed26958dfbbde07cb48612c37f0bc6 560w, https://mintcdn.com/trigger/GRVvL72gYSoZFvP1/images/lifecycle-functions.png?w=840&fit=max&auto=format&n=GRVvL72gYSoZFvP1&q=85&s=32495b4b321f9f790a4e6b3bfb99e550 840w, https://mintcdn.com/trigger/GRVvL72gYSoZFvP1/images/lifecycle-functions.png?w=1100&fit=max&auto=format&n=GRVvL72gYSoZFvP1&q=85&s=bb3d9791a3052a6c82ce6fc6c8194cdb 1100w, https://mintcdn.com/trigger/GRVvL72gYSoZFvP1/images/lifecycle-functions.png?w=1650&fit=max&auto=format&n=GRVvL72gYSoZFvP1&q=85&s=15e76db685781a56fe68c8e787a593b6 1650w, https://mintcdn.com/trigger/GRVvL72gYSoZFvP1/images/lifecycle-functions.png?w=2500&fit=max&auto=format&n=GRVvL72gYSoZFvP1&q=85&s=123bad89f02dae694d741c0ad186de64 2500w" />

### `middleware` and `locals` functions

Our task middleware system runs at the top level, executing before and after all lifecycle hooks. This allows you to wrap the entire task execution lifecycle with custom logic.

<Info>
  An error thrown in `middleware` is just like an uncaught error in the run function: it will
  propagate through to `catchError()` function and then will fail the attempt (either causing a
  retry or failing the run).
</Info>

The `locals` API allows you to share data between middleware and hooks.

```ts db.ts theme={null}
import { locals } from "@trigger.dev/sdk";
import { logger, tasks } from "@trigger.dev/sdk";

// This would be type of your database client here
const DbLocal = locals.create<{ connect: () => Promise<void>; disconnect: () => Promise<void> }>(
  "db"
);

export function getDb() {
  return locals.getOrThrow(DbLocal);
}

export function setDb(db: { connect: () => Promise<void> }) {
  locals.set(DbLocal, db);
}

tasks.middleware("db", async ({ ctx, payload, next, task }) => {
  // This would be your database client here
  const db = locals.set(DbLocal, {
    connect: async () => {
      logger.info("Connecting to the database");
    },
    disconnect: async () => {
      logger.info("Disconnecting from the database");
    },
  });

  await db.connect();

  await next();

  await db.disconnect();
});

// Disconnect when the run is paused
tasks.onWait("db", async ({ ctx, payload, task }) => {
  const db = getDb();
  await db.disconnect();
});

// Reconnect when the run is resumed
tasks.onResume("db", async ({ ctx, payload, task }) => {
  const db = getDb();
  await db.connect();
});
```

You can access the database client using `getDb()` in your tasks `run` function and all your hooks (global or task specific):

```ts  theme={null}
import { getDb } from "./db";

export const myTask = task({
  run: async (payload: any, { ctx }) => {
    const db = getDb();
    await db.query("SELECT 1");
  },
});
```

### `onStartAttempt` function

<Info>The `onStartAttempt` function was introduced in v4.1.0</Info>

Before a task run attempt starts, the `onStartAttempt` function is called. It's useful for sending notifications, logging, and other side effects.

```ts /trigger/on-start.ts theme={null}
export const taskWithOnStartAttempt = task({
  id: "task-with-on-start-attempt",
  onStartAttempt: async ({ payload, ctx }) => {
    //...
  },
  run: async (payload: any, { ctx }) => {
    //...
  },
});
```

You can also define a global `onStartAttempt` function using `tasks.onStartAttempt()`.

```ts init.ts theme={null}
import { tasks } from "@trigger.dev/sdk";

tasks.onStartAttempt(({ ctx, payload, task }) => {
  console.log(
    `Run ${ctx.run.id} started on task ${task} attempt ${ctx.run.attempt.number}`,
    ctx.run
  );
});
```

<Info>Errors thrown in the `onStartAttempt` function will cause the attempt to fail.</Info>

If you want to execute code before just the first attempt, you can use the `onStartAttempt` function and check `ctx.run.attempt.number === 1`:

```ts /trigger/on-start-attempt.ts theme={null}
export const taskWithOnStartAttempt = task({
  id: "task-with-on-start-attempt",
  onStartAttempt: async ({ payload, ctx }) => {
    if (ctx.run.attempt.number === 1) {
      console.log("Run started on attempt 1", ctx.run);
    }
  },
});
```

### `onWait` and `onResume` functions

These lifecycle hooks allow you to run code when a run is paused or resumed because of a wait:

```ts  theme={null}
export const myTask = task({
  id: "my-task",
  onWait: async ({ wait }) => {
    console.log("Run paused", wait);
  },
  onResume: async ({ wait }) => {
    console.log("Run resumed", wait);
  },
  run: async (payload: any, { ctx }) => {
    console.log("Run started", ctx.run);

    await wait.for({ seconds: 10 });

    console.log("Run finished", ctx.run);
  },
});
```

You can also define global `onWait` and `onResume` functions using `tasks.onWait()` and `tasks.onResume()`:

```ts init.ts theme={null}
import { tasks } from "@trigger.dev/sdk";

tasks.onWait(({ ctx, payload, wait, task }) => {
  console.log("Run paused", ctx.run, wait);
});

tasks.onResume(({ ctx, payload, wait, task }) => {
  console.log("Run resumed", ctx.run, wait);
});
```

### `onSuccess` function

When a task run succeeds, the `onSuccess` function is called. It's useful for sending notifications, logging, syncing state to your database, or other side effects.

```ts /trigger/on-success.ts theme={null}
export const taskWithOnSuccess = task({
  id: "task-with-on-success",
  onSuccess: async ({ payload, output, ctx }) => {
    //...
  },
  run: async (payload: any, { ctx }) => {
    //...
  },
});
```

You can also define a global `onSuccess` function using `tasks.onSuccess()`.

```ts init.ts theme={null}
import { tasks } from "@trigger.dev/sdk";

tasks.onSuccess(({ ctx, payload, output }) => {
  console.log("Task succeeded", ctx.task.id);
});
```

<Info>
  Errors thrown in the `onSuccess` function will be ignored, but you will still be able to see them
  in the dashboard.
</Info>

### `onComplete` function

This hook is executed when a run completes, regardless of whether it succeeded or failed:

```ts /trigger/on-complete.ts theme={null}
export const taskWithOnComplete = task({
  id: "task-with-on-complete",
  onComplete: async ({ payload, output, ctx }) => {
  if (result.ok) {
    console.log("Run succeeded", result.data);
  } else {
    console.log("Run failed", result.error);
  }
});
```

You can also define a global `onComplete` function using `tasks.onComplete()`.

```ts init.ts theme={null}
import { tasks } from "@trigger.dev/sdk";

tasks.onComplete(({ ctx, payload, output }) => {
  console.log("Task completed", ctx.task.id);
});
```

<Info>
  Errors thrown in the `onComplete` function will be ignored, but you will still be able to see them
  in the dashboard.
</Info>

### `onFailure` function

When a task run fails, the `onFailure` function is called. It's useful for sending notifications, logging, or other side effects. It will only be executed once the task run has exhausted all its retries.

```ts /trigger/on-failure.ts theme={null}
export const taskWithOnFailure = task({
  id: "task-with-on-failure",
  onFailure: async ({ payload, error, ctx }) => {
    //...
  },
  run: async (payload: any, { ctx }) => {
    //...
  },
});
```

You can also define a global `onFailure` function using `tasks.onFailure()`.

```ts init.ts theme={null}
import { tasks } from "@trigger.dev/sdk";

tasks.onFailure(({ ctx, payload, error }) => {
  console.log("Task failed", ctx.task.id);
});
```

<Info>
  Errors thrown in the `onFailure` function will be ignored, but you will still be able to see them
  in the dashboard.
</Info>

<Note>
  `onFailure` doesn’t fire for some of the run statuses like `Crashed`, `System failures`, and
  `Canceled`.
</Note>

### `catchError` functions

You can define a function that will be called when an error is thrown in the `run` function, that allows you to control how the error is handled and whether the task should be retried.

Read more about `catchError` in our [Errors and Retrying guide](/errors-retrying).

<Info>Uncaught errors will throw a special internal error of the type `HANDLE_ERROR_ERROR`.</Info>

### `onCancel` function

You can define an `onCancel` hook that is called when a run is cancelled. This is useful if you want to clean up any resources that were allocated for the run.

```ts  theme={null}
tasks.onCancel(({ ctx, signal }) => {
  console.log("Run cancelled", signal);
});
```

You can use the `onCancel` hook along with the `signal` passed into the run function to interrupt a call to an external service, for example using the [streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) function from the AI SDK:

```ts  theme={null}
import { logger, tasks, schemaTask } from "@trigger.dev/sdk";
import { streamText } from "ai";
import { z } from "zod";

export const interruptibleChat = schemaTask({
  id: "interruptible-chat",
  description: "Chat with the AI",
  schema: z.object({
    prompt: z.string().describe("The prompt to chat with the AI"),
  }),
  run: async ({ prompt }, { signal }) => {
    const chunks: TextStreamPart<{}>[] = [];

    // 👇 This is a global onCancel hook, but it's inside of the run function
    tasks.onCancel(async () => {
      // We have access to the chunks here, and can save them to the database
      await saveChunksToDatabase(chunks);
    });

    try {
      const result = streamText({
        model: getModel(),
        prompt,
        experimental_telemetry: {
          isEnabled: true,
        },
        tools: {},
        abortSignal: signal, // 👈 Pass the signal to the streamText function, which aborts with the run is cancelled
        onChunk: ({ chunk }) => {
          chunks.push(chunk);
        },
      });

      const textParts = [];

      for await (const part of result.textStream) {
        textParts.push(part);
      }

      return textParts.join("");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // streamText will throw an AbortError if the signal is aborted, so we can handle it here
      } else {
        throw error;
      }
    }
  },
});
```

The `onCancel` hook can optionally wait for the `run` function to finish, and access the output of the run:

```ts  theme={null}
import { logger, task } from "@trigger.dev/sdk";
import { setTimeout } from "node:timers/promises";

export const cancelExampleTask = task({
  id: "cancel-example",
  // Signal will be aborted when the task is cancelled 👇
  run: async (payload: { message: string }, { signal }) => {
    try {
      // We pass the signal to setTimeout to abort the timeout if the task is cancelled
      await setTimeout(10_000, undefined, { signal });
    } catch (error) {
      // Ignore the abort error
    }

    // Do some more work here

    return {
      message: "Hello, world!",
    };
  },
  onCancel: async ({ runPromise }) => {
    // You can await the runPromise to get the output of the task
    const output = await runPromise;
  },
});
```

<Note>
  You will have up to 30 seconds to complete the `runPromise` in the `onCancel` hook. After that
  point the process will be killed.
</Note>

### `onStart` function (deprecated)

<Info>The `onStart` function was deprecated in v4.1.0. Use `onStartAttempt` instead.</Info>

When a task run starts, the `onStart` function is called. It's useful for sending notifications, logging, and other side effects.

<Warning>
  This function will only be called once per run (not per attempt). If you want to run code before
  each attempt, use a middleware function or the `onStartAttempt` function.
</Warning>

```ts /trigger/on-start.ts theme={null}
export const taskWithOnStart = task({
  id: "task-with-on-start",
  onStart: async ({ payload, ctx }) => {
    //...
  },
  run: async (payload: any, { ctx }) => {
    //...
  },
});
```

You can also define a global `onStart` function using `tasks.onStart()`.

```ts init.ts theme={null}
import { tasks } from "@trigger.dev/sdk";

tasks.onStart(({ ctx, payload, task }) => {
  console.log(`Run ${ctx.run.id} started on task ${task}`, ctx.run);
});
```

<Info>Errors thrown in the `onStart` function will cause the attempt to fail.</Info>

### `init` function (deprecated)

<Warning>
  The `init` hook is deprecated and will be removed in the future. Use
  [middleware](/tasks/overview#middleware-and-locals-functions) instead.
</Warning>

This function is called before a run attempt:

```ts /trigger/init.ts theme={null}
export const taskWithInit = task({
  id: "task-with-init",
  init: async ({ payload, ctx }) => {
    //...
  },
  run: async (payload: any, { ctx }) => {
    //...
  },
});
```

You can also return data from the `init` function that will be available in the params of the `run`, `cleanup`, `onSuccess`, and `onFailure` functions.

```ts /trigger/init-return.ts theme={null}
export const taskWithInitReturn = task({
  id: "task-with-init-return",
  init: async ({ payload, ctx }) => {
    return { someData: "someValue" };
  },
  run: async (payload: any, { ctx, init }) => {
    console.log(init.someData); // "someValue"
  },
});
```

<Info>Errors thrown in the `init` function will cause the attempt to fail.</Info>

### `cleanup` function (deprecated)

<Warning>
  The `cleanup` hook is deprecated and will be removed in the future. Use
  [middleware](/tasks/overview#middleware-and-locals-functions) instead.
</Warning>

This function is called after the `run` function is executed, regardless of whether the run was successful or not. It's useful for cleaning up resources, logging, or other side effects.

```ts /trigger/cleanup.ts theme={null}
export const taskWithCleanup = task({
  id: "task-with-cleanup",
  cleanup: async ({ payload, ctx }) => {
    //...
  },
  run: async (payload: any, { ctx }) => {
    //...
  },
});
```

<Info>Errors thrown in the `cleanup` function will cause the attempt to fail.</Info>

## Next steps

<CardGroup>
  <Card title="Triggering" icon="bolt" href="/triggering">
    Learn how to trigger your tasks from your code.
  </Card>

  <Card title="Writing tasks" icon="wand-magic-sparkles" href="/writing-tasks-introduction">
    Tasks are the core of Trigger.dev. Learn how to write them.
  </Card>
</CardGroup>


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://trigger.dev/docs/llms.txt
# schemaTask

> Define tasks with a runtime payload schema and validate the payload before running the task.

The `schemaTask` function allows you to define a task with a runtime payload schema. This schema is used to validate the payload before running the task or when triggering a task directly. If the payload does not match the schema, the task will not execute.

## Usage

```ts  theme={null}
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

const myTask = schemaTask({
  id: "my-task",
  schema: z.object({
    name: z.string(),
    age: z.number(),
  }),
  run: async (payload) => {
    console.log(payload.name, payload.age);
  },
});
```

`schemaTask` takes all the same options as [task](/tasks/overview), with the addition of a `schema` field. The `schema` field is a schema parser function from a schema library or or a custom parser function.

<Note>
  We will probably eventually combine `task` and `schemaTask` into a single function, but because
  that would be a breaking change, we are keeping them separate for now.
</Note>

When you trigger the task directly, the payload will be validated against the schema before the [run](/runs) is created:

```ts  theme={null}
import { tasks } from "@trigger.dev/sdk";
import { myTask } from "./trigger/myTasks";

// This will call the schema parser function and validate the payload
await myTask.trigger({ name: "Alice", age: "oops" }); // this will throw an error

// This will NOT call the schema parser function
await tasks.trigger<typeof myTask>("my-task", { name: "Alice", age: "oops" }); // this will not throw an error
```

The error thrown when the payload does not match the schema will be the same as the error thrown by the schema parser function. For example, if you are using Zod, the error will be a `ZodError`.

We will also validate the payload every time before the task is run, so you can be sure that the payload is always valid. In the example above, the task would fail with a `TaskPayloadParsedError` error and skip retrying if the payload does not match the schema.

## Input/output schemas

Certain schema libraries, like Zod, split their type inference into "schema in" and "schema out". This means that you can define a single schema that will produce different types when triggering the task and when running the task. For example, you can define a schema that has a default value for a field, or a string coerced into a date:

```ts  theme={null}
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

const myTask = schemaTask({
  id: "my-task",
  schema: z.object({
    name: z.string().default("John"),
    age: z.number(),
    dob: z.coerce.date(),
  }),
  run: async (payload) => {
    console.log(payload.name, payload.age);
  },
});
```

In this case, the trigger payload type is `{ name?: string, age: number; dob: string }`, but the run payload type is `{ name: string, age: number; dob: Date }`. So you can trigger the task with a payload like this:

```ts  theme={null}
await myTask.trigger({ age: 30, dob: "2020-01-01" }); // this is valid
await myTask.trigger({ name: "Alice", age: 30, dob: "2020-01-01" }); // this is also valid
```

## `ai.tool`

The `ai.tool` function allows you to create an AI tool from an existing `schemaTask` to use with the Vercel [AI SDK](https://vercel.com/docs/ai-sdk):

```ts  theme={null}
import { ai } from "@trigger.dev/sdk/ai";
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { generateText } from "ai";

const myToolTask = schemaTask({
  id: "my-tool-task",
  schema: z.object({
    foo: z.string(),
  }),
  run: async (payload: any, { ctx }) => {},
});

const myTool = ai.tool(myToolTask);

export const myAiTask = schemaTask({
  id: "my-ai-task",
  schema: z.object({
    text: z.string(),
  }),
  run: async (payload, { ctx }) => {
    const { text } = await generateText({
      prompt: payload.text,
      model: openai("gpt-4o"),
      tools: {
        myTool,
      },
    });
  },
});
```

You can also pass the `experimental_toToolResultContent` option to the `ai.tool` function to customize the content of the tool result:

```ts  theme={null}
import { openai } from "@ai-sdk/openai";
import { Sandbox } from "@e2b/code-interpreter";
import { ai } from "@trigger.dev/sdk/ai";
import { schemaTask } from "@trigger.dev/sdk";
import { generateObject } from "ai";
import { z } from "zod";

const chartTask = schemaTask({
  id: "chart",
  description: "Generate a chart using natural language",
  schema: z.object({
    input: z.string().describe("The chart to generate"),
  }),
  run: async ({ input }) => {
    const code = await generateObject({
      model: openai("gpt-4o"),
      schema: z.object({
        code: z.string().describe("The Python code to execute"),
      }),
      system: `
        You are a helpful assistant that can generate Python code to be executed in a sandbox, using matplotlib.pyplot.

        For example: 
        
        import matplotlib.pyplot as plt
        plt.plot([1, 2, 3, 4])
        plt.ylabel('some numbers')
        plt.show()
        
        Make sure the code ends with plt.show()
      `,
      prompt: input,
    });

    const sandbox = await Sandbox.create();

    const execution = await sandbox.runCode(code.object.code);

    const firstResult = execution.results[0];

    if (firstResult.png) {
      return {
        chart: firstResult.png,
      };
    } else {
      throw new Error("No chart generated");
    }
  },
});

// This is useful if you want to return an image from the tool
export const chartTool = ai.tool(chartTask, {
  experimental_toToolResultContent: (result) => {
    return [
      {
        type: "image",
        data: result.chart,
        mimeType: "image/png",
      },
    ];
  },
});
```

You can access the current tool execution options inside the task run function using the `ai.currentToolOptions()` function:

```ts  theme={null}
import { ai } from "@trigger.dev/sdk/ai";
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

const myToolTask = schemaTask({
  id: "my-tool-task",
  schema: z.object({
    foo: z.string(),
  }),
  run: async (payload, { ctx }) => {
    const toolOptions = ai.currentToolOptions();
    console.log(toolOptions);
  },
});

export const myAiTask = ai.tool(myToolTask);
```

See the [AI SDK tool execution options docs](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling#tool-execution-options) for more details on the tool execution options.

<Note>
  `ai.tool` is compatible with `schemaTask`'s defined with Zod and ArkType schemas, or any schemas
  that implement a `.toJsonSchema()` function.
</Note>

## Supported schema types

### Zod

You can use the [Zod](https://zod.dev) schema library to define your schema. The schema will be validated using Zod's `parse` function.

```ts  theme={null}
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

export const zodTask = schemaTask({
  id: "types/zod",
  schema: z.object({
    bar: z.string(),
    baz: z.string().default("foo"),
  }),
  run: async (payload) => {
    console.log(payload.bar, payload.baz);
  },
});
```

### Yup

```ts  theme={null}
import { schemaTask } from "@trigger.dev/sdk";
import * as yup from "yup";

export const yupTask = schemaTask({
  id: "types/yup",
  schema: yup.object({
    bar: yup.string().required(),
    baz: yup.string().default("foo"),
  }),
  run: async (payload) => {
    console.log(payload.bar, payload.baz);
  },
});
```

### Superstruct

```ts  theme={null}
import { schemaTask } from "@trigger.dev/sdk";
import { object, string } from "superstruct";

export const superstructTask = schemaTask({
  id: "types/superstruct",
  schema: object({
    bar: string(),
    baz: string(),
  }),
  run: async (payload) => {
    console.log(payload.bar, payload.baz);
  },
});
```

### ArkType

```ts  theme={null}
import { schemaTask } from "@trigger.dev/sdk";
import { type } from "arktype";

export const arktypeTask = schemaTask({
  id: "types/arktype",
  schema: type({
    bar: "string",
    baz: "string",
  }).assert,
  run: async (payload) => {
    console.log(payload.bar, payload.baz);
  },
});
```

### @effect/schema

```ts  theme={null}
import { schemaTask } from "@trigger.dev/sdk";
import * as Schema from "@effect/schema/Schema";

// For some funny typescript reason, you cannot pass the Schema.decodeUnknownSync directly to schemaTask
const effectSchemaParser = Schema.decodeUnknownSync(
  Schema.Struct({ bar: Schema.String, baz: Schema.String })
);

export const effectTask = schemaTask({
  id: "types/effect",
  schema: effectSchemaParser,
  run: async (payload) => {
    console.log(payload.bar, payload.baz);
  },
});
```

### runtypes

```ts  theme={null}
import { schemaTask } from "@trigger.dev/sdk";
import * as T from "runtypes";

export const runtypesTask = schemaTask({
  id: "types/runtypes",
  schema: T.Record({
    bar: T.String,
    baz: T.String,
  }),
  run: async (payload) => {
    console.log(payload.bar, payload.baz);
  },
});
```

### valibot

```ts  theme={null}
import { schemaTask } from "@trigger.dev/sdk";

import * as v from "valibot";

// For some funny typescript reason, you cannot pass the v.parser directly to schemaTask
const valibotParser = v.parser(
  v.object({
    bar: v.string(),
    baz: v.string(),
  })
);

export const valibotTask = schemaTask({
  id: "types/valibot",
  schema: valibotParser,
  run: async (payload) => {
    console.log(payload.bar, payload.baz);
  },
});
```

### typebox

```ts  theme={null}
import { schemaTask } from "@trigger.dev/sdk";
import { Type } from "@sinclair/typebox";
import { wrap } from "@typeschema/typebox";

export const typeboxTask = schemaTask({
  id: "types/typebox",
  schema: wrap(
    Type.Object({
      bar: Type.String(),
      baz: Type.String(),
    })
  ),
  run: async (payload) => {
    console.log(payload.bar, payload.baz);
  },
});
```

### Custom parser function

You can also define a custom parser function that will be called with the payload before the task is run. The parser function should return the parsed payload or throw an error if the payload is invalid.

```ts  theme={null}
import { schemaTask } from "@trigger.dev/sdk";

export const customParserTask = schemaTask({
  id: "types/custom-parser",
  schema: (data: unknown) => {
    // This is a custom parser, and should do actual parsing (not just casting)
    if (typeof data !== "object") {
      throw new Error("Invalid data");
    }

    const { bar, baz } = data as { bar: string; baz: string };

    return { bar, baz };
  },
  run: async (payload) => {
    console.log(payload.bar, payload.baz);
  },
});
```


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://trigger.dev/docs/llms.txt

# Scheduled tasks (cron)

> A task that is triggered on a recurring schedule using cron syntax.

<Note>
  Scheduled tasks are only for recurring tasks. If you want to trigger a one-off task at a future
  time, you should [use the delay option](/triggering#delay).
</Note>

## Defining a scheduled task

This task will run when any of the attached schedules trigger. They have a predefined payload with some useful properties:

```ts  theme={null}
import { schedules } from "@trigger.dev/sdk";

export const firstScheduledTask = schedules.task({
  id: "first-scheduled-task",
  run: async (payload) => {
    //when the task was scheduled to run
    //note this will be slightly different from new Date() because it takes a few ms to run the task
    console.log(payload.timestamp); //is a Date object

    //when the task was last run
    //this can be undefined if it's never been run
    console.log(payload.lastTimestamp); //is a Date object or undefined

    //the timezone the schedule was registered with, defaults to "UTC"
    //this is in IANA format, e.g. "America/New_York"
    //See the full list here: https://cloud.trigger.dev/timezones
    console.log(payload.timezone); //is a string

    //If you want to output the time in the user's timezone do this:
    const formatted = payload.timestamp.toLocaleString("en-US", {
      timeZone: payload.timezone,
    });

    //the schedule id (you can have many schedules for the same task)
    //using this you can remove the schedule, update it, etc
    console.log(payload.scheduleId); //is a string

    //you can optionally provide an external id when creating the schedule
    //usually you would set this to a userId or some other unique identifier
    //this can be undefined if you didn't provide one
    console.log(payload.externalId); //is a string or undefined

    //the next 5 dates this task is scheduled to run
    console.log(payload.upcoming); //is an array of Date objects
  },
});
```

You can see from the comments that the payload has several useful properties:

* `timestamp` - the time the task was scheduled to run, as a UTC date.
* `lastTimestamp` - the time the task was last run, as a UTC date.
* `timezone` - the timezone the schedule was registered with, defaults to "UTC". In IANA format, e.g. "America/New\_York".
* `scheduleId` - the id of the schedule that triggered the task
* `externalId` - the external id you (optionally) provided when creating the schedule
* `upcoming` - the next 5 times the task is scheduled to run

<Note>
  This task will NOT get triggered on a schedule until you attach a schedule to it. Read on for how
  to do that.
</Note>

Like all tasks they don't have timeouts, they should be placed inside a [/trigger folder](/config/config-file), and you [can configure them](/tasks/overview#defining-a-task).

## How to attach a schedule

Now that we've defined a scheduled task, we need to define when it will actually run. To do this we need to attach one or more schedules.

There are two ways of doing this:

* **Declarative:** defined on your `schedules.task`. They sync when you run the dev command or deploy.
* **Imperative:** created from the dashboard or by using the imperative SDK functions like `schedules.create()`.

<Info>
  A scheduled task can have multiple schedules attached to it, including a declarative schedule
  and/or many imperative schedules.
</Info>

### Declarative schedules

These sync when you run the [dev](/cli-dev) or [deploy](/cli-deploy) commands.

To create them you add the `cron` property to your `schedules.task()`. This property is optional and is only used if you want to add a declarative schedule to your task:

```ts  theme={null}
export const firstScheduledTask = schedules.task({
  id: "first-scheduled-task",
  //every two hours (UTC timezone)
  cron: "0 */2 * * *",
  run: async (payload, { ctx }) => {
    //do something
  },
});
```

If you use a string it will be in UTC. Alternatively, you can specify a timezone like this:

```ts  theme={null}
export const secondScheduledTask = schedules.task({
  id: "second-scheduled-task",
  cron: {
    //5am every day Tokyo time
    pattern: "0 5 * * *",
    timezone: "Asia/Tokyo",
    //optional, defaults to all environments
    //possible values are "PRODUCTION", "STAGING", "PREVIEW" and "DEVELOPMENT"
    environments: ["PRODUCTION", "STAGING"],
  },
  run: async (payload) => {},
});
```

When you run the [dev](/cli-dev) or [deploy](/cli-deploy) commands, declarative schedules will be synced. If you add, delete or edit the `cron` property it will be updated when you run these commands. You can view your schedules on the Schedules page in the dashboard.

### Imperative schedules

Alternatively you can explicitly attach schedules to a `schedules.task`. You can do this in the Schedules page in the dashboard by just pressing the "New schedule" button, or you can use the SDK to create schedules.

The advantage of imperative schedules is that they can be created dynamically, for example, you could create a schedule for each user in your database. They can also be activated, disabled, edited, and deleted without deploying new code by using the SDK or dashboard.

To use imperative schedules you need to do two things:

1. Define a task in your code using `schedules.task()`.
2. Attach 1+ schedules to the task either using the dashboard or the SDK.

## Supported cron syntax

```
*    *    *    *    *
┬    ┬    ┬    ┬    ┬
│    │    │    │    |
│    │    │    │    └ day of week (0 - 7, 1L - 7L) (0 or 7 is Sun)
│    │    │    └───── month (1 - 12)
│    │    └────────── day of month (1 - 31, L)
│    └─────────────── hour (0 - 23)
└──────────────────── minute (0 - 59)
```

"L" means the last. In the "day of week" field, 1L means the last Monday of the month. In the "day of month" field, L means the last day of the month.

We do not support seconds in the cron syntax.

## When schedules won't trigger

There are two situations when a scheduled task won't trigger:

* For Dev environments scheduled tasks will only trigger if you're running the dev CLI.
* For Staging/Production environments scheduled tasks will only trigger if the task is in the current deployment (latest version). We won't trigger tasks from previous deployments.

## Attaching schedules in the dashboard

You need to attach a schedule to a task before it will run on a schedule. You can attach static schedules in the dashboard:

<Steps>
  <Step title="Go to the Schedules page">
    In the sidebar select the "Schedules" page, then press the "New schedule" button. Or you can
    follow the onboarding and press the create in dashboard button. <img src="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-blank.png?fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=43eb999c7adffee996282649787537ac" alt="Blank schedules
    page" data-og-width="1600" width="1600" data-og-height="900" height="900" data-path="images/schedules-blank.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-blank.png?w=280&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=fe91c092419f97fabd87bc978b02ef70 280w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-blank.png?w=560&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=80f88b80434b611ce1c3d496563c6986 560w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-blank.png?w=840&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=366e55c6afcfd9a36a16d94ef5bb7453 840w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-blank.png?w=1100&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=d3cc50242dbdd1bb6f035caeb20c91c6 1100w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-blank.png?w=1650&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=8b38dec234ab37de05949645ac5bd3e6 1650w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-blank.png?w=2500&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=bc86e5670d9c0b0c85cb3db0cde6bfbe 2500w" />
  </Step>

  <Step title="Create your schedule">
    Fill in the form and press "Create schedule" when you're done. <img src="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-create.png?fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=c958b2628029237508df655d4e893d1e" alt="Environment variables
    page" data-og-width="1600" width="1600" data-og-height="901" height="901" data-path="images/schedules-create.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-create.png?w=280&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=5ebfd52f0aa7804335db8b6cc77dd13f 280w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-create.png?w=560&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=a0bddf8862294445a0c3b6d2140ddffd 560w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-create.png?w=840&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=04fa4d04c0490f38d0b243f2588e00f3 840w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-create.png?w=1100&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=0895d4a4306bbd55f91173c4b365c6e2 1100w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-create.png?w=1650&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=21b3fc532d0bdce094542b94a20e915c 1650w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-create.png?w=2500&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=06ce41644450d0f6bc12745c26e8859b 2500w" />

    These are the options when creating a schedule:

    | Name              | Description                                                                                   |
    | ----------------- | --------------------------------------------------------------------------------------------- |
    | Task              | The id of the task you want to attach to.                                                     |
    | Cron pattern      | The schedule in cron format.                                                                  |
    | Timezone          | The timezone the schedule will run in. Defaults to "UTC"                                      |
    | External id       | An optional external id, usually you'd use a userId.                                          |
    | Deduplication key | An optional deduplication key. If you pass the same value, it will update rather than create. |
    | Environments      | The environments this schedule will run in.                                                   |
  </Step>
</Steps>

## Attaching schedules with the SDK

You call `schedules.create()` to create a schedule from your code. Here's the simplest possible example:

```ts  theme={null}
const createdSchedule = await schedules.create({
  //The id of the scheduled task you want to attach to.
  task: firstScheduledTask.id,
  //The schedule in cron format.
  cron: "0 0 * * *",
  //this is required, it prevents you from creating duplicate schedules. It will update the schedule if it already exists.
  deduplicationKey: "my-deduplication-key",
});
```

<Note>The `task` id must be a task that you defined using `schedules.task()`.</Note>

You can create many schedules with the same `task`, `cron`, and `externalId` but only one with the same `deduplicationKey`.

This means you can have thousands of schedules attached to a single task, but only one schedule per `deduplicationKey`. Here's an example with all the options:

```ts  theme={null}
const createdSchedule = await schedules.create({
  //The id of the scheduled task you want to attach to.
  task: firstScheduledTask.id,
  //The schedule in cron format.
  cron: "0 0 * * *",
  // Optional, it defaults to "UTC". In IANA format, e.g. "America/New_York".
  // In this case, the task will run at midnight every day in New York time.
  // If you specify a timezone it will automatically work with daylight saving time.
  timezone: "America/New_York",
  //Optionally, you can specify your own IDs (like a user ID) and then use it inside the run function of your task.
  //This allows you to have per-user cron tasks.
  externalId: "user_123456",
  //You can only create one schedule with this key.
  //If you use it twice, the second call will update the schedule.
  //This is useful because you don't want to create duplicate schedules for a user.
  deduplicationKey: "user_123456-todo_reminder",
});
```

See [the SDK reference](/management/schedules/create) for full details.

### Dynamic schedules (or multi-tenant schedules)

By using the `externalId` you can have schedules for your users. This is useful for things like reminders, where you want to have a schedule for each user.

A reminder task:

```ts /trigger/reminder.ts theme={null}
import { schedules } from "@trigger.dev/sdk";

//this task will run when any of the attached schedules trigger
export const reminderTask = schedules.task({
  id: "todo-reminder",
  run: async (payload) => {
    if (!payload.externalId) {
      throw new Error("externalId is required");
    }

    //get user using the externalId you used when creating the schedule
    const user = await db.getUser(payload.externalId);

    //send a reminder email
    await sendReminderEmail(user);
  },
});
```

Then in your backend code, you can create a schedule for each user:

```ts Next.js API route theme={null}
import { reminderTask } from "~/trigger/reminder";

//app/reminders/route.ts
export async function POST(request: Request) {
  //get the JSON from the request
  const data = await request.json();

  //create a schedule for the user
  const createdSchedule = await schedules.create({
    task: reminderTask.id,
    //8am every day
    cron: "0 8 * * *",
    //the user's timezone
    timezone: data.timezone,
    //the user id
    externalId: data.userId,
    //this makes it impossible to have two reminder schedules for the same user
    deduplicationKey: `${data.userId}-reminder`,
  });

  //return a success response with the schedule
  return Response.json(createdSchedule);
}
```

You can also retrieve, list, delete, deactivate and re-activate schedules using the SDK. More on that later.

## Testing schedules

You can test a scheduled task in the dashboard. Note that the `scheduleId` will always come through as `sched_1234` to the run.

<Steps>
  <Step title="Go to the Test page">
    In the sidebar select the "Test" page, then select a scheduled task from the list (they have a
    clock icon on them) <img src="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-test.png?fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=6591163dd3e4af384746705dffef6c92" alt="Test page" data-og-width="1600" width="1600" data-og-height="900" height="900" data-path="images/schedules-test.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-test.png?w=280&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=ec7027a656655d186e0ee7b8d4d858ad 280w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-test.png?w=560&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=7616d494747c8f9038be012668f3a238 560w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-test.png?w=840&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=23eb128eee342e40a3826b05c006c029 840w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-test.png?w=1100&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=f7fdc2ee3775b41361ae411022a37f53 1100w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-test.png?w=1650&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=4261839b6f2f2c8f1c2c360108c16f33 1650w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-test.png?w=2500&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=82ac96f5c94674e853545cb60285b38a 2500w" />
  </Step>

  <Step title="Create your schedule">
    Fill in the form \[1]. You can select from a recent run \[2] to pre-populate the fields. Press "Run
    test" when you're ready <img src="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-test-form.png?fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=0b2a0947db2701825addb703f92748a1" alt="Schedule test form" data-og-width="1600" width="1600" data-og-height="900" height="900" data-path="images/schedules-test-form.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-test-form.png?w=280&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=3031563444d48852d76c67b95a4f5139 280w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-test-form.png?w=560&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=1455997fee472ae6934f5d96ba2e1a2e 560w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-test-form.png?w=840&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=5be53628561e1c9ae50228cef28ffac6 840w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-test-form.png?w=1100&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=aa2f6a789d838b7afb13ad77f6305143 1100w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-test-form.png?w=1650&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=f833cb1540671e10b2a9aebda6fd0b9c 1650w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/schedules-test-form.png?w=2500&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=8878736225374e8cc8ddd0d8227a596a 2500w" />
  </Step>
</Steps>

## Managing schedules with the SDK

### Retrieving an existing schedule

```ts  theme={null}
const retrievedSchedule = await schedules.retrieve(scheduleId);
```

See [the SDK reference](/management/schedules/retrieve) for full details.

### Listing schedules

```ts  theme={null}
const allSchedules = await schedules.list();
```

See [the SDK reference](/management/schedules/list) for full details.

### Updating a schedule

```ts  theme={null}
const updatedSchedule = await schedules.update(scheduleId, {
  task: firstScheduledTask.id,
  cron: "0 0 1 * *",
  externalId: "ext_1234444",
  deduplicationKey: "my-deduplication-key",
});
```

See [the SDK reference](/management/schedules/update) for full details.

### Deactivating a schedule

```ts  theme={null}
const deactivatedSchedule = await schedules.deactivate(scheduleId);
```

See [the SDK reference](/management/schedules/deactivate) for full details.

### Activating a schedule

```ts  theme={null}
const activatedSchedule = await schedules.activate(scheduleId);
```

See [the SDK reference](/management/schedules/activate) for full details.

### Deleting a schedule

```ts  theme={null}
const deletedSchedule = await schedules.del(scheduleId);
```

See [the SDK reference](/management/schedules/delete) for full details.

### Getting possible timezones

You might want to show a dropdown menu in your UI so your users can select their timezone. You can get a list of all possible timezones using the SDK:

```ts  theme={null}
const timezones = await schedules.timezones();
```

See [the SDK reference](/management/schedules/timezones) for full details.


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://trigger.dev/docs/llms.txt
# Triggering

> Tasks need to be triggered in order to run.

## Trigger functions

Trigger tasks **from your backend**:

| Function               | What it does                                                                                     |                             |
| :--------------------- | :----------------------------------------------------------------------------------------------- | --------------------------- |
| `tasks.trigger()`      | Triggers a task and returns a handle you can use to fetch and manage the run.                    | [Docs](#tasks-trigger)      |
| `tasks.batchTrigger()` | Triggers a single task in a batch and returns a handle you can use to fetch and manage the runs. | [Docs](#tasks-batchtrigger) |
| `batch.trigger()`      | Similar to `tasks.batchTrigger` but allows running multiple different tasks                      | [Docs](#batch-trigger)      |

Trigger tasks **from inside a another task**:

| Function                         | What it does                                                                                                                       |                                       |
| :------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `yourTask.trigger()`             | Triggers a task and gets a handle you can use to monitor and manage the run. It does not wait for the result.                      | [Docs](#yourtask-trigger)             |
| `yourTask.batchTrigger()`        | Triggers a task multiple times and gets a handle you can use to monitor and manage the runs. It does not wait for the results.     | [Docs](#yourtask-batchtrigger)        |
| `yourTask.triggerAndWait()`      | Triggers a task and then waits until it's complete. You get the result data to continue with.                                      | [Docs](#yourtask-triggerandwait)      |
| `yourTask.batchTriggerAndWait()` | Triggers a task multiple times in parallel and then waits until they're all complete. You get the resulting data to continue with. | [Docs](#yourtask-batchtriggerandwait) |
| `batch.triggerAndWait()`         | Similar to `batch.trigger` but will wait on the triggered tasks to finish and return the results.                                  | [Docs](#batch-triggerandwait)         |
| `batch.triggerByTask()`          | Similar to `batch.trigger` but allows passing in task instances instead of task IDs.                                               | [Docs](#batch-triggerbytask)          |
| `batch.triggerByTaskAndWait()`   | Similar to `batch.triggerbyTask` but will wait on the triggered tasks to finish and return the results.                            | [Docs](#batch-triggerbytaskandwait)   |

## Triggering from your backend

When you trigger a task from your backend code, you need to set the `TRIGGER_SECRET_KEY` environment variable. If you're [using a preview branch](/deployment/preview-branches), you also need to set the `TRIGGER_PREVIEW_BRANCH` environment variable. You can find the value on the API keys page in the Trigger.dev dashboard. [More info on API keys](/apikeys).

<Note>
  If you are using Next.js Server Actions [you'll need to be careful with
  bundling](/guides/frameworks/nextjs#triggering-your-task-in-next-js).
</Note>

### tasks.trigger()

Triggers a single run of a task with the payload you pass in, and any options you specify, without needing to import the task.

<Note>
  By using `tasks.trigger()`, you can pass in the task type as a generic argument, giving you full
  type checking. Make sure you use a `type` import so that your task code is not imported into your
  application.
</Note>

```ts Your backend theme={null}
import { tasks } from "@trigger.dev/sdk";
import type { emailSequence } from "~/trigger/emails";
//     👆 **type-only** import

//app/email/route.ts
export async function POST(request: Request) {
  //get the JSON from the request
  const data = await request.json();

  // Pass the task type to `trigger()` as a generic argument, giving you full type checking
  const handle = await tasks.trigger<typeof emailSequence>("email-sequence", {
    to: data.email,
    name: data.name,
  });

  //return a success response with the handle
  return Response.json(handle);
}
```

You can pass in options to the task using the third argument:

```ts Your backend theme={null}
import { tasks } from "@trigger.dev/sdk";
import type { emailSequence } from "~/trigger/emails";

//app/email/route.ts
export async function POST(request: Request) {
  //get the JSON from the request
  const data = await request.json();

  // Pass the task type to `trigger()` as a generic argument, giving you full type checking
  const handle = await tasks.trigger<typeof emailSequence>(
    "email-sequence",
    {
      to: data.email,
      name: data.name,
    },
    { delay: "1h" } // 👈 Pass in the options here
  );

  //return a success response with the handle
  return Response.json(handle);
}
```

### tasks.batchTrigger()

Triggers multiple runs of a single task with the payloads you pass in, and any options you specify, without needing to import the task.

```ts Your backend theme={null}
import { tasks } from "@trigger.dev/sdk";
import type { emailSequence } from "~/trigger/emails";
//     👆 **type-only** import

//app/email/route.ts
export async function POST(request: Request) {
  //get the JSON from the request
  const data = await request.json();

  // Pass the task type to `batchTrigger()` as a generic argument, giving you full type checking
  const batchHandle = await tasks.batchTrigger<typeof emailSequence>(
    "email-sequence",
    data.users.map((u) => ({ payload: { to: u.email, name: u.name } }))
  );

  //return a success response with the handle
  return Response.json(batchHandle);
}
```

You can pass in options to the `batchTrigger` function using the third argument:

```ts Your backend theme={null}
import { tasks } from "@trigger.dev/sdk";
import type { emailSequence } from "~/trigger/emails";

//app/email/route.ts
export async function POST(request: Request) {
  //get the JSON from the request
  const data = await request.json();

  // Pass the task type to `batchTrigger()` as a generic argument, giving you full type checking
  const batchHandle = await tasks.batchTrigger<typeof emailSequence>(
    "email-sequence",
    data.users.map((u) => ({ payload: { to: u.email, name: u.name } })),
    { idempotencyKey: "my-idempotency-key" } // 👈 Pass in the options here
  );

  //return a success response with the handle
  return Response.json(batchHandle);
}
```

You can also pass in options for each run in the batch:

```ts Your backend theme={null}
import { tasks } from "@trigger.dev/sdk";
import type { emailSequence } from "~/trigger/emails";

//app/email/route.ts
export async function POST(request: Request) {
  //get the JSON from the request
  const data = await request.json();

  // Pass the task type to `batchTrigger()` as a generic argument, giving you full type checking
  const batchHandle = await tasks.batchTrigger<typeof emailSequence>(
    "email-sequence",
    data.users.map((u) => ({ payload: { to: u.email, name: u.name }, options: { delay: "1h" } })) // 👈 Pass in options to each item like so
  );

  //return a success response with the handle
  return Response.json(batchHandle);
}
```

### batch.trigger()

Triggers multiple runs of different tasks with the payloads you pass in, and any options you specify. This is useful when you need to trigger multiple tasks at once.

```ts Your backend theme={null}
import { batch } from "@trigger.dev/sdk";
import type { myTask1, myTask2 } from "~/trigger/myTasks";

export async function POST(request: Request) {
  //get the JSON from the request
  const data = await request.json();

  // Pass a union of the tasks to `trigger()` as a generic argument, giving you full type checking
  const result = await batch.trigger<typeof myTask1 | typeof myTask2>([
    // Because we're using a union, we can pass in multiple tasks by ID
    { id: "my-task-1", payload: { some: data.some } },
    { id: "my-task-2", payload: { other: data.other } },
  ]);

  //return a success response with the result
  return Response.json(result);
}
```

## Triggering from inside another task

The following functions should only be used when running inside a task, for one of the following reasons:

* You need to **wait** for the result of the triggered task.
* You need to import the task instance. Importing a task instance from your backend code is not recommended, as it can pull in a lot of unnecessary code and dependencies.

### yourTask.trigger()

Triggers a single run of a task with the payload you pass in, and any options you specify.

<Note>
  If you need to call `trigger()` on a task in a loop, use
  [`batchTrigger()`](#yourTask-batchtrigger) instead which will trigger up to 1,000 runs in a single
  call with SDK 4.3.1+ (500 runs in prior versions).
</Note>

```ts ./trigger/my-task.ts theme={null}
import { runs } from "@trigger.dev/sdk";
import { myOtherTask } from "~/trigger/my-other-task";

export const myTask = task({
  id: "my-task",
  run: async (payload: string) => {
    const handle = await myOtherTask.trigger({ foo: "some data" });

    const run = await runs.retrieve(handle);
    // Do something with the run
  },
});
```

To pass options to the triggered task, you can use the second argument:

```ts ./trigger/my-task.ts theme={null}
import { runs } from "@trigger.dev/sdk";
import { myOtherTask } from "~/trigger/my-other-task";

export const myTask = task({
  id: "my-task",
  run: async (payload: string) => {
    const handle = await myOtherTask.trigger({ foo: "some data" }, { delay: "1h" });

    const run = await runs.retrieve(handle);
    // Do something with the run
  },
});
```

### yourTask.batchTrigger()

Triggers multiple runs of a single task with the payloads you pass in, and any options you specify.

```ts /trigger/my-task.ts theme={null}
import { batch } from "@trigger.dev/sdk";
import { myOtherTask } from "~/trigger/my-other-task";

export const myTask = task({
  id: "my-task",
  run: async (payload: string) => {
    const batchHandle = await myOtherTask.batchTrigger([{ payload: "some data" }]);

    //...do other stuff
    const batch = await batch.retrieve(batchHandle.id);
  },
});
```

If you need to pass options to `batchTrigger`, you can use the second argument:

```ts /trigger/my-task.ts theme={null}
import { batch } from "@trigger.dev/sdk";
import { myOtherTask } from "~/trigger/my-other-task";

export const myTask = task({
  id: "my-task",
  run: async (payload: string) => {
    const batchHandle = await myOtherTask.batchTrigger([{ payload: "some data" }], {
      idempotencyKey: "my-task-key",
    });

    //...do other stuff
    const batch = await batch.retrieve(batchHandle.id);
  },
});
```

You can also pass in options for each run in the batch:

```ts /trigger/my-task.ts theme={null}
import { batch } from "@trigger.dev/sdk";
import { myOtherTask } from "~/trigger/my-other-task";

export const myTask = task({
  id: "my-task",
  run: async (payload: string) => {
    const batchHandle = await myOtherTask.batchTrigger([
      { payload: "some data", options: { delay: "1h" } },
    ]);

    //...do other stuff
    const batch = await batch.retrieve(batchHandle.id);
  },
});
```

### yourTask.triggerAndWait()

This is where it gets interesting. You can trigger a task and then wait for the result. This is useful when you need to call a different task and then use the result to continue with your task.

<Accordion title="Don't use this in parallel, e.g. with `Promise.all()`">
  Instead, use `batchTriggerAndWait()` if you can, or a for loop if you can't.

  To control concurrency using batch triggers, you can set `queue.concurrencyLimit` on the child task.

  <CodeGroup>
    ```ts /trigger/batch.ts theme={null}
    export const batchTask = task({
      id: "batch-task",
      run: async (payload: string) => {
        const results = await childTask.batchTriggerAndWait([
          { payload: "item1" },
          { payload: "item2" },
        ]);
        console.log("Results", results);

        //...do stuff with the results
      },
    });
    ```

    ```ts /trigger/loop.ts theme={null}
    export const loopTask = task({
      id: "loop-task",
      run: async (payload: string) => {
        //this will be slower than the batch version
        //as we have to resume the parent after each iteration
        for (let i = 0; i < 2; i++) {
          const result = await childTask.triggerAndWait(`item${i}`);
          console.log("Result", result);

          //...do stuff with the result
        }
      },
    });
    ```
  </CodeGroup>
</Accordion>

```ts /trigger/parent.ts theme={null}
export const parentTask = task({
  id: "parent-task",
  run: async (payload: string) => {
    const result = await childTask.triggerAndWait("some-data");
    console.log("Result", result);

    //...do stuff with the result
  },
});
```

The `result` object is a "Result" type that needs to be checked to see if the child task run was successful:

```ts /trigger/parent.ts theme={null}
export const parentTask = task({
  id: "parent-task",
  run: async (payload: string) => {
    const result = await childTask.triggerAndWait("some-data");

    if (result.ok) {
      console.log("Result", result.output); // result.output is the typed return value of the child task
    } else {
      console.error("Error", result.error); // result.error is the error that caused the run to fail
    }
  },
});
```

If instead you just want to get the output of the child task, and throw an error if the child task failed, you can use the `unwrap` method:

```ts /trigger/parent.ts theme={null}
export const parentTask = task({
  id: "parent-task",
  run: async (payload: string) => {
    const output = await childTask.triggerAndWait("some-data").unwrap();
    console.log("Output", output);
  },
});
```

You can also catch the error if the child task fails and get more information about the error:

```ts /trigger/parent.ts theme={null}
import { task, SubtaskUnwrapError } from "@trigger.dev/sdk";
export const parentTask = task({
  id: "parent-task",
  run: async (payload: string) => {
    try {
      const output = await childTask.triggerAndWait("some-data").unwrap();
      console.log("Output", output);
    } catch (error) {
      if (error instanceof SubtaskUnwrapError) {
        console.error("Error in fetch-post-task", {
          runId: error.runId,
          taskId: error.taskId,
          cause: error.cause,
        });
      }
    }
  },
});
```

<Warning>
  This method should only be used inside a task. If you use it outside a task, it will throw an
  error.
</Warning>

### yourTask.batchTriggerAndWait()

You can batch trigger a task and wait for all the results. This is useful for the fan-out pattern, where you need to call a task multiple times and then wait for all the results to continue with your task.

<Accordion title="Don't use this in parallel, e.g. with `Promise.all()`">
  Instead, pass in all items at once and set an appropriate `maxConcurrency`. Alternatively, use sequentially with a for loop.

  To control concurrency, you can set `queue.concurrencyLimit` on the child task.

  <CodeGroup>
    ```ts /trigger/batch.ts theme={null}
    export const batchTask = task({
      id: "batch-task",
      run: async (payload: string) => {
        const results = await childTask.batchTriggerAndWait([
          { payload: "item1" },
          { payload: "item2" },
        ]);
        console.log("Results", results);

        //...do stuff with the results
      },
    });
    ```

    ```ts /trigger/loop.ts theme={null}
    export const loopTask = task({
      id: "loop-task",
      run: async (payload: string) => {
        //this will be slower than a single batchTriggerAndWait()
        //as we have to resume the parent after each iteration
        for (let i = 0; i < 2; i++) {
          const result = await childTask.batchTriggerAndWait([
            { payload: `itemA${i}` },
            { payload: `itemB${i}` },
          ]);
          console.log("Result", result);

          //...do stuff with the result
        }
      },
    });
    ```
  </CodeGroup>
</Accordion>

<Accordion title="How to handle run failures">
  When using `batchTriggerAndWait`, you have full control over how to handle failures within the batch. The method returns an array of run results, allowing you to inspect each run's outcome individually and implement custom error handling.

  Here's how you can manage run failures:

  1. **Inspect individual run results**: Each run in the returned array has an `ok` property indicating success or failure.

  2. **Access error information**: For failed runs, you can examine the `error` property to get details about the failure.

  3. **Choose your failure strategy**: You have two main options:

     * **Fail the entire batch**: Throw an error if any run fails, causing the parent task to reattempt.
     * **Continue despite failures**: Process the results without throwing an error, allowing the parent task to continue.

  4. **Implement custom logic**: You can create sophisticated handling based on the number of failures, types of errors, or other criteria.

  Here's an example of how you might handle run failures:

  <CodeGroup>
    ```ts /trigger/batchTriggerAndWait.ts theme={null}
    const result = await batchChildTask.batchTriggerAndWait([
      { payload: "item1" },
      { payload: "item2" },
      { payload: "item3" },
    ]);

    // Result will contain the finished runs.
    // They're only finished if they have succeeded or failed.
    // "Failed" means all attempts failed

    for (const run of result.runs) {
      // Check if the run succeeded
      if (run.ok) {
        logger.info("Batch task run succeeded", { output: run.output });
      } else {
        logger.error("Batch task run error", { error: run.error });

        //You can choose if you want to throw an error and fail the entire run
        throw new Error(`Fail the entire run because ${run.id} failed`);
      }
    }
    ```
  </CodeGroup>
</Accordion>

```ts /trigger/nested.ts theme={null}
export const batchParentTask = task({
  id: "parent-task",
  run: async (payload: string) => {
    const results = await childTask.batchTriggerAndWait([
      { payload: "item4" },
      { payload: "item5" },
      { payload: "item6" },
    ]);
    console.log("Results", results);

    //...do stuff with the result
  },
});
```

<Warning>
  This method should only be used inside a task. If you use it outside a task, it will throw an
  error.
</Warning>

### batch.triggerAndWait()

You can batch trigger multiple different tasks and wait for all the results:

```ts /trigger/batch.ts theme={null}
import { batch, task } from "@trigger.dev/sdk";

export const parentTask = task({
  id: "parent-task",
  run: async (payload: string) => {
    //                                         👇 Pass a union of all the tasks you want to trigger
    const results = await batch.triggerAndWait<typeof childTask1 | typeof childTask2>([
      { id: "child-task-1", payload: { foo: "World" } }, // 👈 The payload is typed correctly based on the task `id`
      { id: "child-task-2", payload: { bar: 42 } }, // 👈 The payload is typed correctly based on the task `id`
    ]);

    for (const result of results) {
      if (result.ok) {
        // 👇 Narrow the type of the result based on the taskIdentifier
        switch (result.taskIdentifier) {
          case "child-task-1":
            console.log("Child task 1 output", result.output); // 👈 result.output is typed as a string
            break;
          case "child-task-2":
            console.log("Child task 2 output", result.output); // 👈 result.output is typed as a number
            break;
        }
      } else {
        console.error("Error", result.error); // 👈 result.error is the error that caused the run to fail
      }
    }
  },
});

export const childTask1 = task({
  id: "child-task-1",
  run: async (payload: { foo: string }) => {
    return `Hello ${payload}`;
  },
});

export const childTask2 = task({
  id: "child-task-2",
  run: async (payload: { bar: number }) => {
    return bar + 1;
  },
});
```

### batch.triggerByTask()

You can batch trigger multiple different tasks by passing in the task instances. This function is especially useful when you have a static set of tasks you want to trigger:

```ts /trigger/batch.ts theme={null}
import { batch, task, runs } from "@trigger.dev/sdk";

export const parentTask = task({
  id: "parent-task",
  run: async (payload: string) => {
    const results = await batch.triggerByTask([
      { task: childTask1, payload: { foo: "World" } }, // 👈 The payload is typed correctly based on the task instance
      { task: childTask2, payload: { bar: 42 } }, // 👈 The payload is typed correctly based on the task instance
    ]);

    // 👇 results.runs is a tuple, allowing you to get type safety without needing to narrow
    const run1 = await runs.retrieve(results.runs[0]); // 👈 run1 is typed as the output of childTask1
    const run2 = await runs.retrieve(results.runs[1]); // 👈 run2 is typed as the output of childTask2
  },
});

export const childTask1 = task({
  id: "child-task-1",
  run: async (payload: { foo: string }) => {
    return `Hello ${payload}`;
  },
});

export const childTask2 = task({
  id: "child-task-2",
  run: async (payload: { bar: number }) => {
    return bar + 1;
  },
});
```

### batch.triggerByTaskAndWait()

You can batch trigger multiple different tasks by passing in the task instances, and wait for all the results. This function is especially useful when you have a static set of tasks you want to trigger:

```ts /trigger/batch.ts theme={null}
import { batch, task, runs } from "@trigger.dev/sdk";

export const parentTask = task({
  id: "parent-task",
  run: async (payload: string) => {
    const { runs } = await batch.triggerByTaskAndWait([
      { task: childTask1, payload: { foo: "World" } }, // 👈 The payload is typed correctly based on the task instance
      { task: childTask2, payload: { bar: 42 } }, // 👈 The payload is typed correctly based on the task instance
    ]);

    if (runs[0].ok) {
      console.log("Child task 1 output", runs[0].output); // 👈 runs[0].output is typed as the output of childTask1
    }

    if (runs[1].ok) {
      console.log("Child task 2 output", runs[1].output); // 👈 runs[1].output is typed as the output of childTask2
    }

    // 💭 A nice alternative syntax is to destructure the runs array:
    const {
      runs: [run1, run2],
    } = await batch.triggerByTaskAndWait([
      { task: childTask1, payload: { foo: "World" } }, // 👈 The payload is typed correctly based on the task instance
      { task: childTask2, payload: { bar: 42 } }, // 👈 The payload is typed correctly based on the task instance
    ]);

    if (run1.ok) {
      console.log("Child task 1 output", run1.output); // 👈 run1.output is typed as the output of childTask1
    }

    if (run2.ok) {
      console.log("Child task 2 output", run2.output); // 👈 run2.output is typed as the output of childTask2
    }
  },
});

export const childTask1 = task({
  id: "child-task-1",
  run: async (payload: { foo: string }) => {
    return `Hello ${payload}`;
  },
});

export const childTask2 = task({
  id: "child-task-2",
  run: async (payload: { bar: number }) => {
    return bar + 1;
  },
});
```

## Triggering from your frontend

If you want to trigger a task directly from a frontend application, you can use our [React
hooks](/realtime/react-hooks/triggering).

## Options

All of the above functions accept an options object:

```ts  theme={null}
await myTask.trigger({ some: "data" }, { delay: "1h", ttl: "1h" });
await myTask.batchTrigger([{ payload: { some: "data" }, options: { delay: "1h" } }]);
```

The following options are available:

### `delay`

When you want to trigger a task now, but have it run at a later time, you can use the `delay` option:

```ts  theme={null}
// Delay the task run by 1 hour
await myTask.trigger({ some: "data" }, { delay: "1h" });
// Delay the task run by 88 seconds
await myTask.trigger({ some: "data" }, { delay: "88s" });
// Delay the task run by 1 hour and 52 minutes and 18 seconds
await myTask.trigger({ some: "data" }, { delay: "1h52m18s" });
// Delay until a specific time
await myTask.trigger({ some: "data" }, { delay: "2024-12-01T00:00:00" });
// Delay using a Date object
await myTask.trigger({ some: "data" }, { delay: new Date(Date.now() + 1000 * 60 * 60) });
// Delay using a timezone
await myTask.trigger({ some: "data" }, { delay: new Date("2024-07-23T11:50:00+02:00") });
```

Runs that are delayed and have not been enqueued yet will display in the dashboard with a "Delayed" status:

<img src="https://mintcdn.com/trigger/uys6iMwf9B_ojh8r/images/delayed-runs.png?fit=max&auto=format&n=uys6iMwf9B_ojh8r&q=85&s=38620549a2c6e61c37b4a8101b89f5d7" alt="Delayed run in the dashboard" data-og-width="1134" width="1134" data-og-height="200" height="200" data-path="images/delayed-runs.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/trigger/uys6iMwf9B_ojh8r/images/delayed-runs.png?w=280&fit=max&auto=format&n=uys6iMwf9B_ojh8r&q=85&s=79400cc072f698650aa953a6e049c94a 280w, https://mintcdn.com/trigger/uys6iMwf9B_ojh8r/images/delayed-runs.png?w=560&fit=max&auto=format&n=uys6iMwf9B_ojh8r&q=85&s=363695b013020cc0028c73247861ded3 560w, https://mintcdn.com/trigger/uys6iMwf9B_ojh8r/images/delayed-runs.png?w=840&fit=max&auto=format&n=uys6iMwf9B_ojh8r&q=85&s=366cf60b4ed03a71917fd46df9a381e5 840w, https://mintcdn.com/trigger/uys6iMwf9B_ojh8r/images/delayed-runs.png?w=1100&fit=max&auto=format&n=uys6iMwf9B_ojh8r&q=85&s=0216d073946e5282d84650d81f07e8ac 1100w, https://mintcdn.com/trigger/uys6iMwf9B_ojh8r/images/delayed-runs.png?w=1650&fit=max&auto=format&n=uys6iMwf9B_ojh8r&q=85&s=6d77990fce1c4bdcb6444530f24ca7e8 1650w, https://mintcdn.com/trigger/uys6iMwf9B_ojh8r/images/delayed-runs.png?w=2500&fit=max&auto=format&n=uys6iMwf9B_ojh8r&q=85&s=8a0e272b23ace6a933949758994b9fad 2500w" />

<Note>
  Delayed runs will be enqueued at the time specified, and will run as soon as possible after that
  time, just as a normally triggered run would.
</Note>

You can cancel a delayed run using the `runs.cancel` SDK function:

```ts  theme={null}
import { runs } from "@trigger.dev/sdk";

await runs.cancel("run_1234");
```

You can also reschedule a delayed run using the `runs.reschedule` SDK function:

```ts  theme={null}
import { runs } from "@trigger.dev/sdk";

// The delay option here takes the same format as the trigger delay option
await runs.reschedule("run_1234", { delay: "1h" });
```

The `delay` option is also available when using `batchTrigger`:

```ts  theme={null}
await myTask.batchTrigger([{ payload: { some: "data" }, options: { delay: "1h" } }]);
```

### `ttl`

You can set a TTL (time to live) when triggering a task, which will automatically expire the run if it hasn't started within the specified time. This is useful for ensuring that a run doesn't get stuck in the queue for too long.

<Note>
  All runs in development have a default `ttl` of 10 minutes. You can disable this by setting the
  `ttl` option.
</Note>

```ts  theme={null}
import { myTask } from "./trigger/myTasks";

// Expire the run if it hasn't started within 1 hour
await myTask.trigger({ some: "data" }, { ttl: "1h" });

// If you specify a number, it will be treated as seconds
await myTask.trigger({ some: "data" }, { ttl: 3600 }); // 1 hour
```

When a run is expired, it will be marked as "Expired" in the dashboard:

<img src="https://mintcdn.com/trigger/uys6iMwf9B_ojh8r/images/expired-runs.png?fit=max&auto=format&n=uys6iMwf9B_ojh8r&q=85&s=d984afe341eaacbe47b698dade27e445" alt="Expired runs in the dashboard" data-og-width="1364" width="1364" data-og-height="316" height="316" data-path="images/expired-runs.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/trigger/uys6iMwf9B_ojh8r/images/expired-runs.png?w=280&fit=max&auto=format&n=uys6iMwf9B_ojh8r&q=85&s=33cefd04968f559f47ccb1fff85813fe 280w, https://mintcdn.com/trigger/uys6iMwf9B_ojh8r/images/expired-runs.png?w=560&fit=max&auto=format&n=uys6iMwf9B_ojh8r&q=85&s=08409ef7f1fe02dc5aef3d13a8ce0fda 560w, https://mintcdn.com/trigger/uys6iMwf9B_ojh8r/images/expired-runs.png?w=840&fit=max&auto=format&n=uys6iMwf9B_ojh8r&q=85&s=9694db79f948a51792ac50d781e251a0 840w, https://mintcdn.com/trigger/uys6iMwf9B_ojh8r/images/expired-runs.png?w=1100&fit=max&auto=format&n=uys6iMwf9B_ojh8r&q=85&s=899a2f4e90e3f0dbde8c1e3e42cfe42f 1100w, https://mintcdn.com/trigger/uys6iMwf9B_ojh8r/images/expired-runs.png?w=1650&fit=max&auto=format&n=uys6iMwf9B_ojh8r&q=85&s=9d493a433aaf988c62e58bd036b2f802 1650w, https://mintcdn.com/trigger/uys6iMwf9B_ojh8r/images/expired-runs.png?w=2500&fit=max&auto=format&n=uys6iMwf9B_ojh8r&q=85&s=eb0e94a36fdb1d7d8e1adba0a0b2fd33 2500w" />

When you use both `delay` and `ttl`, the TTL will start counting down from the time the run is enqueued, not from the time the run is triggered.

So for example, when using the following code:

```ts  theme={null}
await myTask.trigger({ some: "data" }, { delay: "10m", ttl: "1h" });
```

The timeline would look like this:

1. The run is created at 12:00:00
2. The run is enqueued at 12:10:00
3. The TTL starts counting down from 12:10:00
4. If the run hasn't started by 13:10:00, it will be expired

For this reason, the `ttl` option only accepts durations and not absolute timestamps.

### `idempotencyKey`

You can provide an `idempotencyKey` to ensure that a task is only triggered once with the same key. This is useful if you are triggering a task within another task that might be retried:

```typescript  theme={null}
import { idempotencyKeys, task } from "@trigger.dev/sdk";

export const myTask = task({
  id: "my-task",
  retry: {
    maxAttempts: 4,
  },
  run: async (payload: any) => {
    // By default, idempotency keys generated are unique to the run, to prevent retries from duplicating child tasks
    const idempotencyKey = await idempotencyKeys.create("my-task-key");

    // childTask will only be triggered once with the same idempotency key
    await childTask.trigger(payload, { idempotencyKey });

    // Do something else, that may throw an error and cause the task to be retried
  },
});
```

For more information, see our [Idempotency](/idempotency) documentation.

<Warning>
  In version 3.3.0 and later, the `idempotencyKey` option is not available when using
  `triggerAndWait` or `batchTriggerAndWait`, due to a bug that would sometimes cause the parent task
  to become stuck. We are working on a fix for this issue.
</Warning>

### `idempotencyKeyTTL`

Idempotency keys automatically expire after 30 days, but you can set a custom TTL for an idempotency key when triggering a task:

```typescript  theme={null}
import { idempotencyKeys, task } from "@trigger.dev/sdk";

export const myTask = task({
  id: "my-task",
  retry: {
    maxAttempts: 4,
  },
  run: async (payload: any) => {
    // By default, idempotency keys generated are unique to the run, to prevent retries from duplicating child tasks
    const idempotencyKey = await idempotencyKeys.create("my-task-key");

    // childTask will only be triggered once with the same idempotency key
    await childTask.trigger(payload, { idempotencyKey, idempotencyKeyTTL: "1h" });

    // Do something else, that may throw an error and cause the task to be retried
  },
});
```

For more information, see our [Idempotency](/idempotency) documentation.

### `debounce`

You can debounce task triggers to consolidate multiple trigger calls into a single delayed run. When a run with the same debounce key already exists in the delayed state, subsequent triggers "push" the existing run's execution time later rather than creating new runs.

This is useful for scenarios like:

* Real-time document indexing where you want to wait for the user to finish typing
* Aggregating webhook events from the same source
* Rate limiting expensive operations while still processing the final request

```ts  theme={null}
// First trigger creates a new run, delayed by 5 seconds
await myTask.trigger({ some: "data" }, { debounce: { key: "user-123", delay: "5s" } });

// If triggered again within 5 seconds, the existing run is pushed later
await myTask.trigger({ updated: "data" }, { debounce: { key: "user-123", delay: "5s" } });

// The run only executes after 5 seconds of no new triggers
// Note: The first payload is used (first trigger wins)
```

<Note>
  Debounce keys are scoped to the task identifier, so different tasks can use the same key without
  conflicts.
</Note>

The `debounce` option accepts:

* `key` - A unique string to identify the debounce group (scoped to the task)
* `delay` - Duration string specifying how long to delay (e.g., "5s", "1m", "30s")
* `mode` - Optional. Controls which trigger's data is used: `"leading"` (default) or `"trailing"`

**How it works:**

1. First trigger with a debounce key creates a new delayed run
2. Subsequent triggers with the same key (while the run is still delayed) push the execution time further
3. Once no new triggers occur within the delay duration, the run executes
4. After the run starts executing, a new trigger with the same key will create a new run

**Leading vs Trailing mode:**

By default, debounce uses **leading mode** - the run executes with data from the **first** trigger.

With **trailing mode**, each subsequent trigger updates the run's data (payload, metadata, tags, maxAttempts, maxDuration, and machine), so the run executes with data from the **last** trigger:

```ts  theme={null}
// Leading mode (default): runs with first payload
await myTask.trigger({ count: 1 }, { debounce: { key: "user-123", delay: "5s" } });
await myTask.trigger({ count: 2 }, { debounce: { key: "user-123", delay: "5s" } });
// After 5 seconds, runs with { count: 1 }

// Trailing mode: runs with last payload
await myTask.trigger(
  { count: 1 },
  { debounce: { key: "user-123", delay: "5s", mode: "trailing" } }
);
await myTask.trigger(
  { count: 2 },
  { debounce: { key: "user-123", delay: "5s", mode: "trailing" } }
);
// After 5 seconds, runs with { count: 2 }
```

Use **trailing mode** when you want to process the most recent data, such as:

* Saving the latest version of a document after edits stop
* Processing the final state after a series of rapid updates

**With `triggerAndWait`:**

When using `triggerAndWait` with debounce, the parent run blocks on the existing debounced run if one exists:

```ts  theme={null}
export const parentTask = task({
  id: "parent-task",
  run: async (payload: string) => {
    // Both will wait for the same run
    const result = await childTask.triggerAndWait(
      { data: payload },
      { debounce: { key: "shared-key", delay: "3s" } }
    );
    return result;
  },
});
```

<Note>
  Idempotency keys take precedence over debounce keys. If both are provided and an idempotency match
  is found, it wins.
</Note>

### `queue`

When you trigger a task you can override the concurrency limit. This is really useful if you sometimes have high priority runs.

The task:

```ts /trigger/override-concurrency.ts theme={null}
const generatePullRequest = task({
  id: "generate-pull-request",
  queue: {
    //normally when triggering this task it will be limited to 1 run at a time
    concurrencyLimit: 1,
  },
  run: async (payload) => {
    //todo generate a PR using OpenAI
  },
});
```

Triggering from your backend and overriding the concurrency:

```ts app/api/push/route.ts theme={null}
import { generatePullRequest } from "~/trigger/override-concurrency";

export async function POST(request: Request) {
  const data = await request.json();

  if (data.branch === "main") {
    //trigger the task, with a different queue
    const handle = await generatePullRequest.trigger(data, {
      queue: {
        //the "main-branch" queue will have a concurrency limit of 10
        //this triggered run will use that queue
        name: "main-branch",
        concurrencyLimit: 10,
      },
    });

    return Response.json(handle);
  } else {
    //triggered with the default (concurrency of 1)
    const handle = await generatePullRequest.trigger(data);
    return Response.json(handle);
  }
}
```

### `concurrencyKey`

If you're building an application where you want to run tasks for your users, you might want a separate queue for each of your users. (It doesn't have to be users, it can be any entity you want to separately limit the concurrency for.)

You can do this by using `concurrencyKey`. It creates a separate queue for each value of the key.

Your backend code:

```ts app/api/pr/route.ts theme={null}
import { generatePullRequest } from "~/trigger/override-concurrency";

export async function POST(request: Request) {
  const data = await request.json();

  if (data.isFreeUser) {
    //free users can only have 1 PR generated at a time
    const handle = await generatePullRequest.trigger(data, {
      queue: {
        //every free user gets a queue with a concurrency limit of 1
        name: "free-users",
        concurrencyLimit: 1,
      },
      concurrencyKey: data.userId,
    });

    //return a success response with the handle
    return Response.json(handle);
  } else {
    //trigger the task, with a different queue
    const handle = await generatePullRequest.trigger(data, {
      queue: {
        //every paid user gets a queue with a concurrency limit of 10
        name: "paid-users",
        concurrencyLimit: 10,
      },
      concurrencyKey: data.userId,
    });

    //return a success response with the handle
    return Response.json(handle);
  }
}
```

### `maxAttempts`

You can set the maximum number of attempts for a task run. If the run fails, it will be retried up to the number of attempts you specify.

```ts  theme={null}
await myTask.trigger({ some: "data" }, { maxAttempts: 3 });
await myTask.trigger({ some: "data" }, { maxAttempts: 1 }); // no retries
```

This will override the `retry.maxAttempts` value set in the task definition.

### `tags`

View our [tags doc](/tags) for more information.

### `metadata`

View our [metadata doc](/runs/metadata) for more information.

### `maxDuration`

View our [maxDuration doc](/runs/max-duration) for more information.

### `priority`

View our [priority doc](/runs/priority) for more information.

### `region`

You can override the default region when you trigger a run:

```ts  theme={null}
await yourTask.trigger(payload, { region: "eu-central-1" });
```

If you don't specify a region it will use the default for your project. Go to the "Regions" page in the dashboard to see available regions or switch your default.

The region is where your runs are executed, it does not change where the run payload, output, tags, logs, or are any other data is stored.

### `machine`

You can override the default machine preset when you trigger a run:

```ts  theme={null}
await yourTask.trigger(payload, { machine: "large-1x" });
```

If you don't specify a machine it will use the machine preset for your task (or the default for your project). For more information read [the machines guide](/machines).

## Streaming batch triggering

<Note>This feature is only available with SDK 4.3.1+</Note>

For large batches, you can pass an `AsyncIterable` or `ReadableStream` instead of an array. This allows you to generate items on-demand without loading them all into memory upfront.

```ts /trigger/my-task.ts theme={null}
import { task } from "@trigger.dev/sdk";
import { myOtherTask } from "~/trigger/my-other-task";

export const myTask = task({
  id: "my-task",
  run: async (payload: { userIds: string[] }) => {
    // Use an async generator to stream items
    async function* generateItems() {
      for (const userId of payload.userIds) {
        yield { payload: { userId } };
      }
    }

    const batchHandle = await myOtherTask.batchTrigger(generateItems());

    return { batchId: batchHandle.batchId };
  },
});
```

This works with all batch trigger methods:

* `yourTask.batchTrigger()`
* `yourTask.batchTriggerAndWait()`
* `batch.triggerByTask()`
* `batch.triggerByTaskAndWait()`
* `tasks.batchTrigger()`

Streaming is especially useful when generating batches from database queries, API pagination, or
file processing where you don't want to load all items into memory at once.

## Large Payloads

We recommend keeping your task payloads as small as possible. We currently have a hard limit on task payloads above 10MB.

If your payload size is larger than 512KB, instead of saving the payload to the database, we will upload it to an S3-compatible object store and store the URL in the database.

When your task runs, we automatically download the payload from the object store and pass it to your task function. We also will return to you a `payloadPresignedUrl` from the `runs.retrieve` SDK function so you can download the payload if needed:

```ts  theme={null}
import { runs } from "@trigger.dev/sdk";

const run = await runs.retrieve(handle);

if (run.payloadPresignedUrl) {
  const response = await fetch(run.payloadPresignedUrl);
  const payload = await response.json();

  console.log("Payload", payload);
}
```

<Note>
  We also use this same system for dealing with large task outputs, and subsequently will return a
  corresponding `outputPresignedUrl`. Task outputs are limited to 100MB.
</Note>

If you need to pass larger payloads, you'll need to upload the payload to your own storage and pass a URL to the file in the payload instead. For example, uploading to S3 and then sending a presigned URL that expires in URL:

<CodeGroup>
  ```ts /yourServer.ts theme={null}
  import { myTask } from "./trigger/myTasks";
  import { s3Client, getSignedUrl, PutObjectCommand, GetObjectCommand } from "./s3";
  import { createReadStream } from "node:fs";

  // Upload file to S3
  await s3Client.send(
    new PutObjectCommand({
      Bucket: "my-bucket",
      Key: "myfile.json",
      Body: createReadStream("large-payload.json"),
    })
  );

  // Create presigned URL
  const presignedUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: "my-bucket",
      Key: "my-file.json",
    }),
    {
      expiresIn: 3600, // expires in 1 hour
    }
  );

  // Now send the URL to the task
  const handle = await myTask.trigger({
    url: presignedUrl,
  });
  ```

  ```ts /trigger/myTasks.ts theme={null}
  import { task } from "@trigger.dev/sdk";

  export const myTask = task({
    id: "my-task",
    run: async (payload: { url: string }) => {
      // Download the file from the URL
      const response = await fetch(payload.url);
      const data = await response.json();

      // Do something with the data
    },
  });
  ```
</CodeGroup>


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://trigger.dev/docs/llms.txt

# Runs

> Understanding the lifecycle of task run execution in Trigger.dev

In Trigger.dev, the concepts of runs and attempts are fundamental to understanding how tasks are executed and managed. This article explains these concepts in detail and provides insights into the various states a run can go through during its lifecycle.

## What are runs?

A run is created when you trigger a task (e.g. calling `yourTask.trigger({ foo: "bar" })`). It represents a single instance of a task being executed and contains the following key information:

* A unique run ID
* The current status of the run
* The payload (input data) for the task
* Lots of other metadata

## The run lifecycle

A run can go through **various** states during its lifecycle. The following diagram illustrates a typical state transition where a single run is triggered and completes successfully:

<img src="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-lifecycle.png?fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=a8936884740688be9f52dd5d7356fb44" alt="Run Lifecycle" data-og-width="1430" width="1430" data-og-height="549" height="549" data-path="images/run-lifecycle.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-lifecycle.png?w=280&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=3af5089f036381cbacc1749c212eb0f4 280w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-lifecycle.png?w=560&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=cace40b5bbab66d38031fed3e28a9182 560w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-lifecycle.png?w=840&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=f177c420bee7020b3a0e0e4ff73a1ee0 840w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-lifecycle.png?w=1100&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=cba5c92e5b76a9651c89376826b1b34c 1100w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-lifecycle.png?w=1650&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=74a0627ced1962111e7b78debaa3bcb8 1650w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-lifecycle.png?w=2500&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=7850d8f28313b615293b27dc6d4bf428 2500w" />

Runs can also find themselves in lots of other states depending on what's happening at any given time. The following sections describe all the possible states in more detail.

### Initial states

<Icon icon="rectangle-history" iconType="solid" color="#FBBF24" size={17} /> **Pending version**:
The task is waiting for a version update because it cannot execute without additional information (task, queue, etc.).

<Icon icon="clock" iconType="solid" color="#878C99" size={17} /> **Delayed**: When a run is triggered
with a delay, it enters this state until the specified delay period has passed.

<Icon icon="rectangle-history" iconType="solid" color="#878C99" size={17} /> **Queued**: The run is ready
to be executed and is waiting in the queue.

<Icon icon="rectangle-history" iconType="solid" color="#878C99" size={17} /> **Dequeued**: The task has been dequeued and is being sent to a worker to start executing.

### Execution states

<Icon icon="spinner-third" iconType="duotone" color="#3B82F6" size={17} /> **Executing**: The task is
currently being executed by a worker.

<Icon icon="hourglass" iconType="solid" color="#878C99" size={17} /> **Waiting**: You have used a
[triggerAndWait()](/triggering#yourtask-triggerandwait), [batchTriggerAndWait()](/triggering#yourtask-batchtriggerandwait) or a [wait function](/wait). When the wait is complete, the task will resume execution.

### Final states

<Icon icon="circle-check" iconType="solid" color="#28BF5C" size={17} /> **Completed**: The task has successfully
finished execution.

<Icon icon="ban" iconType="solid" color="#878C99" size={17} /> **Canceled**: The run was manually canceled
by the user.

<Icon icon="circle-xmark" iconType="solid" color="#E11D48" size={17} /> **Failed**: The task has failed
to complete successfully due to an error in the task code.

<Icon icon="alarm-exclamation" iconType="solid" color="#E11D48" size={17} /> **Timed out**: Task has
failed because it exceeded its `maxDuration`.

<Icon icon="fire" iconType="solid" color="#E11D48" size={17} /> **Crashed**: The worker process crashed
during execution (likely due to an Out of Memory error) and won’t be retried.

<Icon icon="bug" iconType="solid" color="#E11D48" size={17} /> **System failure**: An unrecoverable system
error has occurred.

<Icon icon="trash-can" iconType="solid" color="#878C99" size={17} /> **Expired**: The run's [Time-to-Live](#time-to-live-ttl)
(TTL) has passed before it could start executing.

## Attempts

An attempt represents a single execution of a task within a run. A run can have one or more attempts, depending on the task's retry settings and whether it fails. Each attempt has:

* A unique attempt ID
* A status
* An output (if successful) or an error (if failed)

When a task fails, it will be retried according to its retry settings, creating new attempts until it either succeeds or reaches the retry limit.

<img src="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-retries.png?fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=520a05470d031b8117b2780405964153" alt="Run with retries" data-og-width="1430" width="1430" data-og-height="585" height="585" data-path="images/run-with-retries.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-retries.png?w=280&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=f9d43bd7b37a9fffaa342cc4d05bb89a 280w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-retries.png?w=560&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=ace34edfe0154bcff7c2555e6ae3bf83 560w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-retries.png?w=840&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=a3a7478cfd71ede3194dd2ae2226ac12 840w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-retries.png?w=1100&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=2dd91c524cf54fe9c6b3960afb7e3ad6 1100w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-retries.png?w=1650&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=8a2680c03a1515e3f25ac1f36bc25377 1650w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-retries.png?w=2500&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=6c0a8c1b610d5befaf82b583e2adcedf 2500w" />

## Run completion

A run is considered finished when:

1. The last attempt succeeds, or
2. The task has reached its retry limit and all attempts have failed

At this point, the run will have either an output (if successful) or an error (if failed).

## Boolean helpers

Run objects returned from the API and Realtime include convenient boolean helper methods to check the run's status:

```ts  theme={null}
import { runs } from "@trigger.dev/sdk";

const run = await runs.retrieve("run_1234");

if (run.isCompleted) {
  console.log("Run completed successfully");
}
```

* **`isQueued`**: Returns `true` when the status is `QUEUED`, `PENDING_VERSION`, or `DELAYED`
* **`isExecuting`**: Returns `true` when the status is `EXECUTING` or `DEQUEUED`. These count against your concurrency limits.
* **`isWaiting`**: Returns `true` when the status is `WAITING`. These do not count against your concurrency limits.
* **`isCompleted`**: Returns `true` when the status is any of the completed statuses
* **`isCanceled`**: Returns `true` when the status is `CANCELED`
* **`isFailed`**: Returns `true` when the status is any of the failed statuses
* **`isSuccess`**: Returns `true` when the status is `COMPLETED`

These helpers are also available when subscribing to Realtime run updates:

```ts  theme={null}
import { runs } from "@trigger.dev/sdk";

for await (const run of runs.subscribeToRun("run_1234")) {
  if (run.isCompleted) {
    console.log("Run completed successfully!");
    break;
  }
}
```

## Advanced run features

### Idempotency Keys

When triggering a task, you can provide an idempotency key to ensure the task is executed only once, even if triggered multiple times. This is useful for preventing duplicate executions in distributed systems.

```ts  theme={null}
await yourTask.trigger({ foo: "bar" }, { idempotencyKey: "unique-key" });
```

* If a run with the same idempotency key is already in progress, the new trigger will be ignored.
* If the run has already finished, the previous output or error will be returned.

See our [Idempotency docs](/idempotency) for more information.

### Canceling runs

You can cancel an in-progress run using the API or the dashboard:

```ts  theme={null}
await runs.cancel(runId);
```

When a run is canceled:

– The task execution is stopped

– The run is marked as canceled

– The task will not be retried

– Any in-progress child runs are also canceled

### Time-to-live (TTL)

TTL is a time-to-live setting that defines the maximum duration a run can remain in a queued state before being automatically expired. You can set a TTL when triggering a run:

```ts  theme={null}
await yourTask.trigger({ foo: "bar" }, { ttl: "10m" });
```

If the run hasn't started within the specified TTL, it will automatically expire, returning the status `Expired`. This is useful for time-sensitive tasks where immediate execution is important. For example, when you queue many runs simultaneously and exceed your concurrency limits, some runs might be delayed - using TTL ensures they only execute if they can start within your specified timeframe.

Note that dev runs automatically have a 10-minute TTL. In Staging and Production environments, no TTL is set by default.

<img src="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-ttl.png?fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=2a3663f4cf4d7c4249c5c82f54859a76" alt="Run with TTL" data-og-width="1406" width="1406" data-og-height="453" height="453" data-path="images/run-with-ttl.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-ttl.png?w=280&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=c596effb593c6533723019ba62d72cf9 280w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-ttl.png?w=560&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=fd441b76d258f5d8ad83b17a42dfeb1c 560w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-ttl.png?w=840&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=a1ba26b44a1b1fb0822eb7142aaf69ef 840w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-ttl.png?w=1100&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=477990ac794bc64d536becff619cdd81 1100w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-ttl.png?w=1650&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=56720e4a594907f52dabc475dd663b03 1650w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-ttl.png?w=2500&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=f3c577f8ef1ee2bcb22bf66259d88869 2500w" />

### Delayed runs

You can schedule a run to start after a specified delay:

```ts  theme={null}
await yourTask.trigger({ foo: "bar" }, { delay: "1h" });
```

This is useful for tasks that need to be executed at a specific time in the future.

<img src="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-delay.png?fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=fe68bf64bab17c12f0c1c532bdb48ab4" alt="Run with delay" data-og-width="1430" width="1430" data-og-height="581" height="581" data-path="images/run-with-delay.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-delay.png?w=280&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=e185434d9cd2a26155dee5ac5e94f370 280w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-delay.png?w=560&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=829277bb21bc824019d68fc8f755ce2c 560w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-delay.png?w=840&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=7e88e6325a8559caca3c76a573f5523c 840w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-delay.png?w=1100&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=ce7e12e3199088a1c7316918bb6fb3a7 1100w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-delay.png?w=1650&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=0cf1c7ecc525f8f8f5c4550cdd463df3 1650w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-delay.png?w=2500&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=03fc83ca451c8b58faf1c79c34bdface 2500w" />

### Replaying runs

You can create a new run with the same payload as a previous run:

```ts  theme={null}
await runs.replay(runId);
```

This is useful for re-running a task with the same input, especially for debugging or recovering from failures. The new run will use the latest version of the task.

You can also replay runs from the dashboard using the same or different payload. Learn how to do this [here](/replaying).

### Waiting for runs

#### triggerAndWait()

The `triggerAndWait()` function triggers a task and then lets you wait for the result before continuing. [Learn more about triggerAndWait()](/triggering#yourtask-triggerandwait).

<img src="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-triggerAndWait().png?fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=b7175cd727983b76dc998fa76cdc7279" alt="Run with triggerAndWait" data-og-width="1617" width="1617" data-og-height="735" height="735" data-path="images/run-with-triggerAndWait().png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-triggerAndWait().png?w=280&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=b6c6add3e9f09f52eb4b63e1e723175a 280w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-triggerAndWait().png?w=560&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=6d78b248fdc52ef7833f4ba71713b3f0 560w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-triggerAndWait().png?w=840&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=0f69ee104ab1e7afb9fde3d69b9b6d7a 840w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-triggerAndWait().png?w=1100&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=292ec187be08fefd76f30c3a768b7449 1100w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-triggerAndWait().png?w=1650&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=c3cedaa32be6515ab9738df67c87276a 1650w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-triggerAndWait().png?w=2500&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=c8e309d749162c08006a9baca616ef74 2500w" />

#### batchTriggerAndWait()

Similar to `triggerAndWait()`, the `batchTriggerAndWait()` function lets you batch trigger a task and wait for all the results [Learn more about batchTriggerAndWait()](/triggering#yourtask-batchtriggerandwait).

<img src="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-batchTriggerAndWait().png?fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=26974085e23f5dd55ea301234b477655" alt="Run with batchTriggerAndWait" data-og-width="1617" width="1617" data-og-height="940" height="940" data-path="images/run-with-batchTriggerAndWait().png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-batchTriggerAndWait().png?w=280&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=96d696e99dec5085efd8327dce107618 280w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-batchTriggerAndWait().png?w=560&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=8c926544b58cd261021928eeda461bf4 560w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-batchTriggerAndWait().png?w=840&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=8f412df861d962ccaba445a95971daca 840w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-batchTriggerAndWait().png?w=1100&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=e590ab7550353f53a6e3b62972c38771 1100w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-batchTriggerAndWait().png?w=1650&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=cc03c2493a62ae36b30ecad5ce3889ab 1650w, https://mintcdn.com/trigger/5SxX7bFjJKRsidSL/images/run-with-batchTriggerAndWait().png?w=2500&fit=max&auto=format&n=5SxX7bFjJKRsidSL&q=85&s=7863f7505ba010ae2b1f0f998f57cf35 2500w" />

### Runs API

#### runs.list()

List runs in a specific environment. You can filter the runs by status, created at, task identifier, version, and more:

```ts  theme={null}
import { runs } from "@trigger.dev/sdk";

// Get the first page of runs, returning up to 20 runs
let page = await runs.list({ limit: 20 });

for (const run of page.data) {
  console.log(run);
}

// Keep getting the next page until there are no more runs
while (page.hasNextPage()) {
  page = await page.getNextPage();
  // Do something with the next page of runs
}
```

You can also use an Async Iterator to get all runs:

```ts  theme={null}
import { runs } from "@trigger.dev/sdk";

for await (const run of runs.list({ limit: 20 })) {
  console.log(run);
}
```

You can provide multiple filters to the `list()` function to narrow down the results:

```ts  theme={null}
import { runs } from "@trigger.dev/sdk";

const response = await runs.list({
  status: ["QUEUED", "EXECUTING"], // Filter by status
  taskIdentifier: ["my-task", "my-other-task"], // Filter by task identifier
  from: new Date("2024-04-01T00:00:00Z"), // Filter by created at
  to: new Date(),
  version: "20241127.2", // Filter by deployment version,
  tag: ["tag1", "tag2"], // Filter by tags
  batch: "batch_1234", // Filter by batch ID
  schedule: "sched_1234", // Filter by schedule ID
});
```

#### runs.retrieve()

Fetch a single run by it's ID:

```ts  theme={null}
import { runs } from "@trigger.dev/sdk";

const run = await runs.retrieve(runId);
```

You can provide the type of the task to correctly type the `run.payload` and `run.output`:

```ts  theme={null}
import { runs } from "@trigger.dev/sdk";
import type { myTask } from "./trigger/myTask";

const run = await runs.retrieve<typeof myTask>(runId);

console.log(run.payload.foo); // string
console.log(run.output.bar); // string
```

If you have just triggered a run, you can pass the entire response object to `retrieve()` and the response will already be typed:

```ts  theme={null}
import { runs, tasks } from "@trigger.dev/sdk";
import type { myTask } from "./trigger/myTask";

const response = await tasks.trigger<typeof myTask>({ foo: "bar" });
const run = await runs.retrieve(response);

console.log(run.payload.foo); // string
console.log(run.output.bar); // string
```

#### runs.cancel()

Cancel a run:

```ts  theme={null}
import { runs } from "@trigger.dev/sdk";

await runs.cancel(runId);
```

#### runs.replay()

Replay a run:

```ts  theme={null}
import { runs } from "@trigger.dev/sdk";

await runs.replay(runId);
```

#### runs.reschedule()

Updates a delayed run with a new delay. Only valid when the run is in the DELAYED state.

```ts  theme={null}
import { runs } from "@trigger.dev/sdk";

await runs.reschedule(runId, { delay: "1h" });
```

### Real-time updates

Subscribe to changes to a specific run in real-time:

```ts  theme={null}
import { runs } from "@trigger.dev/sdk";

for await (const run of runs.subscribeToRun(runId)) {
  console.log(run);
}
```

Similar to `runs.retrieve()`, you can provide the type of the task to correctly type the `run.payload` and `run.output`:

```ts  theme={null}
import { runs } from "@trigger.dev/sdk";
import type { myTask } from "./trigger/myTask";

for await (const run of runs.subscribeToRun<typeof myTask>(runId)) {
  console.log(run.payload.foo); // string
  console.log(run.output?.bar); // string | undefined
}
```

For more on real-time updates, see the [Realtime](/realtime) documentation.

### Triggering runs for undeployed tasks

It's possible to trigger a run for a task that hasn't been deployed yet. The run will enter the "Waiting for deploy" state until the task is deployed. Once deployed, the run will be queued and executed normally.
This feature is particularly useful in CI/CD pipelines where you want to trigger tasks before the deployment is complete.


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://trigger.dev/docs/llms.txt

# Concurrency & Queues

> Configure what you want to happen when there is more than one run at a time.

When you trigger a task, it isn't executed immediately. Instead, the task [run](/runs) is placed into a queue for execution.

By default, each task gets its own queue and the concurrency is only limited by your environment concurrency limit. If you need more control (for example, to limit concurrency or share limits across multiple tasks), you can define a custom queue as described later.

Controlling concurrency is useful when you have a task that can't be run concurrently, or when you want to limit the number of runs to avoid overloading a resource.

It's important to note that only actively executing runs count towards concurrency limits. Runs that are delayed or waiting in a queue do not consume concurrency slots until they begin execution.

## Default concurrency

By default, all tasks have an unbounded concurrency limit, limited only by the overall concurrency limits of your environment.

<Note>
  Your environment has a base concurrency limit and a burstable limit (default burst factor of 2.0x
  the base limit). Individual queues are limited by the base concurrency limit, not the burstable
  limit. For example, if your base limit is 10, your environment can burst up to 20 concurrent runs,
  but any single queue can have at most 10 concurrent runs. If you're a paying customer you can
  request higher burst limits by [contacting us](https://www.trigger.dev/contact).
</Note>

## Setting task concurrency

You can set the concurrency limit for a task by setting the `concurrencyLimit` property on the task's queue. This limits the number of runs that can be executing at any one time:

```ts /trigger/one-at-a-time.ts theme={null}
// This task will only run one at a time
export const oneAtATime = task({
  id: "one-at-a-time",
  queue: {
    concurrencyLimit: 1,
  },
  run: async (payload) => {
    //...
  },
});
```

This is useful if you need to control access to a shared resource, like a database or an API that has rate limits.

## Sharing concurrency between tasks

As well as putting queue settings directly on a task, you can define a queue and reuse it across multiple tasks. This allows you to share the same concurrency limit:

```ts /trigger/queue.ts theme={null}
export const myQueue = queue({
  name: "my-queue",
  concurrencyLimit: 1,
});

export const task1 = task({
  id: "task-1",
  queue: myQueue,
  run: async (payload: { message: string }) => {
    // ...
  },
});

export const task2 = task({
  id: "task-2",
  queue: myQueue,
  run: async (payload: { message: string }) => {
    // ...
  },
});
```

In this example, `task1` and `task2` share the same queue, so only one of them can run at a time.

## Setting the queue when you trigger a run

When you trigger a task you can override the default queue. This is really useful if you sometimes have high priority runs.

The task and queue definition:

```ts /trigger/override-concurrency.ts theme={null}
const paidQueue = queue({
  name: "paid-users",
  concurrencyLimit: 10,
});

export const generatePullRequest = task({
  id: "generate-pull-request",
  queue: {
    //normally when triggering this task it will be limited to 1 run at a time
    concurrencyLimit: 1,
  },
  run: async (payload) => {
    //todo generate a PR using OpenAI
  },
});
```

Triggering from your backend and overriding the queue:

```ts app/api/push/route.ts theme={null}
import { generatePullRequest } from "~/trigger/override-concurrency";

export async function POST(request: Request) {
  const data = await request.json();

  if (data.branch === "main") {
    //trigger the task, with the paid users queue
    const handle = await generatePullRequest.trigger(data, {
      // Set the paid users queue
      queue: "paid-users",
    });

    return Response.json(handle);
  } else {
    //triggered with the default queue (concurrency of 1)
    const handle = await generatePullRequest.trigger(data);
    return Response.json(handle);
  }
}
```

## Concurrency keys and per-tenant queuing

If you're building an application where you want to run tasks for your users, you might want a separate queue for each of your users (or orgs, projects, etc.).

You can do this by using `concurrencyKey`. It creates a copy of the queue for each unique value of the key.

Your backend code:

```ts app/api/pr/route.ts theme={null}
import { generatePullRequest } from "~/trigger/override-concurrency";

export async function POST(request: Request) {
  const data = await request.json();

  if (data.isFreeUser) {
    //the "free-users" queue has a concurrency limit of 1
    const handle = await generatePullRequest.trigger(data, {
      queue: "free-users",
      //this creates a free-users queue for each user
      concurrencyKey: data.userId,
    });

    //return a success response with the handle
    return Response.json(handle);
  } else {
    //the "paid-users" queue has a concurrency limit of 10
    const handle = await generatePullRequest.trigger(data, {
      queue: "paid-users",
      //this creates a paid-users queue for each user
      concurrencyKey: data.userId,
    });

    //return a success response with the handle
    return Response.json(handle);
  }
}
```

## Concurrency and subtasks

When you trigger a task that has subtasks, the subtasks will not inherit the queue from the parent task. Unless otherwise specified, subtasks will run on their own queue

```ts /trigger/subtasks.ts theme={null}
export const parentTask = task({
  id: "parent-task",
  run: async (payload) => {
    //trigger a subtask
    await subtask.triggerAndWait(payload);
  },
});

// This subtask will run on its own queue
export const subtask = task({
  id: "subtask",
  run: async (payload) => {
    //...
  },
});
```

## Waits and concurrency

With our [task checkpoint system](/how-it-works#the-checkpoint-resume-system), tasks can wait at various waitpoints (like waiting for subtasks to complete, delays, or external events). The way this system interacts with the concurrency system is important to understand.

Concurrency is only released when a run reaches a waitpoint and is checkpointed. When a run is checkpointed, it transitions to the `WAITING` state and releases its concurrency slot back to both the queue and the environment, allowing other runs to execute or resume.

This means that:

* Only actively executing runs count towards concurrency limits
* Runs in the `WAITING` state (checkpointed at waitpoints) do not consume concurrency slots
* You can have more runs in the `WAITING` state than your queue's concurrency limit
* When a waiting run resumes (e.g., when a subtask completes), it must re-acquire a concurrency slot

For example, if you have a queue with a `concurrencyLimit` of 1:

* You can only have exactly 1 run executing at a time
* You may have multiple runs in the `WAITING` state that belong to that queue
* When the executing run reaches a waitpoint and checkpoints, it releases its slot
* The next queued run can then begin execution

### Waiting for a subtask on a different queue

When a parent task triggers and waits for a subtask on a different queue, the parent task will checkpoint and release its concurrency slot once it reaches the wait point. This prevents environment deadlocks where all concurrency slots would be occupied by waiting tasks.

```ts /trigger/waiting.ts theme={null}
export const parentTask = task({
  id: "parent-task",
  queue: {
    concurrencyLimit: 1,
  },
  run: async (payload) => {
    //trigger a subtask and wait for it to complete
    await subtask.triggerAndWait(payload);
    // The parent task checkpoints here and releases its concurrency slot
    // allowing other tasks to execute while waiting
  },
});

export const subtask = task({
  id: "subtask",
  run: async (payload) => {
    //...
  },
});
```

When the parent task reaches the `triggerAndWait` call, it checkpoints and transitions to the `WAITING` state, releasing its concurrency slot back to both its queue and the environment. Once the subtask completes, the parent task will resume and re-acquire a concurrency slot.


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://trigger.dev/docs/llms.txt