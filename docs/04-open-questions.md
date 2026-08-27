# Open Questions

Decisions needed before or during Phase 0.

## Decisions made — 26 August 2026

The four blocking questions are settled. They are recorded below with their original framing struck through to "**Decided**".

| # | Question | Decision |
|---|---|---|
| **Q1** | Access to the existing database | **Full database export available** — migration is export‑led; scraping is fallback only |
| **Q4** | Hosting | **Directus Cloud** (managed) |
| **Q7** | Scope of the first release | **All phases** — full 18‑week programme through to migration and aftercare |
| **Q8** | Degree of visual change | **New look, same map** — modern redesign, unchanged information architecture and page names |

**What these decisions change**

- The ±2 week migration risk is removed, and everything the site does not display publicly — contact details, historic scorecards behind login, registration history — comes across intact. Phase 0 gains a schema‑documentation task; Phase 5's ETL becomes a transform rather than a scrape.
- Hosting is fixed at roughly **£180–250/year**. No VPS provisioning, patching or backup rota falls to a volunteer.
- The lean ~8‑week alternative in the implementation plan is **not** being taken. Phases 0–6 run as written.
- The design brief is now explicit: **every page keeps its current name and its place in the structure.** "League Tables" stays "League Tables" and stays where it is. What changes is type, contrast, spacing, layout, mobile behaviour and interaction. This is a constraint on the design, not a suggestion.

---

## Backend and data

**★ Q1 — What access is there to the existing database?** — **Decided: full export available.**
The site runs Classic ASP on IIS/Plesk, so the data is most likely SQL Server or Access. With a direct export, migration is a documented transform from a known schema rather than an HTML scrape, and nothing that the site keeps behind its login is lost. The scraper written during this audit is retained as a reconciliation check — the migrated data should agree with what the public pages currently display.

*Remaining task:* obtain the export, document the source schema, and map it field by field onto [02-data-model.md](02-data-model.md) during Phase 0.

**Q2 — Who currently holds the hosting, DNS and domain, and can that be transferred?**
Needed for the HTTPS fix regardless of anything else.

**Q3 — How far back should the archives go?**
The Hall of Fame runs to 1970. Tables, averages and match results exist on the site for 2024‑25 and 2025‑26 only. Is there anything older in the database, in spreadsheets, or in a filing cabinet? Digitising more history is high‑value and low‑risk, but only if it exists.

---

## Hosting and operations

**★ Q4 — Managed or self‑hosted?** — **Decided: Directus Cloud.**
Roughly £180–250/year, and patching, backups and uptime stop being a volunteer's responsibility — which is where the real risk sat. The existing Plesk/Windows host is no longer part of the target architecture and can be retired once the legacy site is decommissioned (see Q9).

*Remaining task:* create the account, decide who holds billing, and confirm the plan tier against expected traffic during Phase 0.

**Q5 — Who runs the site after launch, and how much time do they have?**
This determines how much can safely be automated versus how much needs an interface. If the answer is "the same one volunteer", the scope should shrink and the automation should grow.

**Q6 — What is the annual budget?**
The plan assumes under £250/year. If there is less, self‑hosting and free tiers still work; if there is more, a professional accessibility audit is the best place to spend it.

---

## Scope and sequencing

**★ Q7 — Phase 1 scope: public site only, or public site plus captain result entry?** — **Decided: all phases.**
The full programme runs — Phases 0 through 6, roughly 18 weeks, ending with migration, cutover and aftercare. The lean alternative in [03-implementation-plan.md](03-implementation-plan.md) is not being taken.

Because the whole programme is in scope, two things become more important rather than less: the **beta at week 9 still happens** and still runs in parallel with the old site — committing to all phases is not a reason to defer the first release to the end — and the **change management around result entry (Phase 3)** needs real attention, because captains will be asked to change a habit. The three‑captain test panel recruited in Phase 0 is the mitigation, and it is not optional.

