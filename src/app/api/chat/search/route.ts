import { NextResponse } from "next/server";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { verifyRequest } from "@/lib/api-auth";

/**
 * POST /api/chat/search
 *
 * Searches a user's past Jarvis chat sessions stored in Firestore.
 * Returns matching sessions with relevant message snippets.
 *
 * Body: { uid: string, query: string, limit?: number }
 */
export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;
  try {
    const { uid, query, limit = 10 } = await req.json();
    if (!uid || !query) {
      return NextResponse.json({ error: "uid and query required" }, { status: 400 });
    }

    initAdmin();
    const db = getAdminFirestore();

    // Fetch all sessions for this user (we'll search client-side since Firestore
    // doesn't support full-text search natively — the collection is small enough)
    const sessionsSnap = await db
      .collection("users")
      .doc(uid)
      .collection("jarvis_sessions")
      .orderBy("updatedAt", "desc")
      .limit(100) // Cap at 100 most recent sessions
      .get();

    if (sessionsSnap.empty) {
      return NextResponse.json({ results: [], totalSearched: 0 });
    }

    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter((t: string) => t.length > 2);

    type SearchResult = {
      sessionId: string;
      title: string;
      updatedAt: number;
      relevanceScore: number;
      matchingMessages: { text: string; isSelf: boolean; timestamp?: number }[];
    };

    const results: SearchResult[] = [];

    sessionsSnap.forEach(doc => {
      const data = doc.data();
      const messages: any[] = data.messages || [];
      const title: string = data.title || "Untitled";

      // Score this session
      let score = 0;
      const matchingMsgs: any[] = [];

      // Check title
      if (title.toLowerCase().includes(queryLower)) {
        score += 10;
      }

      // Check each message
      messages.forEach(msg => {
        const text = (msg.text || "").toLowerCase();
        let msgScore = 0;

        // Exact phrase match
        if (text.includes(queryLower)) {
          msgScore += 5;
        }

        // Individual term matches
        queryTerms.forEach((term: string) => {
          if (text.includes(term)) {
            msgScore += 1;
          }
        });

        if (msgScore > 0) {
          score += msgScore;
          matchingMsgs.push({
            text: msg.text.length > 200 ? msg.text.substring(0, 200) + "..." : msg.text,
            isSelf: msg.isSelf,
          });
        }
      });

      if (score > 0) {
        results.push({
          sessionId: doc.id,
          title,
          updatedAt: data.updatedAt || 0,
          relevanceScore: score,
          matchingMessages: matchingMsgs.slice(0, 3), // Top 3 matching messages
        });
      }
    });

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return NextResponse.json({
      results: results.slice(0, limit),
      totalSearched: sessionsSnap.size,
    });
  } catch (error: any) {
    console.error("Chat search error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
