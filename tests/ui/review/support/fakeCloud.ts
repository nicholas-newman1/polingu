/**
 * Stand-in for `firebase/functions` and `firebase/storage`. Several modules the
 * review pages import call `getFunctions(app)` as they load, which the real SDK
 * cannot do with the inert app handle. Install with
 *
 *   vi.mock('firebase/functions', () => import('./support/fakeCloud'));
 *   vi.mock('firebase/storage', () => import('./support/fakeCloud'));
 *
 * Every callable and upload fails: the study flow must not depend on them.
 */
const unavailable = (what: string) => () => {
  throw new Error(`${what} is not available in UI tests`);
};

export const getFunctions = () => ({ __fake: 'functions' });
export const httpsCallable = (_functions: unknown, name: string) => async () =>
  unavailable(`Cloud Function ${name}`)();

export const getStorage = () => ({ __fake: 'storage' });
export const ref = (_storage: unknown, path?: string) => ({ fullPath: path ?? '' });
export const getDownloadURL = async () => unavailable('Storage download')();
export const uploadBytesResumable = unavailable('Storage upload');
export const deleteObject = async () => unavailable('Storage delete')();
