from api_service import get_movie_files
import asyncio
import traceback

async def debug_subs(title):
    print(f"Debugging {title}...")
    try:
        downloads, subtitles = await get_movie_files(title)
        
        print("\n--- SUBTITLES ---")
        if subtitles:
            print(f"Found {len(subtitles)} subtitles.")
            s = subtitles[0]
            print(f"Type: {type(s)}")
            print(f"Dir: {dir(s)}")
            if hasattr(s, '__dict__'):
                print(f"Dict: {vars(s)}")
            elif isinstance(s, dict):
                print(f"Dict Content: {s}")
        else:
            print("No subtitles found.")

    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_subs("Home Alone 2"))
