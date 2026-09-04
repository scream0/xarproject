const fs = require('fs');

const log = fs.readFileSync('tsc_errors2.log', 'utf16le');
const lines = log.split('\n');

const filesToUpdate = new Set();
lines.forEach(line => {
    const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+):/);
    if (match) {
        filesToUpdate.add(match[1]);
    }
});

filesToUpdate.forEach(file => {
    try {
        let content = fs.readFileSync(file, 'utf8');
        let modified = false;

        // Fix TS7031 for components: `export function Component({ a, b })` -> `export function Component({ a, b }: any)`
        // or `export default function Component({ a, b })`
        // We can do a regex replacement for the function signature.
        // It's tricky to balance braces, but we can look for `({ ... }) {` and replace with `({ ... }: any) {`
        // Only if it doesn't already have `: any) {` or `: SomeType) {`
        if (content.includes('({')) {
            const regex = /function\s+[A-Za-z0-9_]+\s*\(\s*\{([^}]*)\}\s*\)\s*\{/g;
            content = content.replace(regex, (match, p1) => {
                modified = true;
                return match.replace('}) {', '}: any) {');
            });
            
            const regexArrow = /const\s+[A-Za-z0-9_]+\s*=\s*\(\s*\{([^}]*)\}\s*\)\s*=>/g;
            content = content.replace(regexArrow, (match, p1) => {
                modified = true;
                return match.replace('}) =>', '}: any) =>');
            });
        }

        // Fix never[]: `useState([])` -> `useState<any[]>([])`
        if (content.includes('useState([])')) {
            content = content.replace(/useState\(\[\]\)/g, 'useState<any[]>([])');
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(file, content, 'utf8');
            console.log(`Auto-fixed TS7031 / never[] in ${file}`);
        }
    } catch(e) {
        console.error(e);
    }
});
