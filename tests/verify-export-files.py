"""Independent parsing/render verification for synthetic generated files only."""
from pathlib import Path
from zipfile import ZipFile
import json
import xml.etree.ElementTree as ET
from pypdf import PdfReader
import fitz

root = Path(__file__).resolve().parent.parent
directory = root / "work" / "export-verification"
expected = (directory / "expected.txt").read_text(encoding="utf-8")
results = []
for template in ["classic", "modern", "compact"]:
    pdf = directory / (template + ".pdf")
    reader = PdfReader(pdf)
    extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
    for line in expected.splitlines():
        if line.strip():
            assert " ".join(line.split()) in " ".join(extracted.split()), f"Lost PDF text: {template}"
    assert len(reader.pages) == 1, f"Unexpected synthetic resume pagination: {template}"
    document = fitz.open(pdf)
    page = document[0]
    # Verify content stays inside page, then render for separate human review.
    for block in page.get_text("blocks"):
        assert 0 <= block[0] < block[2] <= page.rect.width
        assert 0 <= block[1] < block[3] <= page.rect.height
    page.get_pixmap(matrix=fitz.Matrix(1.3, 1.3)).save(directory / (template + ".png"))
    with ZipFile(directory / (template + ".docx")) as archive:
        assert not any("vbaProject" in item or item.endswith(".exe") for item in archive.namelist())
        tree = ET.fromstring(archive.read("word/document.xml"))
        namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        value = "\n".join("".join(paragraph.itertext()) for paragraph in tree.findall(".//w:p", namespace))
        for line in expected.splitlines():
            if line.strip():
                assert line in value, f"Lost DOCX text: {template}"
        assert "ज्ञानगंगा" in value
        assert "<script>alert(1)</script>" in value, "Script-like text must remain literal document text"
        styles = archive.read("word/styles.xml").decode("utf-8")
        assert "Heading2" in styles
        assert not any(b'TargetMode="External"' in archive.read(name) for name in archive.namelist() if name.endswith(".rels"))
    results.append({"template": template, "pdfPages": len(reader.pages), "pdfTextPreserved": True,
                    "docxUnicodeAndLiteralTextPreserved": True, "embeddedMacrosOrExternalRelations": False})
result = {"passed": True, "scope": "Synthetic fixtures, pypdf text extraction, fitz page bounds/rendering, OOXML parsing; not every employer ATS or Office renderer", "templates": results}
(root / "docs" / "platform-export-results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result))
