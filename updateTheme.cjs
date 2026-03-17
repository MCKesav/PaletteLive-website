const fs = require('fs');

const file = 'src/App.tsx';
let code = fs.readFileSync(file, 'utf-8');

const replacements = [
    { search: /bg-white(?=[\s"])/g, replace: 'bg-[#111827]' },
    { search: /text-slate-900/g, replace: 'text-white' },
    { search: /text-slate-800/g, replace: 'text-slate-100' },
    { search: /text-slate-700/g, replace: 'text-slate-300' },
    { search: /text-slate-600/g, replace: 'text-slate-400' },
    { search: /text-slate-500/g, replace: 'text-slate-400' },
    { search: /border-slate-200/g, replace: 'border-white/10' },
    { search: /bg-slate-50\/60/g, replace: 'bg-white/[0.02]' },
    { search: /bg-slate-50\/40/g, replace: 'bg-white/[0.01]' },
    { search: /bg-slate-50/g, replace: 'bg-white/5' },
    { search: /from-slate-50\/80 to-white/g, replace: 'from-white/[0.02] to-[#0A0F1C]' },
    { search: /from-slate-50 via-white to-indigo-50/g, replace: 'from-[#111827] via-[#111827] to-indigo-900/20' },
    { search: /shadow-sm/g, replace: 'shadow-lg shadow-black/20' },
    { search: /bg-indigo-50\/60/g, replace: 'bg-indigo-900/20' },
    { search: /bg-indigo-50/g, replace: 'bg-indigo-[0.05]' },
    { search: /text-indigo-700/g, replace: 'text-indigo-300' },
    { search: /text-indigo-600/g, replace: 'text-indigo-300' },
    { search: /border-indigo-200/g, replace: 'border-indigo-500/30' },
    { search: /border-slate-100/g, replace: 'border-white/5' },
    { search: /bg-slate-100/g, replace: 'bg-white/5' },
    { search: /bg-indigo-100/g, replace: 'bg-indigo-[0.15]' },
    { search: /text-slate-400/g, replace: 'text-slate-300' },
];

function applyReplacements(str) {
    let result = str;
    for (const r of replacements) {
        result = result.replace(r.search, r.replace);
    }
    return result;
}

const targets = [
    { name: 'BeforeAfter', regex: /(function BeforeAfter\(\) \{)([\s\S]*?)(^})/m },
    { name: 'HeatmapShowcase', regex: /(function HeatmapShowcase\(\) \{)([\s\S]*?)(^})/m },
    { name: 'FAQItem', regex: /(function FAQItem[\s\S]*?\{)([\s\S]*?)(^})/m },
    { name: 'ComparisonCheck', regex: /(function ComparisonCheck\(\) \{)([\s\S]*?)(^})/m },
    { name: 'ComparisonCross', regex: /(function ComparisonCross\(\) \{)([\s\S]*?)(^})/m },
    { name: 'ComparisonTable', regex: /(function ComparisonTable[\s\S]*?\{)([\s\S]*?)(^})/m },
    { name: 'AppMain', regex: /(<main className="bg-white text-slate-900">)([\s\S]*?)(<\/main>)/m },
];

for (const t of targets) {
    code = code.replace(t.regex, (match, p1, p2, p3) => {
        let newP2 = applyReplacements(p2);
        if (t.name === 'AppMain') {
            p1 = '<main className="bg-[#0A0F1C] text-slate-300">';
        }
        return p1 + newP2 + p3;
    });
}

fs.writeFileSync(file, code);
console.log("Replacements done");
