import sys
import re

path = 'src/app/portal/dashboard/[orgId]/action-board/page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('import { usePathname, useSearchParams } useParams, from "next/navigation";', 'import { usePathname, useSearchParams, useParams } from "next/navigation";')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
