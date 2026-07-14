import json
import app

q = 'tamil songs'
s = app.JioSaavnAPI.search_songs(q, limit=3)
print('search count', len(s))
print(json.dumps(s[:1], indent=2)[:6000])
print('---')
if s:
    sid = s[0].get('id') or s[0].get('perma_url')
    print('sid', sid)
    d = app.JioSaavnAPI.get_song_details(sid) if sid else None
    print('detail type', type(d).__name__)
    print(json.dumps(d, indent=2)[:12000])
