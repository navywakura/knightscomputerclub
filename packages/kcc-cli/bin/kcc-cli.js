#!/usr/bin/env node
"use strict";

/**
 * kcc-cli — shell de terminal para // nexo (knightscomputer.club)
 *
 * El comando principal es `kcc-cli` (NO `kcc`).
 * En macOS, `kcc` es el cliente Kerberos de Heimdal y se come el PATH.
 *
 * Uso:
 *   kcc-cli
 *   kcc-cli login <user> <pass>
 *   kcc-cli boards
 *   kcc-cli --version
 */

const path = require("path");
const fs = require("fs");

// Si alguien instaló el bin como `kcc` y mac resuelve el de Heimdal,
// nunca llegamos acá. Si llegamos vía npm link con nombre kcc, avisamos.
function warnIfShadowed() {
  try {
    const our = path.resolve(__filename);
    // solo info en version/help
  } catch {
    /* */
  }
}

warnIfShadowed();

const { main } = require("../src/main");

main(process.argv.slice(2)).catch((e) => {
  console.error("kcc-cli:", e.message || e);
  process.exit(1);
});
