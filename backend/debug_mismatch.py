from moviebox_api import Session, Search, SubjectType
import asyncio

async def debug_search(title):
    session = Session()
    print(f"Searching for: {title}")
    search = Search(session=session, query=title, subject_type=SubjectType.MOVIES)
    results = await search.get_content()
    items = results.get('items', [])
    
    print(f"Found {len(items)} items")
    for item in items:
        # print full dict for the first one to check structure
        # print(item)
        print(f" - Title: {item.get('title')}, Year: {item.get('year')}")

if __name__ == "__main__":
    asyncio.run(debug_search("Zootopia 2"))
