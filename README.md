# hrc-club

Planning documents for rebuilding **hertsttl.org.uk**, the Hertford & District Table Tennis League website, on Directus (backend) and Nuxt 4 / Vue 3 (frontend), for an audience that is mostly older adults.

## Documents

Read in order. Everything lives in [`docs/`](docs/).

| Document | What it covers |
|---|---|
| [docs/README.md](docs/README.md) | Overview of the set, the decisions in force, and a short summary of the problem, the architecture and the design constraint |
| [docs/00-site-audit.md](docs/00-site-audit.md) | Full crawl of the existing site — 90 URLs, ~40 templates. Page inventory, current technology, 25 findings ranked by severity, and what works today and must be preserved |
| [docs/01-prd.md](docs/01-prd.md) | The PRD. Goals, users, the static vs dynamic analysis that drives the architecture, functional and older-user design requirements, security and privacy, technology stack, success metrics, risks and cost |
| [docs/02-data-model.md](docs/02-data-model.md) | Directus collections and fields, roles and field-level permissions, automation Flows, the public API surface, migration mapping, and the old→new URL redirect map |
| [docs/03-implementation-plan.md](docs/03-implementation-plan.md) | Six phases over ~18 weeks (with a leaner ~8-week alternative that is not being taken), sequencing rationale, and the accessibility assurance gate |
| [docs/04-open-questions.md](docs/04-open-questions.md) | 23 decisions. The four blocking ones are settled; nineteen remain |

## Decisions in force — 26 August 2026

| Question | Decision |
|---|---|
| Access to the existing data | **Full database export available** — migration is an export-led transform, not a scrape |
| Hosting | **Directus Cloud**, managed, ~£180–250/year |
| Scope | **All six phases**, ~18 weeks, with the public beta still landing at week 9 |
| Visual change | **New look, same map** — modern redesign, unchanged information architecture and page names |

## Provenance

These documents were authored in the sibling repository
[`kipergil/hrc-league`](https://github.com/kipergil/hrc-league) on branch
`claude/website-modernization-prd-kn5osw` and copied here unchanged. Edit them
here; treat this repository as the home for the planning set going forward.
