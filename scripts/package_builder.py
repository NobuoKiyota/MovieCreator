#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
MovieCreator Package Builder
----------------------------
z:\MovieCreator\exports\ 内の動画ファイルをスキャンし、
・サムネイルの自動生成 (exports/thumbnails/)
・商用利用ライセンス (LICENSE_JP.txt, LICENSE_EN.txt) の自動生成
・BOOTH/Gumroad 用の販売パッケージ ZIP (MovieCreator_AssetPack.zip) の一括構築
を行います。
"""

import os
import sys
import glob
import argparse
import zipfile
from datetime import datetime

# Windowsコンソール出力の文字化け・UnicodeEncodeError対策
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# cv2 の動的インポート（未インストールの場合はフォールバック警告）
try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False


LICENSE_JP_CONTENT = """========================================================================
MovieCreator アセットパック - 利用規約・ライセンス（日本国内向け）
========================================================================

本アセットパック（動画素材・画像素材等）をご購入・ご利用いただきありがとうございます。
以下の規約に同意の上、ご活用ください。

【許諾事項】
1. 商用利用および非商用利用を問わず、ご自由にご利用いただけます。
2. VJ（Visual Jockey）映像、ライブ演出、動画制作、ゲーム開発、MV/PV、
   配信背景など、各種メディア作品の素材として組み込んで利用・加工することが可能です。
3. クレジット表記は任意です（表記していただける場合は「Created with MovieCreator」等）。

【禁止事項】
1. 本アセットパックに含まれる動画・画像ファイルそのものを、そのまま（または単なる形式変換のみで）
   第三者へ再配布・転売・オークション出品・譲渡する行為。
2. 商標登録や意匠登録など、本アセット素材自体の権利を独占的に主張・登録する行為。
3. 違法行為、公序良俗に反するコンテンツでの使用。

【免責事項】
本アセット素材の利用によって生じた損害やトラブルについて、制作者は一切の責任を負いません。

------------------------------------------------------------------------
発行元: MovieCreator Studio
発行日: {date_str}
========================================================================
"""

LICENSE_EN_CONTENT = """========================================================================
MovieCreator Asset Pack - End User License Agreement (EULA)
========================================================================

Thank you for purchasing and using the MovieCreator Asset Pack.
By using these assets, you agree to the following terms and conditions:

[PERMITTED USES]
1. Royalty-Free Commercial & Non-Commercial Use:
   You are granted a non-exclusive, worldwide license to use these video and 
   image assets in your commercial and non-commercial projects.
2. Allowed Applications:
   VJ performance visuals, video editing, game development, live stream backgrounds,
   music videos, and interactive media. Modifications and editing are allowed.
3. Attribution:
   Credit is optional, but appreciated (e.g., "Assets generated with MovieCreator").

[PROHIBITED USES]
1. Redistribution & Resale:
   You may NOT resell, redistribute, sublicense, or share the original asset files
   (or simple format conversions of them) as standalone stock media or packages.
2. Trademark / Copyright Claim:
   You may NOT claim exclusive ownership or register trademark/copyright for the asset files.
3. Unlawful Content:
   Use in illegal, defamatory, or hateful content is strictly prohibited.

[DISCLAIMER]
The author is not liable for any damages or losses arising from the use of these assets.

