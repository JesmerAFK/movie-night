from moviebox_api import Session, Search, SubjectType, DownloadableTVSeriesFilesDetail, TVSeriesDetails
from moviebox_api.download import DownloadableMovieFilesDetail
from moviebox_api.models import SearchResultsItem
import asyncio
import difflib

# Helper to fetch and parse files with smart matching
async def get_movie_files(title: str, year: int = None, season: int = 1, episode: int = 1):
    # Use a fresh session for the search
    session = Session()
    try:
        # 1. Search (Movies first, then TV)
        items = []
        search_queries = [title]
        # If title has special chars, try a clean version too
        clean_title = "".join(c for c in title if c.isalnum() or c.isspace())
        if clean_title != title:
            search_queries.append(clean_title)

        for query in search_queries:
            print(f"DEBUG: Searching for '{query}' on Render...")
            try:
                search_movie = Search(session=session, query=query, subject_type=SubjectType.MOVIES)
                res = await asyncio.wait_for(search_movie.get_content(), timeout=8.0)
                found = res.get('items', [])
                if found:
                    print(f"DEBUG: Found {len(found)} movies for '{query}'")
                    items.extend(found)
                    break # Stop if we found something
            except: pass
            
            try:
                search_tv = Search(session=session, query=query, subject_type=SubjectType.TV_SERIES)
                res = await asyncio.wait_for(search_tv.get_content(), timeout=8.0)
                found = res.get('items', [])
                if found:
                    print(f"DEBUG: Found {len(found)} series for '{query}'")
                    items.extend(found)
                    break
            except: pass

        if not items:
            print(f"DEBUG: No results found for '{title}' after all attempts.")
            return None, None

        # Smart Matching Logic
        cleaned_query = title.lower().strip()
        query_has_digit = any(char.isdigit() for char in cleaned_query)
        
        candidates = []
        for item in items:
            i_title = item.get('title', '').strip()
            i_year = item.get('year') 
            try: i_year = int(i_year) 
            except: i_year = None
            
            i_id = item.get('subjectId')
            
            score = 0
            clean_i_title = i_title.lower()
            ratio = difflib.SequenceMatcher(None, cleaned_query, clean_i_title).ratio()
            
            if ratio < 0.4: continue
            
            score += ratio * 100
            
            if cleaned_query == clean_i_title: score += 50
            
            # Digit Check
            item_has_digit = any(char.isdigit() for char in clean_i_title)
            # Strict logic: If query has digits that are NOT in item, penalty.
            import re
            query_digits = set(re.findall(r'\d+', cleaned_query))
            item_digits = set(re.findall(r'\d+', clean_i_title))
            
            # If query has a digit, it MUST be in the item title (sequel logic)
            if query_digits and not query_digits.issubset(item_digits):
                 score -= 100
            
            # Year Logic
            if year and i_year:
                diff = abs(i_year - year)
                if diff == 0: score += 50
                elif diff <= 1: score += 25
                elif diff > 3: score -= 100
            
            candidates.append((score, item))
            
        candidates.sort(key=lambda x: x[0], reverse=True)
        
        if not candidates:
            return None, None
            
        best_score = candidates[0][0]
        target_item_dict = candidates[0][1]
        
        if best_score < 40:
             return None, None
             
        # Instantiate
        target_item = SearchResultsItem(**target_item_dict)
        
        is_tv = target_item.subjectType == SubjectType.TV_SERIES

        if is_tv:
            dmfd = DownloadableTVSeriesFilesDetail(session, target_item)
            files_container = await dmfd.get_content(season=season, episode=episode)
        else:
            dmfd = DownloadableMovieFilesDetail(session, target_item)
            files_container = await dmfd.get_content()
        
        downloads = []
        if hasattr(files_container, 'downloads'):
            downloads = files_container.downloads
        elif isinstance(files_container, dict) and 'downloads' in files_container:
            downloads = files_container['downloads']
            
        subtitles = []
        if hasattr(files_container, 'captions'):
            subtitles = files_container.captions
        elif isinstance(files_container, dict) and 'captions' in files_container:
            subtitles = files_container['captions']
        elif isinstance(files_container, dict) and 'subtitles' in files_container:
             subtitles = files_container['subtitles']
            
        return downloads, subtitles

    except Exception as e:
        print(f"Error: {e}")
        return None, None

