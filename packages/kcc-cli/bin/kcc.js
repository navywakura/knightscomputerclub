#!/usr/bin/env node
"use strict";

/**
 * kcc — CLI / shell para // nexo
 * Uso:
 *   kcc                 → shell interactiva
 *   kcc login
 *   kcc boards
 *   kcc join <slug|id>
 *   kcc avatar ./foto.jpg
 *   kcc banner ./vip.png
 *   kcc help
 */

const path = require("path");
const { main } = require("../src/main");

main(process.argv.slice(2)).catch((e) => {
  console.error("kcc:", e.message || e);
  process.exit(1);
});
