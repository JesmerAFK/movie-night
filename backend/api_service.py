"""
api_service.py – Pure REST API integration for MovieBox.ph using direct H5 endpoints.
Replaces legacy scraping/v1 library with official netfilm/aoneroom H5 API.
"""

import asyncio
import difflib
import re
import json
import httpx

API_BASE = "https://h5-api.aoneroom.com/wefeed-h5api-bff"
_bearer_token: str | None = None

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "Referer": "https://moviebox.ph/",
    "Origin": "https://moviebox.ph",
    "X-Client-Info": '{"timezone":"Asia/Manila"}',
    "X-Request-Lang": "en",
    "Accept": "application/json",
    "Content-Type": "application/json",
}

PLAYER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "X-Client-Info": '{"timezone":"Asia/Manila"}',
    "X-Source": "",
}

async def _get_bearer_token() -> str:
    global _bearer_token
    if _bearer_token:
        return _bearer_token
    async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
        try:
            resp = await client.get(f"{API_BASE}/home?host=moviebox.ph", headers=DEFAULT_HEADERS)
            x_user = resp.headers.get("x-user")
            if x_user:
                _bearer_token = json.loads(x_user).get("token")
            if not _bearer_token:
                cookie = resp.headers.get("set-cookie", "")
                m = re.search(r"token=([^;]+)", cookie)
                if m:
                    _bearer_token = m.group(1)
        except Exception as e:
            print(f"DEBUG: Token acquisition error: {e}")
    return _bearer_token or ""

async def _make_request(url: str, method: str = "GET", payload: dict = None, custom_headers: dict = None) -> dict:
    global _bearer_token
    token = await _get_bearer_token()
    headers = {
        **DEFAULT_HEADERS,
        "Authorization": f"Bearer {token}" if token else "",
        **(custom_headers or {})
    }
    async with httpx.AsyncClient(follow_redirects=True, timeout=25) as client:
        try:
            if method == "POST":
                resp = await client.post(url, headers=headers, json=payload)
            else:
                resp = await client.get(url, headers=headers)

            x_user = resp.headers.get("x-user")
            if x_user:
                new_token = json.loads(x_user).get("token")
                if new_token:
                    _bearer_token = new_token

            if resp.status_code == 200:
                return resp.json()
            return {}
        except Exception as e:
            print(f"DEBUG: Request failed {url}: {e}")
            return {}

async def _search_moviebox(title: str):
    """Search title and return list of results."""
    url = f"{API_BASE}/subject/search"
    data = await _make_request(url, method="POST", payload={"keyword": title, "page": 1, "perPage": 15})
    inner = data.get("data", {})
    raw = inner.get("items", inner.get("list", []))
    items = []
    for item in raw:
        sub = item.get("subject") or item
        items.append({
            "title": sub.get("title") or item.get("title", ""),
            "slug": sub.get("detailPath") or item.get("detailPath", ""),
            "subject_id": sub.get("subjectId") or item.get("subjectId", ""),
            "subject_type": sub.get("subjectType") or item.get("subjectType", 1), # 1: movie, 2: tv
            "release_date": sub.get("releaseDate", "")
        })
    return items

async def _find_best_match(title: str, year: int = None, is_tv: bool = None):
    items = await _search_moviebox(title)
    if not items:
        # Retry with clean title (stripping symbols)
        clean_title = re.sub(r"[^\w\s]", " ", title).strip()
        if clean_title != title:
            items = await _search_moviebox(clean_title)

    if not items and (":" in title or "-" in title):
        main_part = re.split(r"[:\-]", title)[0].strip()
        if main_part and main_part != title:
            items = await _search_moviebox(main_part)

    if not items:
        return None

    cleaned_query = title.lower().strip()
    candidates = []

    for item in items:
        i_title = item.get("title", "").strip()
        i_year_raw = item.get("release_date", "")
        i_year = None
        if i_year_raw:
            try: i_year = int(str(i_year_raw)[:4])
            except: pass

        clean_i_title = re.sub(r"\[.*?\]|\(.*?\)", "", i_title.lower())
        clean_i_title = " ".join(clean_i_title.split()).strip()

        ratio = difflib.SequenceMatcher(None, cleaned_query, clean_i_title).ratio()
        if ratio < 0.6:
            continue
        
        score = ratio * 100
        if cleaned_query == clean_i_title:
            score += 50

        if is_tv is not None:
            # 2 = TV series in MovieBox
            is_item_tv = item.get("subject_type") == 2
            if is_item_tv == is_tv:
                score += 30
            else:
                score -= 30

        if year and i_year:
            diff = abs(i_year - year)
            if diff == 0: score += 40
            elif diff <= 1: score += 15
            elif diff > 5: score -= 50

        candidates.append((score, item))

    candidates.sort(key=lambda x: x[0], reverse=True)
    if candidates and candidates[0][0] >= 50:
        return candidates[0][1]
    return items[0] if items else None

