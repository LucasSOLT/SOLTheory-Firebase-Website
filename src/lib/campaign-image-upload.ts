import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { FirebaseStorage } from 'firebase/storage';

export interface UploadedImage {
  url: string;
  filename: string;
  storagePath: string;
}

const ALLOWED_TYPES = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Uploads a campaign email image to Firebase Storage.
 *
 * Storage path: campaign_images/{uid}/{campaignId}/{timestamp}_{filename}
 *
 * @returns The public download URL, original filename, and storage path.
 * @throws If the file type is not an allowed image type or exceeds 5MB.
 */
export async function uploadCampaignImage(
  storage: FirebaseStorage,
  uid: string,
  campaignId: string,
  file: File
): Promise<UploadedImage> {
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      `Invalid file type "${file.type}". Allowed types: ${ALLOWED_TYPES.join(', ')}`
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the 5MB limit.`
    );
  }

  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `campaign_images/${uid}/${campaignId}/${Date.now()}_${sanitizedFilename}`;
  const storageRefObj = ref(storage, storagePath);

  await uploadBytes(storageRefObj, file);
  const url = await getDownloadURL(storageRefObj);

  return {
    url,
    filename: file.name,
    storagePath,
  };
}

/**
 * Deletes a campaign email image from Firebase Storage.
 *
 * @param storage - Firebase Storage instance
 * @param storagePath - The full storage path of the image to delete
 */
export async function deleteCampaignImage(
  storage: FirebaseStorage,
  storagePath: string
): Promise<void> {
  const storageRefObj = ref(storage, storagePath);
  await deleteObject(storageRefObj);
}
