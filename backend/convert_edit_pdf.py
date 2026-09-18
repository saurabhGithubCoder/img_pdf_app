"""
In-place PDF editing engine powered by PyMuPDF.

FIXES:
  • Only uses original subset font for chars that ACTUALLY existed in the
    original text — avoids blank .notdef glyphs and x-advance gaps.
  • Uses border_width=0.01 with render_mode=2 so text isn't rendered bold.
  • "Safe" fallback font ensures every new char is always visible.
"""
import sys
import os
import json
import math
import re
import time
import base64
import urllib.request
import urllib.parse
import fitz  # PyMuPDF


def log(msg):
    sys.stderr.write(f"[edit] {msg}\n")


# ===========================================================================
# FONT CATEGORY → CLOSEST FREE CLONE
# ===========================================================================
CATEGORY_FALLBACK = {
    'grotesque-sans':     {'clone': 'Arimo',            'fallback': 'Arial, Helvetica, sans-serif'},
    'neo-grotesque-sans': {'clone': 'Inter',            'fallback': 'Arial, Helvetica, sans-serif'},
    'geometric-sans':     {'clone': 'Jost',             'fallback': 'Arial, Helvetica, sans-serif'},
    'humanist-sans':      {'clone': 'Open Sans',        'fallback': 'Arial, Helvetica, sans-serif'},
    'transitional-serif': {'clone': 'Tinos',            'fallback': '"Times New Roman", serif'},
    'old-style-serif':    {'clone': 'EB Garamond',      'fallback': 'Georgia, serif'},
    'modern-serif':       {'clone': 'Playfair Display', 'fallback': 'Georgia, serif'},
    'slab-serif':         {'clone': 'Bitter',           'fallback': 'Georgia, serif'},
    'monospace':          {'clone': 'JetBrains Mono',   'fallback': 'Consolas, monospace'},
    'script':             {'clone': 'Pacifico',         'fallback': 'cursive'},
    'display':            {'clone': 'Oswald',           'fallback': 'Impact, sans-serif'},
    'symbol':             {'clone': None,               'fallback': 'Symbol, serif'},
}

