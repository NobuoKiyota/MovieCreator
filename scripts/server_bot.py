#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
MovieCreator Server Bot (LINE Webhook & X Post Server)
------------------------------------------------------
LINE の Postback (承認/再生成/キャンセル) を受信し、
承認時に tweepy 経由で X (Twitter) に動画付きツイートを自動投稿する Webhook サーバー。
"""

import os
import sys
import json
import urllib.parse
from datetime import datetime

# Windowsコンソール出力の文字化け・UnicodeEncodeError対策
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Flask の動的インポート
try:
    from flask import Flask, request, jsonify, send_from_directory, abort
    HAS_FLASK = True
except ImportError:
    HAS_FLASK = False

# tweepy の動的インポート
try:
    import tweepy
    HAS_TWEEPY = True
except ImportError:
    HAS_TWEEPY = False

# linebot sdk の動的インポート
try:
    from linebot import LineBotApi, WebhookHandler
    from linebot.exceptions import InvalidSignatureError
    from linebot.models import TextSendMessage
    HAS_LINE_SDK = True
except ImportError:
    HAS_LINE_SDK = False

from sns_autopilot import load_config, run_autopilot, PENDING_POST_FILE


CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
config = load_config(CONFIG_PATH) or {}

if HAS_FLASK:
    app = Flask(__name__)
else:
    app = None


def post_to_twitter(video_path, pr_text, twitter_config):
    """tweepy を使用して動画付きツイートを X (Twitter) へ投稿"""
    if not HAS_TWEEPY:
        print("[Error] tweepy が未インストールの為、X投稿を実行できません。")
        return False, "tweepy module not installed."

    api_key = twitter_config.get("api_key")
    api_secret = twitter_config.get("api_secret")
    access_token = twitter_config.get("access_token")
    access_token_secret = twitter_config.get("access_token_secret")
    bearer_token = twitter_config.get("bearer_token")

    if not api_key or api_key == "YOUR_TWITTER_API_KEY":
        print("[Warning] X (Twitter) API キーが設定されていません (ドライラン投稿)。")
        print(f"--- [Twitter Mock Post] ---\nVideo: {video_path}\nText: {pr_text}\n---------------------------")
        return True, "https://x.com/mock_user/status/1234567890 (Mock)"

    try:
        # 1. v1.1 認証 (メディアアップロード用)
        auth = tweepy.OAuth1UserHandler(api_key, api_secret, access_token, access_token_secret)
        api_v1 = tweepy.API(auth)

        print(f"[Twitter] 動画アップロード開始: {video_path}")
        media = api_v1.media_upload(video_path, media_category="tweet_video")
        print(f"[Twitter] メディアアップロード成功 (ID: {media.media_id})")

        # 2. v2 クライアント (ツイート作成用)
        client_v2 = tweepy.Client(
            bearer_token=bearer_token,
            consumer_key=api_key,
            consumer_secret=api_secret,
            access_token=access_token,
            access_token_secret=access_token_secret
        )

        response = client_v2.create_tweet(text=pr_text, media_ids=[media.media_id])
        tweet_id = response.data.get("id")
        tweet_url = f"https://x.com/user/status/{tweet_id}"
        print(f"[Twitter] 投稿成功！ -> {tweet_url}")
        return True, tweet_url

    except Exception as e:
        print(f"[Error] X 投稿処理で例外が発生しました: {e}")
        return False, str(e)


def reply_line_message(reply_token, text, line_config):
    """LINE への返信メッセージ送信"""
    token = line_config.get("channel_access_token")
    if not token or token == "YOUR_LINE_CHANNEL_ACCESS_TOKEN" or not reply_token:
        print(f"[LINE Reply Mock] {text}")
        return

    if HAS_LINE_SDK:
        try:
            line_bot_api = LineBotApi(token)
            line_bot_api.reply_message(reply_token, TextSendMessage(text=text))
        except Exception as e:
            print(f"[Error] LINE 返信例外: {e}")


if HAS_FLASK:
    @app.route("/previews/<path:filename>")
    def serve_preview(filename):
        """プレビュー静的動画ファイルの配信"""
        preview_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "exports", "previews"
        )
        return send_from_directory(preview_dir, filename)

    @app.route("/callback", methods=["POST"])
    def line_callback():
        """LINE Webhook 受信エンドポイント"""
        signature = request.headers.get("X-Line-Signature", "")
        body = request.get_data(as_text=True)

        try:
            data = json.loads(body)
        except Exception:
            return jsonify({"status": "invalid json"}), 400

        events = data.get("events", [])
        for event in events:
            event_type = event.get("type")
            reply_token = event.get("replyToken")

            if event_type == "postback":
                pb_data_str = event.get("postback", {}).get("data", "")
                parsed = urllib.parse.parse_qs(pb_data_str)
                action = parsed.get("action", [""])[0]
                post_id = parsed.get("id", [""])[0]

                print(f"[LINE Event] Postback受信: action={action}, id={post_id}")

                if action == "approve":
                    if os.path.exists(PENDING_POST_FILE):
                        with open(PENDING_POST_FILE, "r", encoding="utf-8") as f:
                            pending = json.load(f)

                        success, result_msg = post_to_twitter(
                            pending["video_path"],
                            pending["pr_text"],
                            config.get("twitter", {})
                        )

                        if success:
                            pending["status"] = "posted"
                            with open(PENDING_POST_FILE, "w", encoding="utf-8") as f:
                                json.dump(pending, f, ensure_ascii=False, indent=2)
                            reply_line_message(reply_token, f"🎉 X(Twitter) への動画自動投稿が完了しました！\n{result_msg}", config.get("line", {}))
                        else:
                            reply_line_message(reply_token, f"⚠️ X投稿エラーが発生しました:\n{result_msg}", config.get("line", {}))
                    else:
                        reply_line_message(reply_token, "⚠️ 保留中の投稿データが見つかりません。", config.get("line", {}))

                elif action == "regenerate":
                    reply_line_message(reply_token, "🔄 文案・動画の再生成を開始します。しばらくお待ちください...", config.get("line", {}))
                    run_autopilot(CONFIG_PATH)

                elif action == "cancel":
                    if os.path.exists(PENDING_POST_FILE):
                        os.remove(PENDING_POST_FILE)
                    reply_line_message(reply_token, "❌ X投稿リクエストをキャンセルしました。", config.get("line", {}))

        return jsonify({"status": "ok"}), 200


def main():
    port = config.get("server", {}).get("port", 5000)
    print("=" * 60)
    print(f" MovieCreator Server Bot Running on port {port} ")
    print("=" * 60)

    if HAS_FLASK and app:
        app.run(host="0.0.0.0", port=port, debug=False)
    else:
        print("[Error] Flask モジュールがインストールされていません。")
        print("  `pip install flask` を実行してください。")


if __name__ == "__main__":
    main()
