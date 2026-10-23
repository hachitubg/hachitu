# 2d_chars renderer

Source: https://github.com/juanpe500/2d_chars
Pinned commit: d093ec90f2c5681b0995a9f4590e250ab11bab1f
File: sprites.js. License: MIT, see LICENSE.txt. Copyright 2026 juanpe500.

HACHITU modifications: wrap the original source in an IIFE and expose `window.HachiCharacterRenderer` to avoid global lexical collisions on SPA navigation; add `hideName` to omit the built-in name tag because the Vue UI displays the name separately. No remote scripts, editor bundle, props or network services are used. UI/configuration/room validation are implemented separately in the app. Keep LICENSE.txt when distributing this file.