------------------------------------------------------------------------
Issued by: MovieCreator Studio
Date: {date_str}
========================================================================
"""


def extract_thumbnail(video_path, output_thumb_path):
    """動画の中間フレームをサムネイルとして出力"""
    if not HAS_CV2:
        print(f"[Warning] cv2(opencv-python) が未インストールのため、サムネイル抽出をスキップします: {video_path}")
        return False

    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"[Error] 動画ファイルを開けませんでした: {video_path}")
            return False

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        target_frame = max(0, total_frames // 2) if total_frames > 0 else 0

        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
        ret, frame = cap.read()
        
        if not ret:
            # 50%位置で読めない場合は0フレーム目を再試行
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = cap.read()

        cap.release()

        if ret and frame is not None:
            os.makedirs(os.path.dirname(output_thumb_path), exist_ok=True)
            cv2.imwrite(output_thumb_path, frame, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
            print(f"[Success] サムネイル生成完了: {output_thumb_path}")
            return True
        else:
            print(f"[Error] フレーム読み込みに失敗しました: {video_path}")
            return False
    except Exception as e:
        print(f"[Error] サムネイル抽出中に例外が発生しました ({video_path}): {e}")
        return False


def generate_license_files(output_dir):
    """ライセンスファイルを指定ディレクトリに出力"""
    os.makedirs(output_dir, exist_ok=True)
    date_str = datetime.now().strftime("%Y-%m-%d")

    jp_path = os.path.join(output_dir, "LICENSE_JP.txt")
    en_path = os.path.join(output_dir, "LICENSE_EN.txt")

    with open(jp_path, "w", encoding="utf-8") as f:
        f.write(LICENSE_JP_CONTENT.format(date_str=date_str))

    with open(en_path, "w", encoding="utf-8") as f:
        f.write(LICENSE_EN_CONTENT.format(date_str=date_str))

    print(f"[Info] ライセンスファイルを生成しました: {jp_path}, {en_path}")
    return jp_path, en_path


def build_package(export_dir, output_zip_path):
    """パッケージ一括生成処理メインルーチン"""
    print("=" * 60)
    print(" MovieCreator Package Builder ")
    print("=" * 60)

    if not os.path.exists(export_dir):
        os.makedirs(export_dir, exist_ok=True)
        print(f"[Info] エクスポートディレクトリを作成しました: {export_dir}")

    # 1. 動画ファイルの探索
    video_extensions = ("*.mp4", "*.webm", "*.mov", "*.avi")
    video_files = []
    for ext in video_extensions:
        video_files.extend(glob.glob(os.path.join(export_dir, ext)))
        video_files.extend(glob.glob(os.path.join(export_dir, ext.upper())))

    # 重複除去
    video_files = list(set(video_files))

    print(f"[Info] 対象動画ファイル数: {len(video_files)} 件")
    for vf in video_files:
        print(f"  - {os.path.basename(vf)}")

    # 2. サムネイルの抽出
    thumb_dir = os.path.join(export_dir, "thumbnails")
    extracted_thumbs = []

    for vf in video_files:
        base_name = os.path.splitext(os.path.basename(vf))[0]
        thumb_path = os.path.join(thumb_dir, f"{base_name}_thumb.jpg")
        if extract_thumbnail(vf, thumb_path):
            extracted_thumbs.append(thumb_path)

    # 3. ライセンスファイルの生成
    jp_lic, en_lic = generate_license_files(export_dir)

    # 4. ZIP アーカイブ化
    zip_dir = os.path.dirname(output_zip_path)
    if zip_dir:
        os.makedirs(zip_dir, exist_ok=True)

    print(f"\n[Info] ZIP パッケージを作成中: {output_zip_path}")
    with zipfile.ZipFile(output_zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        # ライセンスの追加
        zf.write(jp_lic, arcname=os.path.join("MovieCreator_AssetPack", "LICENSE_JP.txt"))
        zf.write(en_lic, arcname=os.path.join("MovieCreator_AssetPack", "LICENSE_EN.txt"))

        # 動画の追加
        for vf in video_files:
            arc_name = os.path.join("MovieCreator_AssetPack", "Videos", os.path.basename(vf))
            zf.write(vf, arcname=arc_name)

        # サムネイルの追加
        for tf in extracted_thumbs:
            arc_name = os.path.join("MovieCreator_AssetPack", "Thumbnails", os.path.basename(tf))
            zf.write(tf, arcname=arc_name)

    print(f"[Completed] パッケージ生成が完了しました！ -> {output_zip_path}\n")


def main():
    parser = argparse.ArgumentParser(description="MovieCreator Asset Pack Builder")
    parser.add_argument(
        "--export-dir",
        default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "exports"),
        help="動画ファイルが置かれているディレクトリパス (デフォルト: exports/)"
    )
    parser.add_argument(
        "--output-zip",
        default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "exports", "MovieCreator_AssetPack.zip"),
        help="出力するZIPファイルのパス"
    )

    args = parser.parse_args()
    build_package(args.export_dir, args.output_zip)


if __name__ == "__main__":
    main()
