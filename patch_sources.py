import re

with open('backend/fetcher.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace RSS_SOURCES list definition with json.load
code = re.sub(
    r'RSS_SOURCES: list\[dict\] = \[.*?\]\n',
    'import json\nimport os\n\nsources_path = os.path.join(os.path.dirname(__file__), "sources.json")\nwith open(sources_path, "r", encoding="utf-8") as _f:\n    RSS_SOURCES: list[dict] = json.load(_f)\n',
    code, flags=re.DOTALL
)

with open('backend/fetcher.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated fetcher.py to use sources.json!")
