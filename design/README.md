# Obsidian & Champagne — 3D Elegant Redesign

Drop-in visual upgrade for your `car-dash` Next.js app. **No logic was changed** — every class name, prop, and component structure is identical.

## What's inside

```
src/app/globals.css                       <- replace
src/app/dashboard/layout.tsx              <- replace (only <style jsx> changed)
src/app/dashboard/DashboardClient.tsx     <- replace (only <style jsx> changed)
```

## Install

1. Back up your originals.
2. Copy the three files into your project at the same paths.
3. `npm run dev` — done.

## What changed visually

- **Tokens** rebuilt with layered champagne-gold + obsidian palette
- **Fonts**: Fraunces (serif display) + Manrope (body) for editorial feel
- **3D depth**: ambient radial glows on body, film-grain noise overlay, inset highlights, layered shadow stacks
- **Sidebar**: floating glass card with light-catching top rim and gold active-item bar
- **Topbar**: glass pill with pulsing live indicator
- **Stat cards**: embossed champagne edge, hover lift, gem-style icon wells
- **Calendar days**: tactile glass cells with lift on hover, glowing selected state
- **Buttons**: bevelled with inset highlight + outer warm glow
- **Status badges**: backlit pills with colored bloom

The other dashboard pages (bookings, expenses, fleet, maintenance) inherit
the new tokens through `globals.css` automatically — no further edits needed.
