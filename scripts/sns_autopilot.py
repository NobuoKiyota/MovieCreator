#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
MovieCreator SNS Autopilot
--------------------------
1. exports/ からランダムに動画を選択
2. 軽量プレビュー (5秒間のMP4/GIF) を抽出
3. Gemini API 等を利用し、VJ/ジェネレーティブアート向けPR投稿文を生成
4. LINE Messaging API (Flex Message) でユーザーに承認リクエストを送信
"""

import os
import sys
import glob
import json
import random
import uuid
import argparse
import requests
from datetime import datetime

# Windowsコンソール出力の文字化け・UnicodeEncodeError対策
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# cv2 の動的インポート
try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

# linebot sdk の動的インポート (v3 もしくは v2 互換)
try:
    from linebot import LineBotApi
    from linebot.models import (
        TextSendMessage, FlexSendMessage, BubbleContainer, BoxComponent, 
        TextComponent, ButtonComponent, PostbackAction, ImageComponent
    )
    HAS_LINE_SDK = True
except ImportError:
    HAS_LINE_SDK = False


PENDING_POST_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "sns_pending_post.json"
)


def load_config(config_path):
    """設定ファイルの読み込み"""
    if not os.path.exists(config_path):
        print(f"[Warning] 設定ファイルが見つかりません: {config_path}")
        print("  scripts/config.example.json を参考に config.json を作成してください。")
        return None

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[Error] 設定ファイルの読み込みエラー: {e}")
        return None


def extract_preview_clip(video_path, output_preview_path, duration_sec=5.0):
    """動画から5秒間の軽量プレビュー動画/画像を抽出"""
    if not HAS_CV2:
        print(f"[Warning] cv2が未インストールの為、動画をそのままプレビュー用パスに複製します。")
        try:
            import shutil
            shutil.copyfile(video_path, output_preview_path)
            return True
        except Exception as e:
            print(f"[Error] コピー失敗: {e}")
            return False

    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"[Error] 動画を開けません: {video_path}")
            return False

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        max_preview_frames = int(fps * duration_sec)
        
        # プレビュー出力用 VideoWriter
        os.makedirs(os.path.dirname(output_preview_path), exist_ok=True)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_preview_path, fourcc, fps, (width, height))

        frames_written = 0
        while cap.isOpened() and frames_written < max_preview_frames:
            ret, frame = cap.read()
            if not ret:
                break
            out.write(frame)
            frames_written += 1

        cap.release()
        out.release()
        print(f"[Success] 軽量プレビュー抽出完了 ({frames_written} フレーム): {output_preview_path}")
        return True
    except Exception as e:
        print(f"[Error] プレビュー抽出中に例外発生: {e}")
        return False


def generate_pr_comment_with_ai(gemini_api_key, video_filename):
    """AI (Gemini API / Fallback) による VJ/ジェネレーティブアート向けPR文自動生成"""
    prompt = (
        f"あなたはサイバーパンク/ネオン調のジェネレーティブ・アートやVJ素材のトッププロモーターです。\n"
        f"動画素材 '{video_filename}' の魅力を伝えるX(Twitter)投稿用の短文PRテキストを作成してください。\n\n"
        f"【要件】\n"
        f"1. 日本語と英語の両方を含めること。\n"
        f"2. クールでスタイリッシュ、VJ演出や映像制作に使いたくなるような言葉遣い。\n"
        f"3. 関連ハッシュタグ (#MovieCreator #GenerativeArt #VJ #Cyberpunk #MotionGraphics 等) を3〜5個付けること。\n"
        f"4. Xの文字数制限に収まるコンパクトな長さ（200文字以内）にすること。\n"
    )

    if gemini_api_key and gemini_api_key != "YOUR_GEMINI_API_KEY":
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            resp = requests.post(url, headers=headers, json=payload, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                print("[AI] Gemini API による PRコメントの生成に成功しました。")
                return text
            else:
                print(f"[Warning] Gemini API エラー ({resp.status_code}): {resp.text}")
        except Exception as e:
            print(f"[Warning] Gemini API 呼び出し例外: {e}")

    # AI API 未設定時のデフォルトフォールバック文章
    fallback_text = (
        f"✨ New Generative Visual Loop Release! ✨\n"
        f"ネオン＆サイバーパンクな幾何学ループ素材 '{video_filename}' 配信中！\n"
        f"VJ演出や動画制作の背景素材に最適です🔥\n\n"
        f"Check out our new cyberpunk motion graphic loop.\n"
        f"Perfect for VJing, live streaming, and music videos!\n\n"
        f"#MovieCreator #GenerativeArt #VJ #MotionGraphics #Cyberpunk"
    )
    print("[AI] フォールバック用テンプレートテキストを使用します。")
    return fallback_text


def create_line_flex_message(post_id, preview_url, pr_text):
    """LINE Flex Message の構造体を作成"""
    flex_content = {
        "type": "bubble",
        "header": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "text",
                    "text": "🎬 X投稿 承認リクエスト",
                    "weight": "bold",
                    "color": "#1DB954",
                    "size": "sm"
                }
            ]
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "text",
                    "text": pr_text,
                    "wrap": True,
                    "size": "xs",
                    "color": "#333333"
                }
            ]
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "contents": [
                {
                    "type": "button",
                    "style": "primary",
                    "color": "#1DA1F2",
                    "action": {
                        "type": "postback",
                        "label": "👍 承認してXに投稿",
                        "data": f"action=approve&id={post_id}",
                        "displayText": "👍 Xへの投稿を承認しました"
                    }
                },
                {
                    "type": "button",
                    "style": "secondary",
                    "action": {
                        "type": "postback",
                        "label": "🔄 再生成",
                        "data": f"action=regenerate&id={post_id}",
                        "displayText": "🔄 文案の再生成を要求します"
                    }
                },
                {
                    "type": "button",
                    "style": "link",
                    "color": "#FF3B30",
                    "action": {
                        "type": "postback",
                        "label": "❌ キャンセル",
                        "data": f"action=cancel&id={post_id}",
                        "displayText": "❌ キャンセルしました"
                    }
                }
            ]
        }
    }
    return flex_content


def send_line_approval_request(config, post_id, video_path, preview_path, pr_text):
    """LINE Messaging API 経由で承認メッセージを送信"""
    line_cfg = config.get("line", {})
    token = line_cfg.get("channel_access_token")
    user_id = line_cfg.get("user_id")
    public_url = config.get("server", {}).get("public_url", "").rstrip("/")

    preview_filename = os.path.basename(preview_path)
    preview_url = f"{public_url}/previews/{preview_filename}" if public_url else preview_path

    # セッションデータの保存
    pending_data = {
        "id": post_id,
        "video_path": video_path,
        "preview_path": preview_path,
        "preview_url": preview_url,
        "pr_text": pr_text,
        "status": "pending",
        "created_at": datetime.now().isoformat()
    }
    os.makedirs(os.path.dirname(PENDING_POST_FILE), exist_ok=True)
    with open(PENDING_POST_FILE, "w", encoding="utf-8") as f:
        json.dump(pending_data, f, ensure_ascii=False, indent=2)

    print(f"\n[Info] 保留中投稿セッションを保存しました -> {PENDING_POST_FILE}")
    print(f"--- 承認待ち PRコメント ---\n{pr_text}\n---------------------------")

    if not token or token == "YOUR_LINE_CHANNEL_ACCESS_TOKEN" or not user_id or user_id == "YOUR_LINE_USER_ID":
        print("[Warning] LINE Channel Access Token または User ID が未設定です。")
        print("          LINEメッセージの実際の配信はスキップされました（ドライラン）。")
        return False

    if HAS_LINE_SDK:
        try:
            line_bot_api = LineBotApi(token)
            flex_obj = create_line_flex_message(post_id, preview_url, pr_text)
            flex_message = FlexSendMessage(alt_text="[MovieCreator] X投稿承認のお願い", contents=flex_obj)
            line_bot_api.push_message(user_id, flex_message)
            print("[LINE] 承認リクエスト Flex Message を正常に配信しました！")
            return True
        except Exception as e:
            print(f"[Error] LINE API 配信例外: {e}")
            return False
    else:
        # requests によるフォールバック送信
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
            }
            payload = {
                "to": user_id,
                "messages": [
                    {
                        "type": "flex",
                        "altText": "[MovieCreator] X投稿承認のお願い",
                        "contents": create_line_flex_message(post_id, preview_url, pr_text)
                    }
                ]
            }
            resp = requests.post("https://api.line.me/v2/bot/message/push", headers=headers, json=payload, timeout=10)
            if resp.status_code == 200:
                print("[LINE] 承認リクエスト Flex Message を正常に配信しました！")
                return True
            else:
                print(f"[Error] LINE API 応答エラー ({resp.status_code}): {resp.text}")
                return False
        except Exception as e:
            print(f"[Error] LINE API リクエスト送信失敗: {e}")
            return False


def run_autopilot(config_path):
    """SNS Autopilot メイン処理"""
    config = load_config(config_path)
    if not config:
        print("[Error] 設定が読み込めないため処理を中断します。")
        return

    export_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "exports")
    video_files = glob.glob(os.path.join(export_dir, "*.mp4")) + glob.glob(os.path.join(export_dir, "*.webm"))
    
    if not video_files:
        print(f"[Warning] exports/ ディレクトリ ({export_dir}) に対象の動画ファイルがありません。")
        return

    target_video = random.choice(video_files)
    print(f"[Info] 対象動画を選択しました: {os.path.basename(target_video)}")

    post_id = str(uuid.uuid4())[:8]
    preview_path = os.path.join(export_dir, "previews", f"preview_{post_id}.mp4")

    # 1. プレビューの抽出
    extract_preview_clip(target_video, preview_path)

    # 2. PRテキストの生成
    gemini_key = config.get("ai", {}).get("gemini_api_key")
    pr_text = generate_pr_comment_with_ai(gemini_key, os.path.basename(target_video))

    # 3. LINE承認要求の配信
    send_line_approval_request(config, post_id, target_video, preview_path, pr_text)


def main():
    parser = argparse.ArgumentParser(description="MovieCreator SNS Autopilot Pipeline")
    parser.add_argument(
        "--config",
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json"),
        help="設定ファイルパス (デフォルト: scripts/config.json)"
    )
    args = parser.parse_args()
    run_autopilot(args.config)


if __name__ == "__main__":
    main()
