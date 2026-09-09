// Feed the real TEMPLATE_file01 through dispatch.html, assign crews as the
// TEMPLATE_file02 has them, and diff the Route4Me upload against it.
const { chromium } = require('playwright');
const fs = require('fs');
const UP = __dirname + '/fixtures/';
const CSV = fs.readFileSync(UP + 'TEMPLATE_file01_Sage_export.csv', 'utf8');
const EXPECT = fs.readFileSync(UP + 'TEMPLATE_file02_Route4Me_upload.csv', 'utf8');

// Parse template file02 to get: sub coords, crew homes, crew ids/names, assignment.
function parseCsv(t){ return t.trim().split(/\r?\n/).map(l => l.match(/"([^"]*)"/g).map(c => c.slice(1,-1))); }
const exp = parseCsv(EXPECT); const H = exp[0]; const rows = exp.slice(1);
const col = n => H.indexOf(n);
const subs = {}, crews = {}, assign = {};
for (const r of rows) {
  const alias = r[col('Alias')], lat = +r[col('Latitude')], lon = +r[col('Longitude')];
  const rid = r[col('Original Route ID')], name = r[col('Route Name')];
  if (r[col('Depot')] === '1') { crews[rid] = { name, lat, lon }; continue; }
  const parts = alias.split(' - '); const sub = parts[1];
  subs[sub] = { lat, lon };
  assign[r[col('Svc Job Num')]] = rid;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const logs = []; page.on('console', m => { const t = m.text(); if (/^\[rlog\]/.test(t)) logs.push(t); });
  await page.route('https://unpkg.com/**', r => r.abort());
  await page.goto('file://' + require('path').resolve(__dirname, '../dispatch.html'), { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1000);

  const result = await Promise.race([page.evaluate(async ({ csv, subs, crews, assign }) => {
    DB.subs = Object.entries(subs).map(([name, c]) => ({ name, address: '', lat: c.lat, lon: c.lon, aliases: [] }));
    DB.crews = Object.entries(crews).map(([fn, c]) => ({ id: 'crew' + fn, name: c.name, active: true, locked: false, color: '#112233', homeAddress: 'x', lat: c.lat, lon: c.lon, avgMin: 40, shiftMin: 510, fieldNumber: fn }));
    DB.settings.dispatchDate = '2026-09-10';
    DB.settings.fuzzyThreshold = 0.99;
    DB.settings.routeCardPDF = false;
    const saved = [];
    window.saveExportFile = async (name, blob) => { saved.push({ name, text: await blob.text() }); return true; };
    const origRlog = window.rlog; window.rlog = (m, c) => { console.log('[rlog] ' + (c||'info') + ': ' + m); origRlog(m, c); };
    dialog.alert = async () => {};
    await handleSageCSV(new File([csv], 'TEMPLATE_file01_Sage_export.csv', { type: 'text/csv' }));
    const svcByJob = new Map();
    for (const row of DB.sageImport.rows) svcByJob.set(row.idx, row.fields.svcJobNum);
    let o = 0;
    for (const j of DB.jobs) { const rid = assign[svcByJob.get(j.sageRowIdx)]; if (rid) { j.crew = 'crew' + rid; j.order = o++; } }
    await exportToSage();
    return { saved, jobs: DB.jobs.length, pending: DB.pendingSubReview.length };
  }, { csv: CSV, subs, crews, assign }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 40000))]).catch(e => ({ fatal: e.message }));
  await browser.close();

  console.log('page errors:', errors.length ? errors : 'none');
  if (result.fatal) { console.log('FATAL', result.fatal); process.exit(1); }
  console.log('jobs imported:', result.jobs, '· pending sub review:', result.pending);
  for (const l of logs) console.log(l);
  const r4m = result.saved.find(f => /route4me/.test(f.name));
  console.log('\n--- files:', result.saved.map(f => f.name).join(', '));
  // Compare on the columns both files share, by header name, order-insensitive
  // (the template lists jobs in file order, depots last). Columns only one side
  // has (Service Time, Sequence No here; Svc Job Num, Scheduled For there) are
  // reported, not compared.
  const got = parseCsv(r4m.text); const GH = got[0];
  const shared = H.filter(h => GH.includes(h));
  console.log('columns produced:', GH.join(', '));
  console.log('only in template:', H.filter(h => !GH.includes(h)).join(', ') || 'none');
  console.log('only produced   :', GH.filter(h => !H.includes(h)).join(', ') || 'none');
  const proj = (r, hdr) => shared.map(h => r[hdr.indexOf(h)]).join('|');
  const gotSet = new Map(got.slice(1).map(r => [proj(r, GH), r]));
  const expSet = new Map(rows.map(r => [proj(r, H), r]));
  let ok = 0; const missing = [], extra = [];
  for (const [k, r] of expSet) { if (gotSet.has(k)) ok++; else missing.push(r); }
  for (const [k, r] of gotSet) { if (!expSet.has(k)) extra.push(r); }
  console.log(`rows matching template on shared columns: ${ok}/${rows.length}`);
  if (missing.length) { console.log('\nEXPECTED but not produced:'); for (const r of missing) console.log('  ' + r.join(' | ')); }
  if (extra.length) { console.log('\nPRODUCED but not in template:'); for (const r of extra) console.log('  ' + r.join(' | ')); }
  const iSeq = GH.indexOf('Sequence No'), iRid = GH.indexOf('Original Route ID'), iAl = GH.indexOf('Alias');
  console.log('\nsequence by route:');
  for (const r of got.slice(1)) console.log(`  route ${r[iRid]}  seq ${r[iSeq] || '-'}  ${r[iAl]}`);
  process.exit(ok === rows.length ? 0 : 1);
})();
