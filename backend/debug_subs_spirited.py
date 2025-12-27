
import asyncio
from api_service import get_movie_files

async def debug_subs_spirited():
    # Spirited Away (2001)
    downloads, subtitles = await get_movie_files("Spirited Away", year=2001)
    print(f"Subtitles Found: {len(subtitles)}")
    for i, s in enumerate(subtitles):
        print(f"Sub {i+1}: lan={s.get('lan')}, lanName={s.get('lanName')}")

if __name__ == "__main__":
    asyncio.run(debug_subs_spirited())
