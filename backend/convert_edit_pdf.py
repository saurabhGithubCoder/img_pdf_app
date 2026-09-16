"""
In-place PDF editing engine powered by PyMuPDF.

New in this version:
  • Google Font support — 40+ web fonts are downloaded on demand from the
    Google Fonts CDN and embedded into the output PDF.
  • System font aliases for Linux (Liberation / DejaVu / Carlito / Noto …).
  • Bulletproof multi-tier insertion — text is always visible.
  • Alignment via manual x-positioning (no insert_textbox dropouts).
"""
import sys
import os
import json
import math
import time
import re
import urllib.request
import urllib.parse
import fitz  # PyMuPDF


def log(msg):
    sys.stderr.write(f"[edit] {msg}\n")


# ===========================================================================
# FONT SYSTEM
# ===========================================================================

# Names that map to the PDF Base-14 fonts
BASE14_FAMILIES = {
    'Helvetica', 'Arial',
    'Times', 'Times New Roman',
    'Courier', 'Courier New',
    'Symbol', 'Zapf Dingbats',
}

# Google Font families we serve. Anything here can be downloaded on demand.
GOOGLE_FONT_FAMILIES = {
    'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Inter',
    'Nunito', 'Raleway', 'Work Sans', 'Ubuntu', 'Rubik', 'Karla',
    'Mulish', 'Manrope', 'DM Sans',
    'Merriweather', 'Playfair Display', 'Lora', 'PT Serif',
    'Crimson Text', 'Libre Baskerville', 'EB Garamond',
    'Cormorant Garamond', 'Noto Serif', 'Bitter',
    'JetBrains Mono', 'Fira Code', 'Source Code Pro',
    'IBM Plex Mono', 'Roboto Mono',
    'Oswald', 'Bebas Neue', 'Lobster', 'Pacifico',
    'Dancing Script', 'Great Vibes', 'Caveat', 'Satisfy',
}

# Cache directories
_FONT_CACHE_DIR = os.path.join('/tmp', 'pdf-forge-google-fonts')
os.makedirs(_FONT_CACHE_DIR, exist_ok=True)

_google_font_disk = {}   # (family, weight, italic) -> local_path or None


