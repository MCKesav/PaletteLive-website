const fs = require('fs');

const file = 'src/App.tsx';
let code = fs.readFileSync(file, 'utf-8');

const replacements = [
    { search: /bg-slate-50\/60/g, replace: 'bg-gradient-to-b from-indigo-50/40 via-white to-fuchsia-50/20' },
    { search: /from-slate-50\/80 to-white/g, replace: 'from-indigo-50/30 to-[#FAFAFA]' },
    { search: /from-slate-50 via-white to-indigo-50/g, replace: 'from-indigo-50/30 via-white to-fuchsia-50/30' },
    { search: /border-slate-200/g, replace: 'border-indigo-100/80' },
    { search: /border-slate-100/g, replace: 'border-indigo-50/60' },
    { search: /bg-slate-50(?!\/)/g, replace: 'bg-indigo-50/50' }, // exclude bg-slate-50/60
    { search: /bg-slate-100/g, replace: 'bg-indigo-50/80' },
    { search: /shadow-sm/g, replace: 'shadow-xl shadow-indigo-900/5' },
    { search: /bg-indigo-50\/60/g, replace: 'bg-violet-50/80' },
    { search: /bg-indigo-50(?!\/)/g, replace: 'bg-violet-50' },
    { search: /text-indigo-700/g, replace: 'text-violet-700' },
    { search: /text-indigo-600/g, replace: 'text-violet-600' },
    { search: /border-indigo-200/g, replace: 'border-violet-200' },
    { search: /text-slate-900/g, replace: 'text-indigo-950' },
    { search: /text-slate-800/g, replace: 'text-indigo-900' },
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
    // Apply to main body but avoid breaking footer and bottom CTA
    { name: 'AppMain', regex: /(<main className="bg-white text-slate-900">)([\s\S]*?)(<\/main>)/m },
];

for (const t of targets) {
    code = code.replace(t.regex, (match, p1, p2, p3) => {
        let newP2 = applyReplacements(p2);
        if (t.name === 'AppMain') {
            p1 = '<main className="bg-[#FAFAFA] text-slate-800">';
        }
        return p1 + newP2 + p3;
    });
}

fs.writeFileSync(file, code);
console.log("Light palette replacements done");
