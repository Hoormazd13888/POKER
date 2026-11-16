import os
import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from emoji_forge.config import BOT_TOKEN

logger = logging.getLogger(__name__)

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    await update.message.reply_text(
        f"سلام {user.first_name} عزیز! 🚀\n"
        "به ربات پیشرفته POKER خوش آمدید.\n"
        "برای شروع دستورات یا درخواست خود را ارسال کنید."
    )

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    await update.message.reply_text(f"پیام شما دریافت شد: {text}")

def main():
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN یافت نشد! لطفاً فایل تنظیمات را بررسی کنید.")
        return

    application = Application.builder().token(BOT_TOKEN).build()

    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("ربات پکر با موفقیت راه‌اندازی شد و در حال دریافت پیام است...")
    application.run_polling()

if __name__ == "__main__":
    main()
  
