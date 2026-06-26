import os

import uvicorn


def main() -> None:
    """Run the web API server. Respects PORT env var (Railway sets this)."""
    uvicorn.run(
        "intervals_mcp_server.web.app:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
    )


if __name__ == "__main__":
    main()
