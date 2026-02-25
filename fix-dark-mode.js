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

const replacements = [
    // Backgrounds
    { regex: /(?<=[\s"'`])bg-white(?=[\s"'`])/g, val: 'bg-surface-1' },
    { regex: /(?<=[\s"'`])bg-gray-50(?=[\s"'`])/g, val: 'bg-surface-2' },
    { regex: /(?<=[\s"'`])bg-gray-100(?=[\s"'`])/g, val: 'bg-surface-2' },
    { regex: /(?<=[\s"'`])bg-slate-50(?=[\s"'`])/g, val: 'bg-surface-2' },
    { regex: /(?<=[\s"'`])bg-slate-100(?=[\s"'`])/g, val: 'bg-surface-2' },
    { regex: /(?<=[\s"'`])bg-gray-200(?=[\s"'`])/g, val: 'bg-surface-3' },

    // Text colors
    { regex: /(?<=[\s"'`])text-black(?=[\s"'`])/g, val: 'text-foreground' },
    { regex: /(?<=[\s"'`])text-gray-900(?=[\s"'`])/g, val: 'text-foreground' },
    { regex: /(?<=[\s"'`])text-gray-800(?=[\s"'`])/g, val: 'text-foreground' },
    { regex: /(?<=[\s"'`])text-slate-900(?=[\s"'`])/g, val: 'text-foreground' },
    { regex: /(?<=[\s"'`])text-slate-800(?=[\s"'`])/g, val: 'text-foreground' },

    { regex: /(?<=[\s"'`])text-gray-700(?=[\s"'`])/g, val: 'text-muted-foreground' },
    { regex: /(?<=[\s"'`])text-gray-600(?=[\s"'`])/g, val: 'text-muted-foreground' },
    { regex: /(?<=[\s"'`])text-gray-500(?=[\s"'`])/g, val: 'text-muted-foreground' },
    { regex: /(?<=[\s"'`])text-slate-700(?=[\s"'`])/g, val: 'text-muted-foreground' },
    { regex: /(?<=[\s"'`])text-slate-600(?=[\s"'`])/g, val: 'text-muted-foreground' },
    { regex: /(?<=[\s"'`])text-slate-500(?=[\s"'`])/g, val: 'text-muted-foreground' },

    // Borders
    { regex: /(?<=[\s"'`])border-gray-100(?=[\s"'`])/g, val: 'border-border' },
    { regex: /(?<=[\s"'`])border-gray-200(?=[\s"'`])/g, val: 'border-border' },
    { regex: /(?<=[\s"'`])border-gray-300(?=[\s"'`])/g, val: 'border-border' },
    { regex: /(?<=[\s"'`])border-slate-100(?=[\s"'`])/g, val: 'border-border' },
    { regex: /(?<=[\s"'`])border-slate-200(?=[\s"'`])/g, val: 'border-border' },
    { regex: /(?<=[\s"'`])border-slate-300(?=[\s"'`])/g, val: 'border-border' },

    // Divides
    { regex: /(?<=[\s"'`])divide-gray-100(?=[\s"'`])/g, val: 'divide-border' },
    { regex: /(?<=[\s"'`])divide-gray-200(?=[\s"'`])/g, val: 'divide-border' },
    { regex: /(?<=[\s"'`])divide-slate-100(?=[\s"'`])/g, val: 'divide-border' },
    { regex: /(?<=[\s"'`])divide-slate-200(?=[\s"'`])/g, val: 'divide-border' },

    // Specific specific issue fixes (hover, active)
    { regex: /(?<=[\s"'`])hover:bg-gray-50(?=[\s"'`])/g, val: 'hover:bg-surface-2' },
    { regex: /(?<=[\s"'`])hover:bg-gray-100(?=[\s"'`])/g, val: 'hover:bg-surface-2' },
];

walkPath('./src', (fullPath) => {
    if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let original = content;

        for (const { regex, val } of replacements) {
            content = content.replace(regex, val);
        }

        if (content !== original) {
            fs.writeFileSync(fullPath, content);
            console.log(`Updated ${fullPath}`);
        }
    }
});
