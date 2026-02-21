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
    // Backgrounds
    'bg-white/80': 'bg-background/80',
    'bg-white': 'bg-card',
    'bg-slate-50/50': 'bg-surface-2/50',
    'bg-slate-50/30': 'bg-surface-2/30',
    'bg-slate-50': 'bg-surface-2',
    'bg-slate-100': 'bg-surface-3',
    'bg-slate-200': 'bg-muted',
    'bg-slate-800': 'bg-surface-3',
    'bg-slate-900': 'bg-primary',
    'hover:bg-slate-50': 'hover:bg-surface-2',
    'hover:bg-slate-100': 'hover:bg-surface-3',
    'hover:bg-slate-200': 'hover:bg-muted',
    'hover:bg-slate-800': 'hover:bg-primary-dim',

    // Texts
    'text-slate-900': 'text-foreground',
    'text-slate-800': 'text-foreground',
    'text-slate-700': 'text-foreground',
    'text-slate-600': 'text-muted-foreground',
    'text-slate-500': 'text-muted-foreground',
    'text-slate-400': 'text-muted-foreground',
    'text-slate-300': 'text-muted-foreground',
    'hover:text-slate-900': 'hover:text-foreground',
    'hover:text-slate-800': 'hover:text-foreground',
    'hover:text-slate-700': 'hover:text-foreground',
    'hover:text-slate-600': 'hover:text-foreground',

    // Borders
    'border-slate-100': 'border-border',
    'border-slate-200': 'border-border',
    'border-slate-300': 'border-border',
    'border-slate-800': 'border-border',
    'border-white/50': 'border-border',
    'border-white': 'border-border',

    // Misc fixes
    'bg-blue-50': 'bg-primary/10',
    'bg-blue-100': 'bg-primary/20',
    'text-blue-600': 'text-primary',
    'text-blue-500': 'text-primary',
    'text-blue-700': 'text-primary-glow',
    'bg-blue-600': 'bg-primary',
    'hover:bg-blue-700': 'hover:bg-primary-dim',
    'shadow-blue-200': 'shadow-none',
    'shadow-blue-200/50': 'shadow-none',
    'from-indigo-50': 'from-background',
    'to-blue-100': 'to-surface-2',
    'bg-blue-200/20': 'bg-primary/5',
    'bg-indigo-200/20': 'bg-primary/5',
    'shadow-lg shadow-blue-200': 'shadow-glow-primary',
    'bg-gradient-to-br': '',

    // Danger
    'bg-red-50': 'bg-danger/10',
    'text-red-500': 'text-danger',
    'text-red-600': 'text-danger',
    'border-red-100': 'border-danger/30',
    'border-red-200': 'border-danger/30',
    'border-red-500/20': 'border-danger/20',
    'bg-red-500/10': 'bg-danger/10',
    'bg-red-600': 'bg-danger',
    'hover:bg-red-700': 'hover:bg-danger-dim',
    'hover:bg-red-800': 'hover:bg-danger-dim',

    // Green/Success
    'bg-green-50': 'bg-success/10',
    'bg-green-100': 'bg-success/20',
    'text-green-500': 'text-success',
    'text-green-600': 'text-success',
    'border-green-100': 'border-success/30',
    'border-green-200': 'border-success/30',
    'border-green-500/20': 'border-success/20',
    'bg-green-500/10': 'bg-success/10',
    'bg-green-600': 'bg-success',
    'hover:bg-green-700': 'hover:bg-success',

    // Yellow/Warning
    'bg-yellow-50': 'bg-warning/10',
    'bg-yellow-100': 'bg-warning/20',
    'text-yellow-500': 'text-warning',
    'text-yellow-600': 'text-warning',
    'border-yellow-200': 'border-warning/30',
    'bg-yellow-500/10': 'bg-warning/10',
    'border-yellow-500/20': 'border-warning/20',

    // Purple
    'bg-purple-100': 'bg-indigo-500/20',
    'text-purple-500': 'text-indigo-400',
    'text-purple-600': 'text-indigo-500',

    // Violet
    'bg-violet-100': 'bg-violet-500/20',
    'text-violet-700': 'text-violet-400',
    'border-violet-200': 'border-violet-500/30',

    // Indigo
    'text-indigo-50': 'text-indigo-500/20',
    'text-indigo-600': 'text-indigo-500',

    // Primary/10 badge
    'bg-primary/10': 'bg-primary/20',
    'border-primary/20': 'border-primary/30'
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
