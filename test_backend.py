"""
Quick integration test for the refactored api_service.py using moviebox_api v3.
Tests: search + stream URL, metadata, subtitles.
"""
import asyncio
import sys
import os

# Ensure backend dir is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from api_service import (
    get_stream_url,
    get_media_metadata,
    get_available_qualities,
    get_available_subtitles,
    get_available_qualities_with_urls,
)


async def main():
    print("=" * 60)
    print("TEST 1: get_stream_url('Avatar')")
    print("=" * 60)
    url = await get_stream_url("Avatar", year=2009)
    print(f"  Stream URL: {url}")
    assert url and url.startswith("http"), "FAIL: No stream URL returned"
    print("  [OK] PASS\n")

    print("=" * 60)
    print("TEST 2: get_media_metadata('Breaking Bad')")
    print("=" * 60)
    meta = await get_media_metadata("Breaking Bad")
    print(f"  Metadata: {meta}")
    assert meta is not None, "FAIL: No metadata returned"
    assert meta.get("is_tv") is True, "FAIL: Should be TV"
    assert len(meta.get("seasons", [])) > 0, "FAIL: No seasons"
    print("  [OK] PASS\n")

    print("=" * 60)
    print("TEST 3: get_available_qualities('Avatar')")
    print("=" * 60)
    qualities = await get_available_qualities("Avatar", year=2009)
    print(f"  Qualities: {qualities}")
    assert len(qualities) > 0, "FAIL: No qualities"
    print("  [OK] PASS\n")

    print("=" * 60)
    print("TEST 4: get_available_subtitles('Avatar')")
    print("=" * 60)
    subs = await get_available_subtitles("Avatar", year=2009)
    print(f"  Subtitles count: {len(subs)}")
    if subs:
        print(f"  First subtitle language: {subs[0].get('language', 'N/A')}")
    # Subtitles may or may not exist, just check it doesn't crash
    print("  [OK] PASS (no crash)\n")

    print("=" * 60)
    print("TEST 5: get_available_qualities_with_urls('Avatar')")
    print("=" * 60)
    qurls = await get_available_qualities_with_urls("Avatar", year=2009)
    print(f"  Quality+URLs ({len(qurls)}): {qurls[:2]}...")
    assert len(qurls) > 0, "FAIL: No quality URLs"
    print("  [OK] PASS\n")

    print("=" * 60)
    print("TEST 6: TV Show - get_stream_url('Breaking Bad', season=1, episode=1)")
    print("=" * 60)
    tv_url = await get_stream_url("Breaking Bad", season=1, episode=1, is_tv=True)
    print(f"  TV Stream URL: {tv_url}")
    assert tv_url and tv_url.startswith("http"), "FAIL: No TV stream URL"
    print("  [OK] PASS\n")

    print("=" * 60)
    print("ALL TESTS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
