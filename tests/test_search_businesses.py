import pytest
from unittest.mock import patch, MagicMock
from voyageai import Client as VoyageClient


@pytest.mark.asyncio
async def test_search_businesses_success(client):
    """Тест успешного поиска бизнесов с моками Voyage AI."""
    # Мокаем Voyage AI клиент
    with patch.object(VoyageClient, 'embed') as mock_embed:
        # Настраиваем мок для возврата тестовых embeddings
        mock_response = MagicMock()
        mock_response.embeddings = [[0.1] * 1024]  # 1024 измерения для voyage-large-2
        mock_embed.return_value = mock_response

        # Тестовый запрос
        response = await client.post(
            "/search/businesses",
            json={"query": "coffee shop", "limit": 5}
        )

        # Проверки
        assert response.status_code == 200
        data = response.json()
        assert "businesses" in data
        assert isinstance(data["businesses"], list)

        # Проверяем, что Voyage AI был вызван с правильными параметрами
        mock_embed.assert_called_once()
        call_args = mock_embed.call_args
        assert call_args[1]["texts"] == ["coffee shop"]
        assert call_args[1]["model"] == "voyage-large-2"


@pytest.mark.asyncio
async def test_search_businesses_empty_query(client):
    """Тест поиска с пустой строкой (Voyage AI гайдлайн)."""
    with patch.object(VoyageClient, 'embed') as mock_embed:
        mock_response = MagicMock()
        mock_response.embeddings = [[0.0] * 1024]
        mock_embed.return_value = mock_response

        response = await client.post(
            "/search/businesses",
            json={"query": "", "limit": 5}
        )

        # Проверяем обработку пустой строки
        assert response.status_code == 200
        data = response.json()
        assert "businesses" in data
        # Возможно, возвращает пустой список или специальное сообщение


@pytest.mark.asyncio
async def test_search_businesses_invalid_input(client):
    """Тест валидации входных данных (Pydantic гайдлайн)."""
    # Пустое тело
    response = await client.post("/search/businesses", json={})
    assert response.status_code == 422  # Validation error

    # Неверный тип данных
    response = await client.post(
        "/search/businesses",
        json={"query": 123, "limit": "not_a_number"}
    )
    assert response.status_code == 422