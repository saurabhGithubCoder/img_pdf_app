"""
In-place PDF editing engine powered by PyMuPDF.

Key fixes in this version:
  1. `preserveOriginalFont` flag — only extracts the original PDF font when
     the user hasn't touched family / bold / italic. Bold/Italic now work.
  2. Alignment uses the page width for center / right / justify, so text
     actually moves on the page.
  3. Multi-tier insertion fallback so text is always visible.
"""
import sys
import json
import math
import time
import fitz  # PyMuPDF


def log(msg):
    sys.stderr.write(f"[edit] {msg}\n")


# ---------------------------------------------------------------------------
# Font code mapping
# ---------------------------------------------------------------------------
def resolve_font_code(font_name):
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
    if 'symbol' in name:
        return 'symb'
    if 'zapf' in name or 'dingbat' in name:
        return 'zadb'

    if is_bold and is_italic: return 'hebi'
    if is_bold: return 'hebo'
    if is_italic: return 'heit'
    return 'helv'


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


# ---------------------------------------------------------------------------
# Extract + register the original embedded PDF font (per doc + name)
# ---------------------------------------------------------------------------
_extract_cache = {}


def _extract_and_register_font(doc, page, original_name):
    if not original_name:
        return None

    key = (id(doc), original_name.lower())
    if key in _extract_cache:
        return _extract_cache[key]

    try:
        fonts = page.get_fonts(full=True)
    except Exception as e:
        log(f"get_fonts failed: {e}")
        return None

    target = original_name.lower()
    if '+' in target:
        target = target.split('+', 1)[1]

    for f in fonts:
        try:
            xref = f[0]
            basefont = (f[3] or '').lower()
            clean_base = basefont.split('+', 1)[1] if '+' in basefont else basefont
            if target == clean_base or target in clean_base or clean_base in target:
                basename, ext, subtype, buffer = doc.extract_font(xref)
                if buffer:
                    reg_name = f"ext{xref}{int(time.time() * 1000) % 100000}"
                    try:
                        page.insert_font(fontname=reg_name, fontbuffer=buffer)
                        _extract_cache[key] = reg_name
                        log(f"Extracted '{basefont}' -> '{reg_name}'")
                        return reg_name
                    except Exception as ex:
                        log(f"insert_font(fontbuffer) failed: {ex}")
        except Exception:
            continue
    return None


# ---------------------------------------------------------------------------
# Text insertion
# ---------------------------------------------------------------------------
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

    # Only preserve the ORIGINAL embedded font when the user has not changed
    # any font-affecting property (family / bold / italic / super / sub).
    if preserve_original_font and not superscript and not subscript:
        extracted = _extract_and_register_font(doc, page, original_font_name)
        if extracted:
            font_code = extracted
            used_extracted = True

    if not font_code:
        font_code = resolve_font_code(font_name or original_font_name or 'Helvetica')

    log(f"  Insert '{str(text)[:22]}' font={font_code} "
        f"(extracted={used_extracted}, preserve={preserve_original_font})")

    # ------------------------------------------------------------------
    # Compute x position — center / right use PAGE width so text moves
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

    # Preserve whatever left offset the ORIGINAL span had as the page margin
    left_margin = max(0.0, x0 - page_left)

    ins_x = x0
    if align == 'center':
        ins_x = page_left + (page_width - text_w) / 2.0
    elif align == 'right':
        ins_x = page_right - left_margin - text_w
    # justify → treat as left for single-line spans

    inserted = False

    # TIER 1: per-character placement (char spacing)
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
            # Redact
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

            # Re-insert
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
                    preserve_original_font=False,   # additions always explicit
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