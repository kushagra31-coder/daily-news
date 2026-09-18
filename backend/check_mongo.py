import asyncio
from database import get_database
async def check():
    db = get_database()
    col = db['articles']
    doc = await col.find_one()
    print(doc)
asyncio.run(check())
