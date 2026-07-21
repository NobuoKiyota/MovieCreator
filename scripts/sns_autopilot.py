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
    """AI (Gemini API / Fallback) による 有益な開発日記・技術ノウハウ・PR文自動生成"""

    # 3つの異なる切り口（コンテンツタイプ）からランダム選出
    angles = [
        {
            "type": "DevLog (開発日記 / アプリ紹介)",
            "context": (
                "Webブラウザ上で動作するサイバーパンク生成映像クリエイター『MovieCreator』の開発進捗ログです。\n"
                "「ブラウザ上で60fps決定論的WebCodecs書き出しができる」「多面万華鏡ミラーや自己進化型変異ランダマイザーを搭載」などの技術的魅力や、"
                "作例動画として今回の素材を提示し、クリエイターコミュニティにインスピレーションを与える内容にしてください。"
            )
        },
        {
            "type": "Technique & VFX Tips (映像演出ノウハウ)",
            "context": (
                "VJ演出や配信オーバーレイ画面で使えるレイヤー合成やエフェクトのノウハウ投稿です。\n"
                "「多面ミラーとKaleidoscopeを組み合わせ、Differenceブレンドで重ねることで幾何学的で深みのある光の干渉が得られる」などの実践的ワンポイント解説を含めてください。"
            )
        },
        {
            "type": "Product Showcase (素材パック・作品紹介)",
            "context": (
                "BOOTHやGumroad等で提供・配信されている高品質なネオン＆サイバーパンク背景ループ素材の紹介です。\n"
                "VJパフォーマンス、ライブ配信、MV制作などでいかに映えるか、用途や演出効果を具体的かつスタイリッシュに提示してください。"
            )
        }
    ]

    chosen_angle = random.choice(angles)
    print(f"[AI Profile] 切り口: {chosen_angle['type']}")

    prompt = (
        f"あなたはサイバーパンク/ネオン調の生成映像クリエイター兼『MovieCreator』の開発者です。\n"
        f"今回の動画作品 '{video_filename}' の映像（またはその制作プロセス）に関して、X (Twitter) 向けの魅力的なポストを作成してください。\n\n"
        f"【今回の投稿切り口】\n"
        f"{chosen_angle['context']}\n\n"
        f"【要件】\n"
        f"1. 単なる宣伝や自己満足にならず、読んだクリエイターやVJが『面白い！参考になる！使ってみたい！』と感じる有益な視点を入れること。\n"
        f"2. 日本語と英語の両方（バイリンガル表記）を含めること。\n"
        f"3. 関連ハッシュタグ (#MovieCreator #DevLog #GenerativeArt #VJ #CreativeCoding #Cyberpunk から3〜5個) を末尾に付けること。\n"
        f"4. Xの文字数制限に確実に収まるコンパクトでスタイリッシュな文章（全体の合計220文字以内）にすること。\n"
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
                print("[AI] Gemini API による有益DevLog/PRコメントの生成に成功しました。")
                return text
            else:
                print(f"[Warning] Gemini API エラー ({resp.status_code}): {resp.text}")
        except Exception as e:
            print(f"[Warning] Gemini API 呼び出し例外: {e}")

    # AI API 未設定時のフォールバック文章
    fallback_templates = [
        (
            f"🛠️ [DevLog] Building MovieCreator!\n"
            f"ブラウザだけで60fps決定論的WebCodecs書き出しができる映像生成アプリを開発中💻\n"
            f"多面ミラー×Dot Designのレイヤー合成作例 '{video_filename}' です🔥\n\n"
            f"Building an in-browser generative video maker. Layering radial mirror + dot patterns for VJ loops!\n\n"
            f"#MovieCreator #DevLog #GenerativeArt #VJ #CreativeCoding"
        ),
        (
            f"💡 [VFX Tip] Layer Blending Trick\n"
            f"多面万華鏡と独立エフェクトをDiffernce合成で重ねると重層的な光の干渉パターンが作れます✨ 素材: '{video_filename}'\n\n"
            f"Combine multi-radial mirror & kaleidoscope with Difference blend mode to create complex cyber patterns!\n\n"
            f"#MovieCreator #VJ #MotionGraphics #CreativeCoding #Cyberpunk"
        )
    ]
    fallback_text = random.choice(fallback_templates)
    print("[AI] フォールバック用高クオリティテンプレートを使用します。")
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
