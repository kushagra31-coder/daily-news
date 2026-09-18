import re

with open('backend/verifier.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace the LLM check blocks
code = re.sub(
    r'    if reputation_score >= 0\.60:\n.*?tier="pending",\n        \)',
    '    if reputation_score >= 0.60:\n        return VerificationResult(\n            verified=False,\n            score=reputation_score * 0.8,\n            tier="pending",\n        )',
    code, flags=re.DOTALL
)

code = re.sub(
    r'    # ------------------------------------------------------------------ #\n    # Tier 3: LLM fact-check.*?llm_check\(title, summary\)',
    '',
    code, flags=re.DOTALL
)

with open('backend/verifier.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Removed LLM checks from verifier.py!")
