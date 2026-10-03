import type { PDFDocumentProxy } from 'pdfjs-dist';

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export interface OpenedPdf {
  pdf: PDFDocumentProxy;
  destroy: () => void;
}

export async function openPdf(data: ArrayBuffer): Promise<OpenedPdf> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data });
  const pdf = await task.promise;
  return { pdf, destroy: () => void task.destroy() };
}

export type { PDFDocumentProxy };
