import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "./lib/env.js";
import { ScorecardAiUnavailable, parseScorecardImage } from "./lib/scorecard-ai.js";

/**
 * The Anthropic call, exercised against a stand-in for the API.
 *
 * These are the tests the feature shipped without, and the first real
 * upload found what they would have found: the key in use is
 * identity-linked, so the API refused the request outright with
 *
 *   anthropic-workspace-id is required when authenticating with an
 *   identity-linked API key
 *
 * That is not something a typecheck, a unit test of the card arithmetic or
 * a build can see. It needs the request to actually leave the process, so
 * these point the SDK at a local server (via ANTHROPIC_BASE_URL) and assert
 * on the headers that arrive and on what comes back out of a rejection.
 */

let received: { headers: IncomingMessage["headers"]; body: string } | null = null;
let respond: (res: ServerResponse) => void;
let server: Server;
let baseUrl: string;

const IMAGE = { data: Buffer.from("not really a png").toString("base64"), mediaType: "image/png" };

/** A minimal well-formed reply: one tool_use block holding one rubber. */
function replyWithCard(res: ServerResponse) {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-opus-5",
      stop_reason: "tool_use",
      usage: { input_tokens: 1200, output_tokens: 90 },
      content: [
        {
          type: "tool_use",
          id: "toolu_test",
          name: "record_scorecard",
          input: {
            rubbers: [
              { rubberNumber: 1, homePlayer: "J Smith", awayPlayer: "R Patel", games: [[11, 8]] },
            ],
          },
        },
      ],
    }),
  );
}

/** The exact body the API returns for an identity-linked key. */
function replyWorkspaceRequired(res: ServerResponse) {
  res.writeHead(400, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      type: "error",
      error: {
        type: "invalid_request_error",
        message:
          "anthropic-workspace-id is required when authenticating with an identity-linked API key; " +
          "send the id of the workspace this request acts in.",
      },
      request_id: null,
    }),
  );
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      received = { headers: req.headers, body: Buffer.concat(chunks).toString() };
      respond(res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  process.env.ANTHROPIC_BASE_URL = baseUrl;
});

afterAll(async () => {
  delete process.env.ANTHROPIC_BASE_URL;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  received = null;
  respond = replyWithCard;
  // `env` is read when the client is built, so setting it here is what a
  // deployment's configuration does.
  env.ANTHROPIC_API_KEY = "sk-ant-test";
  env.ANTHROPIC_WORKSPACE_ID = undefined;
  // Note the SDK retries a 429 or a 5xx twice by default (maxRetries is a
  // constructor option, not an env var), so `received` after one of those
  // is the last attempt rather than the only one. The 200 and 400 cases,
  // which the header assertions use, are not retried.
});

describe("the workspace header", () => {
  it("is sent when a workspace id is configured", async () => {
    env.ANTHROPIC_WORKSPACE_ID = "wrkspc_01Example";

    await parseScorecardImage(IMAGE);

    expect(received?.headers["anthropic-workspace-id"]).toBe("wrkspc_01Example");
  });

  it("is left off entirely when there is none", async () => {
    await parseScorecardImage(IMAGE);

    // Not sent as an empty string: a workspace-scoped key already carries
    // its own workspace, and an empty contradicting header is worse than
    // no header at all.
    expect(received?.headers).not.toHaveProperty("anthropic-workspace-id");
  });

  it("still sends the card itself", async () => {
    env.ANTHROPIC_WORKSPACE_ID = "wrkspc_01Example";

    const result = await parseScorecardImage(IMAGE);

    const body = JSON.parse(received!.body);
    expect(body.model).toBe(env.SCORECARD_MODEL);
    expect(body.messages[0].content[0]).toMatchObject({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: IMAGE.data },
    });
    // Forced onto the tool, so a prose answer is not a shape we can get.
    expect(body.tool_choice).toEqual({ type: "tool", name: "record_scorecard" });
    expect(result.card.rubbers).toHaveLength(1);
    expect(result.inputTokens).toBe(1200);
  });
});

describe("when the API refuses", () => {
  it("explains the identity-linked key instead of relaying JSON", async () => {
    respond = replyWorkspaceRequired;

    const error = await parseScorecardImage(IMAGE).catch((caught: unknown) => caught);

    // The old behaviour put `400 {"type":"error",...}` on screen for a team
    // captain, who can do nothing with it and is not even told the fault is
    // a configuration one.
    expect(error).toBeInstanceOf(ScorecardAiUnavailable);
    expect((error as Error).message).toContain("ANTHROPIC_WORKSPACE_ID");
    expect((error as Error).message).toContain("by hand");
    expect((error as Error).message).not.toContain("invalid_request_error");
  });

  it("names the key when the key is rejected", async () => {
    respond = (res) => {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "authentication_error" } }));
    };

    const error = await parseScorecardImage(IMAGE).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ScorecardAiUnavailable);
    expect((error as Error).message).toContain("ANTHROPIC_API_KEY");
  });

  it("names the model when the model does not exist", async () => {
    respond = (res) => {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "not_found_error" } }));
    };

    const error = await parseScorecardImage(IMAGE).catch((caught: unknown) => caught);

    expect((error as Error).message).toContain("SCORECARD_MODEL");
  });

  it("treats a rate limit as temporary rather than as a bad card", async () => {
    respond = (res) => {
      res.writeHead(429, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "rate_limit_error" } }));
    };

    const error = await parseScorecardImage(IMAGE).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ScorecardAiUnavailable);
    expect((error as Error).message).toContain("again");
  });
});

describe("when the card is the problem", () => {
  it("says so, and is not an availability error", async () => {
    // A successful call that returned prose instead of the tool — the one
    // failure that really is about what was in the photograph.
    respond = (res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-opus-5",
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
          content: [{ type: "text", text: "This is a photograph of a dog." }],
        }),
      );
    };

    const error = await parseScorecardImage(IMAGE).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ScorecardAiUnavailable);
    expect((error as Error).message).toContain("may not be a match card");
  });
});
