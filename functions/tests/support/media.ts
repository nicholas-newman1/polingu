/**
 * Tiny but valid media files, so tests can run the real pdfjs-dist and
 * music-metadata parsers instead of mocking them.
 */

/** A minimal PDF with `pages` blank pages and the given document info (Title, Author, ...). */
export function makePdf({
  pages = 1,
  info = {},
}: { pages?: number; info?: Record<string, string> } = {}): Buffer {
  const kids = Array.from({ length: pages }, (_, i) => `${4 + i} 0 R`).join(' ');
  const infoEntries = Object.entries(info)
    .map(([key, value]) => `/${key} (${value})`)
    .join(' ');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`,
    `<< ${infoEntries} >>`,
    ...Array.from(
      { length: pages },
      () => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>'
    ),
  ];

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 3 0 R >>\n`;
  out += `startxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** A silent mono 8-bit PCM WAV file lasting `seconds` (at a 1 kHz sample rate to stay small). */
export function makeWav(seconds: number): Buffer {
  const sampleRate = 1000;
  const dataSize = Math.round(seconds * sampleRate);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate, 28); // byte rate
  header.writeUInt16LE(1, 32); // block align
  header.writeUInt16LE(8, 34); // bits per sample
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, Buffer.alloc(dataSize, 128)]);
}
