import uvicorn
import asyncio
from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.responses import RedirectResponse, StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import requests
import os
import sys

# Ensure backend directory is in the python path for absolute imports on deployment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api_service import (
    get_stream_url, 
    get_media_metadata, 
    get_available_qualities, 
    get_available_subtitles,
    get_available_qualities_with_urls
)
import httpx
import re

app = FastAPI()

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    if request.method == "OPTIONS":
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            }
        )
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# Serve static frontend files (for bundled app)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, '..', 'dist')

if os.path.exists(DIST_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, 'assets')), name="static_assets")

# Serve local assets (like intro video) from the root assets directory
ROOT_DIR = os.path.dirname(BASE_DIR)
local_assets_dir = os.path.join(ROOT_DIR, 'assets')
if os.path.exists(local_assets_dir):
    app.mount("/local_assets", StaticFiles(directory=local_assets_dir), name="local_assets")

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "movie-night-backend"}

@app.get("/api/metadata")
async def get_meta(title: str, year: int = None):
    if not title: return {}
    try:
        return await get_media_metadata(title, year=year)
    except:
        return {}

@app.get("/api/qualities")
async def get_qualities(title: str, year: int = None, season: int = 1, episode: int = 1, is_tv: bool = None):
    if not title:
        return []
    try:
        from api_service import get_available_qualities
        qualities = await get_available_qualities(title, year=year, season=season, episode=episode, is_tv=is_tv)
        return qualities
    except:
        return []

@app.get("/api/subtitles")
async def get_subtitles(title: str, year: int = None, season: int = 1, episode: int = 1, is_tv: bool = None):
    if not title:
        return []
    try:
        subs = await get_available_subtitles(title, year=year, season=season, episode=episode, is_tv=is_tv)
        return subs
    except Exception as e:
        print(f"Subtitle error: {e}")
        return []

@app.get("/api/downloads")
async def get_downloads_links(title: str, year: int = None, season: int = 1, episode: int = 1, is_tv: bool = None):
    if not title:
        return []
    try:
        links = await get_available_qualities_with_urls(title, year=year, season=season, episode=episode, is_tv=is_tv)
        return links
    except Exception as e:
        print(f"Download links error: {e}")
        return []

@app.get("/api/subtitles/proxy")
async def proxy_subtitle(url: str):
    if not url: raise HTTPException(status_code=400)
    try:
        headers = {
            'Referer': 'https://fmoviesunblocked.net/', 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code >= 400:
                print(f"Sub Proxy Fetch Error: {resp.status_code} for {url}")
                raise HTTPException(status_code=resp.status_code)
            
            content = resp.content
            
            # 1. Handle Byte Order Mark (BOM) and decode
            try:
                text = content.decode('utf-8-sig')
            except UnicodeDecodeError:
                try:
                    text = content.decode('latin-1')
                except:
                    text = content.decode('utf-8', errors='ignore')

            text = text.strip()
            
            # Handle \N or \n as line breaks (common in some sources)
            text = text.replace("\\N", "\n").replace("\\n", "\n")
            
            # 2. Check if it's already VTT or needs conversion
            is_vtt = text.startswith("WEBVTT")
            
            # Standardize timestamps: 00:00:00,000 -> 00:00:00.000
            text = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", text)
            
            # Inject positioning (line:80%) to push subs up away from black bars
            # This works for both newly converted and existing VTT
            text = re.sub(r"(\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3})", r"\1 line:80%", text)
            
            if not is_vtt:
                vtt_text = "WEBVTT\n\n" + text
                return Response(
                    content=vtt_text, 
                    media_type="text/vtt",
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "no-cache",
                        "X-Content-Type-Options": "nosniff"
                    }
                )
            
            # Already VTT, but we updated the timestamps with 'line:80%'
            return Response(
                content=text if text.startswith("WEBVTT") else f"WEBVTT\n\n{text}", 
                media_type="text/vtt",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-cache",
                    "X-Content-Type-Options": "nosniff"
                }
            )
    except Exception as e:
        print(f"Sub proxy total failure: {e}")
        raise HTTPException(status_code=500)