FONT_PATTERNS = [
    (r'^futurapt', 'Futura PT', 'geometric-sans'),
    (r'^futura', 'Futura', 'geometric-sans'),
    (r'^effra', 'Effra', 'geometric-sans'),
    (r'^circular', 'Circular', 'geometric-sans'),
    (r'^gotham', 'Gotham', 'geometric-sans'),
    (r'^proximanova', 'Proxima Nova', 'geometric-sans'),
    (r'^centurygothic', 'Century Gothic', 'geometric-sans'),
    (r'^avenirnext', 'Avenir Next', 'geometric-sans'),
    (r'^avenir', 'Avenir', 'geometric-sans'),
    (r'^poppins', 'Poppins', 'geometric-sans'),
    (r'^jost', 'Jost', 'geometric-sans'),
    (r'^montserrat', 'Montserrat', 'geometric-sans'),
    (r'^brandon', 'Brandon Grotesque', 'geometric-sans'),
    (r'^museosans', 'Museo Sans', 'geometric-sans'),
    (r'^questrial', 'Questrial', 'geometric-sans'),
    (r'^dmsans', 'DM Sans', 'geometric-sans'),
    (r'^sofiapro', 'Sofia Pro', 'geometric-sans'),
    (r'^avantgarde', 'ITC Avant Garde', 'geometric-sans'),
    (r'^inter($|variable)', 'Inter', 'neo-grotesque-sans'),
    (r'^helveticanow', 'Helvetica Now', 'neo-grotesque-sans'),
    (r'^aktivgrotesk', 'Aktiv Grotesk', 'neo-grotesque-sans'),
    (r'^roboto($|sans|flex|condensed)', 'Roboto', 'neo-grotesque-sans'),
    (r'^sfpro|^sanfrancisco|^sfcompact', 'San Francisco', 'neo-grotesque-sans'),
    (r'^helveticaneue', 'Helvetica Neue', 'grotesque-sans'),
    (r'^helvetica', 'Helvetica', 'grotesque-sans'),
    (r'^arialrounded', 'Arial Rounded', 'geometric-sans'),
    (r'^arialnarrow', 'Arial Narrow', 'grotesque-sans'),
    (r'^arialblack', 'Arial Black', 'grotesque-sans'),
    (r'^arial', 'Arial', 'grotesque-sans'),
    (r'^liberationsans', 'Arial', 'grotesque-sans'),
    (r'^arimo', 'Arimo', 'grotesque-sans'),
    (r'^nimbussans', 'Nimbus Sans', 'grotesque-sans'),
    (r'^univers', 'Univers', 'grotesque-sans'),
    (r'^akzidenz', 'Akzidenz-Grotesk', 'grotesque-sans'),
    (r'^franklingothic', 'Franklin Gothic', 'grotesque-sans'),
    (r'^newsgothic', 'News Gothic', 'grotesque-sans'),
    (r'^tradegothic', 'Trade Gothic', 'grotesque-sans'),
    (r'^opensans', 'Open Sans', 'humanist-sans'),
    (r'^lato', 'Lato', 'humanist-sans'),
    (r'^segoeuivariable', 'Segoe UI', 'humanist-sans'),
    (r'^segoeui', 'Segoe UI', 'humanist-sans'),
    (r'^carlito', 'Calibri', 'humanist-sans'),
    (r'^calibri', 'Calibri', 'humanist-sans'),
    (r'^myriadpro', 'Myriad Pro', 'humanist-sans'),
    (r'^myriad', 'Myriad', 'humanist-sans'),
    (r'^frutiger', 'Frutiger', 'humanist-sans'),
    (r'^sourcesans', 'Source Sans Pro', 'humanist-sans'),
    (r'^notosans', 'Noto Sans', 'humanist-sans'),
    (r'^ptsans', 'PT Sans', 'humanist-sans'),
    (r'^nunitosans', 'Nunito Sans', 'humanist-sans'),
    (r'^nunito', 'Nunito', 'humanist-sans'),
    (r'^firasans', 'Fira Sans', 'humanist-sans'),
    (r'^ubuntucondensed', 'Ubuntu Condensed', 'humanist-sans'),
    (r'^ubuntu', 'Ubuntu', 'humanist-sans'),
    (r'^worksans', 'Work Sans', 'humanist-sans'),
    (r'^tahoma', 'Tahoma', 'humanist-sans'),
    (r'^verdana', 'Verdana', 'humanist-sans'),
    (r'^trebuchet', 'Trebuchet MS', 'humanist-sans'),
    (r'^optima', 'Optima', 'humanist-sans'),
    (r'^aptos', 'Aptos', 'humanist-sans'),
    (r'^karla', 'Karla', 'humanist-sans'),
    (r'^mulish', 'Mulish', 'humanist-sans'),
    (r'^manrope', 'Manrope', 'humanist-sans'),
    (r'^raleway', 'Raleway', 'humanist-sans'),
    (r'^candara', 'Candara', 'humanist-sans'),
    (r'^corbel', 'Corbel', 'humanist-sans'),
    (r'^rubik', 'Rubik', 'humanist-sans'),
    (r'^gillsans', 'Gill Sans', 'humanist-sans'),
    (r'^goudysans', 'Goudy Sans', 'humanist-sans'),
    (r'^timesnewroman|^times$', 'Times New Roman', 'transitional-serif'),
    (r'^tinos', 'Tinos', 'transitional-serif'),
    (r'^liberationserif', 'Times New Roman', 'transitional-serif'),
    (r'^georgia', 'Georgia', 'transitional-serif'),
    (r'^gelasio', 'Gelasio', 'transitional-serif'),
    (r'^librebaskerville|^baskervville', 'Libre Baskerville', 'transitional-serif'),
    (r'^baskerville', 'Baskerville', 'transitional-serif'),
    (r'^merriweather', 'Merriweather', 'transitional-serif'),
    (r'^ptserif', 'PT Serif', 'transitional-serif'),
    (r'^sourceserif', 'Source Serif Pro', 'transitional-serif'),
    (r'^charter', 'Charter', 'transitional-serif'),
    (r'^sitka', 'Sitka', 'transitional-serif'),
    (r'^notoserif', 'Noto Serif', 'transitional-serif'),
    (r'^constantia', 'Constantia', 'transitional-serif'),
    (r'^crimson', 'Crimson Text', 'transitional-serif'),
    (r'^caladea', 'Cambria', 'transitional-serif'),
    (r'^cambria', 'Cambria', 'transitional-serif'),
    (r'^adobegaramond', 'Adobe Garamond', 'old-style-serif'),
    (r'^ebgaramond', 'EB Garamond', 'old-style-serif'),
    (r'^garamond', 'Garamond', 'old-style-serif'),
    (r'^cormorant', 'Cormorant Garamond', 'old-style-serif'),
    (r'^librecaslon', 'Libre Caslon', 'old-style-serif'),
    (r'^caslon', 'Caslon', 'old-style-serif'),
    (r'^minionpro', 'Minion Pro', 'old-style-serif'),
    (r'^minion', 'Minion', 'old-style-serif'),
    (r'^palatino|^bookantiqua|^urwpalladio', 'Palatino', 'old-style-serif'),
    (r'^sabon', 'Sabon', 'old-style-serif'),
    (r'^jenson', 'Jenson', 'old-style-serif'),
    (r'^goudy', 'Goudy Old Style', 'old-style-serif'),
    (r'^librebodoni', 'Libre Bodoni', 'modern-serif'),
    (r'^didot', 'Didot', 'modern-serif'),
    (r'^bodoni', 'Bodoni', 'modern-serif'),
    (r'^playfairdisplay', 'Playfair Display', 'modern-serif'),
    (r'^playfair', 'Playfair', 'modern-serif'),
    (r'^walbaum', 'Walbaum', 'modern-serif'),
    (r'^abrilfatface', 'Abril Fatface', 'modern-serif'),
    (r'^rockwell', 'Rockwell', 'slab-serif'),
    (r'^bitter', 'Bitter', 'slab-serif'),
    (r'^robotoslab', 'Roboto Slab', 'slab-serif'),
    (r'^arvo', 'Arvo', 'slab-serif'),
    (r'^josefinslab', 'Josefin Slab', 'slab-serif'),
    (r'^americantypewriter', 'American Typewriter', 'slab-serif'),
    (r'^courierprime', 'Courier Prime', 'monospace'),
    (r'^couriernew|^courier$', 'Courier New', 'monospace'),
    (r'^cousine', 'Cousine', 'monospace'),
    (r'^liberationmono', 'Courier New', 'monospace'),
    (r'^consolas', 'Consolas', 'monospace'),
    (r'^menlo', 'Menlo', 'monospace'),
    (r'^monaco', 'Monaco', 'monospace'),
    (r'^andalemono', 'Andale Mono', 'monospace'),
    (r'^inconsolata', 'Inconsolata', 'monospace'),
    (r'^jetbrainsmono', 'JetBrains Mono', 'monospace'),
    (r'^firacode', 'Fira Code', 'monospace'),
    (r'^firamono', 'Fira Mono', 'monospace'),
    (r'^sourcecodepro', 'Source Code Pro', 'monospace'),
    (r'^ibmplexmono', 'IBM Plex Mono', 'monospace'),
    (r'^robotomono', 'Roboto Mono', 'monospace'),
    (r'^cascadia', 'Cascadia Code', 'monospace'),
    (r'^dejavusansmono|^dejavumono', 'DejaVu Sans Mono', 'monospace'),
    (r'^sfmono', 'SF Mono', 'monospace'),
    (r'^ubuntumono', 'Ubuntu Mono', 'monospace'),
    (r'^spacemono', 'Space Mono', 'monospace'),
    (r'^ptmono', 'PT Mono', 'monospace'),
    (r'^notomono', 'Noto Mono', 'monospace'),
    (r'^freemono', 'FreeMono', 'monospace'),
    (r'^pacifico', 'Pacifico', 'script'),
    (r'^lobster', 'Lobster', 'script'),
    (r'^dancingscript', 'Dancing Script', 'script'),
    (r'^greatvibes', 'Great Vibes', 'script'),
    (r'^caveat', 'Caveat', 'script'),
    (r'^satisfy', 'Satisfy', 'script'),
    (r'^brushscript', 'Brush Script', 'script'),
    (r'^scriptmt', 'Script MT', 'script'),
    (r'^snellroundhand', 'Snell Roundhand', 'script'),
    (r'^allura', 'Allura', 'script'),
    (r'^alexbrush', 'Alex Brush', 'script'),
    (r'^kaushanscript', 'Kaushan Script', 'script'),
    (r'^indieflower', 'Indie Flower', 'script'),
    (r'^shadowsintolight', 'Shadows Into Light', 'script'),
    (r'^oswald', 'Oswald', 'display'),
    (r'^bebasneue|^bebas', 'Bebas Neue', 'display'),
    (r'^impact', 'Impact', 'display'),
    (r'^anton', 'Anton', 'display'),
    (r'^archivoblack|^archivo', 'Archivo Black', 'display'),
    (r'^chivo', 'Chivo', 'display'),
    (r'^barlowcondensed', 'Barlow Condensed', 'display'),
    (r'^barlowsemicondensed', 'Barlow Semi Condensed', 'display'),
    (r'^barlow', 'Barlow', 'display'),
    (r'^copperplate', 'Copperplate', 'display'),
    (r'^trajan', 'Trajan Pro', 'display'),
    (r'^cinzel', 'Cinzel', 'display'),
    (r'^marcellus', 'Marcellus', 'display'),
    (r'^symbol$', 'Symbol', 'symbol'),
    (r'^wingdings', 'Wingdings', 'symbol'),
    (r'^webdings', 'Webdings', 'symbol'),
    (r'^zapfdingbats|^dingbats', 'Zapf Dingbats', 'symbol'),
    (r'^segoeuisymbol|^segoeuiemoji', 'Segoe UI Symbol', 'symbol'),
    (r'^mangal|^nirmalaui|^aparajita|^kokila|^utsaah', 'Noto Sans Devanagari', 'humanist-sans'),
]

COMPILED = [(re.compile(p, re.IGNORECASE), name, cat) for p, name, cat in FONT_PATTERNS]


