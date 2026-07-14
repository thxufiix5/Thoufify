#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Thoufify - Premium Music Streaming App
JioSaavn API Integration - Tamil/Hindi/Malayalam/English
"""

import os
import json
import requests
import base64
import threading
import time
from flask import Flask, render_template, jsonify, send_from_directory, request, Response
from flask_cors import CORS
from Crypto.Cipher import DES

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

MUSIC_DIR = os.path.join(app.static_folder, 'music')
IMAGES_DIR = os.path.join(app.static_folder, 'images')
os.makedirs(MUSIC_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)

# ========== JIOSAAVN API ==========
class JioSaavnAPI:
    BASE_URL = "https://www.jiosaavn.com/api.php"
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://www.jiosaavn.com/",
        "Cookie": "B=1; CT=1"
    }

    @staticmethod
    def search_songs(query, limit=20):
        try:
            url = f"{JioSaavnAPI.BASE_URL}?__call=search.getResults&p=1&q={requests.utils.quote(query)}&_format=json&_marker=0&api_version=4&ctx=web6dot0&n={limit}"
            resp = requests.get(url, headers=JioSaavnAPI.HEADERS, timeout=20)
            data = resp.json()
            if isinstance(data, dict):
                return data.get('results', [])
            elif isinstance(data, list) and len(data) > 0:
                return data[0].get('results', [])
            return []
        except Exception as e:
            print(f"Search error: {e}")
            return []

    @staticmethod
    def get_song_details(song_id):
        try:
            url = f"{JioSaavnAPI.BASE_URL}?__call=song.getDetails&pids={song_id}&_format=json&_marker=0&api_version=4&ctx=web6dot0"
            resp = requests.get(url, headers=JioSaavnAPI.HEADERS, timeout=20)
            data = resp.json()
            if isinstance(data, dict):
                songs = data.get('songs', [])
                return songs[0] if songs else None
            if isinstance(data, list) and data:
                return data[0]
            return None
        except Exception as e:
            print(f"Details error: {e}")
            return None

    @staticmethod
    def decrypt_media_url(encrypted_url):
        try:
            if not encrypted_url or not encrypted_url.startswith("ID2ieOjCrw"):
                return None
            encrypted_url = encrypted_url[10:]
            padding = 4 - (len(encrypted_url) % 4)
            if padding != 4:
                encrypted_url += "=" * padding
            decoded = base64.b64decode(encrypted_url)
            key = b"38346591"
            cipher = DES.new(key, DES.MODE_ECB)
            decrypted = cipher.decrypt(decoded)
            pad_len = decrypted[-1]
            if isinstance(pad_len, int) and pad_len <= 8:
                decrypted = decrypted[:-pad_len]
            url = decrypted.decode('utf-8', errors='ignore').strip()
            return url if url.startswith('http') else None
        except:
            return None

def _clean_text(value):
    if value is None:
        return ''
    if isinstance(value, (list, dict)):
        return ''
    return str(value).replace('&quot;', '"').replace('&#039;', "'").strip()


def _extract_song_fields(song, lang):
    more_info = song.get('more_info') or {}
    title = _clean_text(song.get('title') or more_info.get('title') or '')
    if not title:
        title = 'Unknown'

    artist = _clean_text(
        more_info.get('music')
        or more_info.get('singers')
        or song.get('artist')
        or song.get('subtitle')
        or ''
    )
    if not artist:
        subtitle = _clean_text(song.get('subtitle') or '')
        if subtitle:
            artist = subtitle.split('-')[0].strip() or 'Unknown'
        else:
            artist = 'Unknown'

    album = _clean_text(more_info.get('album') or song.get('album') or 'Unknown')
    image = _clean_text(song.get('image') or more_info.get('image') or '')
    if image:
        image = image.replace('150x150', '500x500').replace('50x50', '500x500')

    audio_url = _clean_text(
        more_info.get('encrypted_media_url')
        or song.get('encrypted_media_url')
        or more_info.get('media_url')
        or song.get('media_url')
        or more_info.get('vlink')
        or song.get('url')
        or ''
    )

    if audio_url and audio_url.startswith('http'):
        pass
    else:
        audio_url = _clean_text(more_info.get('vlink') or '')

    return {
        'title': title,
        'artist': artist,
        'album': album,
        'cover': image or 'https://c.saavncdn.com/web/jioSaavn-Logo.png',
        'audio_url': audio_url,
        'language': lang,
    }


# Cache
_songs_cache = {}
_cache_time = 0
CACHE_DURATION = 3600


def get_cached_songs():
    global _cache_time
    if time.time() - _cache_time > CACHE_DURATION or not _songs_cache:
        refresh_songs()
    return _songs_cache

def refresh_songs():
    global _songs_cache, _cache_time
    api = JioSaavnAPI()

    all_songs = []
    categories = {
        'tamil': ['tamil songs', 'latest tamil songs', 'tamil hits', 'tamil trending 2026', 'tamil 2026'],
        'hindi': ['hindi songs', 'latest hindi songs', 'hindi hits', 'hindi trending 2026', 'hindi 2026'],
        'malayalam': ['malayalam songs', 'latest malayalam songs', 'malayalam hits', 'malayalam trending 2026', 'malayalam 2026'],
        'english': ['english songs', 'latest english songs', 'english hits', 'english trending 2026', 'english 2026']
    }
    per_lang_target = 25
    total_target = 100
    counts_by_lang = {lang: 0 for lang in categories}

    for lang, queries in categories.items():
        try:
            seen_ids = set()
            for query in queries:
                if len(all_songs) >= total_target:
                    break
                results = api.search_songs(query, limit=12)
                if not results:
                    continue
                for song in results:
                    if len(all_songs) >= total_target:
                        break
                    if counts_by_lang[lang] >= per_lang_target:
                        break

                    song_id = song.get('id') or song.get('perma_url') or f"{lang}_{len(all_songs)}"
                    if song_id in seen_ids:
                        continue
                    seen_ids.add(song_id)

                    more_info = song.get('more_info') or {}
                    fields = _extract_song_fields(song, lang)
                    audio_url = None

                    detail_song = api.get_song_details(song_id) or {}
                    detail_info = detail_song.get('more_info') or {}
                    detail_fields = _extract_song_fields(detail_song or song, lang)
                    if detail_fields['audio_url']:
                        audio_url = detail_fields['audio_url']

                    if not audio_url and fields['audio_url']:
                        audio_url = fields['audio_url']

                    if audio_url and audio_url.startswith('http'):
                        try:
                            audio_url = api.decrypt_media_url(audio_url)
                        except Exception:
                            audio_url = None

                    if not audio_url:
                        audio_url = _clean_text((detail_info.get('media_url') or detail_info.get('vlink') or more_info.get('vlink') or ''))

                    if not audio_url:
                        continue

                    duration = 120
                    all_songs.append({
                        'id': song_id,
                        'title': fields['title'],
                        'artist': fields['artist'],
                        'album': fields['album'],
                        'duration': duration,
                        'cover': fields['cover'],
                        'audio_url': audio_url,
                        'language': lang,
                        'file': f"/api/stream/{song_id}"
                    })
                    counts_by_lang[lang] += 1
        except Exception as e:
            print(f"Error fetching {lang}: {e}")

    _songs_cache = {s['id']: s for s in all_songs}
    _cache_time = time.time()
    print(f"Loaded {len(_songs_cache)} songs from JioSaavn")

# Initial load
refresh_songs()

# Background refresh
threading.Thread(target=lambda: [time.sleep(CACHE_DURATION) or refresh_songs() for _ in iter(int, 1)], daemon=True).start()

def get_all_songs():
    return list(get_cached_songs().values())

def get_playlists():
    songs = get_all_songs()
    tamil = [s for s in songs if s['language'] == 'tamil']
    hindi = [s for s in songs if s['language'] == 'hindi']
    malayalam = [s for s in songs if s['language'] == 'malayalam']
    english = [s for s in songs if s['language'] == 'english']

    return {
        'tamil': {'title': 'Tamil Hits 2026', 'desc': f'Trending Tamil 2026 songs - {len(tamil)} songs', 'cover': tamil[0]['cover'] if tamil else '', 'songs': [s['id'] for s in tamil]},
        'hindi': {'title': 'Hindi Hits 2026', 'desc': f'Trending Hindi 2026 songs - {len(hindi)} songs', 'cover': hindi[0]['cover'] if hindi else '', 'songs': [s['id'] for s in hindi]},
        'malayalam': {'title': 'Malayalam Hits 2026', 'desc': f'Trending Malayalam 2026 songs - {len(malayalam)} songs', 'cover': malayalam[0]['cover'] if malayalam else '', 'songs': [s['id'] for s in malayalam]},
        'english': {'title': 'English Hits 2026', 'desc': f'Trending English 2026 songs - {len(english)} songs', 'cover': english[0]['cover'] if english else '', 'songs': [s['id'] for s in english]},
        'liked': {'title': 'Liked Songs', 'desc': 'Your favorite tracks', 'cover': 'https://images.unsplash.com/photo-1493225255756-d9584f8606e5?w=400&h=400&fit=crop', 'songs': []}
    }

# ========== ROUTES ==========
@app.route('/')
def intro():
    return render_template('intro.html')

@app.route('/app')
def main_app():
    return render_template('app.html')

@app.route('/api/songs')
def get_songs():
    return jsonify(get_all_songs())

@app.route('/api/songs/<song_id>')
def get_song(song_id):
    songs = get_cached_songs()
    song = songs.get(song_id)
    if not song:
        return jsonify({"error": "Song not found"}), 404
    return jsonify(song)

@app.route('/api/playlists')
def get_playlists_api():
    return jsonify(get_playlists())

@app.route('/api/search')
def search_songs():
    query = request.args.get('q', '').lower()
    songs = get_all_songs()
    results = [s for s in songs if query in s['title'].lower() 
               or query in s['artist'].lower() 
               or query in s['album'].lower()
               or query in s['language'].lower()]
    return jsonify(results)

@app.route('/api/stream/<song_id>')
def stream_song(song_id):
    songs = get_cached_songs()
    song = songs.get(song_id)
    if not song:
        return jsonify({"error": "Song not found"}), 404

    audio_url = song.get('audio_url', '')
    if not audio_url:
        return jsonify({"error": "Audio unavailable"}), 404

    # Proxy the audio stream
    try:
        resp = requests.get(audio_url, stream=True, timeout=30, headers={
            "User-Agent": JioSaavnAPI.HEADERS["User-Agent"],
            "Referer": "https://www.jiosaavn.com/"
        })
        if resp.status_code in (200, 302, 301):
            if resp.url and resp.url != audio_url:
                audio_url = resp.url
            return Response(
                resp.iter_content(chunk_size=8192),
                content_type=resp.headers.get('Content-Type', 'audio/mpeg'),
                headers={
                    'Accept-Ranges': 'bytes',
                    'Content-Length': resp.headers.get('Content-Length', ''),
                    'X-Stream-Url': audio_url
                }
            )
    except Exception as e:
        print(f"Stream error: {e}")

    return jsonify({"url": audio_url}), 302

@app.route('/api/cover/<song_id>')
def get_cover(song_id):
    songs = get_cached_songs()
    song = songs.get(song_id)
    if song and song.get('cover'):
        return jsonify({"url": song['cover']})
    return jsonify({"url": "https://via.placeholder.com/400/e50914/ffffff?text=Thoufify"})

if __name__ == '__main__':
    print("Thoufify starting with JioSaavn API...")
    print("Open http://localhost:5005 in your browser")
    app.run(host='0.0.0.0', port=5005, debug=True)
