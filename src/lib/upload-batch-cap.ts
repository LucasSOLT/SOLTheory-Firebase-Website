// ─── Upload batch cap ───
// HTML `<input type="file" multiple>` and drag-and-drop cannot limit how many
// files a user picks, so the AI Brain upload handlers cap the batch here:
// keep the first `max` files (in selection order) and report what was dropped,
// instead of rejecting the whole batch.

export const MAX_AI_BRAIN_UPLOAD_FILES = 5;

export const AI_BRAIN_UPLOAD_CAP_WARNING =
  `You selected more than ${MAX_AI_BRAIN_UPLOAD_FILES} files. Only the first ${MAX_AI_BRAIN_UPLOAD_FILES} will be uploaded to prevent overloading.`;

export interface CappedBatch<T> {
  accepted: T[];
  dropped: T[];
}

export function capUploadBatch<T>(files: ArrayLike<T> | Iterable<T>, max: number = MAX_AI_BRAIN_UPLOAD_FILES): CappedBatch<T> {
  const all = Array.from(files as ArrayLike<T>);
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : 0;
  return { accepted: all.slice(0, limit), dropped: all.slice(limit) };
}
