const fs = require('fs');

const log = fs.readFileSync('tsc_errors2.log', 'utf16le');
const lines = log.split('\n');

const filesToUpdate = new Set();
lines.forEach(line => {
    const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS2339):/);
    if (match) {
        filesToUpdate.add(match[1]);
    }
});

filesToUpdate.forEach(file => {
    try {
        let content = fs.readFileSync(file, 'utf8');
        let modified = false;

        // Fix useState({}) -> useState<any>({})
        if (content.includes('useState({}')) {
            content = content.replace(/useState\(\{/g, 'useState<any>({');
            modified = true;
        }
        
        // Fix TS7053 indexing by string: `[key: string]: any` for plain objects if possible, but actually we can just leave it for now.

        if (modified) {
            fs.writeFileSync(file, content, 'utf8');
            console.log(`Auto-fixed useState in ${file}`);
        }
    } catch(e) {
        console.error(e);
    }
});
