from moviebox_api import Session, Search, MovieDetails, SubjectType, TVSeriesDetails
from moviebox_api.models import SearchResultsItem
import asyncio
import json

async def get_stream_url(title: str) -> str | None:
    session = Session()
    try:
        print(f"Searching for {title} (Movies)...")
        search = Search(session=session, query=title, subject_type=SubjectType.MOVIES)
        results = await search.get_content()
        items = results.get('items', [])
        
        if not items:
            return None
            
        target_item_dict = items[0]
        try:
            target_item = SearchResultsItem(**target_item_dict)
        except:
            return None

        print(f"Fetching details for ID: {target_item.subjectId}")
        if target_item.subjectType == SubjectType.MOVIES:
            details_fetcher = MovieDetails(url_or_item=target_item, session=session)
        else:
            return None

        details = await details_fetcher.get_content()
        
        # DUMP details
        with open('backend/details_dump.txt', 'w', encoding='utf-8') as f:
            f.write(str(details))
            
        return None

    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    asyncio.run(get_stream_url("Inception"))
