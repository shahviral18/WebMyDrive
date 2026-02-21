import fs from 'fs';
import path from 'path';

function walkPath(dir, fileCallback) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkPath(fullPath, fileCallback);
        } else {
            fileCallback(fullPath);
        }
    }
}

const replacements = {
    'bg-slate-900/40': 'bg-background/80',
    'bg-slate-900/30': 'bg-background/80',
    'bg-slate-300': 'bg-muted',
    'divide-slate-100': 'divide-border',
    'divide-slate-200': 'divide-border',
    'border-slate-50': 'border-border',
    'bg-slate-50': 'bg-surface-2',
};

walkPath('./src', (fullPath) => {
    if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let original = content;

        for (const [key, val] of Object.entries(replacements)) {
            const regex = new RegExp(`(?<=[\\s"'\\\`])` + key.replace(/([\\/\\.])/g, '\\\\$1') + `(?=[\\s"'\\\`])`, 'g');
            content = content.replace(regex, val);
        }

        if (content !== original) {
            fs.writeFileSync(fullPath, content);
            console.log(`Updated ${fullPath}`);
        }
    }
});
