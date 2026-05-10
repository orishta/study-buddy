"""AI-agnostic client — routes to Anthropic, OpenAI, or local Ollama based on
which keys are configured in the OS keychain or environment variables.

Priority order: Anthropic → OpenAI → Ollama (local, always available).
"""
import httpx

from services import ollama_client
from services.keyring_store import get_secret

# Models to use per remote provider (small/fast tiers to keep costs low)
_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
_OPENAI_MODEL = "gpt-4o-mini"


def _active_provider() -> str:
    if get_secret("anthropic_api_key"):
        return "anthropic"
    if get_secret("openai_api_key"):
        return "openai"
    return "ollama"


async def _generate_anthropic(prompt: str, system: str) -> str:
    key = get_secret("anthropic_api_key")
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": _ANTHROPIC_MODEL,
                "max_tokens": 1024,
                "system": system or "You are a helpful assistant.",
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        resp.raise_for_status()
        return resp.json()["content"][0]["text"]


async def _generate_openai(prompt: str, system: str) -> str:
    key = get_secret("openai_api_key")
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={
                "model": _OPENAI_MODEL,
                "max_tokens": 1024,
                "messages": [
                    {"role": "system", "content": system or "You are a helpful assistant."},
                    {"role": "user", "content": prompt},
                ],
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def generate(prompt: str, system: str = "") -> str:
    """Generate a completion. Uses the first configured provider."""
    provider = _active_provider()
    if provider == "anthropic":
        return await _generate_anthropic(prompt, system)
    if provider == "openai":
        return await _generate_openai(prompt, system)
    return await ollama_client.generate(prompt, system)


async def chat(messages: list[dict], system: str = "") -> str:
    """Multi-turn chat. Uses the first configured provider."""
    provider = _active_provider()
    if provider == "anthropic":
        # Flatten to a single prompt for simplicity (Anthropic supports full multi-turn,
        # but the callers here are single-turn mentor chats)
        combined = "\n".join(
            f"{m['role'].capitalize()}: {m['content']}" for m in messages
        )
        return await _generate_anthropic(combined, system)
    if provider == "openai":
        key = get_secret("openai_api_key")
        msgs = []
        if system:
            msgs.append({"role": "system", "content": system})
        msgs.extend(messages)
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": _OPENAI_MODEL, "max_tokens": 1024, "messages": msgs},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
    return await ollama_client.chat(messages, system)


def provider_status() -> dict:
    """Return which provider is active and which keys are configured."""
    return {
        "active_provider": _active_provider(),
        "anthropic_key_set": bool(get_secret("anthropic_api_key")),
        "openai_key_set": bool(get_secret("openai_api_key")),
    }
