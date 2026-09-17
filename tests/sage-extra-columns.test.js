// Import the 16-column Sage export (15 + BuildType), assign every job to one
// crew, export, and check the extra column survives the round-trip untouched.
const { chromium } = require('playwright');
const fs = require('fs');
const CSV = fs.readFileSync(__dirname + '/fixtures/sage_16col_buildtype.csv', 'utf8');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const logs = []; page.on('console', m => { const t = m.text(); if (/^\[log\]/.test(t)) logs.push(t); });
  await page.route('https://unpkg.com/**', r => r.abort());
  await page.goto('file://' + require('path').resolve(__dirname, '../dispatch.html'), { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1000);

  const out = await Promise.race([page.evaluate(async (csv) => {
    DB.crews = [{ id:'c1', name:'Paul', active:true, locked:false, color:'#112233',
                  homeAddress:'x', lat:28.5, lon:-81.4, avgMin:40, shiftMin:510, fieldNumber:'7' }];
    DB.settings.dispatchDate = '2026-09-21';
    const saved = [];
    window.saveExportFile = async (name, blob) => { saved.push({ name, text: await blob.text() }); return true; };
    for (const fn of ['rlog','ilog']) { const o = window[fn]; window[fn] = (m,c)=>{ console.log('[log] '+(c||'info')+': '+m); o(m,c); }; }
    dialog.alert = async () => {}; dialog.confirm = async () => true;
    await handleSageCSV(new File([csv], 'PEMPLOYEELT.CSV', { type:'text/csv' }));
    let o = 0;
    for (const j of DB.jobs) { j.crew = 'c1'; j.order = o++; if (j.lat == null) { j.lat = 28.5; j.lon = -81.4; } }
    await exportToSage();
    return { jobs: DB.jobs.length, rows: DB.sageImport.rows.length,
             types: [...new Set(DB.jobs.map(j=>j.type))].sort(),
             subs: [...new Set(DB.jobs.map(j=>j.sub))].length,
             saved };
  }, CSV), new Promise((_,rj)=>setTimeout(()=>rj(new Error('timeout')),40000))]).catch(e=>({fatal:e.message}));
  await browser.close();

  console.log('page errors:', errors.length ? errors : 'none');
  if (out.fatal) { console.log('FATAL', out.fatal); process.exit(1); }
  for (const l of logs) console.log(l);
  console.log(`\nrows stashed: ${out.rows} · jobs: ${out.jobs} · distinct subs: ${out.subs}`);
  console.log('task types:', out.types.join(', '));

  const src = CSV.trim().split(/\r?\n/);
  const sage = out.saved.find(f => /^SAGE /.test(f.name));
  const got = sage.text.trim().split(/\r?\n/);
  const cols = l => (l.match(/"[^"]*"|[^,]+/g) || []).length;
  console.log(`\nsource: ${src.length-1} data rows, ${cols(src[0])} columns`);
  console.log(`export: ${got.length-1} data rows, ${cols(got[0])} columns → ${sage.name}`);
  const lastOf = l => { const p = l.match(/"[^"]*"|[^,]+/g) || []; return p[p.length-1]; };
  console.log('\nBuildType column, source vs export (by Svc Job Num):');
  const key = l => (l.match(/"[^"]*"|[^,]+/g)||[])[5];
  const srcBuild = new Map(src.slice(1).map(l => [key(l).replace(/"|\s/g,''), lastOf(l)]));
  let checked = 0, mismatch = 0;
  for (const l of got.slice(1)) {
    const k = key(l).replace(/"|\s/g,''); const want = srcBuild.get(k);
    if (want === undefined) continue;
    checked++;
    const trimmed = '"' + want.replace(/^"|"$/g,'').replace(/^\s+|\s+$/g,'') + '"';
    if (lastOf(l) !== trimmed) { mismatch++; console.log(`  MISMATCH ${k}: src ${want} → export ${lastOf(l)}`); }
  }
  console.log(`  ${checked} rows checked, ${mismatch} mismatched (values are whitespace-trimmed by design)`);
  if (errors.length || mismatch || out.rows !== src.length - 1 || cols(got[0]) !== cols(src[0])) process.exit(1);
  const flagged = [...srcBuild.entries()].filter(([,v]) => v.replace(/"|\s/g,''));
  console.log(`  non-blank BuildType in source: ${flagged.length} rows → ${[...new Set(flagged.map(([,v])=>v.replace(/"|\s/g,'')))].join(', ')}`);
})();
