/**
 * Instagram Firestore Helpers (Server-Side Only)
 *
 * Manages two collections:
 *   - `instagram_connections`  — stores encrypted Meta/Instagram OAuth tokens per client org
 *   - `scheduled_instagram_posts` — stores scheduled post records with status tracking
 *
 * All token fields are encrypted at rest using AES-256-GCM with the key from
 * `process.env.ENCRYPTION_KEY`.  Generate a 64-hex-char key once:
 *
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Then add it to `.env.local`:
 *   ENCRYPTION_KEY=<your-64-char-hex-string>
 */

import { initAdmin, getFirestore } from "@/firebase/admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstagramConnection {
  id: string;
  metaUserAccessToken: string;
  facebookPageId: string;
  facebookPageAccessToken: string;
  instagramBusinessAccountId: string;
  instagramUsername: string;
  instagramProfilePictureUrl: string;
  updatedAt: Timestamp;
}

export type ScheduledPostStatus =
  | "draft"
  | "scheduled"
  | "processing"
  | "published"
  | "failed";

export interface ScheduledInstagramPost {
  id: string;
  clientId: string;
  mediaItemUrls: string[];
  caption: string;
  scheduledTime: Timestamp;
  status: ScheduledPostStatus;
  metaContainerId: string | null;
  metaMediaId: string | null;
  errorMessage: string | null;
  campaignGoal?: string;
  tone?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Encryption Utilities  (AES-256-GCM)
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128-bit IV
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Returns the 32-byte encryption key derived from the hex-encoded env var.
 * Throws at call-time if the key is missing or malformed so the error surfaces
 * immediately rather than producing silently corrupt data.
 */
function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. " +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  if (hex.length !== 64) {
    throw new Error(
      `ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Got ${hex.length} characters.`
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a plaintext string and returns a compact representation:
 *   `iv:authTag:ciphertext`   (all hex-encoded)
 */
function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted].join(":");
}

/**
 * Decrypts a value previously produced by `encrypt()`.
 */
function decrypt(payload: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, ciphertext] = payload.split(":");

  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error("Malformed encrypted payload — expected iv:authTag:ciphertext");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// ---------------------------------------------------------------------------
// Collection References
// ---------------------------------------------------------------------------

const CONNECTIONS_COLLECTION = "instagram_connections";
const POSTS_COLLECTION = "scheduled_instagram_posts";

function db() {
  initAdmin();
  return getFirestore();
}

// ---------------------------------------------------------------------------
// Instagram Connections
// ---------------------------------------------------------------------------

/** Fields that are encrypted before being stored in Firestore. */
const ENCRYPTED_FIELDS: (keyof Pick<
  InstagramConnection,
  "metaUserAccessToken" | "facebookPageAccessToken"
>)[] = ["metaUserAccessToken", "facebookPageAccessToken"];

/**
 * Upserts an Instagram connection document.  Token fields are encrypted
 * before writing.
 *
 * The document ID is the `clientId` (organization ID) so there is always a
 * 1-to-1 mapping between an org and its Instagram connection.
 */
export async function saveInstagramConnection(
  clientId: string,
  data: Omit<InstagramConnection, "id" | "updatedAt">
): Promise<void> {
  const firestore = db();

  // Clone data so we don't mutate the caller's object
  const record: Record<string, unknown> = { ...data };

  // Encrypt sensitive token fields
  for (const field of ENCRYPTED_FIELDS) {
    const value = record[field];
    if (typeof value === "string" && value.length > 0) {
      record[field] = encrypt(value);
    }
  }

  record.updatedAt = FieldValue.serverTimestamp();

  await firestore
    .collection(CONNECTIONS_COLLECTION)
    .doc(clientId)
    .set(record, { merge: true });
}

/**
 * Retrieves the Instagram connection for a given client/org, decrypting
 * token fields.  Returns `null` if no connection exists.
 */
export async function getInstagramConnection(
  clientId: string
): Promise<InstagramConnection | null> {
  const firestore = db();

  const snap = await firestore
    .collection(CONNECTIONS_COLLECTION)
    .doc(clientId)
    .get();

  if (!snap.exists) return null;

  const data = snap.data() as Record<string, unknown>;

  // Decrypt sensitive token fields
  for (const field of ENCRYPTED_FIELDS) {
    const value = data[field];
    if (typeof value === "string" && value.length > 0) {
      try {
        data[field] = decrypt(value);
      } catch {
        // If decryption fails (e.g. key rotated), surface a clear error
        throw new Error(
          `Failed to decrypt ${field} for client ${clientId}. ` +
            "Has the ENCRYPTION_KEY been rotated without re-encrypting existing records?"
        );
      }
    }
  }

  return { ...data, id: snap.id } as InstagramConnection;
}

/**
 * Deletes the Instagram connection for a given client/org.
 */
export async function deleteInstagramConnection(
  clientId: string
): Promise<void> {
  const firestore = db();

  await firestore.collection(CONNECTIONS_COLLECTION).doc(clientId).delete();
}

// ---------------------------------------------------------------------------
// Scheduled Instagram Posts
// ---------------------------------------------------------------------------

export type CreateScheduledPostData = Omit<
  ScheduledInstagramPost,
  "id" | "createdAt" | "updatedAt" | "metaContainerId" | "metaMediaId" | "errorMessage"
>;

/**
 * Creates a new scheduled post document.  The document ID is auto-generated.
 * Returns the newly created document ID.
 */
export async function createScheduledPost(
  postData: CreateScheduledPostData
): Promise<string> {
  const firestore = db();

  const record: Record<string, unknown> = {
    ...postData,
    metaContainerId: null,
    metaMediaId: null,
    errorMessage: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const docRef = await firestore.collection(POSTS_COLLECTION).add(record);
  return docRef.id;
}

/**
 * Retrieves a single scheduled post by document ID.
 * Returns `null` if the document does not exist.
 */
export async function getScheduledPost(
  postId: string
): Promise<ScheduledInstagramPost | null> {
  const firestore = db();

  const snap = await firestore
    .collection(POSTS_COLLECTION)
    .doc(postId)
    .get();

  if (!snap.exists) return null;

  return { ...snap.data(), id: snap.id } as ScheduledInstagramPost;
}

/**
 * Updates the status of a scheduled post and optionally merges extra data
 * (e.g. `metaContainerId`, `metaMediaId`, `errorMessage`).
 */
export async function updateScheduledPostStatus(
  postId: string,
  status: ScheduledPostStatus,
  extraData?: Partial<
    Pick<
      ScheduledInstagramPost,
      "metaContainerId" | "metaMediaId" | "errorMessage"
    >
  >
): Promise<void> {
  const firestore = db();

  const update: Record<string, unknown> = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
    ...extraData,
  };

  await firestore.collection(POSTS_COLLECTION).doc(postId).update(update);
}

/**
 * Queries scheduled posts for a given client within a date range (inclusive).
 * Results are ordered by `scheduledTime` ascending.
 */
export async function getScheduledPostsByDateRange(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<ScheduledInstagramPost[]> {
  const firestore = db();

  const startTs = Timestamp.fromDate(startDate);
  const endTs = Timestamp.fromDate(endDate);

  const snap = await firestore
    .collection(POSTS_COLLECTION)
    .where("clientId", "==", clientId)
    .where("scheduledTime", ">=", startTs)
    .where("scheduledTime", "<=", endTs)
    .orderBy("scheduledTime", "asc")
    .get();

  return snap.docs.map(
    (doc) => ({ ...doc.data(), id: doc.id } as ScheduledInstagramPost)
  );
}
