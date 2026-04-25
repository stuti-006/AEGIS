"""
PDF evidence report generation service.
"""

import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

REPORTS_DIR = Path(__file__).resolve().parent.parent / "data" / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


class ReportService:
    """Create evidence PDFs from analysis payloads."""

    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.styles.add(
            ParagraphStyle(
                name="DocTitle",
                parent=self.styles["Title"],
                alignment=TA_CENTER,
                fontSize=18,
                leading=22,
                textColor=colors.HexColor("#0f172a"),
            )
        )
        self.styles.add(
            ParagraphStyle(
                name="SectionHeading",
                parent=self.styles["Heading2"],
                textColor=colors.HexColor("#0f172a"),
                spaceBefore=12,
                spaceAfter=8,
            )
        )
        self.styles.add(
            ParagraphStyle(
                name="SubsectionHeading",
                parent=self.styles["Heading3"],
                textColor=colors.HexColor("#0f172a"),
                spaceBefore=8,
                spaceAfter=4,
            )
        )
        self.styles.add(
            ParagraphStyle(
                name="BodySmall",
                parent=self.styles["BodyText"],
                fontSize=10,
                leading=14,
                textColor=colors.HexColor("#334155"),
            )
        )
        self.styles.add(
            ParagraphStyle(
                name="Muted",
                parent=self.styles["BodyText"],
                fontSize=9.5,
                leading=13,
                textColor=colors.HexColor("#475569"),
            )
        )

    def generate_pdf(self, analysis: Dict[str, Any]) -> str:
        """Generate a PDF report and return its filename."""
        analysis_id = self._safe_identifier(analysis.get("analysis_id") or "manual")
        filename = f"evidence_{analysis_id}.pdf"
        path = REPORTS_DIR / filename

        evidence = analysis.get("evidence") or {}
        legal_refs = evidence.get("legal_references") or analysis.get("legal_references") or []
        actions = analysis.get("actions") or analysis.get("recommendations") or []
        breakdown = analysis.get("breakdown") or analysis.get("risk_factors") or []
        summary = analysis.get("summary") or analysis.get("reason") or "No summary available."
        message = evidence.get("message") or analysis.get("message") or "Original message not available."
        threat_level = (
            (analysis.get("heatmap") or {}).get("threat_level")
            or analysis.get("threat_level")
            or (analysis.get("label") or "SAFE").upper()
        )
        risk_score = analysis.get("risk_score", "")
        confidence = analysis.get("confidence", "")
        patterns = analysis.get("patterns_detected") or []
        reporter = analysis.get("reporter") or {}
        reporter_email = reporter.get("email") or analysis.get("reporter_email") or ""
        reporter_user_id = reporter.get("user_id") or analysis.get("user_id") or ""
        generated_at = analysis.get("timestamp") or ""

        doc = SimpleDocTemplate(
            str(path),
            pagesize=A4,
            leftMargin=0.7 * inch,
            rightMargin=0.7 * inch,
            topMargin=0.7 * inch,
            bottomMargin=0.7 * inch,
        )

        # --- Document content (court-style / form-like) ---
        content: List[Any] = []

        content.append(Paragraph("INCIDENT REPORTING FORM", self.styles["DocTitle"]))
        content.append(Spacer(1, 0.12 * inch))
        content.append(
            Paragraph(
                self._escape(
                    f"AEGIS Evidence Report · Analysis ID: {analysis.get('analysis_id','N/A')} · Generated: {generated_at}"
                ),
                self.styles["Muted"],
            )
        )
        content.append(Spacer(1, 0.18 * inch))

        # Reporter / complainant block
        content.append(self._section_bar("Contact Information of the Reporter"))
        reporter_rows = [
            ["Name & Role/Title", ""],
            ["Email", reporter_email or ""],
            ["User ID", reporter_user_id or ""],
            ["Contact No.", ""],
            ["Address", ""],
        ]
        content.append(self._kv_table(reporter_rows))
        content.append(Spacer(1, 0.12 * inch))

        # Basic incident details
        content.append(self._section_bar("Basic Incident Details"))
        content.append(self._two_col_table([
            ("Threat Level", str(threat_level)),
            ("Risk Score", f"{risk_score} / 100" if risk_score != "" else ""),
            ("Confidence", self._fmt_confidence(confidence)),
            ("Detected Patterns", ", ".join(patterns) if patterns else ""),
            ("Summary", summary),
        ]))
        content.append(Spacer(1, 0.12 * inch))

        # Incident Type (checkboxes)
        flags = self._incident_flags(patterns=patterns, legal_refs=legal_refs, summary=summary)
        content.append(self._section_bar("Incident Type (tick all that apply)"))
        content.append(self._checkbox_grid(flags))
        content.append(Spacer(1, 0.12 * inch))

        # Evidence
        content.append(self._section_bar("Evidence (Original Message / Extract)"))
        content.append(self._boxed_paragraph(message))
        if analysis.get("ocr_text"):
            content.append(Spacer(1, 0.08 * inch))
            content.append(Paragraph("OCR Extract (if applicable)", self.styles["BodySmall"]))
            content.append(self._boxed_paragraph(str(analysis.get("ocr_text") or "")))
        content.append(Spacer(1, 0.12 * inch))

        # Breakdown
        if breakdown:
            content.append(self._section_bar("Analysis Findings"))
            bullets = []
            for item in breakdown:
                title = item.get("title") or item.get("factor", "unknown")
                desc = item.get("description", "")
                sev = (item.get("severity") or "medium").upper()
                bullets.append(f"{title} [{sev}] — {desc}")
            content.extend(self._bullets(bullets))
            content.append(Spacer(1, 0.12 * inch))

        # Legal refs
        if legal_refs:
            content.append(self._section_bar("Legal References (as detected)"))
            content.extend(self._bullets([str(x) for x in legal_refs]))
            content.append(Spacer(1, 0.12 * inch))

        # Actions
        if actions:
            content.append(self._section_bar("Recommended Immediate Actions"))
            steps: List[str] = []
            for a in actions:
                if isinstance(a, dict):
                    steps.append(f"{a.get('step','')}. {a.get('action','')}".strip(". "))
                else:
                    steps.append(str(a))
            content.extend(self._bullets(steps))
            content.append(Spacer(1, 0.12 * inch))

        # Declaration
        content.append(self._section_bar("Declaration"))
        content.append(
            Paragraph(
                self._escape(
                    "I declare that the information provided above is true to the best of my knowledge and is submitted for safety support / reporting purposes."
                ),
                self.styles["BodyText"],
            )
        )
        content.append(Spacer(1, 0.22 * inch))
        content.append(self._signature_table())

        doc.build(
            content,
            onFirstPage=self._draw_page,
            onLaterPages=self._draw_page,
        )
        return filename

    # ──────────────────────────────────────────────────────────────────
    # Layout helpers
    # ──────────────────────────────────────────────────────────────────
    def _draw_page(self, canv: Canvas, doc: SimpleDocTemplate):
        # Watermark
        canv.saveState()
        try:
            canv.setFillColor(colors.Color(0, 0, 0, alpha=0.05))
        except Exception:
            canv.setFillColor(colors.HexColor("#e2e8f0"))
        canv.setFont("Helvetica-Bold", 54)
        canv.translate(A4[0] / 2, A4[1] / 2)
        canv.rotate(30)
        canv.drawCentredString(0, 0, "AEGIS EVIDENCE")
        canv.restoreState()

        # Header line
        canv.saveState()
        canv.setStrokeColor(colors.HexColor("#CBD5E1"))
        canv.setLineWidth(0.8)
        canv.line(doc.leftMargin, A4[1] - doc.topMargin + 12, A4[0] - doc.rightMargin, A4[1] - doc.topMargin + 12)
        canv.restoreState()

        # Footer
        footer_y = doc.bottomMargin - 22
        canv.saveState()
        canv.setFont("Helvetica", 8.5)
        canv.setFillColor(colors.HexColor("#64748B"))
        page_text = f"Page {doc.page}"
        canv.drawRightString(A4[0] - doc.rightMargin, footer_y, page_text)

        left_x = doc.leftMargin
        text = "Report online: "
        canv.drawString(left_x, footer_y, text)
        x = left_x + canv.stringWidth(text, "Helvetica", 8.5)

        x = self._draw_link(canv, x, footer_y, "cybercrime.gov.in", "https://cybercrime.gov.in")
        sep = "  |  "
        canv.drawString(x, footer_y, sep)
        x += canv.stringWidth(sep, "Helvetica", 8.5)
        self._draw_link(canv, x, footer_y, "ncw.nic.in", "https://ncw.nic.in")
        canv.restoreState()

    def _draw_link(self, canv: Canvas, x: float, y: float, label: str, url: str) -> float:
        canv.setFillColor(colors.HexColor("#1D4ED8"))
        canv.drawString(x, y, label)
        w = canv.stringWidth(label, "Helvetica", 8.5)
        canv.linkURL(url, (x, y - 2, x + w, y + 10), relative=0)
        canv.setFillColor(colors.HexColor("#64748B"))
        return x + w

    def _section_bar(self, title: str):
        t = Table([[Paragraph(self._escape(title), self.styles["BodyText"])]], colWidths=[6.8 * inch])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#E2E8F0")),
                    ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0F172A")),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#94A3B8")),
                ]
            )
        )
        return t

    def _kv_table(self, rows: List[List[str]]):
        data = []
        for k, v in rows:
            data.append(
                [
                    Paragraph(self._escape(str(k)), self.styles["BodySmall"]),
                    Paragraph(self._escape(str(v)), self.styles["BodySmall"]),
                ]
            )
        t = Table(data, colWidths=[2.0 * inch, 4.8 * inch])
        t.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#94A3B8")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8FAFC")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        return t

    def _two_col_table(self, rows: List[Tuple[str, str]]):
        data = []
        for k, v in rows:
            data.append(
                [
                    Paragraph(self._escape(k), self.styles["BodySmall"]),
                    Paragraph(self._escape(v), self.styles["BodySmall"]),
                ]
            )
        t = Table(data, colWidths=[1.6 * inch, 5.2 * inch])
        t.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#94A3B8")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8FAFC")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        return t

    def _boxed_paragraph(self, text: str):
        p = Paragraph(self._escape(text).replace("\n", "<br/>"), self.styles["BodySmall"])
        t = Table([[p]], colWidths=[6.8 * inch])
        t.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#94A3B8")),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        return t

    def _signature_table(self):
        data = [
            ["Signature of Complainant/Reporter", "Date & Time"],
            ["", ""],
        ]
        t = Table(data, colWidths=[4.5 * inch, 2.3 * inch], rowHeights=[0.28 * inch, 0.55 * inch])
        t.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#94A3B8")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 9),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        return t

    def _bullets(self, items: List[str]):
        out = []
        for it in items:
            if not str(it).strip():
                continue
            out.append(Paragraph(self._escape(f"• {it}"), self.styles["BodyText"]))
        return out

    def _fmt_confidence(self, confidence: Any) -> str:
        try:
            # Your API returns 0..1 float
            c = float(confidence)
            if c <= 1.0:
                return f"{c * 100:.1f}%"
            return f"{c:.1f}%"
        except Exception:
            return str(confidence or "")

    def _incident_flags(self, *, patterns: List[str], legal_refs: List[str], summary: str) -> List[Tuple[str, bool]]:
        p = " ".join([str(x).lower() for x in (patterns or [])])
        l = " ".join([str(x).lower() for x in (legal_refs or [])])
        s = (summary or "").lower()

        def has(*keys: str) -> bool:
            return any(k in p or k in l or k in s for k in keys)

        flags = [
            ("Stalking / surveillance", has("stalk", "354d", "surveillance", "follow")),
            ("Harassment / abusive messages", has("harass", "abuse", "509", "obscene")),
            ("Threats / intimidation", has("threat", "intimid", "506", "kill", "hurt")),
            ("Blackmail / extortion", has("blackmail", "extort", "ransom")),
            ("Impersonation / identity theft", has("impersonat", "identity", "spoof")),
            ("Non-consensual intimate content", has("revenge", "nude", "intimate", "66e")),
            ("Doxxing / personal info sharing", has("dox", "address", "leak")),
            ("Scam / fraud", has("scam", "fraud", "phish")),
            ("Other", False),
        ]
        if not any(v for _, v in flags[:-1]):
            flags[-1] = ("Other", True)
        return flags

    def _checkbox_grid(self, flags: List[Tuple[str, bool]]):
        cells = []
        for label, checked in flags:
            mark = "[X]" if checked else "[ ]"
            cells.append(Paragraph(self._escape(f"{mark} {label}"), self.styles["BodySmall"]))

        # 2 columns grid
        rows = []
        for i in range(0, len(cells), 2):
            rows.append(cells[i : i + 2] + ([Paragraph("", self.styles["BodySmall"])] if i + 1 >= len(cells) else []))

        t = Table(rows, colWidths=[3.4 * inch, 3.4 * inch])
        t.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#94A3B8")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        return t

    def _paragraphs(self, lines: Iterable[Any]):
        return [
            Paragraph(self._escape(f"• {line}"), self.styles["BodyText"])
            for line in lines
            if str(line).strip()
        ]

    def _safe_identifier(self, value: str) -> str:
        return re.sub(r"[^a-zA-Z0-9_-]", "_", value)

    def _escape(self, value: Any) -> str:
        return escape(str(value or ""))
