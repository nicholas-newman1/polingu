/**
 * Stand-in for `pdfjs-dist`: a document with `pdfFile.numPages` pages whose text layer
 * holds `pdfFile.text[page]`. Rendering to the canvas is a no-op.
 *
 *   vi.mock('pdfjs-dist', () => import('./support/pdfjs'));
 */
export const GlobalWorkerOptions = { workerSrc: '' };

export const pdfFile = {
  numPages: 5,
  /** Words on each page, as one text run per entry. */
  text: {} as Record<number, string[]>,
  /** Loading the document fails while set. */
  broken: false,
  /** URLs the viewer asked to load. */
  loaded: [] as string[],
  reset() {
    this.numPages = 5;
    this.text = {};
    this.broken = false;
    this.loaded = [];
  },
};

function page(pageNumber: number) {
  return {
    getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
    render: () => ({ promise: Promise.resolve() }),
    getTextContent: async () => ({
      items: (pdfFile.text[pageNumber] ?? []).map((str, line) => ({
        str,
        transform: [12, 0, 0, 12, 40, 760 - line * 20],
        width: str.length * 6,
        height: 12,
      })),
    }),
  };
}

export function getDocument(url: string) {
  pdfFile.loaded.push(url);
  const doc = { numPages: pdfFile.numPages, getPage: async (n: number) => page(n) };
  return {
    promise: pdfFile.broken
      ? Promise.reject(new Error('Invalid PDF structure'))
      : Promise.resolve(doc),
  };
}
