from services.crisis_rag import chunk_text


def test_chunk_text_empty():
    assert chunk_text("") == []


def test_chunk_text_produces_overlapping_chunks():
    text = "A" * 2500
    chunks = chunk_text(text, max_chars=900, overlap=120)
    assert len(chunks) >= 3
    # First chunk length should be near max_chars
    assert 800 <= len(chunks[0]) <= 900
    # Overlap means chunk 2 begins with content that appeared near the end of chunk 1
    assert chunks[0][-50:] in chunks[1]

