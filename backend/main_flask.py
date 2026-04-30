from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import requests
import os
import sys
import re
import asyncio
import traceback
import httpx
import urllib.parse

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api_service import (
    get_stream_url, 
    get_media_metadata, 
    get_available_qualities, 
    get_available_subtitles,
    get_available_qualities_with_urls
)

app = Flask(__name__)
CORS(app)

@app.route("/api/metadata")
def get_meta():
    title = request.args.get('title')
    year = request.args.get('year', type=int)
    if not title: return jsonify({})
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(get_media_metadata(title, year=year))
        return jsonify(result or {})
    except Exception as e:
        print(f"Metadata error: {e}")
        return jsonify({})

@app.route("/api/qualities")
def get_qualities():
    title = request.args.get('title')
    year = request.args.get('year', type=int)
    season = request.args.get('season', 1, type=int)
    episode = request.args.get('episode', 1, type=int)
    is_tv = request.args.get('is_tv', type=lambda v: v.lower() == 'true')
    
    if not title: return jsonify([])
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(get_available_qualities(title, year=year, season=season, episode=episode, is_tv=is_tv))
        return jsonify(result or [])
    except:
        return jsonify([])

@app.route("/api/subtitles")
def get_subtitles():
    title = request.args.get('title')
    year = request.args.get('year', type=int)
    season = request.args.get('season', 1, type=int)
    episode = request.args.get('episode', 1, type=int)
    is_tv = request.args.get('is_tv', type=lambda v: v.lower() == 'true')
    
    if not title: return jsonify([])
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(get_available_subtitles(title, year=year, season=season, episode=episode, is_tv=is_tv))
        return jsonify(result or [])
    except:
        return jsonify([])

@app.route("/api/subtitles/proxy")
def proxy_subtitle():
    # Robust URL recovery
    url = request.args.get('url')
    full_query = request.query_string.decode('utf-8')
    if 'url=' in full_query:
        # Take everything after url=
        url = full_query.split('url=', 1)[1]
        url = urllib.parse.unquote(url)
    
    if not url: return "URL required", 400
    
    try:
        print(f"DEBUG: Proxying sub URL: {url[:100]}...")
        headers = {
            'Referer': 'https://fmoviesunblocked.net/', 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*'
        }
        
        # Follow main.py exactly with httpx
        with httpx.Client(timeout=30.0, follow_redirects=True, verify=False) as client:
            resp = client.get(url, headers=headers)
            if resp.status_code >= 400:
                print(f"DEBUG: Sub Proxy Remote Error: {resp.status_code} for {url[:50]}")
                return f"Remote Error: {resp.status_code}", 502
            
            content = resp.content
            
            # Decoding logic from main.py
            try:
                text = content.decode('utf-8-sig')
            except UnicodeDecodeError:
                try:
                    text = content.decode('latin-1')
                except:
                    text = content.decode('utf-8', errors='ignore')

            text = text.strip()
            text = text.replace("\\N", "\n").replace("\\n", "\n")
            is_vtt = text.startswith("WEBVTT")
            
            # SRT to VTT Timestamp Conversion
            text = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", text)
            
            # Inject positioning (line:80%)
            text = re.sub(r"(\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3})", r"\1 line:80%", text)
            
            if not is_vtt:
                text = "WEBVTT\n\n" + text

            return Response(
                text, 
                mimetype="text/vtt",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-cache",
                    "X-Content-Type-Options": "nosniff"
                }
            )
    except Exception as e:
        print(f"DEBUG: Sub Proxy EXCEPTION: {e}")
        traceback.print_exc()
        return str(e), 500

@app.route("/api/downloads")
def get_downloads_links():
    title = request.args.get('title')
    year = request.args.get('year', type=int)
    season = request.args.get('season', 1, type=int)
    episode = request.args.get('episode', 1, type=int)
    is_tv = request.args.get('is_tv', type=lambda v: v.lower() == 'true')
    
    if not title: return jsonify([])
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        links = loop.run_until_complete(get_available_qualities_with_urls(title, year=year, season=season, episode=episode, is_tv=is_tv))
        return jsonify(links or [])
    except:
        return jsonify([])

@app.route("/api/download/proxy")
def download_proxy():
    url = request.args.get('url')
    title = request.args.get('title', 'video')
    if not url: return "URL required", 400
    
    headers = {
        'Referer': 'https://fmoviesunblocked.net/', 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        r = requests.get(url, headers=headers, stream=True, timeout=10)
        filename = f"{title.replace(' ', '_')}.mp4"
        
        def generate():
            for chunk in r.iter_content(chunk_size=1024*1024):
                yield chunk

        resp_headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Allow-Origin": "*"
        }
        if "Content-Length" in r.headers: resp_headers["Content-Length"] = r.headers["Content-Length"]
        
        return Response(stream_with_context(generate()), headers=resp_headers, media_type="application/octet-stream")
    except Exception as e:
        return str(e), 500

@app.route("/api/tv/metadata")
def get_tv_meta():
    title = request.args.get('title')
    year = request.args.get('year', type=int)
    if not title: return jsonify({})
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(get_media_metadata(title, year=year))
        return jsonify(result or {})
    except Exception as e:
        print(f"TV Metadata error: {e}")
        return jsonify({})

@app.route("/api/stream")
def stream_movie():
    title = request.args.get('title')
    quality = request.args.get('quality')
    year = request.args.get('year', type=int)
    season = request.args.get('season', 1, type=int)
    episode = request.args.get('episode', 1, type=int)
    is_tv = request.args.get('is_tv', type=lambda v: v.lower() == 'true')

    if not title: return "Title required", 400

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        stream_url = loop.run_until_complete(get_stream_url(title, quality=quality, year=year, season=season, episode=episode, is_tv=is_tv))
        
        if not stream_url: return "Not found", 404

        headers = {
            'Referer': 'https://fmoviesunblocked.net/', 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
        
        range_header = request.headers.get('Range')
        if range_header: headers['Range'] = range_header

        r = requests.get(stream_url, headers=headers, stream=True, timeout=10)
        
        def generate():
            for chunk in r.iter_content(chunk_size=65536):
                yield chunk

        response_headers = {
            "Content-Type": r.headers.get("Content-Type", "video/mp4"),
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*"
        }
        if "Content-Length" in r.headers: response_headers["Content-Length"] = r.headers["Content-Length"]
        if "Content-Range" in r.headers: response_headers["Content-Range"] = r.headers["Content-Range"]

        return Response(stream_with_context(generate()), status=r.status_code, headers=response_headers)

    except Exception as e:
        print(f"Stream error: {e}")
        return str(e), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
