const fs = require('fs');

function processFile(sourcePath, targetPath, componentName) {
  let content = fs.readFileSync(sourcePath, 'utf8');

  // Add useParams import if not present
  if (!content.includes('useParams')) {
    content = content.replace('from "next/navigation";', 'useParams, from "next/navigation";');
    if (!content.includes('useParams')) {
       // if next/navigation wasn't there
       content = content.replace(/(import .*? from 'next\/navigation';)/, '$1\nimport { useParams } from "next/navigation";');
    }
    // Handle the case where next/navigation might be imported differently
    if (!content.includes('next/navigation')) {
      content = 'import { useParams } from "next/navigation";\n' + content;
    }
  }

  // Inject useParams hook inside the component
  const hookInjection = `\n  const { orgId } = useParams<{ orgId: string }>();\n`;
  const componentRegex = new RegExp(`(export default function ${componentName}\\([^)]*\\)\\s*\\{\\s*)`);
  content = content.replace(componentRegex, `$1${hookInjection}`);
  
  // also inject in subcomponents if they are exported or main?
  // the instructions say: "CRITICAL: When you extract orgId using useParams(), you must add: const { orgId } = useParams<{ orgId: string }>(); NEAR THE TOP of the component, after other hooks."
  // So we'll inject it.
  
  // Replace hardcoded values according to rules
  // `pact_entries_soltheory` → `pact_entries_\${orgId}`
  content = content.replace(/pact_entries_soltheory/g, 'pact_entries_${orgId}');
  content = content.replace(/pact_entries_nxtchapter/g, 'pact_entries_${orgId}');
  
  // `soltheory_\${params.agentId}` → `\${orgId}_\${params.agentId}`
  content = content.replace(/soltheory_\$\{([^}]+)\}/g, '${orgId}_${$1}');
  content = content.replace(/nxtchapter_\$\{([^}]+)\}/g, '${orgId}_${$1}');

  // `orgs/soltheory/crm-instances` → `orgs/\${orgId}/crm-instances`
  content = content.replace(/orgs\/(soltheory|nxtchapter)\/crm-instances/g, 'orgs/${orgId}/crm-instances');

  // `orgId: "soltheory"` → `orgId: orgId`
  content = content.replace(/orgId:\s*"(soltheory|nxtchapter)"/g, 'orgId: orgId');

  // `origin=soltheory` → `origin=\${orgId}`
  content = content.replace(/origin=(soltheory|nxtchapter)/g, 'origin=${orgId}');

  // `orgPrefix="soltheory"` → `orgPrefix={orgId}`
  content = content.replace(/orgPrefix="(soltheory|nxtchapter)"/g, 'orgPrefix={orgId}');

  // `/portal/dashboard/soltheory/` → `/portal/dashboard/\${orgId}/`
  content = content.replace(/\/portal\/dashboard\/(soltheory|nxtchapter)\//g, '/portal/dashboard/${orgId}/');

  // local storage: soltheory_selectedModel -> ${orgId}_selectedModel
  content = content.replace(/"soltheory_([^"]+)"/g, '`${orgId}_$1`');
  content = content.replace(/'soltheory_([^']+)'/g, '`${orgId}_$1`');
  content = content.replace(/"nxtchapter_([^"]+)"/g, '`${orgId}_$1`');
  content = content.replace(/'nxtchapter_([^']+)'/g, '`${orgId}_$1`');

  // Replace remaining soltheory/nxtchapter literals with orgId
  // We have to be careful with "me@soltheory.org". 
  content = content.replace(/"me@soltheory\.org"/g, '`me@${orgId}.org`');
  content = content.replace(/"me@nxtchapter\.org"/g, '`me@${orgId}.org`');
  
  // Dashboard ID
  content = content.replace(/dashboardId="(soltheory|nxtchapter)"/g, 'dashboardId={orgId}');

  fs.writeFileSync(targetPath, content, 'utf8');
  console.log('Saved to', targetPath);
}

// process gmail
processFile(
  'src/app/portal/dashboard/nxtchapter/gmail/page.tsx', 
  'src/app/portal/dashboard/[orgId]/gmail/page.tsx',
  'GmailPage'
);

// process action-board
processFile(
  'src/app/portal/dashboard/nxtchapter/action-board/page.tsx', 
  'src/app/portal/dashboard/[orgId]/action-board/page.tsx',
  'ActionBoardPage'
);
