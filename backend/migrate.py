import asyncio
from datetime import timedelta
from database import get_database
async def run():
    db = get_database()
    col = db['articles']
    async for doc in col.find({'expires_at': {'$exists': False}}):
        await col.update_one({'_id': doc['_id']}, {'$set': {'expires_at': doc['published_at'] + timedelta(hours=24)}})
asyncio.run(run())