def strip_style_suffixes(name):
    s = name or ''
    for suf in (
        '-BoldItalic', '-BoldOblique', '-Bold', '-Italic', '-Oblique',
        ' Bold Italic', ' Bold', ' Italic', ' Oblique',
        'BoldItalic', 'Bold', 'Italic', 'Oblique',
        '-Regular', ' Regular', '-Roman', ' Roman',
    ):
        if s.endswith(suf):
            s = s[: -len(suf)]
            break
    s = re.sub(r'(MT|PS|MS|Std|Pro)$', '', s, flags=re.IGNORECASE).strip()
    return s


def detect_font_info(raw_name):
    cleaned = re.sub(r'^[A-Z]{6}\+', '', raw_name or '')
    family = strip_style_suffixes(cleaned) or 'Helvetica'
    normalized = re.sub(r'[\s\-_]', '', family.lower())
    for re_obj, canonical, category in COMPILED:
        if re_obj.match(normalized):
            return canonical, category
    lower = normalized
    guessed = 'humanist-sans'
    if 'serif' in lower and 'sans' not in lower:
        if any(k in lower for k in ('modern', 'didone', 'bodoni', 'didot')):
            guessed = 'modern-serif'
        elif any(k in lower for k in ('slab', 'rockwell')):
            guessed = 'slab-serif'
        elif any(k in lower for k in ('garamond', 'caslon', 'jenson', 'goudy', 'minion', 'old')):
            guessed = 'old-style-serif'
        else:
            guessed = 'transitional-serif'
    elif 'mono' in lower or 'code' in lower:
        guessed = 'monospace'
    elif any(k in lower for k in ('script', 'hand', 'cursive', 'brush', 'callig')):
        guessed = 'script'
    elif any(k in lower for k in ('display', 'black', 'condensed', 'heavy')):
        guessed = 'display'
    elif any(k in lower for k in ('geo', 'futura', 'circle', 'round', 'aero')):
        guessed = 'geometric-sans'
    elif any(k in lower for k in ('grotesk', 'grotesque', 'swiss', 'helv')):
        guessed = 'grotesque-sans'
    return family, guessed


# ===========================================================================
# GOOGLE FONT + SYSTEM FONT
# ===========================================================================
GOOGLE_FONT_FAMILIES = {
    'Arimo', 'Tinos', 'Cousine', 'Gelasio', 'Jost',
    'Inter', 'Open Sans', 'EB Garamond', 'Playfair Display',
    'Bitter', 'JetBrains Mono', 'Pacifico', 'Oswald',
    'Roboto', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Raleway',
    'Work Sans', 'Ubuntu', 'Rubik', 'Karla', 'Mulish', 'Manrope',
    'DM Sans', 'Merriweather', 'Lora', 'PT Serif', 'Crimson Text',
    'Libre Baskerville', 'Cormorant Garamond', 'Noto Serif',
    'Fira Code', 'Source Code Pro', 'IBM Plex Mono', 'Roboto Mono',
    'Bebas Neue', 'Lobster', 'Dancing Script', 'Great Vibes', 'Caveat', 'Satisfy',
}

_FONT_CACHE_DIR = os.path.join('/tmp', 'pdf-forge-google-fonts')
os.makedirs(_FONT_CACHE_DIR, exist_ok=True)
_google_font_disk = {}

TTF_MAGIC = (b'\x00\x01\x00\x00', b'OTTO', b'true', b'typ1')


