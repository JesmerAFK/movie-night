from api_service import get_movie_files
import asyncio
import traceback

async def test():
    print("Testing Stranger Things (S1E1)...")
    try:
        downloads, subtitles = await get_movie_files("Stranger Things", season=1, episode=1)
        print(f"Downloads: {len(downloads) if downloads else 'None'}")
        if downloads:
            for d in downloads:
                print(f" - {d.resolution}: {d.url}")
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
