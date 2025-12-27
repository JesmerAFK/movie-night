import asyncio
from api_service import get_media_metadata
import json

async def debug_stranger_things():
    print("Fetching metadata for 'Stranger Things'...")
    meta = await get_media_metadata("Stranger Things")
    print("\nResult:")
    print(json.dumps(meta, indent=2))

if __name__ == "__main__":
    asyncio.run(debug_stranger_things())