def _download_google_font(family, weight=400, italic=False):
    key = (family, weight, italic)
    if key in _google_font_disk:
        return _google_font_disk[key]
    safe = family.replace(' ', '_').replace('/', '_')
    filename = f"{safe}-{weight}{'-italic' if italic else ''}.ttf"
    local_path = os.path.join(_FONT_CACHE_DIR, filename)

    if os.path.exists(local_path) and os.path.getsize(local_path) > 5000:
        try:
            with open(local_path, 'rb') as fh:
                magic = fh.read(4)
            if magic in TTF_MAGIC:
                _google_font_disk[key] = local_path
                return local_path
            else:
                log(f"Cached '{family}' wrong magic {magic.hex()} — re-downloading")
                os.remove(local_path)
        except Exception:
            pass

    try:
        ital = '1' if italic else '0'
        family_q = urllib.parse.quote(family)
        css_url = (
            f"https://fonts.googleapis.com/css2"
            f"?family={family_q}:ital,wght@{ital},{weight}&display=swap"
        )
        req = urllib.request.Request(css_url, headers={'User-Agent': 'Mozilla/4.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            css = resp.read().decode('utf-8', errors='ignore')

        m = re.search(r'src:\s*url\((https://[^)]+\.ttf)\)', css)
        if not m:
            m = re.search(r'src:\s*url\((https://[^)]+\.otf)\)', css)
        if not m:
            m = re.search(r'src:\s*url\((https://[^)]+)\)', css)
        if not m:
            log(f"Could not parse Google Fonts CSS for {family}")
            _google_font_disk[key] = None
            return None

        font_url = m.group(1)
        req2 = urllib.request.Request(font_url, headers={'User-Agent': 'Mozilla/4.0'})
        with urllib.request.urlopen(req2, timeout=30) as resp2:
            data = resp2.read()

        if len(data) < 1000:
            log(f"Downloaded '{family}' too small ({len(data)} bytes)")
            _google_font_disk[key] = None
            return None

        magic = data[:4]
        if magic not in TTF_MAGIC:
            log(f"Downloaded '{family}' not TTF (magic={magic.hex()})")
            _google_font_disk[key] = None
            return None

        with open(local_path, 'wb') as f:
            f.write(data)
        log(f"Downloaded '{family}' ({weight}{' italic' if italic else ''}) → {local_path} ({len(data)} bytes)")
        _google_font_disk[key] = local_path
        return local_path
    except Exception as e:
        log(f"Download failed for {family} {weight}: {e}")
        _google_font_disk[key] = None
        return None


SYSTEM_FONT_FILES = {
    'Arial':           {'regular': '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
                        'bold': '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
                        'italic': '/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf',
                        'bolditalic': '/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf'},
    'Helvetica':       {'regular': '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
                        'bold': '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
                        'italic': '/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf',
                        'bolditalic': '/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf'},
    'Times New Roman': {'regular': '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
                        'bold': '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
                        'italic': '/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf',
                        'bolditalic': '/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf'},
    'Times':           {'regular': '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
                        'bold': '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
                        'italic': '/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf',
                        'bolditalic': '/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf'},
    'Courier New':     {'regular': '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
                        'bold': '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf',
                        'italic': '/usr/share/fonts/truetype/liberation/LiberationMono-Italic.ttf',
                        'bolditalic': '/usr/share/fonts/truetype/liberation/LiberationMono-BoldItalic.ttf'},
    'Courier':         {'regular': '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
                        'bold': '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf',
                        'italic': '/usr/share/fonts/truetype/liberation/LiberationMono-Italic.ttf',
                        'bolditalic': '/usr/share/fonts/truetype/liberation/LiberationMono-BoldItalic.ttf'},
    'Georgia':         {'regular': '/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf',
                        'bold': '/usr/share/fonts/truetype/crosextra/Caladea-Bold.ttf',
                        'italic': '/usr/share/fonts/truetype/crosextra/Caladea-Italic.ttf',
                        'bolditalic': '/usr/share/fonts/truetype/crosextra/Caladea-BoldItalic.ttf'},
    'Cambria':         {'regular': '/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf',
                        'bold': '/usr/share/fonts/truetype/crosextra/Caladea-Bold.ttf',
                        'italic': '/usr/share/fonts/truetype/crosextra/Caladea-Italic.ttf',
                        'bolditalic': '/usr/share/fonts/truetype/crosextra/Caladea-BoldItalic.ttf'},
    'Verdana':         {'regular': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                        'bold': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                        'italic': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
                        'bolditalic': '/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf'},
    'Tahoma':          {'regular': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                        'bold': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                        'italic': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
                        'bolditalic': '/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf'},
    'Trebuchet MS':    {'regular': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                        'bold': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                        'italic': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
                        'bolditalic': '/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf'},
    'Calibri':         {'regular': '/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf',
                        'bold': '/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf',
                        'italic': '/usr/share/fonts/truetype/crosextra/Carlito-Italic.ttf',
                        'bolditalic': '/usr/share/fonts/truetype/crosextra/Carlito-BoldItalic.ttf'},
}


def _pick_system_file(family, bold, italic):
    entry = SYSTEM_FONT_FILES.get(family)
    if not entry:
        return None
    key = ('bolditalic' if (bold and italic) else 'bold' if bold else 'italic' if italic else 'regular')
    for k in (key, 'regular'):
        p = entry.get(k)
        if p and os.path.exists(p):
            return p
    return None


# ===========================================================================
# PRE-EXTRACT FONTS (BEFORE REDACTION)
# ===========================================================================
_page_font_cache = {}


def _page_num_of(page):
    try:
        return page.number
    except Exception:
        return 0


def pre_extract_page_fonts(page, doc, page_num):
    doc_key = id(doc)
    if doc_key not in _page_font_cache:
        _page_font_cache[doc_key] = {}
    if page_num in _page_font_cache[doc_key]:
        return _page_font_cache[doc_key][page_num]

    cache = {}
    try:
        fonts = page.get_fonts(full=True)
    except Exception as e:
        log(f"get_fonts failed on page {page_num}: {e}")
        _page_font_cache[doc_key][page_num] = cache
        return cache

    log(f"  Pre-extracting {len(fonts)} fonts on page {page_num}")
    for f in fonts:
        try:
            xref = f[0]
            basefont = (f[3] or '')

            buffer = None
            try:
                result = doc.extract_font(xref)
                if len(result) >= 4:
                    buffer = result[3]
            except Exception as e:
                log(f"    extract_font({xref}) failed: {e}")

            if not buffer:
                log(f"    xref {xref} '{basefont}': empty buffer")
                continue

            clean = basefont.lower()
            if '+' in clean:
                clean = clean.split('+', 1)[1]
            clean = clean.strip()

            font_obj = None
            try:
                font_obj = fitz.Font(fontbuffer=buffer)
                test_len = font_obj.text_length('A', fontsize=12)
                if test_len <= 0:
                    log(f"    xref {xref} '{basefont}': broken metrics — buffer kept only")
                    font_obj = None
            except Exception as e:
                log(f"    xref {xref} '{basefont}': Font() failed: {e}")

            cache[clean] = {'buffer': buffer, 'xref': xref, 'font_obj': font_obj}
            log(f"    cached '{clean}' (xref {xref}, {len(buffer)} bytes, obj={'yes' if font_obj else 'no'})")
        except Exception as e:
            log(f"    font cache error: {e}")

    _page_font_cache[doc_key][page_num] = cache
    return cache


def find_original_font_in_cache(cache, original_name):
    if not original_name or not cache:
        return None
    target = original_name.lower()
    if '+' in target:
        target = target.split('+', 1)[1]
    target = target.strip()

    if target in cache:
        return cache[target]

    for key, val in cache.items():
        if target == key or target in key or key in target:
            return val

    target_base = strip_style_suffixes(target).lower()
    for key, val in cache.items():
        key_base = strip_style_suffixes(key).lower()
        if target_base == key_base or target_base in key_base or key_base in target_base:
            return val

    return None


# ===========================================================================
# CLONE CACHE
# ===========================================================================
_clone_cache = {}


def _get_clone_font(page, doc, original_name, bold, italic):
    family, category = detect_font_info(original_name or 'Helvetica')
    entry = CATEGORY_FALLBACK.get(category, CATEGORY_FALLBACK['humanist-sans'])
    clone_family = entry.get('clone')
    if not clone_family:
        return None, None, None, None

    cache_key = (clone_family, bold, italic)
    if cache_key in _clone_cache:
        return _clone_cache[cache_key]

    sys_path = _pick_system_file(clone_family, bold, italic)
    if sys_path:
        try:
            with open(sys_path, 'rb') as fh:
                buf = fh.read()
            obj = fitz.Font(fontbuffer=buf)
            result = (obj, buf, sys_path, clone_family)
            _clone_cache[cache_key] = result
            return result
        except Exception as e:
            log(f"Clone sys-file failed: {e}")

    if clone_family in GOOGLE_FONT_FAMILIES:
        weight = 700 if bold else 400
        path = _download_google_font(clone_family, weight, italic)
        if not path and bold:
            path = _download_google_font(clone_family, 400, italic)
        if path:
            try:
                with open(path, 'rb') as fh:
                    buf = fh.read()
                obj = fitz.Font(fontbuffer=buf)
                result = (obj, buf, path, clone_family)
                _clone_cache[cache_key] = result
                return result
            except Exception as e:
                log(f"Clone Google-font failed: {e}")

    _clone_cache[cache_key] = (None, None, None, None)
    return None, None, None, None


def _has_glyph(font_obj, ch):
    try:
        return bool(font_obj.has_glyph(ch))
    except Exception:
        return True


# ===========================================================================
# FONT REGISTRATION
# ===========================================================================
_embedded_fonts = {}


def _register_font_buffer(page, doc, buffer, cache_key):
    page_num = _page_num_of(page)
    key = (id(doc), page_num, cache_key)
    if key in _embedded_fonts:
        cached = _embedded_fonts[key]
        if cached is not None:
            return cached
    internal = f"PF{abs(hash(key)) % 1000000}"
    try:
        page.insert_font(fontname=internal, fontbuffer=buffer)
        _embedded_fonts[key] = internal
        log(f"    Registered fontbuffer '{internal}' on page {page_num} ({len(buffer)} bytes)")
        return internal
    except Exception as e:
        log(f"    insert_font(buffer) failed for {cache_key}: {e}")
        _embedded_fonts[key] = None
        return None


def _register_font_file(page, doc, font_path, cache_key):
    page_num = _page_num_of(page)
    key = (id(doc), page_num, cache_key)
    if key in _embedded_fonts:
        cached = _embedded_fonts[key]
        if cached is not None:
            return cached
    internal = f"PF{abs(hash(key)) % 1000000}"
    try:
        page.insert_font(fontname=internal, fontfile=font_path)
        _embedded_fonts[key] = internal
        log(f"    Registered fontfile '{internal}' on page {page_num}")
        return internal
    except Exception as e:
        log(f"    insert_font(file) failed for {cache_key}: {e}")
        _embedded_fonts[key] = None
        return None


def to_color_tuple(color):
    if isinstance(color, (list, tuple)) and len(color) >= 3:
        try:
            return tuple(max(0.0, min(1.0, float(c))) for c in color[:3])
        except Exception:
            return (0.0, 0.0, 0.0)
    if isinstance(color, str):
        h = color.lstrip('#')
        if len(h) == 6:
            try:
                return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
            except Exception:
                pass
    return (0.0, 0.0, 0.0)


# ===========================================================================
# TEXT INSERTION
# ===========================================================================
def _insert_text_span(page, doc, x0, y0, x1, y1, text, font_name, font_size, color,
                       original_font_name=None,
                       original_text='',
                       preserve_original_font=True,
                       family_explicit=False,
                       font_cache=None,
                       character_overrides=None,
                       align='left', underline=False, strike=False,
                       superscript=False, subscript=False,
                       char_spacing=0.0, h_scale=1.0,
                       outline_color=None, outline_width=0.0):
    original_size = float(font_size)
    text = str(text)

    if superscript:
        eff_size = original_size * 0.65
        baseline_shift = -original_size * 0.35
    elif subscript:
        eff_size = original_size * 0.65
        baseline_shift = original_size * 0.15
    else:
        eff_size = original_size
        baseline_shift = 0.0

    baseline_y = (y1 - 0.15 * original_size) + baseline_shift
    color = to_color_tuple(color)
    color = (float(color[0]), float(color[1]), float(color[2]))
    use_char_spacing = abs(char_spacing) > 0.01

    bold_flag = bool(font_name and 'bold' in font_name.lower())
    italic_flag = bool(font_name and 'italic' in font_name.lower())

    log(f"  [_insert_text_span] text='{text[:30]}' "
        f"color=({color[0]:.3f},{color[1]:.3f},{color[2]:.3f}) "
        f"size={eff_size:.2f} preserve={preserve_original_font} explicit={family_explicit}")

    original_char_set = set(str(original_text or ''))

    orig_entry = None
    if preserve_original_font and not superscript and not subscript and font_cache:
        orig_entry = find_original_font_in_cache(font_cache, original_font_name)

    orig_font_obj = None
    orig_font_reg_name = None
    clone_font_obj = None
    clone_font_reg_name = None
    safe_font_obj = None
    safe_font_reg_name = None
    missing_chars = []

    if orig_entry:
        orig_font_obj = orig_entry.get('font_obj')
        orig_font_buffer = orig_entry.get('buffer')
        if orig_font_obj:
            for ch in text:
                if ch.strip() and ch not in original_char_set:
                    if ch not in missing_chars:
                        missing_chars.append(ch)
                elif ch.strip() and not _has_glyph(orig_font_obj, ch):
                    if ch not in missing_chars:
                        missing_chars.append(ch)
        if orig_font_buffer:
            orig_font_reg_name = _register_font_buffer(
                page, doc, orig_font_buffer, f"orig:{orig_entry.get('xref')}"
            )

    if missing_chars:
        cf_obj, cf_buf, cf_file, _cf_name = _get_clone_font(
            page, doc, original_font_name, bold_flag, italic_flag
        )
        if cf_file:
            clone_font_reg_name = _register_font_file(
                page, doc, cf_file,
                f"clone_file:{original_font_name}:{bold_flag}:{italic_flag}"
            )
            if clone_font_reg_name:
                clone_font_obj = cf_obj
        if not clone_font_reg_name and cf_buf:
            clone_font_reg_name = _register_font_buffer(
                page, doc, cf_buf,
                f"clone_buf:{original_font_name}:{bold_flag}:{italic_flag}"
            )
            if clone_font_reg_name:
                clone_font_obj = cf_obj

    safe_family = None
    if font_name:
        try:
            safe_family, _ = detect_font_info(font_name)
        except Exception:
            safe_family = None
    if not safe_family and original_font_name:
        try:
            safe_family, _ = detect_font_info(original_font_name)
        except Exception:
            safe_family = None
    if not safe_family:
        safe_family = 'Helvetica'

    safe_sys_path = _pick_system_file(safe_family, bold_flag, italic_flag)
    if not safe_sys_path:
        safe_sys_path = _pick_system_file('Helvetica', bold_flag, italic_flag)
    if safe_sys_path:
        safe_font_reg_name = _register_font_file(
            page, doc, safe_sys_path, f"safe:{safe_sys_path}"
        )
        if safe_font_reg_name:
            try:
                with open(safe_sys_path, 'rb') as fh:
                    safe_font_obj = fitz.Font(fontbuffer=fh.read())
            except Exception:
                safe_font_obj = None

    log(f"  [_insert_text_span] orig={'yes' if orig_font_obj else 'NO'} "
        f"clone={'yes' if clone_font_obj else 'no'} safe={'yes' if safe_font_reg_name else 'no'} "
        f"missing={missing_chars[:8]} orig_text='{str(original_text)[:20]}'")

    def which_font(ch):
        if (ch in original_char_set
                and orig_font_obj and orig_font_reg_name
                and _has_glyph(orig_font_obj, ch)):
            return 'orig'
        if clone_font_obj and clone_font_reg_name and _has_glyph(clone_font_obj, ch):
            return 'clone'
        if safe_font_obj and safe_font_reg_name and _has_glyph(safe_font_obj, ch):
            return 'safe'
        if safe_font_reg_name:
            return 'safe'
        return 'helv'

    segments = []
    cur_kind = None
    cur_text = ''
    for ch in text:
        if ch == '\n':
            if cur_text:
                segments.append((cur_kind, cur_text))
            cur_kind = None
            cur_text = ''
            segments.append(('newline', '\n'))
            continue
        kind = which_font(ch)
        if kind != cur_kind:
            if cur_text:
                segments.append((cur_kind, cur_text))
            cur_kind = kind
            cur_text = ch
        else:
            cur_text += ch
    if cur_text:
        segments.append((cur_kind, cur_text))

    log(f"    segments: {[(k, t[:14]) for k, t in segments]}")

    def ch_width(ch):
        kind = which_font(ch)
        if kind == 'orig' and orig_font_obj:
            try:
                return orig_font_obj.text_length(ch, fontsize=eff_size)
            except Exception:
                pass
        if kind == 'clone' and clone_font_obj:
            try:
                return clone_font_obj.text_length(ch, fontsize=eff_size)
            except Exception:
                pass
        if kind == 'safe' and safe_font_obj:
            try:
                return safe_font_obj.text_length(ch, fontsize=eff_size)
            except Exception:
                pass
        try:
            return fitz.get_text_length(ch, fontname='helv', fontsize=eff_size)
        except Exception:
            return eff_size * 0.5

    total_w = sum(ch_width(c) for c in text if c != '\n')
    if use_char_spacing:
        total_w += char_spacing * max(0, len(text) - 1)
    total_w *= h_scale

    page_rect = page.rect
    page_left = page_rect.x0
    page_right = page_rect.x1
    page_width = page_rect.width
    left_margin = max(0.0, x0 - page_left)

    ins_x = x0
    if align == 'center':
        ins_x = page_left + (page_width - total_w) / 2.0
    elif align == 'right':
        ins_x = page_right - left_margin - total_w

        # Split text into runs based on character overrides
    if character_overrides:
        char_styles = []
        for i, ch in enumerate(text):
            eff_style = {
                'fontName': font_name,
                'fontSize': original_size,
                'bold': bold_flag,
                'italic': italic_flag,
                'color': color,
                'outlineColor': outline_color,
                'outlineWidth': outline_width,
                'charSpacing': char_spacing,
            }
            for ov in character_overrides:
                ov_start = int(ov.get('start', 0))
                ov_end = int(ov.get('end', 0))
                ov_style = ov.get('style', {}) or {}
                if ov_start <= i < ov_end:
                    if 'fontFamily' in ov_style and ov_style['fontFamily']:
                        # Convert family to backend font name with bold/italic
                        bold_v = ov_style.get('bold', eff_style['bold'])
                        italic_v = ov_style.get('italic', eff_style['italic'])
                        fn = ov_style['fontFamily']
                        if bold_v and italic_v: fn += '-BoldItalic'
                        elif bold_v: fn += '-Bold'
                        elif italic_v: fn += '-Italic'
                        eff_style['fontName'] = fn
                    if 'fontSize' in ov_style and ov_style['fontSize'] is not None:
                        eff_style['fontSize'] = float(ov_style['fontSize'])
                    if 'bold' in ov_style and ov_style['bold'] is not None:
                        eff_style['bold'] = bool(ov_style['bold'])
                    if 'italic' in ov_style and ov_style['italic'] is not None:
                        eff_style['italic'] = bool(ov_style['italic'])
                    if 'color' in ov_style and ov_style['color'] is not None:
                        eff_style['color'] = to_color_tuple(ov_style['color'])
                    if 'outlineColor' in ov_style and ov_style['outlineColor'] is not None:
                        eff_style['outlineColor'] = to_color_tuple(ov_style['outlineColor'])
                    if 'outlineWidth' in ov_style and ov_style['outlineWidth'] is not None:
                        eff_style['outlineWidth'] = float(ov_style['outlineWidth'])
                    if 'charSpacing' in ov_style and ov_style['charSpacing'] is not None:
                        eff_style['charSpacing'] = float(ov_style['charSpacing'])
            char_styles.append(eff_style)

        # Group consecutive chars with same style
        runs = []
        cur = None
        for i, ch in enumerate(text):
            s = char_styles[i]
            key = (s['fontName'], round(s['fontSize'], 2), s['bold'], s['italic'],
                   s['color'], s['outlineColor'], round(s['outlineWidth'], 2),
                   round(s['charSpacing'], 2))
            if not cur or cur['key'] != key:
                if cur:
                    runs.append(cur)
                cur = {'key': key, 'style': s, 'text': ch, 'start': i}
            else:
                cur['text'] += ch
        if cur:
            runs.append(cur)

        # Render each run at the correct x position
        log(f"    character_overrides → {len(runs)} runs")
        x_cursor_r = ins_x
        y_cursor_r = baseline_y
        inserted_any_r = False
        for run in runs:
            st = run['style']
            run_text = run['text']
            if not run_text:
                continue

            # Resolve font for this run
            fam_from_name, _cat = detect_font_info(st['fontName'] or '')
            bold_r = bool(st['bold'])
            italic_r = bool(st['italic'])
            reg_r = None
            sys_path_r = _pick_system_file(fam_from_name, bold_r, italic_r)
            if sys_path_r:
                reg_r = _register_font_file(page, doc, sys_path_r, f"runsys:{sys_path_r}:{bold_r}:{italic_r}")
            if not reg_r and fam_from_name in GOOGLE_FONT_FAMILIES:
                weight = 700 if bold_r else 400
                path = _download_google_font(fam_from_name, weight, italic_r)
                if not path and bold_r:
                    path = _download_google_font(fam_from_name, 400, italic_r)
                if path:
                    reg_r = _register_font_file(page, doc, path, f"rungf:{fam_from_name}:{weight}:{italic_r}")
            if not reg_r:
                reg_r = 'helv'

            try:
                if st['outlineColor'] and st['outlineWidth'] and st['outlineWidth'] > 0:
                    page.insert_text(
                        fitz.Point(x_cursor_r, y_cursor_r), run_text,
                        fontname=reg_r, fontsize=st['fontSize'],
                        color=to_color_tuple(st['outlineColor']),
                        fill=st['color'],
                        render_mode=2,
                        border_width=float(st['outlineWidth']),
                        overlay=True,
                    )
                else:
                    page.insert_text(
                        fitz.Point(x_cursor_r, y_cursor_r), run_text,
                        fontname=reg_r, fontsize=st['fontSize'],
                        color=st['color'],
                        render_mode=0,
                        overlay=True,
                    )
                inserted_any_r = True
            except Exception as e:
                log(f"    run insert failed for '{run_text[:15]}': {e}")

            # Advance x_cursor by measured width
            try:
                w = fitz.get_text_length(run_text, fontname=reg_r, fontsize=st['fontSize'])
            except Exception:
                w = len(run_text) * st['fontSize'] * 0.5
            x_cursor_r += w
            if st['charSpacing']:
                x_cursor_r += st['charSpacing'] * max(0, len(run_text) - 1)

        if inserted_any_r:
            # Underline/strike handled separately below using full width
            actual_width = x_cursor_r - ins_x
            inserted_any = True
        # else fall through to normal single-run insertion below

    inserted_any = False
    x_cursor = ins_x
    y_cursor = baseline_y

    for kind, seg in segments:
        if kind == 'newline':
            x_cursor = ins_x
            y_cursor += eff_size * 1.2
            continue
        if not seg:
            continue

        if kind == 'orig':
            reg_name = orig_font_reg_name
        elif kind == 'clone':
            reg_name = clone_font_reg_name
        elif kind == 'safe':
            reg_name = safe_font_reg_name
        else:
            reg_name = None

        if reg_name is None:
            reg_name = 'helv'

        ok = False
        try:
            # render_mode=0 → pure fill, no stroke. This is the ONLY way
            # to guarantee text isn't rendered bold.
            if use_outline_condition := (outline_color is not None and outline_width > 0):
                # User explicitly asked for an outline: fill + real stroke
                page.insert_text(
                    fitz.Point(x_cursor, y_cursor), seg,
                    fontname=reg_name,
                    fontsize=eff_size,
                    color=to_color_tuple(outline_color),
                    fill=color,
                    render_mode=2,
                    border_width=float(outline_width),
                    overlay=True,
                )
            else:
                # Normal text: fill only
                page.insert_text(
                    fitz.Point(x_cursor, y_cursor), seg,
                    fontname=reg_name,
                    fontsize=eff_size,
                    color=color,
                    fill=color,
                    render_mode=0,
                    overlay=True,
                )
            ok = True
            inserted_any = True
            log(f"    Inserted [{kind}] '{seg[:15]}' x={x_cursor:.1f} font={reg_name}")
        except TypeError:
            # Older PyMuPDF might not accept some kwarg — retry minimal
            try:
                page.insert_text(
                    fitz.Point(x_cursor, y_cursor), seg,
                    fontname=reg_name,
                    fontsize=eff_size,
                    color=color,
                    render_mode=0,
                    overlay=True,
                )
                ok = True
                inserted_any = True
                log(f"    Inserted [minimal-kwargs] [{kind}] '{seg[:15]}' x={x_cursor:.1f}")
            except Exception as e:
                log(f"    insert_text failed [{kind}] '{seg[:15]}': {e}")
        except Exception as e:
            log(f"    insert_text failed [{kind}] '{seg[:15]}' via '{reg_name}': {e}")

        if not ok:
            try:
                page.insert_text(
                    fitz.Point(x_cursor, y_cursor), seg,
                    fontname='helv', fontsize=eff_size,
                    color=color, render_mode=0,
                    overlay=True,
                )
                inserted_any = True
                log(f"    Helvetica fallback OK for '{seg[:15]}'")
            except Exception as e2:
                log(f"    Helvetica fallback FAILED for '{seg[:15]}': {e2}")

        seg_w = sum(ch_width(c) for c in seg)
        x_cursor += seg_w * h_scale
        if use_char_spacing:
            x_cursor += char_spacing * max(0, len(seg) - 1)

    actual_width = x_cursor - ins_x

    if not inserted_any:
        log(f"    !!! Nothing inserted for '{text[:30]}'")
        return

    if underline or strike:
        try:
            final_w = actual_width
            if underline:
                uy = baseline_y + eff_size * 0.12
                page.draw_line(
                    fitz.Point(ins_x, uy), fitz.Point(ins_x + final_w, uy),
                    color=color, width=max(0.5, eff_size * 0.05),
                )
            if strike:
                sy = baseline_y - eff_size * 0.32
                page.draw_line(
                    fitz.Point(ins_x, sy), fitz.Point(ins_x + final_w, sy),
                    color=color, width=max(0.5, eff_size * 0.05),
                )
        except Exception as e:
            log(f"    Decoration failed: {e}")

# ===========================================================================
# SHAPES
# ===========================================================================
def _draw_shape(page, shape_type, x0, y0, x1, y1, stroke_color, stroke_width, fill_color):
    rect = fitz.Rect(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))
    fill = fill_color if fill_color else None
    w = max(0.5, float(stroke_width))
    try:
        if shape_type == 'rect':
            page.draw_rect(rect, color=stroke_color, fill=fill, width=w)
        elif shape_type in ('ellipse', 'circle'):
            page.draw_ellipse(rect, color=stroke_color, fill=fill, width=w)
        elif shape_type == 'line':
            page.draw_line(fitz.Point(x0, y0), fitz.Point(x1, y1),
                           color=stroke_color, width=w)
        elif shape_type == 'arrow':
            p1, p2 = fitz.Point(x0, y0), fitz.Point(x1, y1)
            page.draw_line(p1, p2, color=stroke_color, width=w)
            dx, dy = p2.x - p1.x, p2.y - p1.y
            length = max(1e-3, math.hypot(dx, dy))
            ux, uy = dx / length, dy / length
            al = min(18.0, max(8.0, length * 0.18))
            for sign in (-1, 1):
                ang = math.atan2(uy, ux) + sign * math.radians(28)
                page.draw_line(p2,
                               fitz.Point(p2.x - math.cos(ang) * al,
                                          p2.y - math.sin(ang) * al),
                               color=stroke_color, width=w)
        elif shape_type == 'triangle':
            pts = [fitz.Point((x0 + x1) / 2.0, min(y0, y1)),
                   fitz.Point(max(x0, x1), max(y0, y1)),
                   fitz.Point(min(x0, x1), max(y0, y1))]
            sh = page.new_shape()
            sh.draw_polyline(pts + [pts[0]])
            sh.finish(color=stroke_color, fill=fill, width=w)
            sh.commit()
        elif shape_type == 'diamond':
            cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
            pts = [fitz.Point(cx, min(y0, y1)),
                   fitz.Point(max(x0, x1), cy),
                   fitz.Point(cx, max(y0, y1)),
                   fitz.Point(min(x0, x1), cy)]
            sh = page.new_shape()
            sh.draw_polyline(pts + [pts[0]])
            sh.finish(color=stroke_color, fill=fill, width=w)
            sh.commit()
    except Exception as e:
        log(f"Shape draw error ({shape_type}): {e}")


# ===========================================================================
# HIGHLIGHT
# ===========================================================================
def _draw_highlight(page, x0, y0, x1, y1, color, opacity):
    rect = fitz.Rect(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))
    fill_col = to_color_tuple(color)
    op = max(0.05, min(1.0, float(opacity or 0.4)))
    try:
        page.draw_rect(
            rect,
            color=None,
            fill=fill_col,
            width=0,
            fill_opacity=op,
            stroke_opacity=0,
            overlay=True,
        )
        log(f"  Drew highlight ({fill_col}) opacity={op} at {rect}")
        return
    except TypeError:
        pass
    except Exception as e:
        log(f"highlight draw (modern) failed: {e}")

    try:
        page.draw_rect(rect, color=None, fill=fill_col, width=0, overlay=True)
        log(f"  Drew highlight (fallback, no opacity) at {rect}")
    except Exception as e:
        log(f"highlight draw failed: {e}")


