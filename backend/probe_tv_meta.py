from moviebox_api import Session, Search, SubjectType, TVSeriesDetails
from moviebox_api.models import SearchResultsItem
import asyncio

async def probe_tv(title):
    session = Session()
    search = Search(session=session, query=title, subject_type=SubjectType.TV_SERIES)
    results = await search.get_content()
    items = results.get('items', [])
    
    if not items:
        print("No results")
        return

    item = items[0]
    print(f"Item keys: {item.keys()}")
    
    # Try getting details
    # The library seems picky. Let's try passing the detail URL path if checking the item fails.
    # Inspect item first
    print(f"Item URL: {item.get('url')}")
    print(f"Item ID: {item.get('subjectId')}")
    
    # It seems TVSeriesDetails might want the 'url' field string, not the object, if the assertion failed?
    # Or maybe I just pass item['url']?
    
    tv_url = item.get('url') # This is usually the detail page URL partial
    
    try:
        print("Attempting with URL string...")
        details = TVSeriesDetails(tv_url, session)
        content = await details.get_content()
        print("Success with URL string")
    except Exception as e:
        print(f"Failed with URL string: {e}")
        try:
             res_item = SearchResultsItem(**item)
             details = TVSeriesDetails(res_item, session)
             content = await details.get_content()
             print("Success with Item object")
        except Exception as e2:
             print(f"Failed with Item object: {e2}")
             return

    if isinstance(content, dict):
        import json
        with open('tv_meta_dump.json', 'w') as f:
            # Handle non-serializable objects if any
            json.dump({k: str(v) for k, v in content.items()}, f, indent=4)
        print("Dumped content to tv_meta_dump.json")
    else:
        print("Content is not a dict")

if __name__ == "__main__":
    asyncio.run(probe_tv("Stranger Things"))
