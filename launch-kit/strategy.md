# Launch Strategy — Link Shortener

## Positioning
"Bitly charges $348/yr to use YOUR OWN domain. Pay $29 once instead." Target: marketers and agencies who run campaign links and QR codes, plus self-hosters who want data ownership.

## Target communities

| Community | Angle (rules-aware) |
| --- | --- |
| r/selfhosted | "I built an MIT-licensed link shortener with analytics — feedback welcome." Lead with the repo, not the paid installer (self-promo must be open source + participatory). |
| r/marketing | Ask/discussion framing: "Anyone else priced out of Bitly's custom-domain tier? Here's what I replaced it with." Follow the no-blogspam rule; share repo in comments if asked. |
| r/DigitalMarketing | UTM-builder + owning click data angle; share as a tool roundup contribution, not a pitch. |
| r/Entrepreneur | "I replaced a $348/yr SaaS with a weekend project" story post — narrative first, link in comments per sub norms. |
| r/webdev | Show-off Saturday thread (that's the only day self-promo is allowed) — stack write-up: Express + better-sqlite3 + React. |
| r/SideProject | Direct launch post allowed; include screenshots and the one-time-price math. |
| Indie Hackers | Build-in-public milestone post with revenue goal; IH loves the "$29 once vs $29/mo" framing. |

## Hacker News — Show HN draft

**Title:** Show HN: Self-hosted link shortener with analytics — Bitly charges $348/yr for a custom domain

**Body:**
I run campaign links for a few clients and Bitly's pricing finally pushed me to build my own: a single Node process (Express + better-sqlite3) that serves branded short links, a React dashboard, per-link QR codes (PNG/SVG), and click analytics — total/unique clicks, referrers, devices, countries.

Privacy details HN might care about: uniques are a SHA-256 of IP+UA+date (rotates daily, no raw IPs stored), country comes from the free CF-IPCountry header instead of a geo API, and there's zero telemetry. Everything lives in one SQLite file you can back up with `cp`.

It's MIT. `docker compose up` or `npm start` on any $5 VPS; there's also an Electron desktop mode for offline QR generation. I sell a packaged installer for $29 one-time, but the source is the product. Happy to answer questions about the redirect-logging design or why I picked a daily-rotating hash over cookies.

## SEO keywords (10)
1. self hosted link shortener
2. bitly alternative
3. open source url shortener
4. branded link shortener
5. custom domain short links
6. link shortener with analytics
7. qr code link generator
8. self hosted bitly
9. url shortener docker
10. one time payment link shortener

## AppSumo / PitchGround pitch

Link Shortener is the anti-subscription answer to Bitly for marketers and agencies. Bitly charges $348/year just to put a customer's own domain on their links — and keeps the click data. Link Shortener is a lifetime, self-hosted deal: unlimited branded links and QR codes (PNG/SVG), real analytics (unique visitors, referrers, devices, countries), UTM builder, and one-paste CSV migration from Bitly, all stored in a SQLite database the customer owns. It deploys in one `docker compose up` on a $5 VPS or runs as a desktop app, with MIT source for full auditability. LTD buyers get the 1-click installer, updates, and priority support — a genuinely sellable "pay once, own forever" story your audience already understands, because they're all tired of the same monthly bill.

## Pricing
**$29 one-time.** Bitly's cheapest custom-domain plan is $29/mo → the purchase pays for itself in **1 month**; vs a full year of Bitly it's a 92% saving ($29 vs $348). Anchor: "One month of Bitly, forever."