# ===========================================================================
# IMAGE
# ===========================================================================
def _draw_image(page, x0, y0, x1, y1, data_url):
    if not data_url or ',' not in data_url:
        log("  image: no valid dataUrl")
        return
    try:
        b64 = data_url.split(',', 1)[1]
        img_bytes = base64.b64decode(b64)
    except Exception as e:
        log(f"  image decode failed: {e}")
        return
    rect = fitz.Rect(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))
    try:
        page.insert_image(rect, stream=img_bytes, overlay=True)
        log(f"  Inserted image into {rect}")
    except Exception as e:
        log(f"  insert_image failed: {e}")


# ===========================================================================
# FREEHAND
# ===========================================================================
def _draw_freehand(page, points, color, stroke_width, opacity):
    if not points or len(points) < 2:
        return
    pts = []
    for p in points:
        try:
            pts.append(fitz.Point(float(p.get('x', 0)), float(p.get('y', 0))))
        except Exception:
            continue
    if len(pts) < 2:
        return
    col = to_color_tuple(color)
    sw = max(0.5, float(stroke_width or 3))
    op = max(0.05, min(1.0, float(opacity or 1.0)))
    try:
        sh = page.new_shape()
        sh.draw_polyline(pts)
        kw = dict(color=col, width=sw, lineCap=1, lineJoin=1)
        if op < 0.99:
            kw['stroke_opacity'] = op
        sh.finish(**kw)
        sh.commit(overlay=True)
        log(f"  Drew freehand with {len(pts)} points")
        return
    except TypeError:
        pass
    except Exception as e:
        log(f"  freehand draw (modern) failed: {e}")

    try:
        sh = page.new_shape()
        sh.draw_polyline(pts)
        sh.finish(color=col, width=sw)
        sh.commit()
        log(f"  Drew freehand (fallback, no opacity) with {len(pts)} points")
    except Exception as e:
        log(f"  freehand draw failed: {e}")


