import asyncio
from main import get_feed
async def check():
    try:
        res = await get_feed(category=None, page=1, page_size=20)
        print(res)
    except Exception as e:
        import traceback; traceback.print_exc()
asyncio.run(check())
