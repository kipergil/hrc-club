import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env.js";
import {
  DOUBLES_RUBBER,
  RUBBERS_PER_MATCH,
  SINGLES_ORDER,
  scorecardInputSchema,
  type ScorecardInput,
} from "../../shared/scorecard.js";

/**
 * Reading a photographed match card with Claude.
 *
 * The card is a fixed printed form (`SingleScoreCard.htm`), which changes
 * the nature of the job: the model is not being asked to understand a
 * document, it is being asked to transcribe known cells. Everything the
 * form guarantees — three players a side, nine singles in a printed
 * order, best of five, ten rubbers — is told to it up front and then
 * *checked afterwards* by `shared/scorecard.ts`, which is the part that
 * matters. A transcription nothing verifies is a rumour.
 *
 * Three deliberate choices:
 *
 *  - **A tool with a strict schema**, not free text and not "reply with
 *    JSON". The response either fits the shape or the call fails, so
 *    nothing downstream has to parse prose or cope with a stray "```json".
 *  - **Nothing is invented.** The prompt is explicit that an unreadable
 *    cell is left empty; a plausible guess in a score column is worse
 *    than a blank one, because a blank is visible in the review screen
 *    and a plausible guess is not.
 *  - **Never saved directly.** The result is a draft for a human to
 *    approve. That is a product decision as much as a safety one: the
 *    captain who took the photo is the person who knows what the scrawl
 *    said.
 */

/** The extraction tool. Its schema is the contract with the model. */
const EXTRACT_TOOL: Anthropic.Tool = {
  name: "record_scorecard",
  description:
    "Record everything written on the match card. Leave any field you cannot read with confidence as null, or omit the game.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["homePlayers", "awayPlayers", "rubbers"],
    properties: {
      playedOn: {
        type: ["string", "null"],
        description: "The date on the card as YYYY-MM-DD. Null if absent or ambiguous.",
      },
      homeTeamName: { type: ["string", "null"] },
      awayTeamName: { type: ["string", "null"] },
      startTime: { type: ["string", "null"], description: 'e.g. "19:30".' },
      finishTime: { type: ["string", "null"] },
      /*
       * The line-up box, and the most important thing on the card.
       *
       * The sheet names its three players a side once, against the
       * letters, and the nine singles rows then refer to the letters
       * alone. Reading the box gives six names to check instead of
       * eighteen, and — because the pairing order is printed — determines
       * every singles rubber's players outright.
       */
      homePlayers: {
        type: "object",
        additionalProperties: false,
        required: ["A", "B", "C"],
        description: "The home team's three players, as the card lists them against A, B and C.",
        properties: {
          A: { type: ["string", "null"] },
          B: { type: ["string", "null"] },
          C: { type: ["string", "null"] },
        },
      },
      awayPlayers: {
        type: "object",
        additionalProperties: false,
        required: ["X", "Y", "Z"],
        description: "The away team's three players, as the card lists them against X, Y and Z.",
        properties: {
          X: { type: ["string", "null"] },
          Y: { type: ["string", "null"] },
          Z: { type: ["string", "null"] },
        },
      },
      rubbers: {
        type: "array",
        description: `One entry per row of the card, up to ${RUBBERS_PER_MATCH}.`,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["rubberNumber", "homePlayer", "awayPlayer", "games"],
          properties: {
            rubberNumber: {
              type: "integer",
              description: `1-9 are the singles in the card's printed order; ${DOUBLES_RUBBER} is the doubles.`,
            },
            homePlayer: {
              type: ["string", "null"],
              description:
                "Only if this row itself writes a name. Null for a singles row that just holds " +
                "scores — the player is already known from the line-up box and the printed order.",
            },
            homePlayer2: {
              type: ["string", "null"],
              description: "Home partner. Only on the doubles row; null on every singles.",
            },
            awayPlayer: { type: ["string", "null"] },
            awayPlayer2: { type: ["string", "null"] },
            games: {
              type: "array",
              maxItems: 5,
              description:
                "The 1st-5th game columns, home points first: [[11,8],[9,11],[11,6]]. Include only games that were played.",
              items: {
                type: "array",
                minItems: 2,
                maxItems: 2,
                items: { type: "integer" },
              },
            },
          },
        },
      },
    },
  },
};

