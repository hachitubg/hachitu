# Poorup integration

Upstream: https://github.com/jeremy341/Poorup
Pinned commit: f7e5b8209dcac9c4aa7b61a96164c53545805c3e
License: MIT, reproduced from the upstream README (no separate license file at this revision).

Vendored unchanged modules:
- `server/propertyRules.js`: build/sell/mortgage/unmortgage eligibility.
- `server/gamePresentation.js`: authoritative dice/movement/cash presentation recording.
- `public/gamePresentationTiming.js`: shared dice, walk and landing timing.
- `public/clientBoardMotion.js`: deterministic path timeline.

HACHITU adapters live in `server/property-game/poorup-adapter.mjs` and `src/views/co-ty-phu/composables/useBoardPresentation.ts`. They translate the existing data schema and retain the HACHITU classic rent table, Vietnamese board, session authentication and 2D characters. This is a module integration, not a fork of the complete Poorup application. Upstream accounts, file persistence, markets, casino, bots and analytics are not loaded.

Tests cover live use of these modules, path events, boundary conditions and preservation of existing rules. To update: compare upstream license, review each selected file, update this commit, and run property-game tests plus frontend tests/build/lint. Do not replace the entire source tree or run upstream bootstrap in HACHITU.
