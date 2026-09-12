import sys
import os
import re
import fitz  # PyMuPDF

def format_gfm_table(table_data):
    """
    Formats extracted table data into GitHub Flavored Markdown table syntax.
    Enforces pipe framing, header separation, and sanitizes line breaks/pipes inside cells.
    """
    if not table_data or len(table_data) == 0:
        return ""
    
    cleaned_rows = []
    for row in table_data:
        # Sanitize internal pipe characters and line breaks
        cells = [
            str(c or "").replace("|", "\\|").replace("\n", " ").strip()
            for c in row
        ]
        if any(cells):
            cleaned_rows.append(cells)
            
    if not cleaned_rows:
        return ""
        
    col_count = max(len(r) for r in cleaned_rows)
    # Pad uneven rows
    normalized = [r + [""] * (col_count - len(r)) for r in cleaned_rows]

    col_widths = [3] * col_count
    for row in normalized:
        for i, cell in enumerate(row):
            col_widths[i] = max(col_widths[i], len(cell))

    lines = []
    # Header row
    header = normalized[0]
    header_str = "| " + " | ".join(header[i].ljust(col_widths[i]) for i in range(col_count)) + " |"
    # GFM delimiter row
    delimiter_str = "| " + " | ".join("-" * max(3, col_widths[i]) for i in range(col_count)) + " |"
    lines.append(header_str)
    lines.append(delimiter_str)

    # Body rows
    for row in normalized[1:]:
        row_str = "| " + " | ".join(row[i].ljust(col_widths[i]) for i in range(col_count)) + " |"
        lines.append(row_str)

    return "\n\n" + "\n".join(lines) + "\n\n"

def is_span_bold(span):
    font_name = span.get("font", "").lower()
    flags = span.get("flags", 0)
    return bool(flags & 2 or any(k in font_name for k in ["bold", "black", "heavy", "medium", "semibold", "bld"]))

def is_span_italic(span):
    font_name = span.get("font", "").lower()
    flags = span.get("flags", 0)
    return bool(flags & 1 or any(k in font_name for k in ["italic", "oblique", "it"]))

def clean_markdown_inline(text):
    """
    Cleans up broken markdown delimiters caused by span merges (e.g. ****, ** **, unclosed tokens).
    """
    # Replace adjacent markdown boundaries like ** ** with single space
    text = re.sub(r'\*\*\s+\*\*', ' ', text)
    # Fix instances of triple/quad asterisks left over
    text = re.sub(r'\*{4,}', '**', text)
    # Ensure punctuation right outside asterisks is preserved cleanly
    text = re.sub(r'\*\*\s+', ' **', text)
    text = re.sub(r'\s+\*\*', '** ', text)
    return text.strip()

