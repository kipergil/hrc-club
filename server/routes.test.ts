import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The storage layer is mocked, so these tests exercise what the routes are
 * actually responsible for — cache policy, validation, the honeypot, and
 * the wording of a 404 — without needing a Directus instance to talk to.
 */
const createEnquiry = vi.fn(async () => ({ id: "enquiry-1" }));

vi.mock("./storage.js", () => ({
  getSettings: async () => ({ clubName: "HRC Table Tennis Club", announcement: null }),
  getHome: async () => ({ settings: {}, nextFixtures: [], latestResults: [] }),
  getPage: async (slug: string) => (slug === "about" ? { id: "1", slug, title: "About" } : null),
  getStandings: async () => [],
  getSessions: async () => [],
  getFixtures: async () => [],
  createEnquiry,
}));

const { createApp } = await import("./app.js");
const app = createApp();

const validEnquiry = {
  name: "Ruth Whitfield",
  email: "ruth@example.invalid",
  enquiryType: "join",
  message: "I played at school and would like to start again. Would Tuesdays suit a beginner?",
};

beforeEach(() => {
  createEnquiry.mockClear();
});

describe("cache policy", () => {
  it("caches editorial content for an hour at the CDN", async () => {
    const response = await request(app).get("/api/pages/about");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("s-maxage=3600");
    expect(response.headers["cache-control"]).toContain("stale-while-revalidate");
  });

  it("caches league data for ten minutes, so a result lands quickly", async () => {
    const response = await request(app).get("/api/standings");
    expect(response.headers["cache-control"]).toContain("s-maxage=600");
  });

  it("never caches anything a person just submitted", async () => {
    const response = await request(app).post("/api/enquiries").send(validEnquiry);
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });
});

describe("404s", () => {
  it("answers with a sentence and a way out, not a status code", async () => {
    const response = await request(app).get("/api/pages/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/couldn't find/i);
    expect(response.body.message).toMatch(/menu/i);
  });
});

describe("POST /api/enquiries", () => {
  it("stores a valid enquiry", async () => {
    const response = await request(app).post("/api/enquiries").send(validEnquiry);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ received: true });
    expect(createEnquiry).toHaveBeenCalledOnce();
  });

  it("returns errors keyed by field, so each sits beside its own input", async () => {
    const response = await request(app)
      .post("/api/enquiries")
      .send({ ...validEnquiry, email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(response.body.errors).toHaveProperty("email");
    expect(response.body.errors.email).toMatch(/email address/i);
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  /**
   * The behaviour that matters is the pair: the bot is told it worked, and
   * nothing is written. A 400 here would be worse than no honeypot at all,
   * because it tells the bot exactly which field to stop filling in.
   */
  it("answers a filled honeypot as if it worked, and stores nothing", async () => {
    const response = await request(app)
      .post("/api/enquiries")
      .send({ ...validEnquiry, website: "http://spam.example" });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ received: true });
    expect(createEnquiry).not.toHaveBeenCalled();
  });
});

describe("machine endpoints", () => {
  it("refuses a revalidate call with no shared secret", async () => {
    const response = await request(app).post("/api/revalidate");
    expect([401, 503]).toContain(response.status);
    expect(response.body.message).toBeTruthy();
  });
});
