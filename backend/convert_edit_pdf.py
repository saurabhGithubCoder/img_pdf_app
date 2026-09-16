"""
In-place PDF text editing engine powered by PyMuPDF.

Takes a PDF + a JSON list of edits (one per text span) and produces a new PDF
where the specified spans are replaced while preserving position, font family,
weight, italic, size, and color as closely as PDF Base-14 fonts allow.
"""
import sys
import os
import json
import fitz  # PyMuPDF


def resolve_font_code(font_name):
    """Map an arbitrary font family name to the closest PDF Base-14 font code."""
    name = (font_name or '').lower()
    is_bold = any(k in name for k in ('bold', 'black', 'heavy', 'semibold', 'demibold'))
    is_italic = any(k in name for k in ('italic', 'oblique'))

    # Times / Serif family
    if any(k in name for k in ('times', 'serif', 'roman', 'georgia', 'garamond', 'book')):
        if is_bold and is_italic:
            return 'tibi'      # Times-BoldItalic
        if is_bold:
            return 'tibo'      # Times-Bold
        if is_italic:
            return 'tiit'      # Times-Italic
        return 'tiro'          # Times-Roman

    # Courier / Mono family
    if any(k in name for k in ('courier', 'mono', 'consol')):
        if is_bold and is_italic:
            return 'cobi'
        if is_bold:
            return 'cobo'
        if is_italic:
            return 'coit'
        return 'cour'

    # Symbol / Dingbats
    if 'symbol' in name:
        return 'symb'
    if 'zapf' in name or 'dingbat' in name:
        return 'zadb'

    # Default: Helvetica / Arial family
    if is_bold and is_italic:
        return 'hebi'
    if is_bold:
        return 'hebo'
    if is_italic:
        return 'heit'
    return 'helv'


def to_color_tuple(color):
    """Normalize RGB color input (list of 0-1 floats, or #RRGGBB string)."""
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


def perform_edits(input_path, output_path, edits):
    doc = fitz.open(input_path)

    # Group edits by page
    by_page = {}
    for e in edits:
        try:
            p = int(e.get('page', 1))
        except Exception:
            continue
        by_page.setdefault(p, []).append(e)

    for page_num, page_edits in by_page.items():
        if page_num < 1 or page_num > len(doc):
            continue
        page = doc[page_num - 1]

        # -----------------------------------------------------------------
        # Step 1: Redact every old text span on this page
        # White fill (or provided bg color) hides the original glyphs.
        # -----------------------------------------------------------------
        for e in page_edits:
            bbox = e.get('bbox')
            if not bbox or len(bbox) != 4:
                continue

            x0, y0, x1, y1 = [float(v) for v in bbox]
            if x1 < x0:
                x0, x1 = x1, x0
            if y1 < y0:
                y0, y1 = y1, y0

            # Small padding to swallow anti-aliased edges of the old glyphs
            rect = fitz.Rect(x0 - 0.5, y0 - 1.0, x1 + 1.0, y1 + 0.5)

            bg = to_color_tuple(e.get('bgColor', [1.0, 1.0, 1.0]))
            try:
                page.add_redact_annot(rect, fill=bg)
            except Exception:
                pass

        if page_edits:
            try:
                # images=NONE  → don't erase images beneath text
                page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
            except Exception:
                pass

        # -----------------------------------------------------------------
        # Step 2: Insert the new text with matching style
        # -----------------------------------------------------------------
        for e in page_edits:
            new_text = e.get('newText')
            if new_text is None:
                continue
            new_text = str(new_text)
            if new_text.strip() == '':
                continue  # user deleted the text — redaction alone suffices

            bbox = e.get('bbox')
            if not bbox or len(bbox) != 4:
                continue
            x0, y0, x1, y1 = [float(v) for v in bbox]
            if x1 < x0:
                x0, x1 = x1, x0
            if y1 < y0:
                y0, y1 = y1, y0

            font_size = float(e.get('fontSize', 11.0))
            if font_size <= 0:
                font_size = 11.0
            font_name = e.get('fontName', 'Helvetica')
            color = to_color_tuple(e.get('color', [0.0, 0.0, 0.0]))
            align = (e.get('align') or 'left').lower()

            font_code = resolve_font_code(font_name)

            # Baseline approx: bottom of bbox minus a fraction of font size.
            # Most fonts put the baseline ~0.2 * size above bbox bottom.
            baseline_y = y1 - 0.2 * font_size
            point = fitz.Point(x0, baseline_y)

            drawn = False

            # For right/center alignment use textbox
            if align in ('right', 'center') and (x1 - x0) > 5:
                try:
                    rect = fitz.Rect(x0, y0, x1, y1)
                    align_enum = fitz.TEXT_ALIGN_RIGHT if align == 'right' else fitz.TEXT_ALIGN_CENTER
                    page.insert_textbox(
                        rect,
                        new_text,
                        fontname=font_code,
                        fontsize=font_size,
                        color=color,
                        align=align_enum,
                    )
                    drawn = True
                except Exception:
                    drawn = False

            # Default: plain insert_text
            if not drawn:
                try:
                    page.insert_text(
                        point,
                        new_text,
                        fontname=font_code,
                        fontsize=font_size,
                        color=color,
                        render_mode=0,
                    )
                except Exception:
                    # Last-resort fallback: Helvetica
                    try:
                        page.insert_text(
                            point,
                            new_text,
                            fontname='helv',
                            fontsize=font_size,
                            color=color,
                            render_mode=0,
                        )
                    except Exception:
                        pass

    doc.save(output_path, garbage=4, deflate=True, clean=True)
    doc.close()


if __name__ == '__main__':
    if len(sys.argv) < 4:
        sys.stderr.write("Usage: python convert_edit_pdf.py <input.pdf> <output.pdf> <edits.json>\n")
        sys.exit(1)

    try:
        with open(sys.argv[3], 'r', encoding='utf-8') as f:
            edits = json.load(f)
        perform_edits(sys.argv[1], sys.argv[2], edits)
        sys.exit(0)
    except Exception as exc:
        sys.stderr.write(f"Edit PDF error: {str(exc)}\n")
        sys.exit(1)