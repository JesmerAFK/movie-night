import moviebox_api
from moviebox_api import Session, Search, SubjectType, DownloadableTVSeriesFilesDetail, TVSeriesDetails, MIRROR_HOSTS
from moviebox_api.download import DownloadableMovieFilesDetail
from moviebox_api.models import SearchResultsItem
import asyncio
import difflib
import random
import re

# Helper to fetch and parse files with smart matching
async def get_movie_files(title: str, year: int = None, season: int = 1, episode: int = 1):
    # Try different mirrors if one is blocked
    mirrors = list(MIRROR_HOSTS)
    # Remove the one we know is blocked on Render if it's there
    if 'h5.aoneroom.com' in mirrors:
        mirrors.remove('h5.aoneroom.com')
    
    random.shuffle(mirrors)
    # Put some known good ones first if they exist
    prime_mirrors = ['moviebox.ph', 'netnaija.video', 'mbbox.video']
    mirrors = [m for m in prime_mirrors if m in mirrors] + [m for m in mirrors if m not in prime_mirrors]

    for mirror in mirrors[:4]:
        try:
            # Force the library to use this mirror
            moviebox_api.SELECTED_HOST = mirror
            moviebox_api.HOST_URL = f"https://{mirror}"
            
            print(f"DEBUG: Attempting MIRROR: {mirror} for '{title}'...")
            
            session = Session()
            items = []
            search_queries = [title]
            
            clean_title = "".join(c for c in title if c.isalnum() or c.isspace())
            if clean_title != title:
                search_queries.append(clean_title)

            for query in search_queries:
                try:
                    search_movie = Search(session=session, query=query, subject_type=SubjectType.MOVIES)
                    res = await asyncio.wait_for(search_movie.get_content(), timeout=10.0)
                    found = res.get('items', [])
                    if found:
                        items.extend(found)
                        break
                except: pass
                
                try:
                    search_tv = Search(session=session, query=query, subject_type=SubjectType.TV_SERIES)
                    res = await asyncio.wait_for(search_tv.get_content(), timeout=10.0)
                    found = res.get('items', [])
                    if found:
                        items.extend(found)
                        break
                except: pass

            if not items:
                print(f"DEBUG: No results on mirror {mirror}, trying next...")
                continue

            # Smart Matching
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
                continue

            target_item_dict = candidates[0][1]
            target_item = SearchResultsItem(**target_item_dict)
            is_tv = target_item.subjectType == SubjectType.TV_SERIES

            if is_tv:
                dmfd = DownloadableTVSeriesFilesDetail(session, target_item)
                files_container = await asyncio.wait_for(dmfd.get_content(season=season, episode=episode), timeout=15.0)
            else:
                dmfd = DownloadableMovieFilesDetail(session, target_item)
                files_container = await asyncio.wait_for(dmfd.get_content(), timeout=15.0)
            
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
                
            if downloads:
                print(f"DEBUG: SUCCESS on mirror {mirror}!")
                return downloads, subtitles
            else:
                print(f"DEBUG: Mirror {mirror} returned no links.")

        except Exception as e:
            print(f"DEBUG: Mirror {mirror} error: {e}")
            continue

    return None, None

async def get_media_metadata(title: str, year: int = None):
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
        is_tv = target.get('subjectType') == SubjectType.TV_SERIES
        seasons_data = []
        
        if is_tv:
             try:
                res_item = SearchResultsItem(**target)
                details = TVSeriesDetails(res_item, session)
                content = await details.get_content()
                
                res_data = content.get('resData', {})
                if isinstance(res_data, str):
                    import json, ast
                    try: res_data = ast.literal_eval(res_data)
                    except:
                        try: res_data = json.loads(res_data)
                        except: res_data = {}
                
                resource = res_data.get('resource', {})
                raw_seasons = resource.get('seasons', [])
                if not raw_seasons:
                    raw_seasons = res_data.get('seasons', [])

                for s in raw_seasons:
                    s_num = s.get('se')
                    max_ep = s.get('maxEp')
                    if s_num is not None:
                        seasons_data.append({
                            'season': int(s_num),
                            'episodes_count': int(max_ep) if max_ep else 1
                        })
                if not seasons_data:
                    seasons_data = [{'season': 1, 'episodes_count': 24}]
                else:
                    seasons_data.sort(key=lambda x: x['season'])
             except Exception as e:
                 print(f"Metadata fetch error: {e}")
                 seasons_data = [{'season': 1, 'episodes_count': 24}]
        
        return { 
            'is_tv': is_tv, 
            'title': target.get('title'), 
            'year': target.get('year'),
            'seasons': seasons_data
        }
    except:
        return None

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
        try: return int(''.join(filter(str.isdigit, s)))
        except: return 0

    return sorted(list(qualities), key=sort_key, reverse=True)

async def get_available_qualities_with_urls(title: str, year: int = None, season: int = 1, episode: int = 1):
    downloads, _ = await get_movie_files(title, year, season, episode)
    if not downloads:
        return []
    
    results = []
    for d in downloads:
        params = vars(d) if hasattr(d, '__dict__') else (d if isinstance(d, dict) else {})
        url = params.get('url')
        res_raw = params.get('resolution') or 'Unknown'
        if url and url.startswith('http'):
            results.append({
                'quality': str(res_raw),
                'url': url
            })
    return results

async def get_available_subtitles(title: str, year: int = None, season: int = 1, episode: int = 1):
    _, subtitles = await get_movie_files(title, year, season, episode)
    if not subtitles: return []
        
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
        display_lang = LANG_MAP.get(lan_code) if lan_code else None
        if not display_lang: display_lang = lan_name
        if not display_lang or display_lang == "None": display_lang = f"Subtitle {i+1}"
        url = params.get('url')
        if url: results.append({'language': display_lang, 'url': url})
    return results

async def get_stream_url(title: str, quality: str = None, year: int = None, season: int = 1, episode: int = 1) -> str | None:
    downloads, _ = await get_movie_files(title, year, season, episode)
    if not downloads: return None
    best_url = None
    best_resolution_score = -1
    for d in downloads:
        params = vars(d) if hasattr(d, '__dict__') else (d if isinstance(d, dict) else {})
        url = params.get('url')
        if not url or not url.startswith('http'): continue
        res_raw = params.get('resolution') or ''
        res_str = str(res_raw).upper()
        current_score = 0
        if '4K' in res_str: current_score = 4000
        elif '1080' in res_str: current_score = 1080
        elif '720' in res_str: current_score = 720
        elif '480' in res_str: current_score = 480
        elif '360' in res_str: current_score = 360
        elif 'CAM' in res_str: current_score = 100
        if quality and str(res_raw) == quality: return url
        if current_score > best_resolution_score:
            best_url = url
            best_resolution_score = current_score
    return best_url
