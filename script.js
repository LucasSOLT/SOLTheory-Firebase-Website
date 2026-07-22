const fs = require('fs');

const files = [
    "c:\\Users\\lucas\\Desktop\\SOLTheory.com\\src\\app\\portal\\dashboard\\nxtchapter\\action-board\\page.tsx",
    "c:\\Users\\lucas\\Desktop\\SOLTheory.com\\src\\app\\portal\\dashboard\\nxtchapter\\ai-agents\\[agentId]\\page.tsx",
    "c:\\Users\\lucas\\Desktop\\SOLTheory.com\\src\\app\\portal\\dashboard\\nxtchapter\\gmail\\page.tsx",
    "c:\\Users\\lucas\\Desktop\\SOLTheory.com\\src\\app\\portal\\dashboard\\nxtchapter\\settings\\page.tsx",
    "c:\\Users\\lucas\\Desktop\\SOLTheory.com\\src\\app\\portal\\dashboard\\soltheory\\action-board\\page.tsx",
    "c:\\Users\\lucas\\Desktop\\SOLTheory.com\\src\\app\\portal\\dashboard\\soltheory\\agentic-campaigning\\instagram\\_components\\CaptionEditor.tsx",
    "c:\\Users\\lucas\\Desktop\\SOLTheory.com\\src\\app\\portal\\dashboard\\soltheory\\ai-knowledge-base\\page.tsx",
    "c:\\Users\\lucas\\Desktop\\SOLTheory.com\\src\\app\\portal\\dashboard\\soltheory\\communications\\imessage\\page.tsx",
    "c:\\Users\\lucas\\Desktop\\SOLTheory.com\\src\\app\\portal\\dashboard\\soltheory\\gmail\\page.tsx",
    "c:\\Users\\lucas\\Desktop\\SOLTheory.com\\src\\app\\portal\\dashboard\\soltheory\\settings\\page.tsx",
    "c:\\Users\\lucas\\Desktop\\SOLTheory.com\\src\\components\\campaigning\\CampaignManager.tsx"
];

for (let file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    if (!content.includes('getAuthHeaders')) {
        content = content.replace(/(import .*?;?\n)/, "$1import { getAuthHeaders } from \"@/lib/api-auth-client\";\n");
        changed = true;
    }

    if (file.endsWith("CampaignManager.tsx")) {
        let newContent = content.replace(/headers:\s*\{\s*"Content-Type":\s*"application\/json",\s*"x-uid":\s*user\?\.uid\s*\|\|\s*""\s*\}/g, 'headers: { ...(await getAuthHeaders()), "x-uid": user?.uid || "" }');
        if (newContent !== content) {
            content = newContent;
            changed = true;
        }
    }

    let newContent = content.replace(/headers:\s*\{\s*["']Content-Type["']\s*:\s*["']application\/json["']\s*\}/g, "headers: await getAuthHeaders()");
    if (newContent !== content) {
        content = newContent;
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content);
    }
}
console.log("Done");
