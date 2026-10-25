import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import config from '../tailwind.config.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baselineFile=path.join(root,'src/shared/theme/model/legacy-color-baseline.json');
const found={};
function visit(directory){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name),relative=path.relative(root,file).replaceAll('\\','/');
    if(entry.isDirectory()){if(!relative.startsWith('src/shared/theme'))visit(file);continue;}
    if(!/\.(tsx|css)$/.test(entry.name)||/\.(test|spec)\.|fixtures/i.test(entry.name))continue;
    const matches=[...fs.readFileSync(file,'utf8').matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d[^)]*\)/g)];
    if(matches.length){found[relative]={};for(const match of matches){const literal=match[0].toLowerCase();found[relative][literal]=(found[relative][literal]??0)+1;}}
  }
}
visit(path.join(root,'src'));
if(process.argv.includes('--baseline'))fs.writeFileSync(baselineFile,JSON.stringify(found,null,2)+'\n');
const baseline=JSON.parse(fs.readFileSync(baselineFile,'utf8'));
const additions=[];
for(const[file,literals]of Object.entries(found))for(const[literal,count]of Object.entries(literals))if(count>(baseline[file]?.[literal]??0))additions.push(`${file}: ${literal}`);
if(additions.length)throw new Error('New raw interface colors: use semantic theme roles, or explicitly review a content/identity exception.\n'+additions.join('\n'));

// Compile real utilities: Tailwind otherwise silently ignores misspelled/undefined tokens.
const utilities=['bg-canvas','bg-surface-raised','text-content','text-content-muted','border-divider','border-control','bg-action','text-on-action','hover:bg-action-hover','text-link','bg-selected','text-selected-content','focus-visible:ring-focus','text-status-danger','bg-status-success-subtle','border-status-warning-border','bg-diff-added','text-diff-removed-content','bg-code','text-brand-300'];
const result=await postcss([tailwind({...config,content:[{raw:utilities.join(' ')}]})]).process('@tailwind utilities;',{from:undefined});
const rules=new Set();result.root.walkRules(rule=>rules.add(rule.selector.replaceAll('\\','')));
for(const utility of utilities)if(![...rules].some(rule=>rule==='.'+utility||rule.startsWith('.'+utility+':')))throw new Error(`Theme utility does not compile: ${utility}`);
console.log(`Theme usage passed: ${utilities.length} compiled utilities, no new raw interface colors.`);
