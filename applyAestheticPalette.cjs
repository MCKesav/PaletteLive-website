const fs = require('fs');

const file = 'src/App.tsx';
let code = fs.readFileSync(file, 'utf-8');

const aestheticReplacements = [
    // Card upgrading to glass/premium look
    { search: /rounded-3xl border border-slate-200 bg-white p-6 shadow-sm/g, replace: 'rounded-3xl border border-white/80 bg-white/70 backdrop-blur-xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]' },
    { search: /rounded-2xl border border-slate-200 bg-white p-5 shadow-sm/g, replace: 'rounded-2xl border border-white/80 bg-white/70 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]' },
    { search: /rounded-3xl border border-slate-200 bg-white shadow-sm/g, replace: 'rounded-3xl border border-white/80 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]' },
    { search: /rounded-2xl border border-slate-200 bg-white/g, replace: 'rounded-2xl border border-white/80 bg-white/70 backdrop-blur-xl shadow-sm' },

    // Backgrounds of sections
    { search: /bg-slate-50\/60/g, replace: 'bg-transparent' }, // we are using a global background mesh now
    { search: /from-slate-50\/80 to-white/g, replace: 'from-transparent to-white/50' },
    { search: /from-slate-50 via-white to-indigo-50/g, replace: 'from-transparent via-white/40 to-blue-50/50' },

    // Accent colors
    { search: /indigo-50/g, replace: 'blue-50' },
    { search: /indigo-100/g, replace: 'blue-100' },
    { search: /indigo-200/g, replace: 'blue-200' },
    { search: /indigo-300/g, replace: 'cyan-500' }, // swap text-indigo-300 tracking to cyan
    { search: /indigo-400/g, replace: 'blue-400' },
    { search: /indigo-500/g, replace: 'blue-500' },
    { search: /indigo-600/g, replace: 'blue-600' },
    { search: /indigo-700/g, replace: 'blue-700' },

    { search: /from-indigo-400 via-fuchsia-400 to-amber-400/g, replace: 'from-cyan-400 via-blue-500 to-indigo-500' }, // Hero hero text

    { search: /bg-slate-50/g, replace: 'bg-white/60' },
    { search: /border-slate-100/g, replace: 'border-slate-200/60' },

    { search: /border-indigo-200/g, replace: 'border-blue-200/50' },
];

function applyReplacements(str) {
    let result = str;
    for (const r of aestheticReplacements) {
        result = result.replace(r.search, r.replace);
    }
    return result;
}

// Only target the main landing page chunks so we don't mess up Interactive Demo
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
            p1 = `<main className="bg-[#F8FAFC] text-slate-900 relative overflow-hidden">
        {/* Soft background aura mesh for landing page */}
        <div className="absolute inset-0 pointer-events-none flex justify-center z-0">
          <div className="w-[800px] h-[600px] bg-blue-400/5 rounded-full blur-[100px] absolute -top-20 -left-40"></div>
          <div className="w-[600px] h-[500px] bg-cyan-400/5 rounded-full blur-[100px] absolute top-[25%] -right-20"></div>
          <div className="w-[900px] h-[600px] bg-blue-300/5 rounded-full blur-[120px] absolute bottom-[10%] left-[10%]"></div>
        </div>
        <div className="relative z-10">`;
            p3 = `</div>\n      </main>`;
        }
        return p1 + newP2 + p3;
    });
}

// Update bottom CTA header and text
code = code.replace(/<section className="border-t border-slate-200 bg-slate-950 text-white"/, '<section className="border-t border-white/10 bg-slate-950 text-white overflow-hidden relative"');
// Make sure the bottom CTA has matching accents
code = code.replace(/text-indigo-300"/g, 'text-cyan-400"');
code = code.replace(/from-indigo-400 via-fuchsia-400 to-amber-400/g, 'from-cyan-400 via-blue-500 to-indigo-500');

fs.writeFileSync(file, code);
console.log("Aesthetic light palette applied successfully");
