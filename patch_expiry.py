import re

# Update ExpiryBar.tsx
with open('frontend/components/ExpiryBar.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    'expiresInSeconds: number\n  publishedAt: string',
    'expiresAt: string\n  publishedAt: string'
)

code = re.sub(
    r'export default function ExpiryBar\(\{.*?className = \x27\x27,\n\}: ExpiryBarProps\) \{.*?\/\/ only start once; we sync via the prop effect above',
    '''export default function ExpiryBar({
  expiresAt,
  publishedAt,
  showCountdown = true,
  className = '',
}: ExpiryBarProps) {
  const calc = () => {
    const expiresMs = new Date(expiresAt).getTime()
    return Math.max(0, Math.floor((expiresMs - Date.now()) / 1000))
  }
  const [remainingSeconds, setRemainingSeconds] = useState<number>(calc())

  useEffect(() => {
    setRemainingSeconds(calc())
    const interval = setInterval(() => {
      setRemainingSeconds(calc())
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])''',
    code, flags=re.DOTALL
)
with open('frontend/components/ExpiryBar.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

# Update NewsCard.tsx
with open('frontend/components/NewsCard.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    'expiresInSeconds={article.expires_in_seconds}',
    'expiresAt={article.expires_at}'
)
with open('frontend/components/NewsCard.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated frontend countdown logic!")
