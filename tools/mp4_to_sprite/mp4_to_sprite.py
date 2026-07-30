#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MP4 to Sprite Sheet Converter with Black Background Removal (Chroma Key Alpha)
Enhanced with Crop Resizing, Frame-based IN/OUT Calculation, Color & Sharpening Filters.
Includes Cocos Creator / Cocos2d .plist & JSON Atlas generation.
"""

import argparse
import math
import os
import xml.etree.ElementTree as ET
import xml.dom.minidom
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


def apply_color_and_sharpen(img_pil, brightness=1.0, contrast=1.0, saturation=1.0, sharpen=0.0):
    """
    PIL画像に明るさ・コントラスト・彩度・シャープネス処理を適用
    """
    if brightness != 1.0:
        img_pil = ImageEnhance.Brightness(img_pil).enhance(brightness)
    if contrast != 1.0:
        img_pil = ImageEnhance.Contrast(img_pil).enhance(contrast)
    if saturation != 1.0:
        img_pil = ImageEnhance.Color(img_pil).enhance(saturation)
    if sharpen > 0.0:
        # 簡易シャープネスカーネル適用
        for _ in range(int(round(sharpen))):
            img_pil = img_pil.filter(ImageFilter.SHARPEN)
    return img_pil


def process_frame(frame, threshold=20, softness=10, brightness=1.0, contrast=1.0, saturation=1.0, sharpen=0.0):
    """
    BGRフレームから黒背景を透過処理（アルファチャンネル作成）＋カラー画質補正。
    """
    bgra = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA).astype(np.float32)
    b, g, r = bgra[:, :, 0], bgra[:, :, 1], bgra[:, :, 2]

    # 画素ごとの最大輝度を取得
    max_val = np.maximum(np.maximum(r, g), b)

    # アルファ値を計算 (0.0 ~ 1.0)
    alpha = np.clip((max_val - threshold) / max(1.0, float(softness)), 0.0, 1.0)

    # アルファチャンネルに適用 (0 ~ 255)
    bgra[:, :, 3] = alpha * 255.0

    # カラーキーエッジ補正 (背景黒が混ざって暗くなったRGBの復元)
    alpha_mask = alpha > 0.01
    for i in range(3):
        bgra[:, :, i][alpha_mask] = np.clip(
            bgra[:, :, i][alpha_mask] / np.maximum(alpha[alpha_mask], 0.3),
            0,
            255
        )

    # BGRA -> RGBA (PIL形式)
    rgba = cv2.cvtColor(bgra.astype(np.uint8), cv2.COLOR_BGRA2RGBA)
    img_pil = Image.fromarray(rgba)

    # カラー＆シャープ補正を適用
    return apply_color_and_sharpen(img_pil, brightness, contrast, saturation, sharpen)


def generate_cocos_plist(output_plist_path, png_name, sheet_w, sheet_h, frames_info):
    """
    Cocos Creator / Cocos2d-x 互換の .plist アトラスファイルを生成する
    """
    plist = ET.Element("plist", version="1.0")
    dict_root = ET.SubElement(plist, "dict")

    ET.SubElement(dict_root, "key").text = "frames"
    dict_frames = ET.SubElement(dict_root, "dict")

    for info in frames_info:
        name = info["name"]
        x, y, w, h = info["x"], info["y"], info["w"], info["h"]

        ET.SubElement(dict_frames, "key").text = name
        dict_frame = ET.SubElement(dict_frames, "dict")

        ET.SubElement(dict_frame, "key").text = "frame"
        ET.SubElement(dict_frame, "string").text = f"{{{{{x},{y}}},{{{w},{h}}}}}"

        ET.SubElement(dict_frame, "key").text = "offset"
        ET.SubElement(dict_frame, "string").text = "{0,0}"

        ET.SubElement(dict_frame, "key").text = "rotated"
        ET.SubElement(dict_frame, "boolean")  # false

        ET.SubElement(dict_frame, "key").text = "sourceColorRect"
        ET.SubElement(dict_frame, "string").text = f"{{{{0,0}},{{{w},{h}}}}}"

        ET.SubElement(dict_frame, "key").text = "sourceSize"
        ET.SubElement(dict_frame, "string").text = f"{{{w},{h}}}"

    ET.SubElement(dict_root, "key").text = "metadata"
    dict_meta = ET.SubElement(dict_root, "dict")

    ET.SubElement(dict_meta, "key").text = "format"
    ET.SubElement(dict_meta, "integer").text = "2"

    ET.SubElement(dict_meta, "key").text = "realTextureFileName"
    ET.SubElement(dict_meta, "string").text = png_name

    ET.SubElement(dict_meta, "key").text = "size"
    ET.SubElement(dict_meta, "string").text = f"{{{sheet_w},{sheet_h}}}"

    ET.SubElement(dict_meta, "key").text = "textureFileName"
    ET.SubElement(dict_meta, "string").text = png_name

    xml_str = xml.dom.minidom.parseString(ET.tostring(plist)).toprettyxml(indent="    ")
    doctype = '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
    if "<?xml" in xml_str:
        header, body = xml_str.split("\n", 1)
        full_xml = header + "\n" + doctype + body
    else:
        full_xml = doctype + xml_str

    with open(output_plist_path, "w", encoding="utf-8") as f:
        f.write(full_xml)
    print(f"Plistメタデータを保存しました: {output_plist_path}")


def generate_json_atlas(output_json_path, png_name, sheet_w, sheet_h, frames_info):
    """
    Unity / Generic JSON Atlas 形式のメタデータを生成する
    """
    import json
    data = {
        "frames": {},
        "meta": {
            "app": "MP4 to SpriteSheet Converter Pro",
            "version": "1.1",
            "image": png_name,
            "size": {"w": sheet_w, "h": sheet_h},
            "scale": "1"
        }
    }

    for info in frames_info:
        data["frames"][info["name"]] = {
            "frame": {"x": info["x"], "y": info["y"], "w": info["w"], "h": info["h"]},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": info["w"], "h": info["h"]},
            "sourceSize": {"w": info["w"], "h": info["h"]}
        }

    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"JSONメタデータを保存しました: {output_json_path}")


def video_to_sprite_sheet(
    video_path,
    output_path="sprite_sheet.png",
    start_sec=0.0,
    end_sec=None,
    start_frame=None,
    end_frame=None,
    fps=15,
    crop_rect=None,  # (x, y, w, h)
    threshold=20,
    softness=10,
    brightness=1.0,
    contrast=1.0,
    saturation=1.0,
    sharpen=0.0,
    cols=None,
    create_plist=False,
    create_json=False
):
    if not os.path.exists(video_path):
        print(f"Error: 動画ファイルが見つかりません -> {video_path}")
        return

    cap = cv2.VideoCapture(video_path)
    orig_fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_sec = total_frames / orig_fps if orig_fps > 0 else 0

    # フレーム番号または秒数からの範囲決定
    if start_frame is not None:
        calc_start_frame = max(0, start_frame)
    else:
        calc_start_frame = max(0, int(start_sec * orig_fps))

    if end_frame is not None:
        calc_end_frame = min(total_frames - 1, end_frame)
    elif end_sec is not None and end_sec > 0:
        calc_end_frame = min(total_frames - 1, int(end_sec * orig_fps))
    else:
        calc_end_frame = total_frames - 1

    if calc_start_frame >= calc_end_frame:
        print("Error: 開始フレームが終了フレーム以降に設定されています。")
        cap.release()
        return

    frame_step = max(1, int(round(orig_fps / fps)))
    print(f"動画情報: {orig_fps:.2f} FPS | 総フレーム: {total_frames} ({duration_sec:.2f}秒)")
    print(f"抽出範囲: Frame {calc_start_frame} ~ {calc_end_frame} | ステップ: {frame_step}フレーム毎 (目標 {fps} FPS)")

    cap.set(cv2.CAP_PROP_POS_FRAMES, calc_start_frame)
    current_frame = calc_start_frame

    processed_images = []

    while cap.isOpened() and current_frame <= calc_end_frame:
        ret, frame = cap.read()
        if not ret:
            break

        if (current_frame - calc_start_frame) % frame_step == 0:
            # 矩形クロップ処理
            if crop_rect is not None:
                cx, cy, cw, ch = crop_rect
                h_img, w_img = frame.shape[:2]
                cx = max(0, min(cx, w_img - 1))
                cy = max(0, min(cy, h_img - 1))
                cw = min(cw, w_img - cx)
                ch = min(ch, h_img - cy)
                if cw > 0 and ch > 0:
                    frame = frame[cy:cy+ch, cx:cx+cw]

            # 黒抜き透過処理 + カラー＆シャープ補正
            img_rgba = process_frame(
                frame,
                threshold=threshold,
                softness=softness,
                brightness=brightness,
                contrast=contrast,
                saturation=saturation,
                sharpen=sharpen
            )
            processed_images.append(img_rgba)

        current_frame += 1

    cap.release()

    num_frames = len(processed_images)
    if num_frames == 0:
        print("フレームが1枚も抽出できませんでした。")
        return

    frame_w, frame_h = processed_images[0].size

    # グリッドサイズ計算
    if cols is None or cols <= 0:
        cols = math.ceil(math.sqrt(num_frames))
    rows = math.ceil(num_frames / cols)

    sheet_w = cols * frame_w
    sheet_h = rows * frame_h

    # スプライトシート作成
    sprite_sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    frames_info = []

    for idx, img in enumerate(processed_images):
        c = idx % cols
        r = idx // cols
        pos_x = c * frame_w
        pos_y = r * frame_h
        sprite_sheet.paste(img, (pos_x, pos_y))

        frame_name = f"frame_{idx:03d}.png"
        frames_info.append({
            "name": frame_name,
            "x": pos_x,
            "y": pos_y,
            "w": frame_w,
            "h": frame_h
        })

    sprite_sheet.save(output_path)
    print(f"成功: スプライトシートを出力しました -> {output_path} ({sheet_w}x{sheet_h}px, {cols}x{rows}グリッド, 全{num_frames}枚)")

    png_name = os.path.basename(output_path)
    base_name = os.path.splitext(output_path)[0]

    if create_plist:
        plist_path = f"{base_name}.plist"
        generate_cocos_plist(plist_path, png_name, sheet_w, sheet_h, frames_info)

    if create_json:
        json_path = f"{base_name}.json"
        generate_json_atlas(json_path, png_name, sheet_w, sheet_h, frames_info)


def main():
    parser = argparse.ArgumentParser(description="MP4 to SpriteSheet Converter with Black Chroma Key & Color Adjustments")
    parser.add_argument("-i", "--input", required=True, help="入力MP4動画のパス")
    parser.add_argument("-o", "--output", default="sprite_sheet.png", help="出力スプライトシート画像パス (.png)")
    parser.add_argument("--start", type=float, default=0.0, help="切り出し開始秒数 (秒)")
    parser.add_argument("--end", type=float, default=None, help="切り出し終了秒数 (秒)")
    parser.add_argument("--start-frame", type=int, default=None, help="切り出し開始フレーム番号")
    parser.add_argument("--end-frame", type=int, default=None, help="切り出し終了フレーム番号")
    parser.add_argument("--fps", type=int, default=15, help="抽出フレームレート (FPS)")
    parser.add_argument("--crop", type=str, default=None, help="矩形クロップ範囲 'x,y,w,h' (例: 100,50,400,400)")
    parser.add_argument("--threshold", type=int, default=20, help="黒背景識別閾値 (0~255)")
    parser.add_argument("--softness", type=int, default=10, help="透過エッジぼかし感度 (1~50)")
    parser.add_argument("--brightness", type=float, default=1.0, help="明るさ補正倍率 (例: 1.2)")
    parser.add_argument("--contrast", type=float, default=1.0, help="コントラスト補正倍率 (例: 1.1)")
    parser.add_argument("--saturation", type=float, default=1.0, help="彩度補正倍率 (例: 1.3)")
    parser.add_argument("--sharpen", type=float, default=0.0, help="シャープネス補正強度 (例: 1.0)")
    parser.add_argument("--cols", type=int, default=None, help="スプライトシートの横列数 (省略時は自動算定)")
    parser.add_argument("--plist", action="store_true", help="Cocos Creator用 .plist メタデータを出力する")
    parser.add_argument("--json", action="store_true", help="Unity/Generic用 .json メタデータを出力する")

    args = parser.parse_args()

    crop_rect = None
    if args.crop:
        try:
            parts = [int(v.strip()) for v in args.crop.split(",")]
            if len(parts) == 4:
                crop_rect = tuple(parts)
        except ValueError:
            print("Warning: --crop 引数の解析に失敗しました。全画面で処理します。")

    video_to_sprite_sheet(
        video_path=args.input,
        output_path=args.output,
        start_sec=args.start,
        end_sec=args.end,
        start_frame=args.start_frame,
        end_frame=args.end_frame,
        fps=args.fps,
        crop_rect=crop_rect,
        threshold=args.threshold,
        softness=args.softness,
        brightness=args.brightness,
        contrast=args.contrast,
        saturation=args.saturation,
        sharpen=args.sharpen,
        cols=args.cols,
        create_plist=args.plist,
        create_json=args.json
    )


if __name__ == "__main__":
    main()
