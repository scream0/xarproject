const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log("Packaging OpenNext output for Cloudflare Pages...");

const openNextDir = path.join(process.cwd(), '.open-next');
const pagesOutDir = path.join(process.cwd(), '.worker-next', 'assets');
const workerDir = path.join(pagesOutDir, '_worker.js');

if (!fs.existsSync(openNextDir)) {
    console.error(".open-next directory not found!");
    process.exit(1);
}

// 1. Clean previous build
fs.rmSync(path.join(process.cwd(), '.worker-next'), { recursive: true, force: true });

// 2. Copy assets
copyDir(path.join(openNextDir, 'assets'), pagesOutDir);

// 3. Copy the entire .open-next to _worker.js directory
copyDir(openNextDir, workerDir);

// 4. Rename worker.js to index.js
const workerFile = path.join(workerDir, 'worker.js');
const indexFile = path.join(workerDir, 'index.js');
if (fs.existsSync(workerFile)) {
    fs.renameSync(workerFile, indexFile);
}

// 5. Remove assets from inside _worker.js to save space
fs.rmSync(path.join(workerDir, 'assets'), { recursive: true, force: true });

console.log("Done! Output is in .worker-next/assets");
