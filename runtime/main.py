"""CLI entry point for NUTANAA Studio OS runtime.

Run with::

    python -m runtime.main
"""

from __future__ import annotations

import asyncio
import logging
import sys

from runtime.bootstrap import bootstrap

logger = logging.getLogger(__name__)


async def _run() -> None:
    """Start the runtime, wait for a signal, then shut it down."""
    ctx = bootstrap()
    await ctx.lifecycle.startup()
    logger.info("NUTANAA Studio OS runtime is running. Press Ctrl+C to stop.")
    try:
        # Keep alive until interrupted.
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        await ctx.lifecycle.shutdown()


def main() -> None:
    """Synchronous wrapper for the async runtime loop."""
    try:
        asyncio.run(_run())
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
