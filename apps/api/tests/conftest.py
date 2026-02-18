import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock
import json
import base64

from main import app


def make_firebase_token(user_id: str = "test-user-123", email: str = "test@example.com") -> str:
    """Create a mock Firebase JWT token for testing."""
    header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({
        "user_id": user_id,
        "email": email,
        "iss": "https://securetoken.google.com/test-project",
    }).encode()).decode().rstrip("=")
    signature = base64.urlsafe_b64encode(b"fake-signature").decode().rstrip("=")
    return f"{header}.{payload}.{signature}"


@pytest.fixture
def mock_token():
    return make_firebase_token()


@pytest.fixture
def auth_headers(mock_token):
    return {"Authorization": f"Bearer {mock_token}"}


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
