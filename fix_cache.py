import re
with open('backend/main.py', 'r', encoding='utf-8') as f:
    code = f.read()

code = re.sub(r'    await cache_response\(cache_key,.*?\)\n', '', code)

with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(code)
