
import asyncio
from api_service import get_movie_files

async def debug_stranger_subs():
    downloads, subtitles = await get_movie_files("Stranger Things", season=1, episode=1)
    print(f"Subtitles: {len(subtitles)}")
    for s in subtitles:
        params = vars(s) if hasattr(s, '__dict__') else (s if isinstance(s, dict) else {})
        url = params.get('url', '')
        # print first 50 and last 50
        print(f"URL: {url[:50]}...{url[-50:]}")
        print(f"LABEL: {params.get('label') or params.get('title')}")

if __name__ == "__main__":
    asyncio.run(debug_stranger_subs())
