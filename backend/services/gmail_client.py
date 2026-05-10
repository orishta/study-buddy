"""Gmail OAuth2 client — all processing stays local, no third-party cloud services."""
import asyncio
import base64
import email as email_lib
import urllib.parse
from datetime import datetime, timezone
from typing import Optional

import httpx

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
REDIRECT_URI = "http://localhost:8765/oauth/callback"
_OAUTH_TIMEOUT = 300  # 5 minutes for user to complete browser flow


# ── OAuth flow ─────────────────────────────────────────────────────────────────

def build_auth_url(client_id: str) -> str:
    """Return the Google authorization URL the user must open in their browser."""
    params = {
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",  # force refresh_token on every auth
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)


async def exchange_code(code: str, client_id: str, client_secret: str) -> str:
    """Exchange an auth code for a refresh_token."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        if "refresh_token" not in data:
            raise RuntimeError("Google did not return a refresh_token. Try revoking app access at myaccount.google.com and reconnecting.")
        return data["refresh_token"]


async def _get_access_token(refresh_token: str, client_id: str, client_secret: str) -> str:
    """Exchange refresh_token for a short-lived access_token."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "refresh_token": refresh_token,
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


# ── Local redirect server (captures OAuth callback without extra deps) ─────────

async def wait_for_oauth_code(timeout: int = _OAUTH_TIMEOUT) -> Optional[str]:
    """
    Spin up a minimal asyncio HTTP server on port 8765 that captures the OAuth
    redirect and returns the 'code' query param. Returns None on timeout.
    """
    code_future: asyncio.Future[Optional[str]] = asyncio.get_event_loop().create_future()

    async def handle(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        try:
            data = await asyncio.wait_for(reader.read(4096), timeout=5)
            request_line = data.decode(errors="ignore").splitlines()[0]
            # GET /oauth/callback?code=XXX HTTP/1.1
            path = request_line.split(" ")[1] if " " in request_line else ""
            params = urllib.parse.parse_qs(urllib.parse.urlparse(path).query)
            code = params.get("code", [None])[0]

            # Send a browser response the user will see
            if code:
                body = (
                    "<html><body style='font-family:sans-serif;text-align:center;padding:60px'>"
                    "<h2>✅ Gmail מחובר בהצלחה!</h2>"
                    "<p>אפשר לסגור את הדפדפן ולחזור לטלגרם.</p>"
                    "</body></html>"
                )
            else:
                body = (
                    "<html><body style='font-family:sans-serif;text-align:center;padding:60px'>"
                    "<h2>⚠️ שגיאה בחיבור</h2>"
                    "<p>לא התקבל קוד. נסה שוב מהטלגרם.</p>"
                    "</body></html>"
                )
            response = (
                f"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n"
                f"Content-Length: {len(body.encode())}\r\nConnection: close\r\n\r\n{body}"
            )
            writer.write(response.encode())
            await writer.drain()

            if not code_future.done():
                code_future.set_result(code)
        except Exception:
            if not code_future.done():
                code_future.set_result(None)
        finally:
            writer.close()

    server = await asyncio.start_server(handle, "127.0.0.1", 8765)
    try:
        result = await asyncio.wait_for(code_future, timeout=timeout)
        return result
    except asyncio.TimeoutError:
        return None
    finally:
        server.close()
        await server.wait_closed()


# ── Gmail API ──────────────────────────────────────────────────────────────────

async def fetch_unread_emails(
    refresh_token: str,
    client_id: str,
    client_secret: str,
    max_results: int = 50,
) -> list[dict]:
    """
    Fetch unread emails from the last 7 days.
    Returns list of {id, subject, body, date} dicts.
    Body is plain-text only (HTML stripped).
    """
    access_token = await _get_access_token(refresh_token, client_id, client_secret)
    headers = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient(timeout=30) as client:
        # List matching message IDs
        list_resp = await client.get(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages",
            headers=headers,
            params={
                "q": "is:unread newer_than:7d",
                "maxResults": max_results,
            },
        )
        list_resp.raise_for_status()
        messages = list_resp.json().get("messages", [])

        results = []
        for msg_ref in messages:
            try:
                msg_resp = await client.get(
                    f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_ref['id']}",
                    headers=headers,
                    params={"format": "full"},
                )
                msg_resp.raise_for_status()
                msg_data = msg_resp.json()
                parsed = _parse_gmail_message(msg_data)
                if parsed:
                    results.append(parsed)
            except Exception:
                continue  # skip individual message errors

        return results


def _parse_gmail_message(msg: dict) -> Optional[dict]:
    """Extract subject, plain-text body, and date from a Gmail API message object."""
    headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
    subject = headers.get("subject", "(no subject)")
    date_str = headers.get("date", "")

    try:
        date = email_lib.utils.parsedate_to_datetime(date_str).replace(tzinfo=None)
    except Exception:
        date = datetime.utcnow()

    body = _extract_body(msg.get("payload", {}))
    if body is None:
        body = msg.get("snippet", "")

    return {"id": msg["id"], "subject": subject, "body": body, "date": date}


def _extract_body(payload: dict) -> Optional[str]:
    """Recursively extract plain-text body from Gmail message payload."""
    mime = payload.get("mimeType", "")
    data = payload.get("body", {}).get("data", "")

    if mime == "text/plain" and data:
        try:
            return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
        except Exception:
            return None

    for part in payload.get("parts", []):
        result = _extract_body(part)
        if result:
            return result

    return None
