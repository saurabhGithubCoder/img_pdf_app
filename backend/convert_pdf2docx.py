import sys
import os
import pdfplumber
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_border(cell, **kwargs):
    """
    Apply clean standard borders that Word natively accepts.
    """
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(r'''
        <w:tcBorders {} >
            <w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
            <w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
            <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
            <w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
        </w:tcBorders>
    '''.format(nsdecls('w')))
    tcPr.append(tcBorders)

def convert_pdf_to_valid_docx(pdf_path, docx_path):
    doc = Document()
    
    # Configure 0.75" standard page margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    with pdfplumber.open(pdf_path) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            if page_idx > 0:
                doc.add_page_break()

            # 1. Extract and render native tables cleanly
            tables = page.extract_tables()
            processed_table_text = set()

            if tables:
                for table_data in tables:
                    if not table_data or len(table_data) == 0:
                        continue
                    
                    # Filter empty rows
                    valid_rows = [row for row in table_data if any(cell and str(cell).strip() for cell in row)]
                    if not valid_rows:
                        continue

                    num_cols = max(len(row) for row in valid_rows)
                    docx_table = doc.add_table(rows=len(valid_rows), cols=num_cols)
                    docx_table.alignment = WD_TABLE_ALIGNMENT.CENTER
                    docx_table.autofit = True

                    for r_idx, row in enumerate(valid_rows):
                        for c_idx, cell_value in enumerate(row):
                            if c_idx < num_cols:
                                cell = docx_table.cell(r_idx, c_idx)
                                text = str(cell_value).strip() if cell_value else ""
                                cell.text = text
                                set_cell_border(cell)
                                
                                # Track text to prevent duplicate paragraph generation
                                if text:
                                    for line in text.split('\n'):
                                        processed_table_text.add(line.strip())

                    doc.add_paragraph() # Spacing below table

            # 2. Extract flow paragraphs that are outside tables
            text = page.extract_text(layout=False)
            if text:
                lines = text.split('\n')
                for line in lines:
                    cleaned_line = line.strip()
                    if not cleaned_line:
                        continue
                    
                    # Skip lines already captured inside tables
                    if cleaned_line in processed_table_text:
                        continue

                    p = doc.add_paragraph()
                    run = p.add_run(cleaned_line)
                    run.font.name = 'Calibri'
                    run.font.size = Pt(11)
                    p.paragraph_format.space_after = Pt(3)
                    p.paragraph_format.space_before = Pt(0)
                    p.paragraph_format.line_spacing = 1.15

    doc.save(docx_path)
    return 0

if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(1)
    
    in_pdf = sys.argv[1]
    out_docx = sys.argv[2]
    
    try:
        status = convert_pdf_to_valid_docx(in_pdf, out_docx)
        sys.exit(status)
    except Exception as e:
        sys.stderr.write(f"Direct builder error: {str(e)}\n")
        sys.exit(1)