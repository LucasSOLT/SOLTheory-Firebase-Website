// ============================================================================
// CRM Auto-Integration Utility
//
// Server-side helper for automatically creating CRM contacts when
// new members join an organization (via invite registration or
// demo-to-org upgrade).
//
// Uses Firebase Admin SDK — only callable from API routes.
// ============================================================================

import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * The Firestore path for CRM contacts within an org.
 * Mirrors the client-side crmPath from crm-store.ts.
 */
function crmContactsPath(orgId: string, instanceId: string = 'default'): string {
  return `orgs/${orgId}/crm-instances/${instanceId}/contacts`;
}

/**
 * The Firestore path for CRM activities within an org.
 */
function crmActivitiesPath(orgId: string, instanceId: string = 'default'): string {
  return `orgs/${orgId}/crm-instances/${instanceId}/activities`;
}

export interface NewMemberContactData {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  certifications: string[];
  orgId: string;
  registrationSource: 'invite' | 'demo_upgrade';
}

/**
 * Auto-create a CRM contact for a new org member.
 *
 * 1. Checks for duplicate email in the org's CRM contacts.
 *    - If a contact with the same email already exists, skips creation
 *      but updates the existing contact's tags to include "Team Member".
 * 2. Creates a new CRM contact document with mapped profile fields.
 * 3. Logs an activity entry on the new contact.
 *
 * This function is best-effort — it catches all errors internally
 * so it never blocks the registration/upgrade flow.
 *
 * @returns The contact ID if created, null if skipped (duplicate), or undefined on error.
 */
export async function createCrmContactForNewMember(
  data: NewMemberContactData
): Promise<string | null | undefined> {
  try {
    const db = getFirestore();
    const contactsCollectionPath = crmContactsPath(data.orgId);

    // ── Step 1: Duplicate detection by email ──
    const existingSnapshot = await db
      .collection(contactsCollectionPath)
      .where('email', '==', data.email.toLowerCase())
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      // Contact with this email already exists — tag them as a team member
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      const existingTags: string[] = existingData.tags || [];

      if (!existingTags.includes('Team Member')) {
        await existingDoc.ref.update({
          tags: [...existingTags, 'Team Member'],
        });
      }

      console.log(
        `[CRM Auto-Integration] Duplicate email found for ${data.email} in ${data.orgId} CRM. ` +
        `Tagged existing contact ${existingDoc.id} as "Team Member".`
      );

      return null; // Skipped — duplicate
    }

    // ── Step 2: Create new CRM contact ──
    // Generate a stable contact ID based on UID to prevent double-creation
    const contactId = `member_${data.uid}`;

    const contactDoc: Record<string, any> = {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email.toLowerCase(),
      birthday: '',
      leadStatus: 'Warm Lead', // Team members start as warm
      tags: ['Team Member', ...(data.certifications.length > 0 ? ['Certified'] : [])],
      totalRevenue: 0,
      aiNotes: `Auto-created from ${data.registrationSource === 'demo_upgrade' ? 'demo account upgrade' : 'invite signup'}. ` +
               `Job title: ${data.jobTitle}. ` +
               (data.certifications.length > 0
                 ? `Certifications: ${data.certifications.join(', ')}.`
                 : 'No certifications listed.'),
      transactions: [],
      outstandingBalance: 0,
      company: '', // Will be populated by org context
      location: '',
      lastContactedDate: new Date().toISOString().split('T')[0],
      createdAt: FieldValue.serverTimestamp(),
      customFields: {
        jobTitle: data.jobTitle,
        certifications: data.certifications.join(', '),
        userId: data.uid,
        registrationSource: data.registrationSource,
      },
    };

    await db.collection(contactsCollectionPath).doc(contactId).set(contactDoc);

    // ── Step 3: Log an activity on the new contact ──
    try {
      await db.collection(crmActivitiesPath(data.orgId)).add({
        customerId: contactId,
        type: 'note',
        content: `${data.firstName} ${data.lastName} joined the organization via ${
          data.registrationSource === 'demo_upgrade'
            ? 'demo account upgrade'
            : 'invite link signup'
        }. CRM contact auto-created.`,
        timestamp: FieldValue.serverTimestamp(),
        createdBy: 'system',
      });
    } catch {
      // Activity log is best-effort
    }

    console.log(
      `[CRM Auto-Integration] Created CRM contact ${contactId} for ${data.email} in ${data.orgId}.`
    );

    return contactId;
  } catch (error: any) {
    console.error('[CRM Auto-Integration] Error:', error.message);
    return undefined; // Never block the registration flow
  }
}
