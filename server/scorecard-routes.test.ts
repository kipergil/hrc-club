import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "./lib/env.js";
import { ScorecardAiUnavailable } from "./lib/scorecard-ai.js";

/**
 * What the upload route does when the reading fails.
 *
 * Two things it must get right, both of which it got wrong until a real
 * card was uploaded and the API turned out to want a workspace id:
 *
 *  1. **The image is always filed.** It is uploaded to Directus before the
 *     model is called, so any path that returns without recording it
 *     leaves an unreferenced file behind — once per attempt, silently.
 *     The no-key case was already fixed this way; the misconfigured-key
 *     case reintroduced it.
 *  2. **A configuration fault is not reported as a bad card.** 503 and a
 *     sentence, not 422 and the API's own JSON.
 */

// `vi.hoisted`, because `vi.mock` is lifted above every other statement in
// the file and its factories would otherwise close over uninitialised
// bindings.
const { storeScorecardImage, recordScorecardUpload, parseScorecardImage } = vi.hoisted(() => ({
  storeScorecardImage: vi.fn(async (_image: unknown) => "file-1"),
  // The parameter is declared so the recorded call is typed: without it
  // `mock.calls[0]` is an empty tuple and the assertions below cannot
  // reach the argument they are about.
  recordScorecardUpload: vi.fn(async (_upload: Record<string, unknown>) => ({ id: "upload-1" })),
  parseScorecardImage: vi.fn(),
}));

vi.mock("./storage.js", () => ({
  getSettings: async () => ({ clubName: "HRC Table Tennis Club", announcement: null }),
  getFixtureSquads: async () => ({
    fixture: {
      id: "fixture-1",
      homeTeam: { name: "HRC B", slug: "hrc-b" },
      awayTeam: { name: "Water Lane A", slug: "water-lane-a" },
    },
    homeSquad: [{ fullName: "Jane Smith" }],
    awaySquad: [{ fullName: "Ravi Patel" }],
  }),
  storeScorecardImage,
  recordScorecardUpload,
}));

vi.mock("./lib/scorecard-ai.js", async () => {
  const actual = await vi.importActual<typeof import("./lib/scorecard-ai.js")>(
    "./lib/scorecard-ai.js",
  );
  return { ...actual, aiConfigured: () => true, parseScorecardImage };
});

const { createApp } = await import("./app.js");
const app = createApp();

const PASSWORD = "a-shared-result-entry-password";
const body = {
  fixtureId: "fixture-1",
  mediaType: "image/png",
  image: Buffer.from("not really a png").toString("base64"),
};

function upload() {
  return request(app)
    .post("/api/admin/scorecards/parse")
    .set("x-admin-token", PASSWORD)
    .send(body);
}

beforeEach(() => {
  env.ADMIN_TOKEN = PASSWORD;
  storeScorecardImage.mockClear();
  recordScorecardUpload.mockClear();
  parseScorecardImage.mockReset();
});

describe("when the card cannot be sent for reading", () => {
  beforeEach(() => {
    parseScorecardImage.mockRejectedValue(
      new ScorecardAiUnavailable(
        "The Anthropic API key is linked to a person rather than to one workspace, so it also needs " +
          "a workspace id. Set ANTHROPIC_WORKSPACE_ID. You can enter this card by hand in the meantime.",
      ),
    );
  });

  it("says it is not the card's fault, and says what to do", async () => {
    const response = await upload();

    expect(response.status).toBe(503);
    expect(response.body.message).toContain("ANTHROPIC_WORKSPACE_ID");
    expect(response.body.message).toContain("by hand");
    // The API's own error text is for an operator reading a log, not for a
    // captain reading a screen.
    expect(response.body.message).not.toContain("invalid_request_error");
  });

  it("files the image instead of orphaning it", async () => {
    await upload();

    expect(storeScorecardImage).toHaveBeenCalledTimes(1);
    expect(recordScorecardUpload).toHaveBeenCalledTimes(1);
    expect(recordScorecardUpload.mock.calls[0]![0]).toMatchObject({
      fixtureId: "fixture-1",
      imageId: "file-1",
      status: "failed",
    });
  });
});

describe("when the card itself is the problem", () => {
  it("is a 422, and still files the image", async () => {
    parseScorecardImage.mockRejectedValue(
      new Error("The model did not return a scorecard. The image may not be a match card."),
    );

    const response = await upload();

    expect(response.status).toBe(422);
    expect(response.body.message).toContain("may not be a match card");
    expect(recordScorecardUpload).toHaveBeenCalledTimes(1);
  });
});

describe("the gate", () => {
  it("does not upload anything for a caller without the password", async () => {
    const response = await request(app)
      .post("/api/admin/scorecards/parse")
      .set("x-admin-token", "wrong")
      .send(body);

    expect(response.status).toBe(401);
    expect(storeScorecardImage).not.toHaveBeenCalled();
    expect(parseScorecardImage).not.toHaveBeenCalled();
  });
});