/**
 * What the model is told about the card before it looks at one.
 *
 * The printed pairing order is in here because it is the strongest single
 * hint available: knowing that row 4 is B-X means a smudged name in row 4
 * can be read against the clean one in row 2. It is also checked
 * afterwards, so telling the model does not make the check redundant — it
 * makes disagreement rarer and more meaningful when it happens.
 */
const SYSTEM = `You transcribe table tennis match cards for the Hertford & District Table Tennis League.

The card is a fixed printed form. Every card has the same structure:

- **A line-up box near the top** naming three players a side against letters: the home players are A, B and C, the away players are X, Y and Z. Read this box carefully — it is the most important thing on the card, because the nine singles rows below refer to the letters rather than repeating the names.
- Names in that box are usually written informally, most often a first name alone ("Sunil", "Dave"). Record exactly what is written. Do not expand a first name into a full name, and do not invent a surname.
- Ten rubbers: nine singles then a doubles. The singles are always played in this printed order, and the order never varies:
${SINGLES_ORDER.map((pair, index) => `  ${index + 1}. ${pair[0]} v ${pair[1]}`).join("\n")}
  ${DOUBLES_RUBBER}. Doubles (two players a side)
- Each rubber is best of five games, 11 up, win by two clear points. The card has five game columns and a SETS column.
- Because the pairing order is fixed, the same three home names recur in a known pattern, and so do the away names. Use that to read a name that is clear in one row and unclear in another.

Rules:
- Transcribe only what is written. If a cell is empty, unreadable, or you are unsure, use null for a name and omit the game rather than guessing. A blank is easy for a human to fill in; a confident wrong number is not.
- Game scores are home points first, matching the card's Home row above the Away row.
- Do not compute or correct anything. If the card's own arithmetic is wrong, record what is written — that disagreement is useful and something else checks for it.
- Names: give them as written, including initials. Do not expand "S. Trakru" into a full name you have inferred.
- **Per-rubber names are only for rows that actually write one.** Most singles rows hold nothing but scores, because the line-up box already says who is playing. Leave homePlayer and awayPlayer null on those rows rather than copying the name down from the box — copying it in would hide a row that genuinely disagrees, which is one of the checks run afterwards. The doubles is the exception: its pairing is not fixed, so name both players a side there if the card does.`;

