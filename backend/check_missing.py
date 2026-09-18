import asyncio
from database import get_database
async def check():
    db = get_database()
    col = db['articles']
    doc = await col.find_one({'expires_at': {'$exists': False}})
    if doc:
        print('MISSING EXPIRES_AT:', doc['_id'])
    else:
        print('ALL DOCS HAVE EXPIRES_AT')
asyncio.run(check())