def _download_google_font(family, weight=400, italic=False):
    """Fetch a Google Font TTF and cache it on disk. Returns path or None."""
    key = (family, weight, italic)
    if key in _google_font_disk:
        return _google_font_disk[key]

    safe = family.replace(' ', '_').replace('/', '_')
    filename = f"{safe}-{weight}{'-italic' if italic else ''}.ttf"
    local_path = os.path.join(_FONT_CACHE_DIR, filename)

    if os.path.exists(local_path) and os.path.getsize(local_path) > 5000:
        _google_font_disk[key] = local_path
        return local_path

    try:
        ital = '1' if italic else '0'
        family_q = urllib.parse.quote(family)
        css_url = (
            f"https://fonts.googleapis.com/css2"
            f"?family={family_q}:ital,wght@{ital},{weight}&display=swap"
        )
        # Use an old UA so Google returns TTF, not WOFF2
        req = urllib.request.Request(css_url, headers={'User-Agent': 'Mozilla/4.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            css = resp.read().decode('utf-8', errors='ignore')

        m = re.search(r'src:\s*url\((https://[^)]+\.ttf)\)', css)
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
            _google_font_disk[key] = None
            return None

        with open(local_path, 'wb') as f:
            f.write(data)

        log(f"Downloaded Google Font '{family}' ({weight}{' italic' if italic else ''}) "
            f"→ {local_path} ({len(data)} bytes)")
        _google_font_disk[key] = local_path
        return local_path
    except Exception as e:
        log(f"Google Font download failed for {family} {weight} italic={italic}: {e}")
        _google_font_disk[key] = None
        return None


# Map user-facing font family names to system file paths (Linux).
# These are the fonts installed by the apt packages listed in the README.
SYSTEM_FONT_FILES = {
    'Arial': {
        'regular': '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        'bold': '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        'italic': '/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf',
        'bolditalic': '/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf',
    },
    'Helvetica': {
        'regular': '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        'bold': '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        'italic': '/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf',
        'bolditalic': '/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf',
    },
    'Times New Roman': {
        'regular': '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
        'bold': '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
        'italic': '/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf',
        'bolditalic': '/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf',
    },
    'Times': {
        'regular': '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
        'bold': '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
        'italic': '/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf',
        'bolditalic': '/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf',
    },
    'Courier New': {
        'regular': '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
        'bold': '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf',
        'italic': '/usr/share/fonts/truetype/liberation/LiberationMono-Italic.ttf',
        'bolditalic': '/usr/share/fonts/truetype/liberation/LiberationMono-BoldItalic.ttf',
    },
    'Courier': {
        'regular': '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
        'bold': '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf',
        'italic': '/usr/share/fonts/truetype/liberation/LiberationMono-Italic.ttf',
        'bolditalic': '/usr/share/fonts/truetype/liberation/LiberationMono-BoldItalic.ttf',
    },
    'Georgia': {
        'regular': '/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf',
        'bold': '/usr/share/fonts/truetype/crosextra/Caladea-Bold.ttf',
        'italic': '/usr/share/fonts/truetype/crosextra/Caladea-Italic.ttf',
        'bolditalic': '/usr/share/fonts/truetype/crosextra/Caladea-BoldItalic.ttf',
    },
    'Cambria': {
        'regular': '/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf',
        'bold': '/usr/share/fonts/truetype/crosextra/Caladea-Bold.ttf',
        'italic': '/usr/share/fonts/truetype/crosextra/Caladea-Italic.ttf',
        'bolditalic': '/usr/share/fonts/truetype/crosextra/Caladea-BoldItalic.ttf',
    },
    'Verdana': {
        'regular': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        'bold': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        'italic': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
        'bolditalic': '/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf',
    },
    'Tahoma': {
        'regular': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        'bold': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        'italic': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
        'bolditalic': '/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf',
    },
    'Trebuchet MS': {
        'regular': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        'bold': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        'italic': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
        'bolditalic': '/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf',
    },
    'Calibri': {
        'regular': '/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf',
        'bold': '/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf',
        'italic': '/usr/share/fonts/truetype/crosextra/Carlito-Italic.ttf',
        'bolditalic': '/usr/share/fonts/truetype/crosextra/Carlito-BoldItalic.ttf',
    },
}


def _pick_system_file(family, bold, italic):
    entry = SYSTEM_FONT_FILES.get(family)
    if not entry:
        return None
    key = (
        'bolditalic' if (bold and italic)
        else 'bold' if bold
        else 'italic' if italic
        else 'regular'
    )
    for k in (key, 'regular'):
        p = entry.get(k)
        if p and os.path.exists(p):
            return p
    return None


# ---- Embedded-font tracking (per document) ----
_embedded_fonts = {}   # (doc_id, cache_key) -> internal_name


def _register_font_file(page, doc, font_path, cache_key):
    """Register a font file on the page. Returns internal fontname or None."""
    key = (id(doc), cache_key)
    if key in _embedded_fonts:
        return _embedded_fonts[key]

    internal = f"PF{abs(hash(key)) % 1000000}"
    try:
        page.insert_font(fontname=internal, fontfile=font_path)
        _embedded_fonts[key] = internal
        return internal
    except Exception as e:
        log(f"insert_font failed for {cache_key}: {e}")
        _embedded_fonts[key] = None
        return None


def _resolve_full_font(family, bold, italic, page, doc):
    """Resolve a family + bold/italic to an embedded font on this page.

    Order of attempts:
      1. System font file (Liberation / DejaVu / Carlito / Caladea)
      2. Google Fonts download (with disk cache)
    """
    # 1) System
    sys_path = _pick_system_file(family, bold, italic)
    if sys_path:
        name = _register_font_file(page, doc, sys_path, f"sys:{sys_path}")
        if name:
            return name

    # 2) Google Fonts
    if family in GOOGLE_FONT_FAMILIES:
        weight = 700 if bold else 400
        path = _download_google_font(family, weight, italic)
        if not path and bold:
            # Bold variant missing → try regular and let the PDF synthesise
            path = _download_google_font(family, 400, italic)
        if path:
            name = _register_font_file(page, doc, path, f"gf:{family}:{weight}:{italic}")
            if name:
                return name

    return None


def _resolve_base14(font_name):
    """Map a font name to one of the PDF Base-14 codes."""
    name = (font_name or '').lower()
    if '+' in name:
        name = name.split('+', 1)[1]

    is_bold = any(k in name for k in ('bold', 'black', 'heavy', 'semibold', 'demibold'))
    is_italic = any(k in name for k in ('italic', 'oblique'))

    if any(k in name for k in ('times', 'georgia', 'garamond', 'cambria', 'minion')):
        if is_bold and is_italic: return 'tibi'
        if is_bold: return 'tibo'
        if is_italic: return 'tiit'
        return 'tiro'
    if any(k in name for k in ('courier', 'mono', 'consol', 'menlo')):
        if is_bold and is_italic: return 'cobi'
        if is_bold: return 'cobo'
        if is_italic: return 'coit'
        return 'cour'
    if 'symbol' in name: return 'symb'
    if 'zapf' in name or 'dingbat' in name: return 'zadb'
    if is_bold and is_italic: return 'hebi'
    if is_bold: return 'hebo'
    if is_italic: return 'heit'
    return 'helv'


def _parse_family_and_style(full_name):
    """Parse 'Poppins-BoldItalic' → ('Poppins', True, True)."""
    if not full_name:
        return (None, False, False)

    # Strip subset prefix
    if '+' in full_name:
        full_name = full_name.split('+', 1)[1]

    bold = False
    italic = False
    low = full_name.lower()
    if 'bold' in low:
        bold = True
    if 'italic' in low or 'oblique' in low:
        italic = True

    # Strip style suffixes to get the family
    family = full_name
    for suf in ('-BoldItalic', '-BoldOblique', '-Bold', '-Italic', '-Oblique',
                ' Bold Italic', ' Bold', ' Italic', ' Oblique'):
        if family.endswith(suf):
            family = family[: -len(suf)]
            break
    # Remove MT / PS / other vendor suffixes
    for suf in ('MT', 'PS', 'MS'):
        if family.endswith(suf):
            family = family[:-len(suf)]

    return (family.strip(), bold, italic)


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
                       preserve_original_font=True,
                       align='left', underline=False, strike=False,
                       superscript=False, subscript=False,
                       char_spacing=0.0, h_scale=1.0,
                       outline_color=None, outline_width=0.0):
    original_size = float(font_size)

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
    use_outline = (outline_color is not None and outline_width > 0)
    use_char_spacing = abs(char_spacing) > 0.01
    use_h_scale = abs(h_scale - 1.0) > 0.01

    # ------------------------------------------------------------------
    # Choose font code
    # ------------------------------------------------------------------
    font_code = None
    used_extracted = False

    family, bold, italic = _parse_family_and_style(font_name or '')
    if not family:
        family, bold, italic = _parse_family_and_style(original_font_name or '')

    # 1) Preserve the ORIGINAL embedded font when user hasn't changed anything
    if preserve_original_font and not superscript and not subscript:
        try:
            if original_font_name:
                fonts = page.get_fonts(full=True)
                target = original_font_name.lower()
                if '+' in target:
                    target = target.split('+', 1)[1]
                for f in fonts:
                    try:
                        xref = f[0]
                        basefont = (f[3] or '').lower()
                        clean = basefont.split('+', 1)[1] if '+' in basefont else basefont
                        if target == clean or target in clean or clean in target:
                            _, _, _, buffer = doc.extract_font(xref)
                            if buffer:
                                reg = f"ext{xref}{int(time.time() * 1000) % 100000}"
                                page.insert_font(fontname=reg, fontbuffer=buffer)
                                font_code = reg
                                used_extracted = True
                                break
                    except Exception:
                        continue
        except Exception as e:
            log(f"extract original font failed: {e}")

    # 2) Full font — system file OR Google Font
    if not font_code and not superscript and not subscript:
        embedded = _resolve_full_font(family, bold, italic, page, doc)
        if embedded:
            font_code = embedded

    # 3) Base-14 fallback
    if not font_code:
        font_code = _resolve_base14(font_name or original_font_name or family or 'Helvetica')

    log(f"  Insert '{str(text)[:22]}' font={font_code} "
        f"(family={family}, bold={bold}, italic={italic}, "
        f"extracted={used_extracted}, preserve={preserve_original_font})")

    # ------------------------------------------------------------------
    # Compute x position (alignment via manual x, page-wide for center/right)
    # ------------------------------------------------------------------
    try:
        text_w = fitz.get_text_length(str(text), fontname=font_code, fontsize=eff_size)
        if use_char_spacing:
            text_w += char_spacing * max(0, len(str(text)) - 1)
        text_w *= h_scale
    except Exception:
        try:
            text_w = fitz.get_text_length(str(text), fontname='helv', fontsize=eff_size)
        except Exception:
            text_w = (x1 - x0)

    page_rect = page.rect
    page_left = page_rect.x0
    page_right = page_rect.x1
    page_width = page_rect.width
    left_margin = max(0.0, x0 - page_left)

    ins_x = x0
    if align == 'center':
        ins_x = page_left + (page_width - text_w) / 2.0
    elif align == 'right':
        ins_x = page_right - left_margin - text_w
    # justify → left (single-line span)

    inserted = False

    # TIER 1: char-spacing via TextWriter
    if use_char_spacing:
        try:
            writer = fitz.TextWriter(page.rect)
            font_obj = fitz.Font(fontname=font_code)
            x = ins_x
            y = baseline_y
            for i, line in enumerate(str(text).split('\n')):
                if i > 0:
                    x = ins_x
                    y += eff_size * 1.2
                for ch in line:
                    writer.append((x, y), ch, font=font_obj, fontsize=eff_size)
                    x += font_obj.text_length(ch, fontsize=eff_size) + char_spacing
            kw = {'color': color}
            if use_h_scale:
                kw['morph'] = (fitz.Point(ins_x, baseline_y),
                               fitz.Matrix(h_scale, 0, 0, 1, 0, 0))
            writer.write_text(page, **kw)
            inserted = True
        except Exception as e:
            log(f"  Tier-1 failed: {e}")

    # TIER 2: styled insert_text
    if not inserted:
        try:
            point = fitz.Point(ins_x, baseline_y)
            kw = dict(fontname=font_code, fontsize=eff_size)
            if use_outline:
                kw['render_mode'] = 2
                kw['fill'] = color
                kw['color'] = to_color_tuple(outline_color)
            else:
                kw['color'] = color
            if use_h_scale:
                kw['morph'] = (fitz.Point(ins_x, baseline_y),
                               fitz.Matrix(h_scale, 0, 0, 1, 0, 0))
            page.insert_text(point, str(text), **kw)
            inserted = True
        except Exception as e:
            log(f"  Tier-2 failed: {e}")

    # TIER 3: bare Helvetica
    if not inserted:
        try:
            page.insert_text(fitz.Point(ins_x, baseline_y), str(text),
                             fontname='helv', fontsize=eff_size, color=color)
            inserted = True
            log("  Tier-3 fallback (Helvetica)")
        except Exception as e:
            log(f"  Tier-3 FAILED: {e}")

    # Decorations
    if inserted and (underline or strike):
        try:
            eff_w = fitz.get_text_length(str(text), fontname=font_code, fontsize=eff_size)
            if use_char_spacing:
                eff_w += char_spacing * max(0, len(str(text)) - 1)
            eff_w *= h_scale
            if underline:
                uy = baseline_y + eff_size * 0.12
                page.draw_line(fitz.Point(ins_x, uy),
                               fitz.Point(ins_x + eff_w, uy),
                               color=color, width=max(0.5, eff_size * 0.05))
            if strike:
                sy = baseline_y - eff_size * 0.32
                page.draw_line(fitz.Point(ins_x, sy),
                               fitz.Point(ins_x + eff_w, sy),
                               color=color, width=max(0.5, eff_size * 0.05))
        except Exception as e:
            log(f"  Underline/strike failed: {e}")


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
                    preserve_original_font=bool(e.get('preserveOriginalFont', False)),
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
                bbox = a.get('bbox') or {}
                x0 = float(bbox.get('x0', 0)); y0 = float(bbox.get('y0', 0))
                x1 = float(bbox.get('x1', 0)); y1 = float(bbox.get('y1', 0))
            except Exception:
                continue

            if a.get('type') == 'text':
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
                    preserve_original_font=False,
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
            elif a.get('type') == 'shape':
                _draw_shape(
                    page, a.get('shapeType', 'rect'),
                    x0, y0, x1, y1,
                    to_color_tuple(a.get('strokeColor', [0, 0, 0])),
                    float(a.get('strokeWidth', 2) or 2),
                    to_color_tuple(a['fillColor']) if a.get('fillColor') else None,
                )

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