async def get_media_metadata(title: str, year: int = None):
    # Returns { is_tv: bool, seasons: int (optional) }
    # Repurpose the search logic? DRY violations but safest to copy for now or refactor.
    # Refactor: let's extract the search.
    # For now, just copy search logic for speed.
    
    session = Session()
    try:
        search_movie = Search(session=session, query=title, subject_type=SubjectType.MOVIES)
        results_movie = await search_movie.get_content()
        items = results_movie.get('items', [])
        
        search_tv = Search(session=session, query=title, subject_type=SubjectType.TV_SERIES)
        results_tv = await search_tv.get_content()
        items.extend(results_tv.get('items', []))
             
        if not items: return None

        cleaned_query = title.lower().strip()
        
        candidates = []
        for item in items:
            i_title = item.get('title', '').strip()
            i_year = item.get('year') 
            try: i_year = int(i_year) 
            except: i_year = None
            
            score = 0
            clean_i_title = i_title.lower()
            ratio = difflib.SequenceMatcher(None, cleaned_query, clean_i_title).ratio()
            if ratio < 0.4: continue
            score += ratio * 100
            if cleaned_query == clean_i_title: score += 50
            
            import re
            query_digits = set(re.findall(r'\d+', cleaned_query))
            item_digits = set(re.findall(r'\d+', clean_i_title))
            if query_digits and not query_digits.issubset(item_digits):
                 score -= 100
            
            if year and i_year:
                diff = abs(i_year - year)
                if diff == 0: score += 50
                elif diff <= 1: score += 25
                elif diff > 3: score -= 100
            
            candidates.append((score, item))
            
        candidates.sort(key=lambda x: x[0], reverse=True)
        
        if not candidates or candidates[0][0] < 40:
            return None
            
        target = candidates[0][1]
        
        # Check TV details
        is_tv = target.get('subjectType') == SubjectType.TV_SERIES
        seasons_data = []
        
        if is_tv:
             try:
                from moviebox_api.models import SearchResultsItem
                
                # We already have TVSeriesDetails from the top import
                res_item = SearchResultsItem(**target)
                details = TVSeriesDetails(res_item, session)
                content = await details.get_content()
                
                # The data might be inside 'resData' as a string or a dict
                res_data = content.get('resData', {})
                if isinstance(res_data, str):
                    import json, ast
                    try:
                        res_data = ast.literal_eval(res_data)
                    except:
                        try: res_data = json.loads(res_data)
                        except: res_data = {}
                
                resource = res_data.get('resource', {})
                raw_seasons = resource.get('seasons', [])
                
                if not raw_seasons:
                    # Fallback check other fields
                    raw_seasons = res_data.get('seasons', [])

                for s in raw_seasons:
                    # s is like {"maxEp": 8, "se": 1}
                    s_num = s.get('se')
                    max_ep = s.get('maxEp')
                    if s_num is not None:
                        seasons_data.append({
                            'season': int(s_num),
                            'episodes_count': int(max_ep) if max_ep else 1
                        })
                        
                if not seasons_data:
                    # Final fallback: at least one season
                    seasons_data = [{'season': 1, 'episodes_count': 24}]
                else:
                    seasons_data.sort(key=lambda x: x['season'])
             except Exception as e:
                 print(f"Metadata fetch error: {e}")
                 # Fallback if it's TV but we failed to get details
                 seasons_data = [{'season': 1, 'episodes_count': 24}]
        
        return { 
            'is_tv': is_tv, 
            'title': target.get('title'), 
            'year': target.get('year'),
            'seasons': seasons_data # Now returns list of objects with episode counts
        }
        
    except:
        return None

# Get all available qualities
async def get_available_qualities(title: str, year: int = None, season: int = 1, episode: int = 1):
    downloads, _ = await get_movie_files(title, year, season, episode)
    if not downloads:
        return []
    
    qualities = set()
    for d in downloads:
        res_raw = getattr(d, 'resolution', None) or (d.get('resolution') if isinstance(d, dict) else '')
        if res_raw:
             qualities.add(str(res_raw))
             
    def sort_key(q):
        s = str(q).upper()
        if '4K' in s: return 4000
        if '1080' in s: return 1080
        if '720' in s: return 720
        if '480' in s: return 480
        if '360' in s: return 360
        try:
            return int(''.join(filter(str.isdigit, s)))
        except:
            return 0

    sorted_qualities = sorted(list(qualities), key=sort_key, reverse=True)
    return sorted_qualities

async def get_available_subtitles(title: str, year: int = None, season: int = 1, episode: int = 1):
    _, subtitles = await get_movie_files(title, year, season, episode)
    if not subtitles:
        return []
        
    # Language code to English name mapping
    LANG_MAP = {
        'en': 'English', 'ar': 'Arabic', 'zh': 'Chinese', 'fr': 'French',
        'de': 'German', 'es': 'Spanish', 'it': 'Italian', 'ja': 'Japanese',
        'ko': 'Korean', 'pt': 'Portuguese', 'ru': 'Russian', 'ur': 'Urdu',
        'hi': 'Hindi', 'vi': 'Vietnamese', 'tr': 'Turkish', 'th': 'Thai',
        'id': 'Indonesian', 'ms': 'Malay', 'fa': 'Persian', 'he': 'Hebrew',
        'tl': 'Tagalog'
    }
    
    results = []
    for i, s in enumerate(subtitles):
        params = vars(s) if hasattr(s, '__dict__') else (s if isinstance(s, dict) else {})
        
        lan_code = params.get('lan') or params.get('language') or params.get('lang')
        lan_name = params.get('lanName') or params.get('label') or params.get('title')
        
        # Determine display name
        display_lang = LANG_MAP.get(lan_code) if lan_code else None
        if not display_lang:
            display_lang = lan_name
            
        # Fallback to generic index
        if not display_lang or display_lang == "None":
            display_lang = f"Subtitle {i+1}"
            
        url = params.get('url')
        if url:
             results.append({'language': display_lang, 'url': url})
    return results

async def get_stream_url(title: str, quality: str = None, year: int = None, season: int = 1, episode: int = 1) -> str | None:
    downloads, _ = await get_movie_files(title, year, season, episode)
    if not downloads:
        return None

    best_url = None
    best_resolution_score = -1
    
    for d in downloads:
        params = vars(d) if hasattr(d, '__dict__') else (d if isinstance(d, dict) else {})
        url = params.get('url')
        if not url or not url.startswith('http'):
            continue
        
        res_raw = params.get('resolution') or ''
        res_str = str(res_raw).upper()
        
        current_score = 0
        if '4K' in res_str: current_score = 4000
        elif '1080' in res_str: current_score = 1080
        elif '720' in res_str: current_score = 720
        elif '480' in res_str: current_score = 480
        elif '360' in res_str: current_score = 360
        elif 'CAM' in res_str: current_score = 100
        
        if quality:
            if str(res_raw) == quality:
                return url
        
        if current_score > best_resolution_score:
            best_url = url
            best_resolution_score = current_score
            
    return best_url
