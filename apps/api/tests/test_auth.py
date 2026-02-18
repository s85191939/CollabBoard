import pytest
import json
import base64


@pytest.mark.anyio
async def test_ai_command_requires_auth(client):
    """Test that AI command endpoint requires authorization header."""
    response = await client.post("/api/ai/command", json={
        "boardId": "board-123",
        "prompt": "test",
    })
    assert response.status_code == 422  # missing required header


@pytest.mark.anyio
async def test_ai_command_rejects_invalid_token(client):
    """Test that AI command rejects malformed tokens."""
    response = await client.post(
        "/api/ai/command",
        json={"boardId": "board-123", "prompt": "test"},
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401
    assert "Invalid token" in response.json()["detail"]


@pytest.mark.anyio
async def test_ai_command_rejects_token_without_user_id(client):
    """Test that token without user_id is rejected."""
    # Create token with no user_id
    header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({
        "email": "test@example.com",
        # No user_id field
    }).encode()).decode().rstrip("=")
    sig = base64.urlsafe_b64encode(b"fake").decode().rstrip("=")
    token = f"{header}.{payload}.{sig}"

    response = await client.post(
        "/api/ai/command",
        json={"boardId": "board-123", "prompt": "test"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 401
    assert "No user_id" in response.json()["detail"]


@pytest.mark.anyio
async def test_valid_token_is_accepted(client, auth_headers):
    """Test that a valid mock token passes auth (may fail at Claude API)."""
    from unittest.mock import patch, MagicMock

    # Mock the Anthropic client to avoid actual API calls
    mock_response = MagicMock()
    mock_response.stop_reason = "end_turn"
    mock_response.content = [MagicMock(type="text", text="Done!")]

    with patch("main.claude") as mock_claude:
        mock_claude.messages.create.return_value = mock_response
        response = await client.post(
            "/api/ai/command",
            json={"boardId": "board-123", "prompt": "create a sticky note"},
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