@app.get("/api/download/proxy")
async def download_proxy(url: str, title: str = "video"):
    if not url: raise HTTPException(status_code=400)
    
    headers = {
        'Referer': 'https://fmoviesunblocked.net/', 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0), follow_redirects=True)
    
    async def stream_file():
        try:
            async with client.stream("GET", url, headers=headers) as r:
                async for chunk in r.aiter_bytes(chunk_size=1024*1024): # 1MB chunks
                    yield chunk
        finally:
            await client.aclose()

    # Try to get file size for progress
    try:
        r = requests.head(url, headers=headers, allow_redirects=True, timeout=5)
        content_length = r.headers.get('Content-Length')
    except:
        content_length = None

    filename = f"{title.replace(' ', '_')}.mp4"
    resp_headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Access-Control-Allow-Origin": "*"
    }
    if content_length:
        resp_headers["Content-Length"] = content_length

    return StreamingResponse(stream_file(), headers=resp_headers, media_type="application/octet-stream")

import time

_stream_url_cache = {}  # key: (title, quality, year, season, episode, is_tv) -> (url, timestamp)
CACHE_TTL = 180  # 3 minutes (prevents CDN link signature expiration)

# Global shared client pool for stream proxying (reuses connections instead of creating new ones per request)
_shared_stream_client: httpx.AsyncClient | None = None

def _get_shared_stream_client() -> httpx.AsyncClient:
    global _shared_stream_client
    if _shared_stream_client is None or _shared_stream_client.is_closed:
        _shared_stream_client = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=15.0),
            follow_redirects=True,
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=20)
        )
    return _shared_stream_client

# Semaphore to limit concurrent upstream stream connections and prevent 429
_stream_semaphore = asyncio.Semaphore(5)

# Track active stream requests to prevent duplicate concurrent fetches for the same URL
_active_stream_requests: dict[str, float] = {}  # url -> timestamp
_STREAM_DEDUP_WINDOW = 2.0  # seconds

async def _resolve_stream_url(title, quality, year, season, episode, is_tv):
    """Resolve stream URL with caching to avoid redundant upstream API calls."""
    cache_key = (title, quality, year, season, episode, is_tv)
    now = time.time()
    if cache_key in _stream_url_cache:
        url, ts = _stream_url_cache[cache_key]
        if now - ts < CACHE_TTL:
            print(f"DEBUG: Stream URL cache hit for '{title}' (quality={quality})")
            return url
        else:
            del _stream_url_cache[cache_key]

    from api_service import get_stream_url
    stream_url = await get_stream_url(title, quality=quality, year=year, season=season, episode=episode, is_tv=is_tv)
    if stream_url:
        _stream_url_cache[cache_key] = (stream_url, now)
    return stream_url


