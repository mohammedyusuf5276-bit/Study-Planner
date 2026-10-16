import { copyFileSync, mkdirSync } from 'node:fs';

const outputDirectory = 'dist';
mkdirSync(outputDirectory, { recursive: true });

for (const file of ['index.html', 'styles.css', 'app.js']) {
  copyFileSync(file, `${outputDirectory}/${file}`);
}

console.log('StudyFlow static site copied to dist/.');
