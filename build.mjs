// Bundles the game into dist/ (index.html + game.js + style.css). Use --watch for development.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const watch = process.argv.includes('--watch');
const single = process.argv.includes('--single'); // also emit a single self-contained HTML file
const entry = process.argv.find((a) => a.startsWith('--entry='))?.slice(8) || 'src/main.js';
const outdir = process.argv.find((a) => a.startsWith('--outdir='))?.slice(9) || 'dist';
fs.mkdirSync(outdir, { recursive: true });

const opts = {
  entryPoints: [entry],
  bundle: true,
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  format: 'iife',
  target: ['es2020', 'safari15'],
  outfile: path.join(outdir, 'game.js'),
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
};

function copyStatic() {
  if (fs.existsSync('index.html')) fs.copyFileSync('index.html', path.join(outdir, 'index.html'));
  if (fs.existsSync('src/style.css')) fs.copyFileSync('src/style.css', path.join(outdir, 'style.css'));
  if (fs.existsSync('public')) for (const f of fs.readdirSync('public')) fs.copyFileSync(path.join('public', f), path.join(outdir, f));
}

if (watch) {
  const ctx = await esbuild.context({ ...opts, plugins: [{ name: 'static', setup(b) { b.onEnd(() => copyStatic()); } }] });
  await ctx.watch();
} else {
  await esbuild.build(opts);
  copyStatic();
  if (single) {
    const html = fs.readFileSync(path.join(outdir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(outdir, 'style.css'), 'utf8');
    const js = fs.readFileSync(path.join(outdir, 'game.js'), 'utf8');
    const out = html
      .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`)
      .replace('<script src="game.js"></script>', () => `<script>\n${js.replace(/<\/script/g, '<\\/script')}\n</script>`);
    fs.writeFileSync(path.join(outdir, 'frostvale.html'), out);
    console.log('single file:', path.join(outdir, 'frostvale.html'), (out.length / 1024 / 1024).toFixed(2), 'MB');
  }
  const art = process.argv.find((a) => a.startsWith('--artifact='))?.slice(11);
  if (art) {
    // claude.ai artifact variant: the host adds the document skeleton, so emit title + style + body content + script
    const css = fs.readFileSync(path.join(outdir, 'style.css'), 'utf8');
    const js = fs.readFileSync(path.join(outdir, 'game.js'), 'utf8');
    const page = `<title>Frostvale Legends</title>
<style>
:root { color-scheme: dark; }
${css}
</style>
<canvas id="gl"></canvas>
<canvas id="ov"></canvas>
<div id="ui"></div>
<div id="rotate"><div>↻</div><p>Rotate your iPhone to landscape</p></div>
<script>
${js.replace(/<\/script/g, '<\\/script')}
</script>
`;
    fs.writeFileSync(art, page);
    console.log('artifact page:', art, (page.length / 1024 / 1024).toFixed(2), 'MB');
  }
}
