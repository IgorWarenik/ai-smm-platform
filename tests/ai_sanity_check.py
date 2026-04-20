import os
import time
import pytest
import voyageai


def test_voyage_ai_sanity_check():
    """
    Перед любым коммитом, связанным с RAG, запусти pytest tests/ai_sanity_check.py.

    Этот тест проверяет:

    Связь с API Voyage.

    Корректность размерности получаемого вектора.

    Скорость ответа (не более 2 секунд).
    """
    api_key = os.getenv("VOYAGE_API_KEY")
    assert api_key is not None, "VOYAGE_API_KEY not set"

    client = voyageai.Client(api_key=api_key)

    text = "test embedding"

    start_time = time.time()
    response = client.embed(texts=[text], model="voyage-large-2")
    end_time = time.time()

    # Проверка связи: если дошло сюда, значит OK

    # Корректность размерности: voyage-large-2 имеет 1024 измерения
    assert len(response.embeddings[0]) == 1024, f"Expected 1024 dimensions, got {len(response.embeddings[0])}"

    # Скорость ответа
    duration = end_time - start_time
    assert duration <= 2.0, f"Response took {duration:.2f} seconds, expected <= 2.0 seconds"