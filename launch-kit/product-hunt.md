# Product Hunt Launch — Link Shortener

## Name
Link Shortener — own your links

## Tagline (60 chars)
Self-hosted Bitly alternative. Pay once, own it forever.

## Description (260 chars)
A branded link shortener + click analytics you actually own. Custom slugs on your domain, QR codes, unique-visitor stats, UTM builder, CSV import — all in a SQLite file on your $5 VPS or desktop. $29 once instead of Bitly's $348/yr for a custom domain.

## Full description

Bitly wants $29/month — $348 a year — just to put YOUR domain on YOUR links, and then it keeps your click data on its servers.

Link Shortener is the one-time-purchase alternative for marketers and agencies:

- **Branded short links** on any domain you own (auto or custom slugs)
- **Real analytics**: total + unique clicks, clicks-over-time, top referrers, devices, browsers, countries
- **QR code per link**, downloadable as PNG or SVG — and because you can edit destinations, printed QR codes never die
- **UTM builder** in the create form, **bulk CSV import/export** to migrate off Bitly in minutes
- **301 or 302 per link**, enable/disable without deleting history
- **Private by design**: SQLite on your machine, no telemetry, no paid geo APIs (uses Cloudflare's free country header)

Run it as a desktop app (`npm run desktop`) or deploy the same code to a $5 VPS with the included Dockerfile. MIT-licensed source; a one-click installer is available on Whop for people who never want to open a terminal.

Pay once. Own it forever. No subscription.

## Maker first comment

Hey PH 👋

I run links for a handful of client campaigns, and the Bitly bill genuinely annoyed me every month. $29/mo to use my *own* domain — that's $348 a year for what is, at its core, a redirect and an INSERT statement. And when a client asks "where did the clicks come from?", the honest answer was "Bitly knows, I rent access."

So I built the version I wanted: one Node process, one SQLite file, a clean dark dashboard. Create a link, get a QR code, watch referrers/devices/countries roll in. Import my whole Bitly export via CSV in one paste. It runs on the cheapest VPS I could find, and there's a desktop mode for when I just need QR codes for print.

It's MIT on GitHub — the $29 is for the packaged 1-click installer and my eternal gratitude. Happy to answer anything about the stack (Express + better-sqlite3 + React) or the privacy approach (daily-rotating IP+UA hash instead of storing IPs).

## Gallery shots (5)

1. **Hero**: dashboard in dark mode — link list with click/unique counts, "Pay once. Own it forever." headline overlay.
2. **Analytics modal**: clicks-over-time bar chart with top referrers, devices, and countries side by side.
3. **QR modal**: crisp QR code with PNG/SVG download buttons, short URL beneath.
4. **Create form with UTM builder open**: long URL in, branded short link out, final-URL preview showing utm_ params.
5. **Comparison graphic**: "Bitly $348/yr vs Link Shortener $29 once" table shot, with 'your data, your SQLite file' callout.
