import re

with open('backend/main.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove FastAPILimiter imports and calls
code = re.sub(r'from fastapi_limiter import FastAPILimiter\n', '', code)
code = re.sub(r'from fastapi_limiter\.depends import RateLimiter\n', '', code)
code = re.sub(r'from cache import get_redis, get_cached, cache_response\n', '', code)

# Remove lifespan init
code = re.sub(r'    await FastAPILimiter\.init\(get_redis\(\)\)\n', '', code)

# Remove rate limiters from endpoints
code = re.sub(r', dependencies=\[Depends\(RateLimiter\(times=100, seconds=60\)\)\]', '', code)
code = re.sub(r'dependencies=\[Depends\(RateLimiter\(times=10, seconds=60\)\)\],', '', code)
code = re.sub(r', dependencies=\[Depends\(RateLimiter\(times=50, seconds=60\)\)\]', '', code)
code = re.sub(r', dependencies=\[Depends\(RateLimiter\(times=5, seconds=60\)\)\]', '', code)

# Remove caching logic
code = re.sub(r'    cache_key = f"feed:\{category or \x27all\x27\}:p\{page\}:s\{page_size\}"\n    cached = await get_cached\(cache_key\)\n    if cached:\n        return FeedResponse\(\*\*cached\)\n\n', '', code)

code = re.sub(r'    response = FeedResponse\(.*?\)\n    await cache_response\(cache_key, response\.model_dump\(\), ttl_seconds=30\)\n    return response', r'    return FeedResponse(articles=results, total=total, page=page, has_more=has_more, next_reset_in_seconds=next_reset)', code, flags=re.DOTALL)

with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Removed Redis and Rate Limiting from main.py!")
