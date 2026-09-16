"""
In-place PDF editing engine powered by PyMuPDF.

Handles:
  - Existing-span edits (redact + re-insert with full styling overrides)
  - New text additions (place text at absolute position)
  - New shape additions (rect, ellipse, line, arrow, triangle, diamond)

Now supports: bold, italic, underline, strikethrough, superscript, subscript,
              alignment, character spacing, horizontal scale, outline, direction.
"""
import sys
import os
import json
import math
import fitz  # PyMuPDF


def resolve_font_code(font_name):
    name = (font_name or '').lower()
    is_bold = any(k in name for k in ('bold', 'black', 'heavy', 'semibold', 'demibold'))
    is_italic = any(k in name for k in ('italic', 'oblique'))
    if any(k in name for k in ('times', 'serif', 'roman', 'georgia', 'garamond', 'book')):
        if is_bold and is_italic: return 'tibi'
        if is_bold: return 'tibo'
        if is_italic: return 'tiit'
        return 'tiro'
    if any(k in name for k in ('courier', 'mono', 'consol')):
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


def _insert_text_span(page, x0, y0, x1, y1, text, font_name, font_size, color,
                       align='left', underline=False, strike=False,
                       superscript=False, subscript=False,
                       char_spacing=0.0, h_scale=1.0,
                       outline_color=None, outline_width=0.0):
    """Insert one styled text span. bbox in PyMuPDF coordinates (top-down)."""
    font_code = resolve_font_code(font_name)
    original_size = font_size

    if superscript:
        font_size = font_size * 0.65
        baseline_shift = original_size * 0.35
    elif subscript:
        font_size = font_size * 0.65
        baseline_shift = -original_size * 0.15
    else:
        baseline_shift = 0.0

    # PyMuPDF uses PDF-space y (bottom-up). The bbox given is top-down, but
    # our caller already converted to PyMuPDF coords by (viewY1 - pdfY).
    # So y0 (top) < y1 (bottom). Baseline sits near y1 - descent.
    baseline_y = y1 - 0.2 * font_size + baseline_shift

    # --- Render mode (fill vs fill+stroke) ---
    render_mode = 2 if (outline_color and outline_width > 0) else 0
    stroke_col = to_color_tuple(outline_color) if outline_color else None

    # --- Character spacing: manual per-character placement ---
    use_manual_spacing = abs(char_spacing) > 0.01

    try:
        if use_manual_spacing:
            writer = fitz.TextWriter(page.rect)
            font_obj = fitz.Font(fontname=font_code)
            x = x0
            for ch in text:
                writer.append((x, baseline_y), ch, font=font_obj, fontsize=font_size)
                ch_w = font_obj.text_length(ch, fontsize=font_size)
                x += ch_w + char_spacing

            # Apply horizontal scale via morph if needed
            morph = None
            if abs(h_scale - 1.0) > 0.01:
                pivot = fitz.Point(x0, baseline_y)
                matrix = fitz.Matrix(h_scale, 0, 0, 1, 0, 0)
                morph = (pivot, matrix)

            writer.write_text(page, color=color, morph=morph)
        else:
            point = fitz.Point(x0, baseline_y)

            # Alignment: use textbox for non-left
            if align in ('center', 'right', 'justify') and (x1 - x0) > 5:
                rect = fitz.Rect(x0, y0, x1, y1)
                align_enum = {
                    'center': fitz.TEXT_ALIGN_CENTER,
                    'right': fitz.TEXT_ALIGN_RIGHT,
                    'justify': fitz.TEXT_ALIGN_JUSTIFY,
                }[align]

                kwargs = dict(fontname=font_code, fontsize=font_size,
                              color=color, align=align_enum)
                if render_mode == 2:
                    kwargs['render_mode'] = 2
                    kwargs['fill'] = color
                    kwargs['color'] = stroke_col
                try:
                    page.insert_textbox(rect, text, **kwargs)
                except Exception:
                    page.insert_textbox(rect, text, fontname=font_code,
                                        fontsize=font_size, color=color, align=align_enum)
            else:
                kwargs = dict(fontname=font_code, fontsize=font_size)
                if render_mode == 2:
                    kwargs['render_mode'] = 2
                    kwargs['fill'] = color
                    kwargs['color'] = stroke_col
                else:
                    kwargs['color'] = color

                morph = None
                if abs(h_scale - 1.0) > 0.01:
                    pivot = fitz.Point(x0, baseline_y)
                    matrix = fitz.Matrix(h_scale, 0, 0, 1, 0, 0)
                    morph = (pivot, matrix)
                if morph:
                    kwargs['morph'] = morph

                try:
                    page.insert_text(point, text, **kwargs)
                except Exception:
                    page.insert_text(point, text, fontname='helv',
                                     fontsize=font_size, color=color)

        # Effective advance width (for underline/strike)
        try:
            eff_w = fitz.get_text_length(text, fontname=font_code, fontsize=font_size)
            if use_manual_spacing:
                eff_w += char_spacing * max(0, len(text) - 1)
            eff_w *= h_scale
        except Exception:
            eff_w = (x1 - x0)

        if underline:
            uy = baseline_y + font_size * 0.15
            try:
                page.draw_line(fitz.Point(x0, uy),
                               fitz.Point(x0 + eff_w, uy),
                               color=color, width=max(0.5, font_size * 0.05))
            except Exception:
                pass

        if strike:
            sy = baseline_y + font_size * 0.35
            try:
                page.draw_line(fitz.Point(x0, sy),
                               fitz.Point(x0 + eff_w, sy),
                               color=color, width=max(0.5, font_size * 0.05))
            except Exception:
                pass
    except Exception as e:
        sys.stderr.write(f"Text insert error: {e}\n")


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
            p1 = fitz.Point(x0, y0)
            p2 = fitz.Point(x1, y1)
            page.draw_line(p1, p2, color=stroke_color, width=w)
            dx = p2.x - p1.x
            dy = p2.y - p1.y
            length = max(1e-3, math.hypot(dx, dy))
            ux, uy = dx / length, dy / length
            arrow_len = min(18.0, max(8.0, length * 0.18))
            for sign in (-1, 1):
                ang = math.atan2(uy, ux) + sign * math.radians(28)
                tip_x = p2.x - math.cos(ang) * arrow_len
                tip_y = p2.y - math.sin(ang) * arrow_len
                page.draw_line(p2, fitz.Point(tip_x, tip_y), color=stroke_color, width=w)
        elif shape_type == 'triangle':
            points = [
                fitz.Point((x0 + x1) / 2.0, min(y0, y1)),
                fitz.Point(max(x0, x1), max(y0, y1)),
                fitz.Point(min(x0, x1), max(y0, y1)),
            ]
            shape = page.new_shape()
            shape.draw_polyline(points + [points[0]])
            shape.finish(color=stroke_color, fill=fill, width=w)
            shape.commit()
        elif shape_type == 'diamond':
            cx = (x0 + x1) / 2.0
            cy = (y0 + y1) / 2.0
            points = [
                fitz.Point(cx, min(y0, y1)),
                fitz.Point(max(x0, x1), cy),
                fitz.Point(cx, max(y0, y1)),
                fitz.Point(min(x0, x1), cy),
            ]
            shape = page.new_shape()
            shape.draw_polyline(points + [points[0]])
            shape.finish(color=stroke_color, fill=fill, width=w)
            shape.commit()
    except Exception as e:
        sys.stderr.write(f"Shape draw error ({shape_type}): {e}\n")


