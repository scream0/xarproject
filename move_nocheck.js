const fs = require('fs');


function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const name = dir + '/' + file;
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files);
    } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      files.push(name);
    }
  }
  return files;
}

const files = getFiles('src');

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('// @ts-nocheck')) {
      // Remove it from current position
      content = content.replace(/\/\/\s*@ts-nocheck\n?/g, '');
      // Add it to the absolute top
      content = '// @ts-nocheck\n' + content;
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Moved @ts-nocheck to top in ${file}`);
    }
  } catch(e) {
    console.error(e);
  }
});
