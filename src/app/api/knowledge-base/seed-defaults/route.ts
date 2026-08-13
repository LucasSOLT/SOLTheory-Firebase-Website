import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { initAdmin, getFirestore } from "@/firebase/admin";
import { solTheoryKnowledge } from "@/lib/soltheory-knowledge";

const NXT_CHAPTER_KNOWLEDGE = `
[CLIENT KNOWLEDGE BASE — NXT CHAPTER]
You are the dedicated dashboard assistant for NXT Chapter. You have been programmed with complete, permanent knowledge regarding this client.

CRITICAL PHONETIC AND TEXT MAPPING:
- Whenever a user says or types "next chapter", "the next chapter", "next-chapter", or any phonetic equivalent, ALWAYS resolve this to the Denver-based nonprofit "NXT Chapter".
- Do not ask for clarification. Proceed immediately with the understanding that they are referring to NXT Chapter.

CLIENT PROFILE:
- Legal Name: Next Chapter Foundation Inc. (branded as NXT Chapter / NxtChapter)
- Entity Type: 501(c)(3) Nonprofit Organization
- Founded: 2020, Denver, CO
- Mission: To accommodate ex-offenders (returning citizens) with essentials and reentry support upon release from incarceration, reducing the recidivism rate and ensuring a smooth transition back into society.
- Core Philosophy: Poor decisions should not warrant the dehumanization of an individual.

KEY PERSONNEL & GOVERNANCE:
- Josephine Burton: President & Executive Director. Developer of the S.E.E.D.™ curriculum.
- Marquell Burton: Co-Founder, Treasurer, and Chief Financial Officer (CFO).
- James Harris: Vice President.
- Zenya Packer: Secretary.
- Cornelius Williams: Board Member.
- Fiscal Sponsors (Historical/Current): CrossPurpose, Colorado Nonprofit Development Center (CNDC).

PROGRAM PORTFOLIO:
1. 3 Steps to Success:
   - Step 1 (Essentials): Provision of hygiene packs, clothing, and administrative assistance to obtain vital documents (State IDs, Birth Certificates, SSN Cards, and RTD transit cards).
   - Step 2 (Employment Support): Securing stable employment, providing transit fare, interview attire, and work-safety gear (safety vests, steel-toe boot resources, hard hats, safety glasses).
   - Step 3 (Reentry Support Net): Coordinating accountability structures between family, NXT Chapter mentors, halfway house case managers, and parole/probation officers.

2. The S.E.E.D.™ Program (Support, Empowerment, Education, & Development):
   - An 8-week mental health and cognitive development curriculum for returning citizens.
   - Core Pillars: (1) Setting Realistic Goals, (2) Cognitive Thinking, (3) Self-Esteem Building.
   - Integrates with W.R.A.P. (Wellness Recovery Action Plan) for substance use recovery, trauma, and mental wellness.
`;

export async function POST(req: Request) {
  try {
    const authError = await verifyRequest(req);
    if (authError) return authError;

    const { orgId } = await req.json();

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    initAdmin();
    const db = getFirestore();
    const docRef = db.collection("organizations").doc(orgId);
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data();
      if (!data?.defaultKnowledge) {
        let newKnowledge = "";
        if (orgId === "soltheory") {
          newKnowledge = solTheoryKnowledge;
        } else if (orgId === "nxtchapter") {
          newKnowledge = NXT_CHAPTER_KNOWLEDGE;
        }

        if (newKnowledge) {
          await docRef.update({
            defaultKnowledge: newKnowledge
          });
          return NextResponse.json({ success: true, seeded: true });
        }
      }
    } else {
        // If the org doesn't exist, we might want to create it, but typically 
        // we'd just leave it alone or create with defaults.
        let newKnowledge = "";
        if (orgId === "soltheory") {
          newKnowledge = solTheoryKnowledge;
        } else if (orgId === "nxtchapter") {
          newKnowledge = NXT_CHAPTER_KNOWLEDGE;
        }
        await docRef.set({
          defaultKnowledge: newKnowledge
        }, { merge: true });
        return NextResponse.json({ success: true, seeded: true });
    }

    return NextResponse.json({ success: true, seeded: false });

  } catch (err: any) {
    console.error("[Seed Defaults API] Error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
