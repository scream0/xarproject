const fs = require('fs');

// Read as utf-16le because PowerShell `>` creates UTF-16 files
const log = fs.readFileSync('tsc_errors.log', 'utf16le');
const lines = log.split('\n');

const fixes = {};
let matched = 0;

lines.forEach(line => {
    const trimmed = line.trim();
    // TS7006 or TS7031
    const match = trimmed.match(/^(.+?)\((\d+),(\d+)\):\s+error\s+(TS7006|TS7031):\s+(?:Parameter|Binding element)\s+'([^']+)'\s+implicitly has an 'any' type\./);
    
    if (match) {
        const file = match[1];
        const lineNum = parseInt(match[2], 10) - 1; 
        const colNum = parseInt(match[3], 10) - 1;
        const paramName = match[5];
        
        if (!fixes[file]) fixes[file] = [];
        
        fixes[file].push({ lineNum, colNum, paramName, errorCode: match[4] });
        matched++;
    }
});

console.log("Matched implicit any errors:", matched);

let fixCount = 0;

Object.keys(fixes).forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8').split('\n');
        
        fixes[file].sort((a, b) => {
            if (a.lineNum !== b.lineNum) return b.lineNum - a.lineNum;
            return b.colNum - a.colNum;
        });
        
        fixes[file].forEach(fix => {
            let lineContent = content[fix.lineNum];
            if (!lineContent) return;
            const startIdx = fix.colNum;
            const endIdx = startIdx + fix.paramName.length;
            
            let typeAnnotation = ': any';
            if (fix.paramName === 'e' || fix.paramName === 'event') {
                 typeAnnotation = ': any';
            } else if (fix.paramName === 'children') {
                 typeAnnotation = ': React.ReactNode';
            }
            
            const nextChars = lineContent.substring(endIdx, endIdx + 10);
            if (!nextChars.includes(':')) {
                if (fix.errorCode === 'TS7006') {
                    // Quick safety check: the text exactly at startIdx should be the paramName
                    if (lineContent.substring(startIdx, endIdx) === fix.paramName) {
                        lineContent = lineContent.substring(0, endIdx) + typeAnnotation + lineContent.substring(endIdx);
                        content[fix.lineNum] = lineContent;
                        fixCount++;
                    }
                }
            }
        });
        
        fs.writeFileSync(file, content.join('\n'), 'utf8');
    } catch (e) {
        console.error(`Failed to process ${file}:`, e);
    }
});

console.log(`Total TS7006 fixed: ${fixCount}`);
