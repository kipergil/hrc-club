import { z } from "zod";
import { ENQUIRY_TYPE } from "./enums.js";

/**
 * One definition of validity, one set of messages, used by the form in the
 * browser and by the route on the server. The league PRD is specific about
 * the wording: an error says what happened and exactly what to do next, in
 * the second person, next to the field concerned. Never a code, never
 * "invalid input".
 */
export const enquiryInputSchema = z.object({
  name: z
    .string({ required_error: "Please tell us your name so we know who to reply to." })
    .trim()
    .min(1, "Please tell us your name so we know who to reply to.")
    .max(120, "That name is longer than we can store — please shorten it."),
  email: z
    .string({ required_error: "Please give us an email address so we can reply." })
    .trim()
    .min(1, "Please give us an email address so we can reply.")
    .email("That doesn't look like an email address. Check for a missing @ or a typo."),
  phone: z
    .string()
    .trim()
    .max(32, "That phone number is longer than we can store.")
    .optional()
    .or(z.literal("")),
  enquiryType: z.enum(ENQUIRY_TYPE, {
    required_error: "Please choose what your message is about.",
    invalid_type_error: "Please choose one of the options for what your message is about.",
  }),
  message: z
    .string({ required_error: "Please tell us a little about what you're after." })
    .trim()
    .min(10, "Please add a little more detail — at least a sentence — so we can help.")
    .max(4000, "That message is very long. Please shorten it, or email us instead."),
  sourcePage: z.string().max(255).optional(),
  /**
   * Honeypot. A real person never sees this field, so a real person never
   * fills it in; a bot fills in everything it finds. Named plausibly enough
   * that a naive bot will take the bait.
   *
   * Deliberately permissive: rejecting a filled honeypot *here* would hand
   * the bot a validation error, which is exactly the feedback that teaches
   * it to try again without the field. The route accepts the submission,
   * answers as if it worked, and quietly declines to store it.
   */
  website: z.string().max(255).optional(),
});

export type EnquiryInput = z.infer<typeof enquiryInputSchema>;

/**
 * Saving a card.
 *
 * Note what is *not* here: the match score. It is derived from the games
 * on the server, so a caller cannot save a card whose rows disagree with
 * its own scoreline — the one inconsistency that would be invisible on
 * every page that shows the result.
 */
export const saveScorecardSchema = z.object({
  fixtureId: z.string().min(1),
  playedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-23.")
    .nullable()
    .optional(),
  savedBy: z.string().trim().max(80).optional(),
  rubbers: z
    .array(
      z.object({
        rubberNumber: z.number().int().min(1).max(10),
        kind: z.enum(["singles", "doubles"]),
        homePlayerId: z.string().nullable(),
        homePlayer2Id: z.string().nullable(),
        awayPlayerId: z.string().nullable(),
        awayPlayer2Id: z.string().nullable(),
        homePlayerName: z.string().trim().max(120).nullable(),
        awayPlayerName: z.string().trim().max(120).nullable(),
        games: z.array(z.tuple([z.number().int().min(0).max(99), z.number().int().min(0).max(99)])).max(5),
      }),
    )
    .max(10),
});

export type SaveScorecardInput = z.infer<typeof saveScorecardSchema>;
