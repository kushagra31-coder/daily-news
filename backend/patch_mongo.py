import asyncio
from datetime import timedelta
from database import get_database

async def migrate_db():
    db = get_database()
    articles = db['articles']
    cursor = articles.find({'expires_at': {'$exists': False}})
    count = 0
    async for doc in cursor:
        expires_at = doc['published_at'] + timedelta(hours=24)
        await articles.update_one({'_id': doc['_id']}, {'$set': {'expires_at': expires_at}})
        count += 1
    print(f"Migrated {count} articles")

asyncio.run(migrate_db())
