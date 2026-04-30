import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from api_service import get_stream_url

async def test():
    try:
        url, referer = await get_stream_url("Stranger Things", is_tv=True, season=1, episode=1)
        print(f"URL: {url}")
        print(f"Referer: {referer}")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