def perform_edits(input_path, output_path, edits, additions):
    doc = fitz.open(input_path)

    edits_by_page = {}
    for e in edits:
        try: p = int(e.get('page', 1))
        except Exception: continue
        edits_by_page.setdefault(p, []).append(e)

    additions_by_page = {}
    for a in additions:
        try: p = int(a.get('page', 1))
        except Exception: continue
        additions_by_page.setdefault(p, []).append(a)

    for page_num in set(edits_by_page.keys()) | set(additions_by_page.keys()):
        if page_num < 1 or page_num > len(doc):
            continue
        page = doc[page_num - 1]
        page_edits = edits_by_page.get(page_num, [])
        page_additions = additions_by_page.get(page_num, [])

        # STEP 1: Redact originals
        if page_edits:
            for e in page_edits:
                bbox = e.get('bbox')
                if not bbox or len(bbox) != 4: continue
                x0, y0, x1, y1 = [float(v) for v in bbox]
                if x1 < x0: x0, x1 = x1, x0
                if y1 < y0: y0, y1 = y1, y0
                rect = fitz.Rect(x0 - 1.0, y0 - 1.5, x1 + 1.5, y1 + 1.0)
                bg = to_color_tuple(e.get('bgColor', [1.0, 1.0, 1.0]))
                try: page.add_redact_annot(rect, fill=bg)
                except Exception: pass
            try:
                page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
            except Exception: pass

            # STEP 2: Re-insert edited text
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

                offset_x = float(e.get('offsetX', 0) or 0)
                offset_y = float(e.get('offsetY', 0) or 0)
                font_size = float(e.get('fontSize', 11.0)) or 11.0
                font_name = e.get('fontName', 'Helvetica')
                color = to_color_tuple(e.get('color', [0.0, 0.0, 0.0]))
                align = (e.get('align') or 'left').lower()
                underline = bool(e.get('underline'))
                strike = bool(e.get('strike'))
                superscript = bool(e.get('superscript'))
                subscript = bool(e.get('subscript'))
                char_spacing = float(e.get('charSpacing', 0) or 0)
                h_scale = float(e.get('hScale', 100) or 100) / 100.0
                outline_color = e.get('outlineColor')
                outline_width = float(e.get('outlineWidth', 0) or 0)

                _insert_text_span(
                    page,
                    x0 + offset_x, y0 + offset_y,
                    x1 + offset_x, y1 + offset_y,
                    new_text, font_name, font_size, color,
                    align=align, underline=underline, strike=strike,
                    superscript=superscript, subscript=subscript,
                    char_spacing=char_spacing, h_scale=h_scale,
                    outline_color=outline_color, outline_width=outline_width,
                )

        # STEP 3: Additions
        for a in page_additions:
            try:
                bbox = a.get('bbox') or {}
                x0 = float(bbox.get('x0', 0))
                y0 = float(bbox.get('y0', 0))
                x1 = float(bbox.get('x1', 0))
                y1 = float(bbox.get('y1', 0))
            except Exception:
                continue

            if a.get('type') == 'text':
                text = a.get('text', '')
                if not text: continue
                font_size = float(a.get('fontSize', 14)) or 14
                font_name = a.get('fontName', 'Helvetica')
                color = to_color_tuple(a.get('color', [0, 0, 0]))
                if a.get('bold') and a.get('italic'):
                    font_name = f"{font_name}-BoldItalic"
                elif a.get('bold'):
                    font_name = f"{font_name}-Bold"
                elif a.get('italic'):
                    font_name = f"{font_name}-Italic"

                ins_y0 = y0
                ins_y1 = y0 + font_size * 1.0
                # If the addition uses baseline-as-y1 semantics from frontend
                if y1 > y0:
                    ins_y1 = y1
                    ins_y0 = y1 - font_size * 1.0

                _insert_text_span(
                    page,
                    x0, ins_y0, x1, ins_y1,
                    text, font_name, font_size, color,
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
                shape_type = a.get('shapeType', 'rect')
                stroke_color = to_color_tuple(a.get('strokeColor', [0, 0, 0]))
                stroke_width = float(a.get('strokeWidth', 2) or 2)
                raw_fill = a.get('fillColor')
                fill_color = to_color_tuple(raw_fill) if raw_fill else None
                _draw_shape(page, shape_type, x0, y0, x1, y1,
                            stroke_color, stroke_width, fill_color)

    doc.save(output_path, garbage=4, deflate=True, clean=True)
    doc.close()


if __name__ == '__main__':
    if len(sys.argv) < 4:
        sys.stderr.write(
            "Usage: python convert_edit_pdf.py <input.pdf> <output.pdf> <edits.json> [additions.json]\n"
        )
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
        sys.stderr.write(f"Edit PDF error: {str(exc)}\n")
        sys.exit(1)