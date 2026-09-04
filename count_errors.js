const fs = require('fs');
const log = fs.readFileSync('tsc_errors2.log', 'utf16le');
const lines = log.split('\n');

const errorCounts = {};
lines.forEach(line => {
    const match = line.match(/error (TS\d+):/);
    if (match) {
        errorCounts[match[1]] = (errorCounts[match[1]] || 0) + 1;
    }
});

console.log("Remaining Errors:", errorCounts);