@app.get("/api/stream/check")
async def check_stream_type(
    title: str,
    quality: str = None,
    year: int = None,
    season: int = 1,
    episode: int = 1,
    is_tv: bool = None,
    hevc: int = 0,
):
    """Lightweight endpoint to check if a stream will be transcoded, without opening the full stream."""
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    try:
        stream_url = await _resolve_stream_url(title, quality, year, season, episode, is_tv)
        if not stream_url:
            return {"transcoded": False, "accept_ranges": "bytes"}

        import shutil
        url_lower = stream_url.lower()
        is_hevc_stream = ("h265" in url_lower or "hevc" in url_lower or "/h265/" in url_lower) and not hevc
        ffmpeg_path = shutil.which("ffmpeg")
        will_transcode = is_hevc_stream and ffmpeg_path is not None

        return {
            "transcoded": will_transcode,
            "accept_ranges": "none" if will_transcode else "bytes",
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Stream check error: {e}")
        return {"transcoded": False, "accept_ranges": "bytes"}


@app.get("/api/stream")
async def stream_movie(
    title: str,
    request: Request,
    quality: str = None,
    year: int = None,
    season: int = 1,
    episode: int = 1,
    proxy: bool = True,
    is_tv: bool = None,
    hevc: int = 0,
    start_time: float = 0.0
):
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")

    try:
        stream_url = await _resolve_stream_url(title, quality, year, season, episode, is_tv)
        if not stream_url:
             raise HTTPException(status_code=404, detail="Stream not found")

        # Dynamic HEVC to H.264 Transcoding detection
        import shutil
        import sys
        
        url_lower = stream_url.lower()
        is_hevc = ("h265" in url_lower or "hevc" in url_lower or "/h265/" in url_lower) and not hevc
        ffmpeg_path = shutil.which("ffmpeg")

        if is_hevc and ffmpeg_path:
            print(f"DEBUG: HEVC detected. Spawning ffmpeg transcoding proxy for: {stream_url[:100]} starting at {start_time}s...")
            headers_str = (
                "Referer: https://netfilm.world/\r\n"
                "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36\r\n"
            )
            
            cmd = [ffmpeg_path]
            if start_time > 0.0:
                cmd.extend(["-ss", str(start_time)])
                
            cmd.extend([
                "-reconnect", "1",
                "-reconnect_streamed", "1",
                "-reconnect_delay_max", "5",
                "-headers", headers_str,
                "-i", stream_url,
                "-vf", "scale=-2:min(720\\,ih)",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-tune", "zerolatency",
                "-threads", "0",
                "-c:a", "copy",
                "-sn",
                "-f", "mp4",
                "-movflags", "frag_keyframe+empty_moov",
                "pipe:1"
            ])
            
            import subprocess
            creationflags = 0
            if sys.platform == "win32":
                creationflags = 0x08000000  # CREATE_NO_WINDOW
                
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
                creationflags=creationflags
            )
            
            async def stream_generator_transcoded():
                try:
                    yield {
                        "status": 200,
                        "headers": {
                            "Content-Type": "video/mp4",
                            "Accept-Ranges": "none",
                            "Access-Control-Allow-Origin": "*",
                            "Cache-Control": "no-cache",
                            "X-Content-Type-Options": "nosniff",
                            "X-Transcoded": "true"
                        }
                    }
                    while True:
                        chunk = await process.stdout.read(262144) # 256KB chunks for faster transcoding startup
                        if not chunk:
                            break
                        yield chunk
                except Exception as e:
                    print(f"DEBUG: Transcoding stream exception: {e}")
                finally:
                    try:
                        process.terminate()
                        await process.wait()
                    except:
                        pass
            
            gen = stream_generator_transcoded()
            try:
                config = await anext(gen)
                return StreamingResponse(
                    gen,
                    status_code=config["status"],
                    headers=config["headers"],
                    media_type="video/mp4"
                )
            except Exception as tr_err:
                print(f"DEBUG: Transcoding failed ({tr_err}), falling back to direct CDN redirect...")

        # Default streaming logic: Return 307 Redirect directly to CDN stream URL.
        # This enables client browsers to stream directly from MovieBox CDN with zero datacenter IP blocks and fast buffering.
        print(f"DEBUG: Redirecting client directly to CDN stream URL: {stream_url[:80]}...")
        return RedirectResponse(url=stream_url, status_code=307)

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Stream processing failure: {e}")
        if "403" in str(e):
             raise HTTPException(status_code=403, detail="Access Forbidden by source IP block.")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """Serve the built frontend. For any non-API path, return index.html (SPA routing)."""
    if not os.path.exists(DIST_DIR):
        return Response("<h1>Movie Night</h1><p>Frontend not found.</p>", status_code=404)
    
    file_path = os.path.join(DIST_DIR, full_path)
    if full_path and os.path.isfile(file_path):
        return FileResponse(file_path)
    
    index = os.path.join(DIST_DIR, 'index.html')
    if os.path.exists(index):
        return FileResponse(index)
    
    return Response("<h1>Movie Night</h1><p>Frontend not found.</p>", status_code=404)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)