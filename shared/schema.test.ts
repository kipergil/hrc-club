import { describe, expect, it } from "vitest";
import { enquiryInputSchema } from "./schema.js";

const valid = {
  name: "Ruth Whitfield",
  email: "ruth@example.invalid",
  enquiryType: "join" as const,
  message: "I played at school and would like to start again. Would Tuesdays suit a beginner?",
};

describe("enquiryInputSchema", () => {
  it("accepts a realistic enquiry", () => {
    expect(enquiryInputSchema.safeParse(valid).success).toBe(true);
  });

  it("gives every message in the second person, with no codes or jargon", () => {
    const result = enquiryInputSchema.safeParse({ name: "", email: "nope", message: "hi" });
    expect(result.success).toBe(false);
    if (result.success) return;

    for (const issue of result.error.issues) {
      // The PRD's rule: say what to do next, in a sentence, never "invalid
      // input" and never a code.
      expect(issue.message).not.toMatch(/invalid|required|must be|expected/i);
      expect(issue.message.length).toBeGreaterThan(20);
      expect(issue.message).toMatch(/[.?]$/);
    }
  });

  it("asks for a sentence rather than accepting a one-word message", () => {
    const result = enquiryInputSchema.safeParse({ ...valid, message: "hi" });
    expect(result.success).toBe(false);
  });

  /**
   * The honeypot has to pass validation. Rejecting it here would hand a bot
   * the one thing that teaches it to try again without the field — see the
   * comment on the field itself.
   */
  it("accepts a filled honeypot so the route can answer as if it worked", () => {
    const result = enquiryInputSchema.safeParse({ ...valid, website: "http://spam.example" });
    expect(result.success).toBe(true);
  });

  it("treats the phone number as optional", () => {
    expect(enquiryInputSchema.safeParse({ ...valid, phone: "" }).success).toBe(true);
    expect(enquiryInputSchema.safeParse({ ...valid, phone: "01992 123456" }).success).toBe(true);
  });
});
