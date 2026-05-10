"""OS keychain wrapper — stores sensitive secrets in macOS Keychain, Windows
Credential Manager, or Linux SecretService.  Falls back to env vars when
the keyring backend is unavailable (CI, headless servers, etc.)."""
import os

_SERVICE = "StudyBuddy"

try:
    import keyring as _kr
    # Trigger a lightweight operation to confirm the backend is reachable.
    _kr.get_password(_SERVICE, "_probe")
    _KEYRING_OK = True
except Exception:
    _KEYRING_OK = False


def set_secret(key: str, value: str | None) -> None:
    """Store *value* under *key* in the OS keychain (no-op if value is blank)."""
    if not _KEYRING_OK:
        return
    if value:
        _kr.set_password(_SERVICE, key, value)
    else:
        try:
            _kr.delete_password(_SERVICE, key)
        except Exception:
            pass


def get_secret(key: str) -> str | None:
    """Return the stored value, trying keychain then env var as fallback."""
    if _KEYRING_OK:
        try:
            val = _kr.get_password(_SERVICE, key)
            if val:
                return val
        except Exception:
            pass
    # Fallback: uppercase env var (e.g. "anthropic_api_key" → ANTHROPIC_API_KEY)
    return os.getenv(key.upper()) or None


def has_secret(key: str) -> bool:
    return bool(get_secret(key))