async def get_movie_files(
    title: str,
    year: int = None,
    season: int = 1,
    episode: int = 1,
    is_tv: bool = None,
):
    try:
        match = await _find_best_match(title, year=year, is_tv=is_tv)
        if not match:
            print(f"DEBUG: No match found for '{title}'")
            return None, None

        subject_id = str(match["subject_id"])
        detail_path = match["slug"]
        is_tv_item = (match.get("subject_type") == 2) if is_tv is None else is_tv

        se_num = season if is_tv_item else 0
        ep_num = episode if is_tv_item else 0

        download_url = f"{API_BASE}/subject/download?subjectId={subject_id}&se={se_num}&ep={ep_num}&detailPath={detail_path}"
        referer_path = f"tv-series/{detail_path}" if is_tv_item else f"movies/{detail_path}"
        player_referer = f"https://moviebox.ph/{referer_path}"

        res_data = await _make_request(download_url, custom_headers={"Referer": player_referer})
        inner_data = res_data.get("data", {})

        raw_streams = inner_data.get("downloads", [])
        raw_caps = inner_data.get("captions", [])

        downloads = []
        for s in raw_streams:
            url = s.get("url")
            res = s.get("resolution")
            if url and url.startswith("http"):
                downloads.append({
                    "url": str(url),
                    "resolution": f"{res}P" if res else "Unknown",
                    "resource_id": str(s.get("id", "")),
                    "size": int(s.get("size", 0)) if s.get("size") else 0,
                    "codec": s.get("codecName", "")
                })

        subtitles = []
        for c in raw_caps:
            c_url = c.get("url")
            if c_url:
                subtitles.append({
                    "lan": c.get("lan", ""),
                    "lanName": c.get("lanName", c.get("lan", "Subtitle")),
                    "url": str(c_url)
                })

        # Fallback to subject/play if downloads is empty
        if not downloads:
            dom_data = await _make_request(f"{API_BASE}/media-player/get-domain")
            domain = dom_data.get("data", "https://netfilm.world").rstrip("/")
            play_url = f"{domain}/wefeed-h5api-bff/subject/play?subjectId={subject_id}&se={se_num}&ep={ep_num}&detailPath={detail_path}"
            play_referer = f"{domain}/spa/videoPlayPage/{referer_path}?id={subject_id}&detailSe={se_num}&detailEp={ep_num}&lang=en"

            async with httpx.AsyncClient(follow_redirects=True, timeout=25) as client:
                resp = await client.get(play_url, headers={**PLAYER_HEADERS, "Referer": play_referer})
                if resp.status_code == 200:
                    play_data = resp.json().get("data", {})
                    fallback_streams = play_data.get("streams", [])
                    for s in fallback_streams:
                        url = s.get("url")
                        res = s.get("resolutions")
                        if url and url.startswith("http"):
                            downloads.append({
                                "url": str(url),
                                "resolution": f"{res}P" if res else "Unknown",
                                "resource_id": str(s.get("id", "")),
                                "size": int(s.get("size", 0)) if s.get("size") else 0,
                                "codec": s.get("codecName", "")
                            })

        # Prioritize non-HEVC and higher resolution
        def sort_key(item):
            url = item.get("url", "").lower()
            hevc = "h265" in url or "hevc" in url or "/h265/" in url
            res_val = 0
            res_str = item.get("resolution", "")
            try:
                res_val = int(re.sub(r"\D", "", res_str))
            except:
                pass
            return (1 if hevc else 0, -res_val)

        downloads.sort(key=sort_key)
        print(f"DEBUG: Pure H5 API SUCCESS – {len(downloads)} stream links, {len(subtitles)} captions")
        return downloads, subtitles

    except Exception as e:
        print(f"DEBUG: get_movie_files error: {e}")
        return None, None

