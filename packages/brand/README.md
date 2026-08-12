# @gogymgo/brand

Canonical GoGymGo colours, fonts, logo sources and asset names. Application-specific components stay in their owning application; web/public font copies are deployment assets generated or synchronized from this package.

## Typography

- Segoe UI with Arial and sans-serif fallbacks is the canonical body stack.
- Orbitron is reserved for headings and display text.
- Share Tech Mono is reserved for labels and technical accents.
- Native applications use the platform system font as the Segoe UI equivalent.
- Web applications import `@gogymgo/brand/web.css`; they do not duplicate the
  canonical font faces or core colour values.

## Logo system

- `assets/logos/mark.png` is the approved small-format source used for app icons,
  favicons, compact navigation marks and other square placements.
- `assets/logos/mark.svg` is its editable vector companion. Both use a cyan G
  traced from end to end with the canonical pink token.
- `assets/logos/wordmark.svg` is the larger `GO GYM GO` wordmark. Do not replace
  wordmark placements with the compact mark.
- Generate application derivatives with `npm run brand:generate --workspace
  @gogymgo/admin`; do not recolour copied assets locally.
