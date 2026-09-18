import re
with open('backend/database.py', 'r', encoding='utf-8') as f:
    code = f.read()

code = re.sub(r'\("expiry_warning_sent", ASCENDING\),\n\s*\("expires_at", ASCENDING\)', '("expiry_warning_sent", ASCENDING),\n              ("expires_at", ASCENDING)],\n              name="idx_expiry_warning_expires_at"\n            ', code)

with open('backend/database.py', 'w', encoding='utf-8') as f:
    f.write(code)
