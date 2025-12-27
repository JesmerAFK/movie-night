from api_service import get_movie_files
import asyncio
import traceback

async def debug_media(title):
    print(f"Debugging {title}...")
    try:
        downloads, subtitles = await get_movie_files(title)
        
        print("\n--- QUALITIES ---")
        if downloads:
            for d in downloads:
                res = getattr(d, 'resolution', 'N/A')
                print(f"Res: '{res}' (Type: {type(res)}) - URL: {d.url[:30]}...")
        else:
            print("No downloads found.")

        print("\n--- SUBTITLES ---")
        if subtitles:
            for s in subtitles:
                # Dump all attributes
                params = vars(s) if hasattr(s, '__dict__') else (s if isinstance(s, dict) else {})
                print(f"Sub Object: {params}")
        else:
            print("No subtitles found.")

    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_media("Home Alone 2: Lost in New York"))