# ===========================================================================
# MAIN
# ===========================================================================
def perform_edits(input_path, output_path, edits, additions):
    doc = fitz.open(input_path)
    log(f"Opened: {len(doc)} pages, {len(edits)} edits, {len(additions)} additions")

    edits_by_page, additions_by_page = {}, {}
    for e in edits:
        try: p = int(e.get('page', 1))
        except Exception: continue
        edits_by_page.setdefault(p, []).append(e)
    for a in additions:
        try: p = int(a.get('page', 1))
        except Exception: continue
        additions_by_page.setdefault(p, []).append(a)

    for page_num in sorted(set(edits_by_page) | set(additions_by_page)):
        if not (1 <= page_num <= len(doc)):
            continue
        page = doc[page_num - 1]
        page_edits = edits_by_page.get(page_num, [])
        page_additions = additions_by_page.get(page_num, [])
        log(f"--- Page {page_num}: {len(page_edits)} edits, {len(page_additions)} additions")

        font_cache = pre_extract_page_fonts(page, doc, page_num) if page_edits else {}

        if page_edits:
            for e in page_edits:
                bbox = e.get('bbox')
                if not bbox or len(bbox) != 4: continue
                x0, y0, x1, y1 = [float(v) for v in bbox]
                if x1 < x0: x0, x1 = x1, x0
                if y1 < y0: y0, y1 = y1, y0
                rect = fitz.Rect(x0 - 1.0, y0 - 1.5, x1 + 1.5, y1 + 1.0)
                bg = to_color_tuple(e.get('bgColor', [1.0, 1.0, 1.0]))
                try:
                    page.add_redact_annot(rect, fill=bg)
                except Exception as ex:
                    log(f"add_redact_annot failed: {ex}")
            try:
                page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
            except Exception as ex:
                log(f"apply_redactions failed: {ex}")

            for e in page_edits:
                new_text = e.get('newText')
                if new_text is None: continue
                new_text = str(new_text)
                if new_text.strip() == '': continue
                bbox = e.get('bbox')
                if not bbox or len(bbox) != 4: continue
                x0, y0, x1, y1 = [float(v) for v in bbox]
                if x1 < x0: x0, x1 = x1, x0
                if y1 < y0: y0, y1 = y1, y0

                _insert_text_span(
                    page, doc,
                    x0 + float(e.get('offsetX', 0) or 0),
                    y0 + float(e.get('offsetY', 0) or 0),
                    x1 + float(e.get('offsetX', 0) or 0),
                    y1 + float(e.get('offsetY', 0) or 0),
                    new_text,
                    e.get('fontName', 'Helvetica'),
                    float(e.get('fontSize', 11.0)) or 11.0,
                    e.get('color', [0.0, 0.0, 0.0]),
                    original_font_name=e.get('originalFontName'),
                    original_text=e.get('originalText', ''),
                    preserve_original_font=bool(e.get('preserveOriginalFont', False)),
                    family_explicit=bool(e.get('familyExplicit', False)),
                    font_cache=font_cache,
                    character_overrides=e.get('characterOverrides', []),
                    align=(e.get('align') or 'left').lower(),
                    underline=bool(e.get('underline')),
                    strike=bool(e.get('strike')),
                    superscript=bool(e.get('superscript')),
                    subscript=bool(e.get('subscript')),
                    char_spacing=float(e.get('charSpacing', 0) or 0),
                    h_scale=float(e.get('hScale', 100) or 100) / 100.0,
                    outline_color=e.get('outlineColor'),
                    outline_width=float(e.get('outlineWidth', 0) or 0),
                )

        for a in page_additions:
            try:
                a_type = a.get('type')

                if a_type == 'text':
                    bbox = a.get('bbox') or {}
                    x0 = float(bbox.get('x0', 0)); y0 = float(bbox.get('y0', 0))
                    x1 = float(bbox.get('x1', 0)); y1 = float(bbox.get('y1', 0))
                    text = a.get('text', '')
                    if not text: continue
                    font_size = float(a.get('fontSize', 14)) or 14
                    font_name = a.get('fontName', 'Helvetica')
                    if a.get('bold') and a.get('italic'): font_name = f"{font_name}-BoldItalic"
                    elif a.get('bold'): font_name = f"{font_name}-Bold"
                    elif a.get('italic'): font_name = f"{font_name}-Italic"

                    baseline = y1 if y1 > y0 else y0
                    ins_y0 = baseline - font_size * 0.9
                    ins_y1 = baseline + font_size * 0.15

                    _insert_text_span(
                        page, doc, x0, ins_y0, x1, ins_y1,
                        text, font_name, font_size,
                        a.get('color', [0, 0, 0]),
                        original_font_name=None,
                        original_text='',
                        preserve_original_font=False,
                        family_explicit=True,
                        font_cache=None,
                        align=a.get('align', 'left'),
                        underline=bool(a.get('underline')),
                        strike=bool(a.get('strike')),
                        superscript=bool(a.get('superscript')),
                        subscript=bool(a.get('subscript')),
                        char_spacing=float(a.get('charSpacing', 0) or 0),
                        h_scale=float(a.get('hScale', 100) or 100) / 100.0,
                        outline_color=a.get('outlineColor'),
                        outline_width=float(a.get('outlineWidth', 0) or 0),
                    )

                elif a_type == 'shape':
                    bbox = a.get('bbox') or {}
                    x0 = float(bbox.get('x0', 0)); y0 = float(bbox.get('y0', 0))
                    x1 = float(bbox.get('x1', 0)); y1 = float(bbox.get('y1', 0))
                    _draw_shape(
                        page, a.get('shapeType', 'rect'),
                        x0, y0, x1, y1,
                        to_color_tuple(a.get('strokeColor', [0, 0, 0])),
                        float(a.get('strokeWidth', 2) or 2),
                        to_color_tuple(a['fillColor']) if a.get('fillColor') else None,
                    )

                elif a_type == 'highlight':
                    bbox = a.get('bbox') or {}
                    x0 = float(bbox.get('x0', 0)); y0 = float(bbox.get('y0', 0))
                    x1 = float(bbox.get('x1', 0)); y1 = float(bbox.get('y1', 0))
                    _draw_highlight(
                        page, x0, y0, x1, y1,
                        a.get('color', [1, 0.93, 0.3]),
                        float(a.get('opacity', 0.4) or 0.4),
                    )

                elif a_type == 'image':
                    bbox = a.get('bbox') or {}
                    x0 = float(bbox.get('x0', 0)); y0 = float(bbox.get('y0', 0))
                    x1 = float(bbox.get('x1', 0)); y1 = float(bbox.get('y1', 0))
                    _draw_image(page, x0, y0, x1, y1, a.get('dataUrl') or '')

                elif a_type == 'freehand':
                    _draw_freehand(
                        page,
                        a.get('points') or [],
                        a.get('color', [0.86, 0.15, 0.15]),
                        float(a.get('strokeWidth', 3) or 3),
                        float(a.get('opacity', 1) or 1),
                    )

            except Exception as ex:
                log(f"addition handling error: {ex}")

    try:
        doc.save(output_path, garbage=4, deflate=True, clean=True)
        log(f"Saved: {output_path}")
    except Exception as e:
        log(f"save failed: {e}")
        raise
    finally:
        doc.close()


if __name__ == '__main__':
    if len(sys.argv) < 4:
        log("Usage: convert_edit_pdf.py <in.pdf> <out.pdf> <edits.json> [additions.json]")
        sys.exit(1)
    try:
        with open(sys.argv[3], 'r', encoding='utf-8') as f:
            edits = json.load(f)
        additions = []
        if len(sys.argv) > 4:
            try:
                with open(sys.argv[4], 'r', encoding='utf-8') as f:
                    additions = json.load(f)
            except Exception:
                additions = []
        perform_edits(sys.argv[1], sys.argv[2], edits, additions)
        sys.exit(0)
    except Exception as exc:
        log(f"FATAL: {exc}")
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)