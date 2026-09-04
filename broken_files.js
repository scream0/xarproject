const fs = require('fs');
const log = fs.readFileSync('tsc_errors2.log', 'utf16le');
const lines = log.split('\n');

const brokenFiles = new Set();
lines.forEach(line => {
    const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+error\s+TS(1005|2657|1382|1381|17002|1003|1161|1128|1109):/);
    if (match) {
        brokenFiles.add(match[1]);
    }
});

console.log("Broken Files:", Array.from(brokenFiles));