**★ Q8 — How much visual change do you want?** — **Decided: new look, same map.**
A modern, legible redesign that keeps the existing information architecture and page names exactly as they are. Concretely, this is now a binding constraint on the design work:

- Every page keeps the name players already use. "League Tables" does not become "Standings". "Fixture Calendar" does not become "Schedule". Where the audit recommended clearer labels, they are added as **subtitles**, not replacements — "League Tables" with "Who's top of each division" beneath it.
- The nav structure keeps its current groupings. The five‑item top bar reorganises *how* the existing items are reached; it does not rename or relocate them.
- "Back to Home" stays on every page, in the same role it plays today.
- Old URLs redirect to new pages that carry the same name and the same content — a bookmark lands somewhere recognisable, not just somewhere valid.
- What changes: typography, contrast, spacing, layout, mobile behaviour, interaction (no hover dependency), and print support.

*Remaining task:* one design direction, reviewed by the 60+ test panel at the end of Phase 1 before any page templates are built on it.

**Q9 — Should the old site stay online?**
Recommendation: freeze it read‑only at `legacy.hertsttl.org.uk` for one season as a safety net, with all old URLs 301‑redirected to the new site.

**Q10 — When should cutover happen?**
Recommendation: pre‑season, late August. The alternative safe window is the Christmas break. Never mid‑season or near a cup final.

---

## People, privacy and access

**Q11 — Who should be able to see player contact details?**
Today they are nominally behind a login, but that login is an email address with no password, so in practice they are public. Options: all logged‑in players; only captains and committee; only committee; or per‑person consent (recommended — the data model supports it).

**Q12 — Do juniors play in the league, and how many?**
There is a Junior Singles event in the Closed Championships. If under‑18s are registered, parental consent records and stricter contact‑data handling are required, and the plan needs a small addition.

**Q13 — How long should personal data be kept after a player leaves?**
The plan assumes three seasons for contact details, with names retained indefinitely in results and honours as league records. Needs committee ratification for the privacy notice.

**Q14 — Should players be able to opt out of appearing publicly?**
Results and averages are arguably league records, but a player may reasonably not want their name indexed by Google. Worth a stated position.

---

## Features

**Q15 — Should tournament entry fees be payable online?**
Currently "a nominal entry fee… on the night". Online payment adds Stripe, reconciliation and refunds — real complexity for a volunteer committee. Recommendation: keep it cash on the night for now.

**Q16 — Should the site email players directly, and about what?**
The plan proposes: result confirmation requests to captains, outstanding‑card chasers, optional fixture reminders, and the newsletter. Each needs a consent position and an unsubscribe route.

**Q17 — Is a "find a club near me" map wanted?**
The league covers Bishop's Stortford to Enfield — a wide area, and a genuine recruitment aid. It needs venue coordinates, which the data model already provides for.

**Q18 — Should player profile pages exist publicly?**
Career records across seasons are a nice feature and the data supports it, but some players will not want a permanent public record. Related to Q14.

**Q19 — Is a mobile app wanted, or is a Progressive Web App enough?**
Recommendation: PWA. It installs to a home screen, works offline for fixtures and draft scorecards, and needs no app store.

**Q20 — Should the committee minutes be public?**
They currently are, but the most recent published set is from 2017. Either commit to publishing them or remove the section — a nine‑year‑old "latest minutes" link reads worse than none.

---

## Content

**Q21 — Who will write the new content?**
The rebuild needs: an About/history page for the 90th anniversary, a "How the league works" explainer, a "New to the league?" join page, venue accessibility notes for each club, and a privacy notice. The league has the knowledge; it needs someone to write it down. Roughly two days of committee time.

**Q22 — Are there club logos, photographs or archive material available?**
The current site has almost no imagery. Photographs of venues in particular help first‑time visitors and prospective players far more than stock imagery would.

**Q23 — Is there a sponsorship model to preserve?**
The current site carries Thorntons, Bribar, KitUOut and a coaching academy. The data model has a `sponsors` collection with tiers and display windows — the question is whether these are paid placements with obligations attached.