async def get_media_metadata(title: str, year: int = None):
    try:
        match = await _find_best_match(title, year=year)
        if not match:
            return None

        subject_id = str(match["subject_id"])
        detail_path = match["slug"]
        detail_url = f"{API_BASE}/detail?detailPath={detail_path}"
        detail_data = await _make_request(detail_url)

        res_data = detail_data.get("data", {})
        is_tv = match.get("subject_type") == 2 or res_data.get("subjectType") == 2

        seasons_data = []
        if is_tv:
            # Parse seasons array from resData
            resource = res_data.get("resource", {})
            raw_seasons = resource.get("seasons", []) or res_data.get("seasons", [])
            for s in raw_seasons:
                s_num = s.get("se")
                max_ep = s.get("maxEp") or s.get("episodeCount")
                if s_num is not None:
                    seasons_data.append({
                        "season": int(s_num),
                        "episodes_count": int(max_ep) if max_ep else 24
                    })
            if not seasons_data:
                seasons_data = [{"season": 1, "episodes_count": 24}]
            else:
                seasons_data.sort(key=lambda x: x["season"])

        return {
            "is_tv": is_tv,
            "title": match.get("title", title),
            "year": year,
            "seasons": seasons_data,
        }
    except Exception as e:
        print(f"DEBUG: get_media_metadata error: {e}")
        return None

async def get_available_qualities(title: str, year: int = None, season: int = 1, episode: int = 1, is_tv: bool = None):
    downloads, _ = await get_movie_files(title, year, season, episode, is_tv=is_tv)
    if not downloads: return []
    qualities = set()
    for d in downloads:
        res = d.get("resolution", "")
        if res: qualities.add(str(res))
    
    def sort_key(q):
        try: return int(re.sub(r"\D", "", str(q)))
        except: return 0
    return sorted(list(qualities), key=sort_key, reverse=True)

async def get_available_qualities_with_urls(title: str, year: int = None, season: int = 1, episode: int = 1, is_tv: bool = None):
    downloads, _ = await get_movie_files(title, year, season, episode, is_tv=is_tv)
    if not downloads: return []
    return [{"quality": d.get("resolution", "Unknown"), "url": d.get("url", "")} for d in downloads if d.get("url")]

async def get_available_subtitles(title: str, year: int = None, season: int = 1, episode: int = 1, is_tv: bool = None):
    _, subtitles = await get_movie_files(title, year, season, episode, is_tv=is_tv)
    if not subtitles: return []
    LANG_MAP = {
        "en": "English", "ar": "Arabic", "zh": "Chinese", "fr": "French",
        "de": "German", "es": "Spanish", "it": "Italian", "ja": "Japanese",
        "ko": "Korean", "pt": "Portuguese", "ru": "Russian", "ur": "Urdu",
        "hi": "Hindi", "vi": "Vietnamese", "tr": "Turkish", "th": "Thai",
        "id": "Indonesian", "ms": "Malay", "fa": "Persian", "he": "Hebrew",
        "tl": "Tagalog",
    }
    results = []
    for i, s in enumerate(subtitles):
        lan_code = s.get("lan", "")
        lan_name = s.get("lanName", "")
        display_lang = LANG_MAP.get(lan_code) or lan_name or f"Subtitle {i + 1}"
        url = s.get("url", "")
        if url:
            results.append({"language": display_lang, "url": url})
    return results

async def get_stream_url(title: str, quality: str = None, year: int = None, season: int = 1, episode: int = 1, is_tv: bool = None) -> str | None:
    downloads, _ = await get_movie_files(title, year, season, episode, is_tv=is_tv)
    if not downloads:
        return None
    for d in downloads:
        if quality and d.get("resolution") == quality:
            return d.get("url")
    return downloads[0].get("url") if downloads else None