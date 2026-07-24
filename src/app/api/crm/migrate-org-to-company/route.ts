import { NextResponse } from "next/server";
import { initAdmin } from "@/firebase/admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { verifyRequest } from "@/lib/api-auth";

/**
 * One-time migration: Merge "Organization Name" / "organizationName" into "company"
 * for all contacts across all CRM instances.
 * 
 * POST /api/crm/migrate-org-to-company?confirm=yes
 */
export async function POST(req: Request) {
  try {
    initAdmin();
    const adminDb = getFirestore();
    const auth = await verifyRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const confirm = searchParams.get("confirm");
    if (confirm !== "yes") {
      return NextResponse.json({ 
        message: "Dry run — pass ?confirm=yes to actually migrate. Scanning...",
        dryRun: true 
      });
    }

    const results: { updated: string[]; skipped: string[]; errors: string[] } = {
      updated: [],
      skipped: [],
      errors: [],
    };

    // Get all org docs
    const orgsSnap = await adminDb.collection("orgs").get();
    
    for (const orgDoc of orgsSnap.docs) {
      const orgId = orgDoc.id;
      
      // Get all CRM instances for this org
      const instancesSnap = await adminDb
        .collection(`orgs/${orgId}/crm-instances`)
        .get();
      
      for (const instanceDoc of instancesSnap.docs) {
        const instanceId = instanceDoc.id;
        const contactsPath = `orgs/${orgId}/crm-instances/${instanceId}/contacts`;
        
        const contactsSnap = await adminDb.collection(contactsPath).get();
        
        for (const contactDoc of contactsSnap.docs) {
          const data = contactDoc.data();
          const contactId = contactDoc.id;
          const fullPath = `${contactsPath}/${contactId}`;
          
          // Check for Organization Name in various field locations
          const orgNameFromCustom = data.customFields?.["Organization Name"] 
                                 || data.customFields?.["organizationName"]
                                 || data.customFields?.["organization_name"]
                                 || null;
          const orgNameDirect = data["Organization Name"] 
                             || data["organizationName"] 
                             || null;
          
          const orgNameValue = orgNameFromCustom || orgNameDirect;
          
          if (!orgNameValue) {
            results.skipped.push(`${fullPath} — no org name found`);
            continue;
          }
          
          // Build the update
          const currentCompany = data.company || "";
          const updates: Record<string, any> = {};
          
          if (!currentCompany) {
            // Company is empty — move org name into it
            updates.company = orgNameValue;
          } else if (currentCompany !== orgNameValue) {
            // Company already has a value — append if different
            updates.company = `${currentCompany} (${orgNameValue})`;
          } else {
            // Already the same — just clean up the old fields
          }
          
          // Clean up old top-level fields
          if (data["Organization Name"] !== undefined) {
            updates["Organization Name"] = FieldValue.delete();
          }
          if (data["organizationName"] !== undefined) {
            updates["organizationName"] = FieldValue.delete();
          }
          
          // Clean up from customFields
          if (data.customFields) {
            const cleanedCustomFields = { ...data.customFields };
            let customFieldChanged = false;
            
            for (const key of ["Organization Name", "organizationName", "organization_name"]) {
              if (cleanedCustomFields[key] !== undefined) {
                delete cleanedCustomFields[key];
                customFieldChanged = true;
              }
            }
            
            if (customFieldChanged) {
              updates.customFields = cleanedCustomFields;
            }
          }
          
          if (Object.keys(updates).length > 0) {
            try {
              await contactDoc.ref.update(updates);
              results.updated.push(
                `${fullPath} — company: "${currentCompany}" → "${updates.company || currentCompany}"`
              );
            } catch (err: any) {
              results.errors.push(`${fullPath} — ${err.message}`);
            }
          } else {
            results.skipped.push(`${fullPath} — already clean`);
          }
        }
      }
    }

    return NextResponse.json({
      message: "Migration complete",
      summary: {
        updated: results.updated.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
      details: results,
    });
    
  } catch (error: any) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: error.message || "Migration failed" },
      { status: 500 }
    );
  }
}
