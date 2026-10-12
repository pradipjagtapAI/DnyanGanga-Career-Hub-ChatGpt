import hashlib
import io
import unittest
from unittest.mock import patch
import zipfile
import processor


def document(extra=None, content=None):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr("_rels/.rels", "<Relationships/>")
        archive.writestr("word/document.xml", content or '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Python tooling</w:t></w:r></w:p></w:document>')
        if extra:
            archive.writestr(extra[0], extra[1])
    return stream.getvalue()


class ProcessorPolicyTests(unittest.TestCase):
    def test_extracted_fields_copy_only_labeled_source_sections(self):
        text = "Jane Example\nSummary\nEngineering tooling\nExperience\nExample Ltd — Engineer 2021–2023\nSkills\nPython, SQL\nEducation\nUser-supplied degree wording"
        fields = processor.extract_labeled_fields(text)
        self.assertEqual(fields["skills"], ["Python", "SQL"])
        self.assertEqual(fields["workHistory"], "Example Ltd — Engineer 2021–2023")
        self.assertNotIn("fullName", fields)
        self.assertNotIn("email", fields)

    def test_unlabeled_source_never_invents_profile_fields(self):
        self.assertEqual(processor.extract_labeled_fields("Unlabeled source\nPython project work"), {})

    def test_real_ooxml_text_extraction(self):
        self.assertEqual(processor.extract_docx(document()), "Python tooling")

    def test_traversal_macros_and_xml_entities_rejected(self):
        for value in (("../file", "x"), ("word/vbaProject.bin", "x"), ("word/settings.xml", '<!DOCTYPE foo [<!ENTITY x "y">]><foo/>')):
            with self.subTest(value=value), self.assertRaises(ValueError):
                processor.extract_docx(document(value))

    def test_external_embedded_relationship_rejected(self):
        with self.assertRaises(ValueError):
            processor.extract_docx(document(("word/_rels/document.xml.rels", '<Relationships><Relationship TargetMode="External" Type="attachedTemplate" Target="http://private/"/></Relationships>')))

    def test_decompression_budget_rejected_before_inflate(self):
        with self.assertRaises(ValueError):
            processor.extract_docx(document(("word/large.xml", "a" * 2_000_000)))

    def test_hash_mismatch_never_reaches_scanner(self):
        with patch.object(processor, "scan_private") as scanner:
            with self.assertRaises(ValueError):
                processor.process(b"PDF", "application/pdf", "0" * 64)
            scanner.assert_not_called()

    def test_scanner_failure_never_reaches_converter(self):
        data = b"%PDF-1.7 source"
        with patch.object(processor, "ensure_fresh_signatures"), patch.object(processor, "scan_private", side_effect=ValueError("not clean")), patch.object(processor.subprocess, "run") as converter:
            with self.assertRaises(ValueError):
                processor.process(data, "application/pdf", hashlib.sha256(data).hexdigest())
            converter.assert_not_called()


if __name__ == "__main__":
    unittest.main()
