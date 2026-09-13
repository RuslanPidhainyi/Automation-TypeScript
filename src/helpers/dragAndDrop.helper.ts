import fs from 'fs';
import path from 'path';
import { Locator } from '@playwright/test';

/**
 * Simulates dropping local files onto an HTML5 drop zone that has no backing
 * `<input type="file">` to target with `setInputFiles`.
 *
 * `ng2FileDrop` (`add-offer.component.html`, `photo-editor.component.html`)
 * only ever listens for the native `drop` event and reads
 * `event.dataTransfer.files` (`FileDropDirective.onDrop`, `ng2-file-upload`) -
 * neither template renders an `<input>`, so there is nothing for
 * `locator.setInputFiles` to attach to. This builds a real `DataTransfer`
 * inside the page and dispatches `drop` with it, which is the pattern
 * Playwright's own docs recommend for input-less drag-and-drop zones.
 */
export async function dropFiles(zone: Locator, ...filePaths: string[]): Promise<void> {
  const files = filePaths.map((filePath) => ({
    name: path.basename(filePath),
    base64: fs.readFileSync(filePath).toString('base64'),
    mimeType: mimeTypeOf(filePath),
  }));

  const dataTransfer = await zone.page().evaluateHandle(async (items) => {
    const dt = new DataTransfer();
    for (const item of items) {
      const blob = await fetch(`data:${item.mimeType};base64,${item.base64}`).then((res) =>
        res.blob(),
      );
      dt.items.add(new File([blob], item.name, { type: item.mimeType }));
    }
    return dt;
  }, files);

  await zone.dispatchEvent('drop', { dataTransfer });
}

function mimeTypeOf(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}
