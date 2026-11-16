import asyncio
import logging
import sys
import os

# اضافه کردن پوشه src به مسیر اجرای پایتون
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'src')))

from bot import main

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Bot stopped by user.")
        
