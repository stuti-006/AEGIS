"""
Crisis RAG (Retrieval-Augmented Generation)

This makes the crisis chatbot more robust than "just a prompt" by grounding it
in a local, vetted knowledge base (markdown files) and retrieving relevant
snippets per user message.
"""

from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


def _safe_read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""


def chunk_text(text: str, *, max_chars: int = 900, overlap: int = 120) -> List[str]:
    """Split text into overlapping chunks (character-based)."""
    text = (text or "").strip()
    if not text:
        return []

    # Normalize whitespace
    text = "\n".join(line.rstrip() for line in text.splitlines()).strip()

    chunks: List[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(n, start + max_chars)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= n:
            break
        start = max(0, end - overlap)
    return chunks


@dataclass(frozen=True)
class KBChunk:
    source: str
    title: str
    text: str


class CrisisRAG:
    """
    Local KB + embeddings index (built on-demand).

    Files:
      - KB markdown: backend/data/crisis_kb/*.md
      - Index: backend/data/crisis_kb_index.npz + backend/data/crisis_kb_index.json
    """

    def __init__(
        self,
        *,
        kb_dir: Path,
        index_npz: Path,
        embed_model: str = "sentence-transformers/all-MiniLM-L6-v2",
    ) -> None:
        self.kb_dir = kb_dir
        self.index_npz = index_npz
        self.index_meta = index_npz.with_suffix(".json")
        self.embed_model = embed_model

        self._lock = threading.Lock()
        self._model = None
        self._embeddings = None
        self._chunks: List[KBChunk] = []

    def _kb_files(self) -> List[Path]:
        if not self.kb_dir.exists():
            return []
        return sorted([p for p in self.kb_dir.glob("*.md") if p.is_file()])

    def _index_is_fresh(self) -> bool:
        if not self.index_npz.exists() or not self.index_meta.exists():
            return False
        idx_mtime = self.index_npz.stat().st_mtime
        for p in self._kb_files():
            if p.stat().st_mtime > idx_mtime:
                return False
        return True

    def _load_model(self):
        if self._model is not None:
            return self._model

        if os.getenv("CRISIS_RAG_DISABLE", "").strip() == "1":
            self._model = False  # sentinel meaning "disabled"
            return self._model

        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(self.embed_model)
        return self._model

    def _load_or_build(self) -> None:
        if self._embeddings is not None and self._chunks:
            return

        with self._lock:
            if self._embeddings is not None and self._chunks:
                return

            files = self._kb_files()
            if not files:
                self._chunks = []
                self._embeddings = []
                return

            if self._index_is_fresh():
                try:
                    import numpy as np

                    data = np.load(self.index_npz, allow_pickle=False)
                    self._embeddings = data["embeddings"]
                    meta = json.loads(_safe_read_text(self.index_meta) or "{}")
                    self._chunks = [
                        KBChunk(source=c["source"], title=c["title"], text=c["text"])
                        for c in meta.get("chunks", [])
                    ]
                    if self._chunks:
                        return
                except Exception:
                    self._embeddings = None
                    self._chunks = []

            # Build chunks
            chunks: List[KBChunk] = []
            for p in files:
                raw = _safe_read_text(p)
                title = p.stem.replace("_", " ").title()
                for c in chunk_text(raw):
                    chunks.append(KBChunk(source=p.name, title=title, text=c))

            model = self._load_model()
            if model is False:
                self._chunks = chunks
                self._embeddings = []
                return

            import numpy as np

            texts = [c.text for c in chunks]
            emb = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)

            self._chunks = chunks
            self._embeddings = emb

            # Persist for faster startups (non-fatal if it fails)
            try:
                self.index_npz.parent.mkdir(parents=True, exist_ok=True)
                np.savez_compressed(self.index_npz, embeddings=emb)
                self.index_meta.write_text(
                    json.dumps(
                        {
                            "embed_model": self.embed_model,
                            "chunks": [
                                {"source": c.source, "title": c.title, "text": c.text}
                                for c in chunks
                            ],
                        },
                        ensure_ascii=False,
                    ),
                    encoding="utf-8",
                )
            except Exception:
                pass

    def retrieve(self, query: str, *, k: int = 4) -> List[Dict[str, Any]]:
        self._load_or_build()
        query = (query or "").strip()
        if not query or not self._chunks:
            return []

        # If embeddings are disabled/unavailable, return the first few chunks.
        if self._embeddings == []:
            return [
                {"score": None, "source": c.source, "title": c.title, "text": c.text}
                for c in self._chunks[:k]
            ]

        model = self._load_model()
        if model is False:
            return []

        import numpy as np

        q = model.encode([query], convert_to_numpy=True, normalize_embeddings=True)[0]
        emb = self._embeddings
        scores = emb @ q  # cosine similarity for normalized vectors
        top_idx = np.argsort(-scores)[:k]

        out: List[Dict[str, Any]] = []
        for i in top_idx:
            c = self._chunks[int(i)]
            out.append(
                {
                    "score": float(scores[int(i)]),
                    "source": c.source,
                    "title": c.title,
                    "text": c.text,
                }
            )
        return out


_singleton: Optional[CrisisRAG] = None


def get_crisis_rag() -> CrisisRAG:
    global _singleton
    if _singleton is None:
        base = Path(__file__).resolve().parents[1]  # backend/
        kb_dir = base / "data" / "crisis_kb"
        index_npz = base / "data" / "crisis_kb_index.npz"
        _singleton = CrisisRAG(kb_dir=kb_dir, index_npz=index_npz)
    return _singleton

