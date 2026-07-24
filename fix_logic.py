import os
path = 'src/app/portal/dashboard/[orgId]/action-board/page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("const ORG_ID = pathname.includes('/nxtchapter') ? 'nxtchapter' : 'soltheory';", "const ORG_ID = orgId;")
content = content.replace("const ORG_ID = pathname.includes('/nxtchapter') ? 'nxtchapter' : 'soltheory'", "const ORG_ID = orgId")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed action-board ORG_ID')

path2 = 'src/app/portal/dashboard/[orgId]/gmail/page.tsx'
with open(path2, 'r', encoding='utf-8') as f:
    content2 = f.read()

# Let's check for any remaining 'soltheory' or 'nxtchapter'
import re
print("Remaining soltheory in action-board:", len(re.findall(r'soltheory', content, re.IGNORECASE)))
print("Remaining nxtchapter in action-board:", len(re.findall(r'nxtchapter', content, re.IGNORECASE)))

print("Remaining soltheory in gmail:", len(re.findall(r'soltheory', content2, re.IGNORECASE)))
print("Remaining nxtchapter in gmail:", len(re.findall(r'nxtchapter', content2, re.IGNORECASE)))