export interface ParseResult {
  card: ScorecardInput;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * The reading could not be attempted — as opposed to being attempted and
 * going wrong. No key, a key the API rejects, a workspace it will not infer,
 * a model name that does not exist, a rate limit, an outage. None of these
 * are anything to do with the card in the photograph, and telling a captain
 * their card "could not be read" when the real answer is that nobody has
 * finished configuring the server sends them looking for a better
 * photograph of a card that was never the problem.
 */
export class ScorecardAiUnavailable extends Error {}

export function aiConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/**
 * Turns an Anthropic API error into a sentence for the person at the
 * screen, and decides whether it was the card's fault.
 *
 * The raw error is JSON written for whoever operates the service, and it
 * was going straight to the browser: the first real card ever uploaded came
 * back as `400 {"type":"error","error":{...}}`, which tells a team captain
 * nothing they can act on and does not even hint that the fix is a
 * configuration one. The detail still goes to the log, where an operator
 * can find it; the reader gets what to do next.
 */
function describeApiError(error: unknown): { message: string; configuration: boolean } | null {
  if (!(error instanceof Anthropic.APIError)) return null;

  const detail = typeof error.message === "string" ? error.message : "";
  const unavailable = (message: string) => ({ message, configuration: true });

  // Checked before the status codes: an identity-linked key returns a plain
  // 400, the same status as a genuinely malformed request, so the status
  // alone cannot tell the two apart.
  if (detail.includes("anthropic-workspace-id")) {
    return unavailable(
      "The Anthropic API key is linked to a person rather than to one workspace, so it also needs a workspace id. " +
        "Set ANTHROPIC_WORKSPACE_ID (it looks like wrkspc_01…, and is on the workspace's page in the Anthropic Console). " +
        "You can enter this card by hand in the meantime.",
    );
  }

  switch (error.status) {
    case 401:
      return unavailable(
        "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY. You can still enter this card by hand.",
      );
    case 403:
      return unavailable(
        "The Anthropic API key is not allowed to do this. Check that it belongs to the right workspace. " +
          "You can still enter this card by hand.",
      );
    case 404:
      return unavailable(
        `No model named "${env.SCORECARD_MODEL}" is available to this key. Check SCORECARD_MODEL. ` +
          "You can still enter this card by hand.",
      );
    case 429:
      return unavailable(
        "Anthropic is rate-limiting us at the moment. Try again in a minute, or enter this card by hand.",
      );
    default:
      if (error.status && error.status >= 500) {
        return unavailable(
          "Anthropic could not be reached just now. Try again shortly, or enter this card by hand.",
        );
      }
      // A 400 that is not the workspace one is ours to fix and not the
      // card's fault either, so it is still not reported as a bad card.
      return unavailable(
        "The card could not be sent for reading, which is a fault at our end rather than a problem with the card. " +
          "You can enter it by hand.",
      );
  }
}

/**
 * Reads one card image.
 *
 * Throws `ScorecardAiUnavailable` when there is no API key, which the
 * route turns into a plain message rather than a 500 — a league without
 * an Anthropic account should still be able to type a card in by hand,
 * and the absence of a key is a configuration fact rather than a fault.
 */
export async function parseScorecardImage(
  image: { data: string; mediaType: string },
  context?: { homeTeamName?: string; awayTeamName?: string; homeSquad?: string[]; awaySquad?: string[] },
): Promise<ParseResult> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new ScorecardAiUnavailable(
      "No Anthropic API key is configured, so cards cannot be read automatically. You can still enter this one by hand.",
    );
  }

  /*
   * The workspace header goes on the client, not on the request, because
   * it belongs to the credential rather than to this call. It is sent only
   * when configured: a workspace-scoped key already carries its workspace,
   * and sending a contradicting id with one would be worse than sending
   * nothing.
   */
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    ...(env.ANTHROPIC_WORKSPACE_ID
      ? { defaultHeaders: { "anthropic-workspace-id": env.ANTHROPIC_WORKSPACE_ID } }
      : {}),
  });

  /*
   * The squads, where we know them, as a hint rather than a constraint.
   * A player who has been drafted in is not on the list, and the card is
   * the authority on who actually played — so this says "expect these"
   * and never "only these".
   */
  const hints: string[] = [];
  if (context?.homeTeamName) hints.push(`The home team is ${context.homeTeamName}.`);
  if (context?.awayTeamName) hints.push(`The away team is ${context.awayTeamName}.`);
  if (context?.homeSquad?.length) {
    hints.push(
      `Home players are usually drawn from: ${context.homeSquad.join(", ")}. ` +
        "Someone else may have played; the card is the authority.",
    );
  }
  if (context?.awaySquad?.length) {
    hints.push(`Away players are usually drawn from: ${context.awaySquad.join(", ")}.`);
  }

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: env.SCORECARD_MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      tools: [EXTRACT_TOOL],
      // The model's only job is to fill the tool in; letting it answer in
      // prose instead is a failure mode with no upside here.
      tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: image.mediaType as "image/png", data: image.data },
            },
            {
              type: "text",
              text: [
                "Transcribe this match card.",
                ...hints,
                "Leave anything you cannot read as null.",
              ].join("\n"),
            },
          ],
        },
      ],
    });
  } catch (error) {
    const described = describeApiError(error);
    if (described?.configuration) {
      // The operator's copy, with the request id the API returns — the
      // thing worth having when this needs chasing.
      console.error("[scorecard] Anthropic rejected the request:", error);
      throw new ScorecardAiUnavailable(described.message);
    }
    throw error;
  }

  const block = response.content.find(
    (item): item is Anthropic.ToolUseBlock => item.type === "tool_use" && item.name === EXTRACT_TOOL.name,
  );
  if (!block) {
    throw new Error("The model did not return a scorecard. The image may not be a match card.");
  }

  /*
   * Parsed through Zod rather than trusted, even though the tool schema
   * constrains it. The schema is enforced by the API, but this boundary
   * is the one place that decides what the rest of the server may
   * believe, and it costs nothing to be certain here.
   */
  const card = scorecardInputSchema.parse({
    playedOn: null,
    homeTeamName: null,
    awayTeamName: null,
    startTime: null,
    finishTime: null,
    ...(block.input as Record<string, unknown>),
    rubbers: ((block.input as { rubbers?: unknown[] }).rubbers ?? []).map((rubber) => ({
      homePlayer: null,
      homePlayer2: null,
      awayPlayer: null,
      awayPlayer2: null,
      games: [],
      ...(rubber as Record<string, unknown>),
    })),
  });

  return {
    card,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
