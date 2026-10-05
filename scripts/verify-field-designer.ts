import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
async function streams(bytes: Uint8Array) {
  const d = await PDFDocument.load(bytes);
  let out = '';
  for (const [, o] of d.context.enumerateIndirectObjects()) {
    if (o instanceof PDFRawStream) { try { out += Buffer.from(decodePDFRawStream(o).decode()).toString('latin1') + '\n'; } catch {} }
  }
  return out;
}
import { applyFieldDesign } from '@/lib/pdf-field-designer-engine';
import { detectPdfFields, fillAndFlattenPdf, fillPdfPartial, flattenAndStampPdf } from '@/lib/pdf-form-engine';
import { validateDesignOps, DesignError } from '@/lib/field-design';

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

async function main() {
  const doc = await PDFDocument.create();
  const p = doc.addPage([612, 792]);
  doc.addPage([612, 792]);
  const form = doc.getForm();
  const t1 = form.createTextField('Patient Initials'); t1.addToPage(p, { x: 50, y: 700, width: 40, height: 20 });
  const t2 = form.createTextField('Initial deposit'); t2.addToPage(p, { x: 50, y: 650, width: 150, height: 20 });
  const t3 = form.createTextField('Some Text'); t3.addToPage(p, { x: 50, y: 600, width: 150, height: 20 });
  const base = await doc.save();

  const d0 = await detectPdfFields(base);
  const ty = (n: string) => d0.find((f) => f.name === n)?.type;
  ok(ty('Patient Initials') === 'signature', 'Patient Initials -> signature');
  ok(ty('Initial deposit') === 'text', 'Initial deposit (wide) stays text');
  ok(ty('Some Text') === 'text', 'plain text stays text');

  // validation
  const pages = [{ x: 0, y: 0, width: 612, height: 792 }];
  let threw = false;
  try { validateDesignOps([{ op: 'add', type: 'text', pageIndex: 0, x: 600, y: 10, width: 50, height: 20 }], pages, []); } catch (e) { threw = e instanceof DesignError; }
  ok(threw, 'off-page box rejected');
  threw = false;
  try { validateDesignOps([{ op: 'delete', name: 'nope' }], pages, []); } catch (e) { threw = e instanceof DesignError; }
  ok(threw, 'unknown field rejected');

  const res = await applyFieldDesign(base, [
    { op: 'add', type: 'text', pageIndex: 0, x: 100, y: 100, width: 150, height: 22, label: 'Your name' },
    { op: 'add', type: 'signature', pageIndex: 0, x: 100, y: 200, width: 170, height: 40 },
    { op: 'add', type: 'initials', pageIndex: 1, x: 100, y: 200, width: 60, height: 30 },
    { op: 'add', type: 'date', pageIndex: 0, x: 300, y: 100, width: 90, height: 20 },
    { op: 'add', type: 'fill', pageIndex: 0, x: 300, y: 300, width: 36, height: 14, color: 'yellow' },
    { op: 'add', type: 'fill', pageIndex: 0, x: 400, y: 300, width: 36, height: 14, color: 'red' },
    { op: 'delete', name: 'Some Text' },
    { op: 'retype', name: 'Initial deposit', to: 'signature' },
  ]);
  ok(res.added.length === 6, 'six added');
  ok(Object.keys(res.autoFill).length === 1, 'one autofill hint');
  const newName = res.nameMap['Initial deposit'];
  ok(!!newName && /^Signature_/.test(newName), 'retype renamed: ' + newName);

  const d1 = await detectPdfFields(res.pdfBytes);
  const find = (n: string) => d1.find((f) => f.name === n);
  ok(!find('Some Text'), 'deleted field gone');
  ok(find(newName)?.type === 'signature', 'retyped detects as signature');
  const sig = d1.filter((f) => f.type === 'signature').map((f) => f.name);
  console.log('signature-ish:', sig);
  ok(sig.some((n) => n.startsWith('Initials_')), 'Initials_n -> signature type');
  ok(find('Text_1')?.type === 'text' && find('Text_1')?.tooltip === 'Your name', 'Text_1 text + tooltip');
  const fills = d1.filter((f) => f.name.startsWith('Fill_'));
  ok(fills.length === 2 && fills.every((f) => f.type === 'checkbox' && f.widgets?.[0]?.width === 36), 'fill checkboxes with geometry');
  ok(find('Text_1')?.widgets?.[0]?.pageIndex === 0 && find('Initials_1')?.widgets?.[0]?.pageIndex === 1, 'page indexes right');

  // fill + flatten with a checked fill
  const sizeBefore = (await fillAndFlattenPdf(res.pdfBytes, { fields: {} })).pdfBytes.length;
  const filled = await fillAndFlattenPdf(res.pdfBytes, { fields: { Fill_yellow_1: true, Text_1: 'Hello' } });
  const dFlat = await detectPdfFields(filled.pdfBytes);
  ok(dFlat.length === 0, 'flattened: no fields left');
  const dump = await streams(filled.pdfBytes);
  ok(/0\.98\d* 0\.8\d* 0\.08\d* rg/.test(dump), 'yellow rectangle painted');
  ok(filled.pdfBytes.length !== sizeBefore, 'differs from unfilled');

  // partial + final flatten path
  const part = await fillPdfPartial(res.pdfBytes, { Fill_red_2: true }, ['Fill_red_2']);
  const fin = await flattenAndStampPdf(part.pdfBytes, []);
  const dump2 = await streams(fin.pdfBytes);
  ok(/0\.86\d* 0\.14\d* 0\.14\d* rg/.test(dump2), 'red rectangle painted via multi-signer path');
  const none = await streams((await flattenAndStampPdf((await fillPdfPartial(res.pdfBytes, {}, [])).pdfBytes, [])).pdfBytes);
  ok(!/0\.86\d* 0\.14\d* 0\.14\d* rg/.test(none), 'unchecked fill box paints nothing');

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
