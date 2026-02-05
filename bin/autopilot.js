#!/usr/bin/env node

const path = require('path');

const { main } = require(path.join(__dirname, '..', 'autocode', 'tools', 'autopilot.js'));

main(process.argv).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

