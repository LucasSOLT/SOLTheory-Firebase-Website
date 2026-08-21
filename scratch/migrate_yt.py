import re

filepath = r'c:\Users\lucas\Desktop\SOLTheory.com\src\components\portal\YouTubeDashboard.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace imports
content = re.sub(
    r'import \{ useUser, useFirestore, useStorage \} from "@/firebase";',
    'import { useUser, useSupabase } from "@/providers/supabase-provider";',
    content
)
content = re.sub(r'import \{ doc, getDoc, setDoc, collection, onSnapshot, addDoc, deleteDoc \} from "firebase/firestore";\n?', '', content)
content = re.sub(r'import \{ ref, uploadBytesResumable, getDownloadURL, deleteObject \} from "firebase/storage";\n?', '', content)

# Replace hooks
content = re.sub(r'const firestore = useFirestore\(\);', 'const { supabase } = useSupabase();', content)
content = re.sub(r'const storage = useStorage\(\);', '', content)

# Replace user.uid with user.id
content = re.sub(r'user\.uid', 'user.id', content)
content = re.sub(r'user\?\.uid', 'user?.id', content)
content = re.sub(r'firestore', 'supabase', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done phase 1")
