const { writeFile } = require('fs/promises');
const { join } = require('path');
const { PDFDocument } = require('pdf-lib');

const FIXTURES_DIR = join(__dirname, '..', 'tests', 'fixtures', 'corrupted-pdfs');

async function generateCorruptedPDFs() {
  try {
    // Generate base PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    page.drawText('Test PDF Document', {
      x: 50,
      y: 350,
      size: 20
    });
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    // 1. Missing header
    const missingHeader = Buffer.from(pdfBytes.slice(5)); // Remove %PDF- header
    await writeFile(join(FIXTURES_DIR, 'header', 'missing-header.pdf'), missingHeader);

    // 2. Invalid version
    const invalidVersion = Buffer.concat([
      Buffer.from('%PDF-9.9'), // Invalid version number
      Buffer.from(pdfBytes.slice(7))
    ]);
    await writeFile(join(FIXTURES_DIR, 'header', 'invalid-version.pdf'), invalidVersion);

    // 3. Corrupted xref table
    const xrefStr = 'xref';
    const xrefIndex = pdfBuffer.indexOf(xrefStr);
    const corruptedXref = Buffer.concat([
      pdfBuffer.slice(0, xrefIndex),
      Buffer.from('xref\n0 INVALID\n'),
      pdfBuffer.slice(xrefIndex + 20)
    ]);
    await writeFile(join(FIXTURES_DIR, 'xref', 'corrupted-xref.pdf'), corruptedXref);

    // 4. Missing xref table
    const trailerStr = 'trailer';
    const trailerIndex = pdfBuffer.indexOf(trailerStr);
    const missingXref = Buffer.concat([
      pdfBuffer.slice(0, xrefIndex),
      pdfBuffer.slice(trailerIndex)
    ]);
    await writeFile(join(FIXTURES_DIR, 'xref', 'missing-xref.pdf'), missingXref);

    // 5. Corrupted object stream
    const streamStr = 'stream\n';
    const endStreamStr = '\nendstream';
    const streamStart = pdfBuffer.indexOf(streamStr);
    const streamEnd = pdfBuffer.indexOf(endStreamStr);
    const corruptedStream = Buffer.concat([
      pdfBuffer.slice(0, streamStart + streamStr.length),
      Buffer.from('CORRUPTED_STREAM_DATA'),
      pdfBuffer.slice(streamEnd)
    ]);
    await writeFile(join(FIXTURES_DIR, 'stream', 'corrupted-stream.pdf'), corruptedStream);

    // 6. Invalid stream length
    const lengthStr = '/Length';
    const lengthPos = pdfBuffer.indexOf(lengthStr);
    const spaceAfterLength = pdfBuffer.indexOf(' ', lengthPos + lengthStr.length);
    const invalidLength = Buffer.concat([
      pdfBuffer.slice(0, lengthPos + lengthStr.length),
      Buffer.from(' 999999'),
      pdfBuffer.slice(spaceAfterLength)
    ]);
    await writeFile(join(FIXTURES_DIR, 'stream', 'invalid-length.pdf'), invalidLength);

    // 7. Broken encryption dictionary
    const encryptDict = `
      /Encrypt <<
        /Filter /Standard
        /V 1
        /R 2
        /O <INVALID_OWNER_KEY>
        /U <INVALID_USER_KEY>
        /P -3
      >>
    `;
    const encryptPos = pdfBuffer.indexOf('<<');
    const brokenEncryption = Buffer.concat([
      pdfBuffer.slice(0, encryptPos),
      Buffer.from(encryptDict),
      pdfBuffer.slice(encryptPos)
    ]);
    await writeFile(join(FIXTURES_DIR, 'encryption', 'broken-encryption.pdf'), brokenEncryption);

    // 8. Invalid encryption key
    const invalidKeyDict = `
      /Encrypt <<
        /Filter /Standard
        /V 1
        /R 2
        /O <0000000000000000000000000000000000000000000000000000000000000000>
        /U <0000000000000000000000000000000000000000000000000000000000000000>
        /P -3
      >>
    `;
    const invalidKey = Buffer.concat([
      pdfBuffer.slice(0, encryptPos),
      Buffer.from(invalidKeyDict),
      pdfBuffer.slice(encryptPos)
    ]);
    await writeFile(join(FIXTURES_DIR, 'encryption', 'invalid-key.pdf'), invalidKey);

    // 9. Corrupted metadata
    const docWithMeta = await PDFDocument.create();
    docWithMeta.setTitle('Test Document');
    docWithMeta.setAuthor('Test Author');
    const metaBytes = await docWithMeta.save();
    const metaBuffer = Buffer.from(metaBytes);
    const infoStr = '/Info';
    const infoPos = metaBuffer.indexOf(infoStr);
    const endInfoPos = metaBuffer.indexOf('>>', infoPos);
    const corruptedMeta = Buffer.concat([
      metaBuffer.slice(0, infoPos + infoStr.length),
      Buffer.from(' CORRUPTED_METADATA'),
      metaBuffer.slice(endInfoPos)
    ]);
    await writeFile(join(FIXTURES_DIR, 'metadata', 'corrupted-metadata.pdf'), corruptedMeta);

    // 10. Invalid XMP metadata
    const xmpDoc = await PDFDocument.create();
    xmpDoc.setTitle('Test Document');
    const xmpBytes = await xmpDoc.save();
    const xmpBuffer = Buffer.from(xmpBytes);
    const xmpStr = '<?xpacket';
    const xmpEndStr = '</x:xmpmeta>';
    const xmpPos = xmpBuffer.indexOf(xmpStr);
    const xmpEndPos = xmpBuffer.indexOf(xmpEndStr);
    const invalidXmp = Buffer.concat([
      xmpBuffer.slice(0, xmpPos + xmpStr.length),
      Buffer.from(' INVALID_XMP_DATA'),
      xmpBuffer.slice(xmpEndPos - 10)
    ]);
    await writeFile(join(FIXTURES_DIR, 'metadata', 'invalid-xmp.pdf'), invalidXmp);

    // 11. Corrupted form fields
    const formDoc = await PDFDocument.create();
    formDoc.addPage([600, 400]);
    const form = formDoc.getForm();
    form.createTextField('test.field');
    const formBytes = await formDoc.save();
    const formBuffer = Buffer.from(formBytes);
    const acroFormStr = '/AcroForm';
    const acroFormPos = formBuffer.indexOf(acroFormStr);
    const endAcroFormPos = formBuffer.indexOf('>>', acroFormPos);
    const corruptedFields = Buffer.concat([
      formBuffer.slice(0, acroFormPos + acroFormStr.length),
      Buffer.from(' CORRUPTED_FORM_DATA'),
      formBuffer.slice(endAcroFormPos)
    ]);
    await writeFile(join(FIXTURES_DIR, 'forms', 'corrupted-fields.pdf'), corruptedFields);

    // 12. Invalid widget annotations
    const widgetDoc = await PDFDocument.create();
    widgetDoc.addPage([600, 400]);
    const widgetForm = widgetDoc.getForm();
    widgetForm.createButton('test.button');
    const widgetBytes = await widgetDoc.save();
    const widgetBuffer = Buffer.from(widgetBytes);
    const annotsStr = '/Annots';
    const annotsPos = widgetBuffer.indexOf(annotsStr);
    const endAnnotsPos = widgetBuffer.indexOf('>>', annotsPos);
    const invalidWidgets = Buffer.concat([
      widgetBuffer.slice(0, annotsPos + annotsStr.length),
      Buffer.from(' INVALID_WIDGET_DATA'),
      widgetBuffer.slice(endAnnotsPos)
    ]);
    await writeFile(join(FIXTURES_DIR, 'forms', 'invalid-widgets.pdf'), invalidWidgets);

    console.log('Successfully generated all corrupted PDF test files');
  } catch (error) {
    console.error('Error generating test PDFs:', error);
    process.exit(1);
  }
}

generateCorruptedPDFs(); 