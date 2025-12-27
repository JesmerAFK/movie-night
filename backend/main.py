import uvicorn
from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from api_service import get_stream_url
import requests
import os

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
        from api_service import get_media_metadata
        return await get_media_metadata(title, year=year)
    except:
        return {}

@app.get("/api/qualities")
async def get_qualities(title: str, year: int = None, season: int = 1, episode: int = 1):
    if not title:
        return []
    try:
        from api_service import get_available_qualities
        qualities = await get_available_qualities(title, year=year, season=season, episode=episode)
        return qualities
    except:
        return []

@app.get("/api/subtitles")
async def get_subtitles(title: str, year: int = None, season: int = 1, episode: int = 1):
    if not title:
        return []
    try:
        from api_service import get_available_subtitles
        subs = await get_available_subtitles(title, year=year, season=season, episode=episode)
        return subs
    except Exception as e:
        print(f"Subtitle error: {e}")
        return []

@app.get("/api/subtitles/proxy")
async def proxy_subtitle(url: str):
    if not url: raise HTTPException(status_code=400)
    try:
        import httpx
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
            
            import re
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
async def stream_movie(title: str, request: Request, quality: str = None, year: int = None, season: int = 1, episode: int = 1):
    """
    Proxies the video stream.
    """
    # print(f"Requesting stream for: {title} (Year: {year}, Quality: {quality}, S{season}E{episode})")
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")

    try:
        from api_service import get_stream_url
        stream_url = await get_stream_url(title, quality=quality, year=year, season=season, episode=episode)
        if not stream_url:
             print("Stream not found")
             raise HTTPException(status_code=404, detail="Stream not found")

        # print(f"Target URL: {stream_url}")
        
        # We know we need a Referer header for some hosts.
        # Ideally we check which host it is, but broadly adding it shouldn't hurt?
        # The dump showed referer: 'https://fmoviesunblocked.net/' for 'fzmovies.cms' source.
        # But 'hakunaymatata.com' might be different?
        # Actually my test showed that adding that referer WORKED for hakunaymatata.
        
        headers = {
            'Referer': 'https://fmoviesunblocked.net/', 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        # PROXYING THE CONTENT
        # Streaming response is required to pipe the video data.
        
        try:
             # We use a generator to stream chunks
             def iterfile():
                 with requests.get(stream_url, headers=headers, stream=True) as r:
                     if r.status_code >= 400:
                         print(f"Proxy Error: {r.status_code} {r.text[:100]}")
                         # If proxy fails, maybe try redirect as fallback?
                         # yield b""
                         return
                         
                     for chunk in r.iter_content(chunk_size=8192):
                         yield chunk
             
             # Get initial headers to pass through (content-type, content-length)
             # Note: Passsing Content-Length is important for seeking, but can be tricky with chunks.
             # FastAPI StreamingResponse handles Transfer-Encoding: chunked automatically if no length.
             # But Players like 'range' requests (206 Partial Content). 
             
             # Implementing full Range support in a simple proxy is complex.
             # If we don't support Range, seeking won't work well.
             
             # Alternative: Direct Redirect but try to trick the Referer? 
             # Browser Referer cannot be spoofed easily for <video src>.
             
             # If we simply Return RedirectResponse, the browser requests the URL directly.
             # The browser will send 'http://localhost:3000' as Referer. 
             # The server checks for 'fmoviesunblocked.net'. -> 403 Forbidden.
             
             # PROXY is the only way unless we can generate a URL that doesn't check Referer.
             
             # Let's try basic StreamingResponse first.
             # To support seeking, we'd need to handle the 'Range' header from the incoming 'request'
             # and pass it to the upstream requests.get.
             
             range_header = request.headers.get('Range')
             proxy_headers = headers.copy()
             if range_header:
                 proxy_headers['Range'] = range_header
                 
             # Make the request
             # We must use stream=True
             external_req = requests.get(stream_url, headers=proxy_headers, stream=True)
             
             # Forward status code (200 or 206)
             status_code = external_req.status_code
             
             # Forward essential headers
             excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
             response_headers = {
                 k: v for k, v in external_req.headers.items() 
                 if k.lower() not in excluded_headers
             }
             # Explicitly set Content-Length if present
             if 'Content-Length' in external_req.headers:
                 response_headers['Content-Length'] = external_req.headers['Content-Length']
             
             # Create generator
             def iter_content():
                 try:
                     for chunk in external_req.iter_content(chunk_size=1024*64):
                         if chunk:
                             yield chunk
                 except Exception as e:
                     print(f"Streaming error: {e}")
                 finally:
                     external_req.close()

             return StreamingResponse(
                 iter_content(),
                 status_code=status_code,
                 headers=response_headers,
                 media_type=external_req.headers.get('Content-Type', 'video/mp4')
             )

        except Exception as e:
            print(f"Proxy setup failed: {e}")
            raise HTTPException(status_code=500, detail="Proxy failed")

    except Exception as e:
        print(f"Error processing {title}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
