import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { apiPost } from "@shared/api-client.js";
import { ENQUIRY_TYPE, ENQUIRY_TYPE_LABELS, type EnquiryType } from "@shared/enums.js";
import { enquiryInputSchema } from "@shared/schema.js";
import { PageHeader } from "@/components/layout";
import { Alert, Button, Card } from "@/components/ui";
import { useSettings } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Errors = Partial<Record<string, string>>;

/**
 * Replaces the league site's feedback form, which had to be switched off
 * because spam made it unusable. Three things stop that happening here: a
 * honeypot field, a five-an-hour rate limit on the endpoint, and a
 * moderated queue in Directus rather than an inbox.
 *
 * The form itself is deliberately plain — one column, real labels above
 * every field, no placeholder-as-label, and each error message sitting
 * next to the field it belongs to rather than in a summary at the top.
 */
export function ContactPage() {
  const { data: settings } = useSettings();
  const [pathname] = useLocation();
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const successRef = useRef<HTMLDivElement>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);

    const form = new FormData(event.currentTarget);
    const candidate = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      enquiryType: String(form.get("enquiryType") ?? "general") as EnquiryType,
      message: String(form.get("message") ?? ""),
      website: String(form.get("website") ?? ""),
      sourcePage: pathname,
    };

    // Validated with the same schema the server uses, so the browser and
    // the server can never disagree about what is acceptable.
    const parsed = enquiryInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !next[field]) next[field] = issue.message;
      }
      setErrors(next);
      // Move focus to the first thing that needs fixing, rather than
      // leaving a keyboard or screen-reader user to hunt for it.
      const firstField = Object.keys(next)[0];
      if (firstField) {
        document.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus();
      }
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await apiPost<{ received: boolean }, typeof parsed.data>("/api/enquiries", parsed.data);
      setSent(true);
      window.setTimeout(() => successRef.current?.focus(), 0);
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : "We couldn't send that. Please try again in a moment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div>
        <PageHeader title="Thank you" subtitle="Your message is on its way" />
        <div ref={successRef} tabIndex={-1}>
          <Alert title="We've got your message.">
            <p>
              Someone from the club will read it and reply, usually within a few days. If it’s
              urgent, come along on a club night — there is always someone there who can help.
            </p>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Contact us" subtitle="Send us a message" />

      <p className="max-w-prose text-lg">
        Whether you want to join, ask about coaching for a child, or just find out whether you’d fit
        in — write to us here and a real person will reply.
        {settings?.contactEmail ? (
          <>
            {" "}
            You can also email us directly at{" "}
            <a href={`mailto:${settings.contactEmail}`} className="text-brand underline">
              {settings.contactEmail}
            </a>
            .
          </>
        ) : null}
      </p>

      {failure ? (
        <Alert tone="warning" title="That didn't send.">
          <p>{failure}</p>
        </Alert>
      ) : null}

      <Card className="max-w-prose">
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          <Field
            name="name"
            label="Your name"
            hint="So we know who we're replying to."
            error={errors.name}
            autoComplete="name"
          />
          <Field
            name="email"
            label="Your email address"
            hint="We'll only use it to reply to you."
            error={errors.email}
            type="email"
            autoComplete="email"
          />
          <Field
            name="phone"
            label="Your phone number"
            hint="Optional — only if you'd rather we rang."
            error={errors.phone}
            type="tel"
            autoComplete="tel"
            required={false}
          />

          <div>
            <label htmlFor="enquiryType" className="block text-lg font-semibold">
              What's it about?
            </label>
            <select
              id="enquiryType"
              name="enquiryType"
              defaultValue="general"
              className="mt-2 min-h-touch w-full rounded-card border-2 border-line bg-surface px-3 text-base text-ink"
            >
              {ENQUIRY_TYPE.map((value) => (
                <option key={value} value={value}>
                  {ENQUIRY_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="message" className="block text-lg font-semibold">
              Your message
            </label>
            <p id="message-hint" className="text-ink-muted">
              Tell us a little about yourself — whether you've played before, and what you're looking
              for.
            </p>
            <textarea
              id="message"
              name="message"
              rows={6}
              required
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={cn("message-hint", errors.message && "message-error")}
              className={cn(
                "mt-2 w-full rounded-card border-2 bg-surface px-3 py-2 text-base text-ink",
                errors.message ? "border-negative" : "border-line",
              )}
            />
            {errors.message ? (
              <p id="message-error" className="mt-1 font-semibold text-negative">
                {errors.message}
              </p>
            ) : null}
          </div>

          {/*
            The honeypot. Hidden from sight and from screen readers, and
            excluded from the tab order, so no real person ever meets it —
            which is what makes anything typed into it a reliable signal.
          */}
          <div aria-hidden="true" className="absolute h-px w-px overflow-hidden opacity-0">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send your message"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Field({
  name,
  label,
  hint,
  error,
  type = "text",
  autoComplete,
  required = true,
}: {
  name: string;
  label: string;
  hint: string;
  error?: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-lg font-semibold">
        {label}
      </label>
      <p id={`${name}-hint`} className="text-ink-muted">
        {hint}
      </p>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(`${name}-hint`, error && `${name}-error`)}
        className={cn(
          "mt-2 min-h-touch w-full rounded-card border-2 bg-surface px-3 text-base text-ink",
          error ? "border-negative" : "border-line",
        )}
      />
      {error ? (
        <p id={`${name}-error`} className="mt-1 font-semibold text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}