def convert_pdf_to_markdown(pdf_path, md_path):
    doc = fitz.open(pdf_path)

    # -------------------------------------------------------------
    # Step 1: Collect font statistics across all pages for scale
    # -------------------------------------------------------------
    font_sizes = []
    for page in doc:
        blocks = page.get_text("dict", flags=fitz.TEXT_DEHYPHENATE).get("blocks", [])
        for b in blocks:
            if b.get("type") == 0:
                for line in b.get("lines", []):
                    for span in line.get("spans", []):
                        txt = span.get("text", "").strip()
                        if txt:
                            font_sizes.append(round(span.get("size", 10.0), 1))

    # Compute base font size (document body text)
    base_size = 10.0
    if font_sizes:
        base_size = max(set(font_sizes), key=font_sizes.count)

    # Distinct GFM Heading thresholds (#, ##, ###, ####, #####)
    h1_limit = base_size * 1.55
    h2_limit = base_size * 1.30
    h3_limit = base_size * 1.15
    h4_limit = base_size * 1.05

    output = []
    doc_name = os.path.splitext(os.path.basename(pdf_path))[0]
    output.append(f"# {doc_name}\n\n")

    # -------------------------------------------------------------
    # Step 2: Parse blocks page by page with spatial layout
    # -------------------------------------------------------------
    for page_idx, page in enumerate(doc):
        tabs = page.find_tables()
        handled_table_indices = set()

        text_page = page.get_text("dict", flags=fitz.TEXT_DEHYPHENATE)
        blocks = text_page.get("blocks", [])

        # Sort blocks vertically first, then horizontally
        blocks = sorted(blocks, key=lambda b: (b.get("bbox", [0, 0, 0, 0])[1], b.get("bbox", [0, 0, 0, 0])[0]))

        for b in blocks:
            bbox = b.get("bbox", (0, 0, 0, 0))
            b_center_y = (bbox[1] + bbox[3]) / 2.0

            # 1. Check if block resides inside an extracted table
            table_match_idx = None
            for idx, tab in enumerate(tabs):
                tb = tab.bbox
                if tb[0] <= bbox[0] and tb[2] >= bbox[2] and tb[1] <= b_center_y <= tb[3]:
                    table_match_idx = idx
                    break

            if table_match_idx is not None:
                if table_match_idx not in handled_table_indices:
                    handled_table_indices.add(table_match_idx)
                    table_obj = tabs[table_match_idx]
                    table_md = format_gfm_table(table_obj.extract())
                    if table_md.strip():
                        output.append(table_md)
                continue

            # 2. Regular Text Processing
            if b.get("type") == 0:
                lines = b.get("lines", [])
                if not lines:
                    continue

                paragraph_chunks = []

                for line in lines:
                    spans = line.get("spans", [])
                    if not spans:
                        continue

                    # Consolidate adjoining spans with identical styles to prevent broken ** tags
                    consolidated = []
                    for s in spans:
                        raw = s.get("text", "")
                        if not raw:
                            continue

                        bold = is_span_bold(s)
                        italic = is_span_italic(s)
                        size = round(s.get("size", base_size), 1)

                        if consolidated and consolidated[-1]["bold"] == bold and consolidated[-1]["italic"] == italic and abs(consolidated[-1]["size"] - size) < 0.3:
                            consolidated[-1]["text"] += raw
                        else:
                            consolidated.append({
                                "text": raw,
                                "bold": bold,
                                "italic": italic,
                                "size": size
                            })

                    # Calculate dominant metrics for the line
                    line_text_parts = []
                    max_line_size = max(c["size"] for c in consolidated) if consolidated else base_size
                    all_bold = all(c["bold"] for c in consolidated if c["text"].strip())

                    for c in consolidated:
                        chunk = c["text"]
                        if not chunk:
                            continue

                        # Extract leading and trailing whitespace so asterisks attach directly to words
                        leading_ws = len(chunk) - len(chunk.lstrip())
                        trailing_ws = len(chunk) - len(chunk.rstrip())
                        core_text = chunk.strip()

                        if core_text:
                            # Apply markdown inline formatting strictly to the core text
                            if c["bold"] and c["italic"]:
                                formatted_core = f"***{core_text}***"
                            elif c["bold"]:
                                formatted_core = f"**{core_text}**"
                            elif c["italic"]:
                                formatted_core = f"*{core_text}*"
                            else:
                                formatted_core = core_text
                            
                            line_text_parts.append((" " * leading_ws) + formatted_core + (" " * trailing_ws))
                        else:
                            line_text_parts.append(chunk)

                    raw_line = "".join(line_text_parts).strip()
                    if not raw_line:
                        continue

                    raw_line = clean_markdown_inline(raw_line)

                    # Determine if the entire line is a Heading based on size
                    clean_plain_line = re.sub(r'[*_`]', '', raw_line).strip()

                    # GFM Heading rules: heading token + space, preceded and followed by empty lines
                    if max_line_size >= h1_limit:
                        paragraph_chunks.append(f"\n# {clean_plain_line}\n")
                    elif max_line_size >= h2_limit:
                        paragraph_chunks.append(f"\n## {clean_plain_line}\n")
                    elif max_line_size >= h3_limit:
                        paragraph_chunks.append(f"\n### {clean_plain_line}\n")
                    elif max_line_size >= h4_limit and all_bold:
                        paragraph_chunks.append(f"\n#### {clean_plain_line}\n")
                    elif raw_line.startswith(("•", "·", "▪", "⁃")):
                        # GFM Bullet list: must be "* " or "- "
                        item_text = re.sub(r'^[•·▪⁃\s]+', '', raw_line)
                        paragraph_chunks.append(f"- {item_text}")
                    elif re.match(r'^\d+[\.\)]\s', raw_line):
                        # GFM Ordered list: "1. text"
                        cleaned_ordered = re.sub(r'^(\d+)[\.\)]\s*', r'\1. ', raw_line)
                        paragraph_chunks.append(cleaned_ordered)
                    else:
                        paragraph_chunks.append(raw_line)

                if paragraph_chunks:
                    # Join lines inside the paragraph block
                    block_content = "\n".join(paragraph_chunks)
                    # Ensure headings are cleanly separated by blank lines
                    block_content = re.sub(r'\n{3,}', '\n\n', block_content)
                    output.append(block_content.strip() + "\n\n")

    doc.close()

    final_md = "".join(output)
    # Normalize excess blank lines according to standard Markdown linting
    final_md = re.sub(r'\n{3,}', '\n\n', final_md).strip() + "\n"

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(final_md)

    return 0

if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.stderr.write("Usage: python convert_pdf2md.py <input.pdf> <output.md>\n")
        sys.exit(1)

    try:
        sys.exit(convert_pdf_to_markdown(sys.argv[1], sys.argv[2]))
    except Exception as e:
        sys.stderr.write(f"Markdown conversion error: {str(e)}\n")
        sys.exit(1)