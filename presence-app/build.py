#!/usr/bin/env python3
"""Build Green Room into a single HTML file (artifact body) plus a standalone test page."""
import json, pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
dx = [[x['id'], x['module'], x['title'], x['scope']] for x in json.loads((root.parent / 'data' / 'curriculum.json').read_text())]
content = (src / 'content.js').read_text().replace('/*DX_CURRICULUM*/[]', json.dumps(dx, ensure_ascii=False))
js = '\n'.join([content] + [(src / f).read_text() for f in ['plan.js', 'analysis.js', 'store.js', 'ai.js', 'game.js', 'ui-core.js', 'ui-views.js', 'flows-rep.js', 'games-ui.js', 'flows-more.js']])
page = (src / 'head.html').read_text() + '<style>\n' + (src / 'styles.css').read_text() + '</style>\n' + (src / 'body.html').read_text() + '<script>\n' + js + '\n</script>\n'
out = root / 'dist'; out.mkdir(exist_ok=True)
(out / 'green-room.html').write_text(page)
# Standalone page for local testing: same skeleton the artifact host adds
skel = ('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>')
(out / 'standalone.html').write_text(skel + page + '</body></html>')
print('built', len(page), 'bytes')
