import { CheckCircle2, Mail, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { apiPost } from "@shared/api-client.js";
import { ENQUIRY_TYPE, ENQUIRY_TYPE_LABELS, type EnquiryType } from "@shared/enums.js";
import { enquiryInputSchema } from "@shared/schema.js";
import { PageHeader } from "@/components/layout";
import { Alert, Button, ButtonLink, Card, Field } from "@/components/ui";

type Errors = Partial<Record<string, string>>;

/**
 * Replaces the league site's feedback form, which had to be switched off
 * because spam made it unusable. Three things stop that happening here: a
 * honeypot field, a five-an-hour rate limit on the endpoint, and a
 * moderated queue in Directus rather than an inbox.
 *
 * The form is one column at reading width, with real labels above every
 * field, no placeholder-as-label, and each error message beside the field
 * it belongs to rather than in a summary at the top. The column is
 * centred rather than pinned left: at 1280px the old layout put a 480px
 * form against the left edge of a 1400px page and left the rest blank,
 * which reads as a page that failed to load rather than one that is
 * finished.
 */
export function ContactPage() {
  const [pathname] = useLocation();
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);

  // A failure that scrolls off the top of the form is a failure the reader
  // does not know about; they press the button again and wonder why.
  useEffect(() => {
    if (failure) failureRef.current?.focus();
  }, [failure]);

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
      <div className="mx-auto max-w-readable">
        <div ref={successRef} tabIndex={-1} className="rounded-panel border border-positive/30 bg-positive-soft p-8 text-center">
          <CheckCircle2 aria-hidden="true" className="mx-auto size-12 text-positive" />
          <h1 className="mt-4 text-2xl sm:text-3xl">Thank you — that's sent.</h1>
          <p className="mx-auto mt-3 max-w-prose text-lg">
            Someone on the committee will read it and reply, usually within a few days.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/">Back to the home page</ButtonLink>
            <ButtonLink href="/help" variant="secondary">
              Read the common questions
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-readable">
      <PageHeader
        title="Leave feedback"
        subtitle="A question, a correction, or something that looks wrong on this site — it all comes to the committee."
      />

      {failure ? (
        <div ref={failureRef} tabIndex={-1} className="mb-6">
          <Alert tone="error" title="That didn't send.">
            <p>{failure}</p>
          </Alert>
        </div>
      ) : null}

      <Card>
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          <Field label="Your name" hint="So we know who we're replying to." error={errors.name} required>
            {(props) => <input {...props} name="name" type="text" autoComplete="name" />}
          </Field>

          <Field
            label="Your email address"
            hint="We'll only use it to reply to you."
            error={errors.email}
            required
          >
            {(props) => <input {...props} name="email" type="email" autoComplete="email" />}
          </Field>

          <Field label="Your phone number" hint="Only if you'd rather we rang." error={errors.phone}>
            {(props) => <input {...props} name="phone" type="tel" autoComplete="tel" />}
          </Field>

          <Field label="What's it about?" error={errors.enquiryType} required>
            {(props) => (
              <select {...props} name="enquiryType" defaultValue="general">
                {ENQUIRY_TYPE.map((value) => (
                  <option key={value} value={value}>
                    {ENQUIRY_TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            label="Your message"
            hint="As much or as little as you like — there's no wrong way to ask."
            error={errors.message}
            required
          >
            {(props) => <textarea {...props} name="message" rows={6} className={`${props.className} resize-y`} />}
          </Field>

          {/*
            The honeypot. Hidden from sight and from screen readers, and
            excluded from the tab order, so no real person ever meets it —
            which is what makes anything typed into it a reliable signal.
          */}
          <div aria-hidden="true" className="absolute h-px w-px overflow-hidden opacity-0">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  {/* A spinner *and* the word, because a spinner alone
                      leaves a reader guessing whether anything happened. */}
                  <span
                    aria-hidden="true"
                    className="size-5 animate-spin rounded-full border-2 border-brand-ink/30 border-t-brand-ink"
                  />
                  Sending…
                </>
              ) : (
                <>
                  <Send aria-hidden="true" className="size-5" />
                  Send your message
                </>
              )}
            </Button>
            <p className="text-ink-muted">We reply to every message.</p>
          </div>
        </form>
      </Card>

      <div className="mt-8 rounded-panel border border-line bg-surface-sunken p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Mail aria-hidden="true" className="size-5 text-ink-muted" />
          Would rather not use a form?
        </h2>
        <p className="mt-1.5 text-ink-muted">
          Every committee post is listed on the{" "}
          <Link href="/committee" className="link font-semibold">
            who's who page
          </Link>
          , and many questions are already answered under{" "}
          <Link href="/help" className="link font-semibold">
            how do I…?
          </Link>
        </p>
      </div>
    </div>
  );
}
