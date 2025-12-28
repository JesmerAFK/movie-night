import uvicorn
from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
import sys

# Ensure backend directory is in the python path for absolute imports on deployment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api_service import (
    get_stream_url, 
    get_media_metadata, 
    get_available_qualities, 
    get_available_subtitles
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

@app.get("/api/stream")
async def stream_movie(title: str, request: Request, quality: str = None, year: int = None, season: int = 1, episode: int = 1, proxy: bool = True, is_tv: bool = None):
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")

    try:
        from api_service import get_stream_url
        stream_url = await get_stream_url(title, quality=quality, year=year, season=season, episode=episode, is_tv=is_tv)
        if not stream_url:
             raise HTTPException(status_code=404, detail="Stream not found")

        # Proxy logic
        headers = {
            'Referer': 'https://fmoviesunblocked.net/', 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Connection': 'keep-alive',
        }
        
        range_header = request.headers.get('Range')
        proxy_headers = headers.copy()
        if range_header:
            proxy_headers['Range'] = range_header
                  
        client = httpx.AsyncClient(timeout=60.0, follow_redirects=True, limits=httpx.Limits(max_connections=100))
        
        async def stream_generator():
            try:
                # Use a smaller pool and streaming to avoid memory overhead
                async with client.stream("GET", stream_url, headers=proxy_headers, timeout=60.0) as r:
                    # Capture vital headers before starting iteration
                    h = r.headers
                    status = r.status_code
                    msg = {
                        "status": status,
                        "headers": {
                            "Content-Type": h.get("Content-Type", "video/mp4"),
                            "Accept-Ranges": "bytes",
                            "Access-Control-Allow-Origin": "*",
                        }
                    }
                    if "Content-Length" in h: msg["headers"]["Content-Length"] = h["Content-Length"]
                    if "Content-Range" in h: msg["headers"]["Content-Range"] = h["Content-Range"]
                    
                    yield msg
                    
                    # Yield chunks as they arrive
                    async for chunk in r.aiter_bytes(chunk_size=16384): # 16KB chunks for smoother flow
                        yield chunk
            except Exception as e:
                print(f"Streaming error: {e}")
            finally:
                await client.aclose()

        gen = stream_generator()
        try:
            # First yield must be the status and headers dict
            config = await anext(gen)
            return StreamingResponse(
                gen, 
                status_code=config["status"], 
                headers=config["headers"], 
                media_type=config["headers"]["Content-Type"]
            )
        except StopAsyncIteration:
             raise HTTPException(status_code=403, detail="Source blocked or unavailable.")

    except Exception as e:
        print(f"Stream processing failure: {e}")
        if "403" in str(e):
             raise HTTPException(status_code=403, detail="Access Forbidden by source IP block.")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
