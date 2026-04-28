const fs = require('fs');
const path = require('path');

const dir = '/home/david/Desktop/personal/docker-programs/n8n/bot/cur-workflows';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.includes('.bak'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  const replacePatterns = [
    { search: /candidates\[0\]\.content\.parts\[0\]\.text/g, replace: 'text' },
    { search: /\?\.candidates\?\.\[0\]\?\.content\?\.parts\?\.\[0\]\?\.text/g, replace: '?.text' },
    { search: /candidates\?\.\[0\]\?\.content\?\.parts\?\.\[0\]\?\.text/g, replace: 'text' }
  ];

  replacePatterns.forEach(pattern => {
    if (pattern.search.test(content)) {
      content = content.replace(pattern.search, pattern.replace);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed paths in ${file}`);
  }
});
