#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
MovieCreator Video Mixer & Random Generator
------------------------------------------
複数の生成動画を合成し、黒抜き（クロマキー）処理やエフェクト（ブレンドモード、フィルター、速度等）を
適用して新しい動画を自動量産するデスクトップアプリケーション。
音声は処理せず、無音（音声トラックなし）のMP4動画を出力します。
"""

import os
import sys
import glob
import random
import time
import threading
import queue
import numpy as np
import cv2
from PIL import Image, ImageTk
import tkinter as tk
from tkinter import ttk, messagebox, filedialog, scrolledtext

# Windowsコンソール出力の文字化け対策
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS_DIR = os.path.join(BASE_DIR, "exports")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
MIXED_DIR = os.path.join(OUTPUT_DIR, "mixed")

# 出力先ディレクトリの確保
os.makedirs(MIXED_DIR, exist_ok=True)


class VideoLayerConfig:
    """レイヤーごとの合成設定を保持するクラス"""
    def __init__(self, name):
        self.name = name
        self.filepath = ""
        self.chroma_threshold = 20  # 黒抜き閾値 (0-255)
        self.blend_mode = "Normal"  # Normal / Screen / Add / Multiply / Difference / Overlay
        self.filter_type = "None"   # None / Grayscale / Sepia / HueRotate / RGBSplit / Neon
        self.hue_offset = 0        # 色相回転オフセット (0-180)
        self.speed = 1.0            # 再生速度倍率
        self.delay = 0.0            # 開始ディレイ（秒）
        self.loop = True            # ループ再生するか
        self.opacity = 1.0          # 不透明度 (0.0 - 1.0)


class VideoMixerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("🎬 MovieCreator - Video Mixer & Random Generator")
        self.root.geometry("1100x800")
        self.root.minsize(1000, 750)

        # テーマカラー (Catppuccin Mocha風ダークテーマ)
        self.bg_color = "#181825"
        self.card_bg = "#1e1e2e"
        self.fg_color = "#cdd6f4"
        self.fg_sub = "#a6adc8"
        self.accent_blue = "#89b4fa"
        self.accent_green = "#a6e3a1"
        self.accent_red = "#f38ba8"
        self.accent_purple = "#cba6f7"
        self.accent_gold = "#f9e2af"
        self.border_color = "#313244"

        self.root.configure(bg=self.bg_color)
        
        # 内部状態
        self.video_assets = []
        self.layers = [
            VideoLayerConfig("Layer 1 (最背面/背景)"),
            VideoLayerConfig("Layer 2 (中層)"),
            VideoLayerConfig("Layer 3 (最前面)")
        ]
        # レイヤー1(最背面)のブレンドモードはNormal固定、ディレイ0固定、ループTrue固定
        self.layers[0].blend_mode = "Normal"
        self.layers[0].delay = 0.0
        self.layers[0].loop = True
        
        # プレビュー関連
        self.preview_frame_idx = 0
        self.preview_total_frames = 100
        self.preview_fps = 30
        self.preview_duration = 3.0
        self.preview_width = 1920
        self.preview_height = 1080
        self.current_preview_image = None
        self.preview_cache = {} # パラメータ変更時の再描画用

        # 非同期処理用
        self.log_queue = queue.Queue()
        self.running_thread = None
        self.cancel_requested = False

        self.setup_styles()
        self.create_widgets()
        self.scan_assets()
        
        # ログ監視タイマー
        self.root.after(100, self.poll_log_queue)

    def setup_styles(self):
        self.style = ttk.Style()
        self.style.theme_use("default")
        self.style.configure(".", background=self.bg_color, foreground=self.fg_color, font=("Segoe UI", 9))
        self.style.configure("TFrame", background=self.bg_color)
        self.style.configure("Card.TFrame", background=self.card_bg, relief="flat", borderwidth=0)
        self.style.configure("Header.TLabel", background=self.bg_color, foreground="#f5e0dc", font=("Segoe UI", 16, "bold"))
        self.style.configure("SubHeader.TLabel", background=self.card_bg, foreground=self.accent_blue, font=("Segoe UI", 11, "bold"))
        self.style.configure("TLabel", background=self.bg_color, foreground=self.fg_color)
        self.style.configure("Card.TLabel", background=self.card_bg, foreground=self.fg_color)
        self.style.configure("Accent.TLabel", background=self.card_bg, foreground=self.accent_purple, font=("Segoe UI", 10, "bold"))
        self.style.configure("Bold.TLabel", background=self.card_bg, font=("Segoe UI", 9, "bold"))

        # Combobox / Scale / Button等のスタイル設定
        self.style.map('TCombobox', fieldbackground=[('readonly', self.card_bg)], background=[('readonly', self.card_bg)])

    def create_widgets(self):
        # 1. ヘッダー
        header_frame = ttk.Frame(self.root, padding=(20, 10, 20, 5))
        header_frame.pack(fill="x")
        
        title_lbl = ttk.Label(header_frame, text="🎬 MovieCreator Video Mixer & Random Generator", style="Header.TLabel")
        title_lbl.pack(side="left")

        # 2. メインコンテナ (左右分割)
        main_pane = ttk.PanedWindow(self.root, orient="horizontal")
        main_pane.pack(fill="both", expand=True, padx=20, pady=10)

        # 左ペイン: アセットリスト ＆ レイヤー設定 (幅広め)
        left_container = ttk.Frame(main_pane)
        main_pane.add(left_container, weight=3)

        # 右ペイン: プレビュー ＆ コンソール ＆ 量産設定
        right_container = ttk.Frame(main_pane)
        main_pane.add(right_container, weight=2)

        # --- 左ペイン構成 ---
        # A. 素材アセットリストエリア
        assets_card = ttk.Frame(left_container, style="Card.TFrame", padding=10)
        assets_card.pack(fill="x", pady=(0, 10))

        assets_header = ttk.Frame(assets_card, style="Card.TFrame")
        assets_header.pack(fill="x", pady=(0, 5))
        ttk.Label(assets_header, text="📁 素材動画アセット", style="SubHeader.TLabel").pack(side="left")
        
        btn_scan = tk.Button(
            assets_header, text="🔄 再スキャン", bg="#313244", fg=self.accent_blue,
            activebackground="#45475a", activeforeground="#ffffff", font=("Segoe UI", 8, "bold"),
            bd=0, padx=8, pady=2, cursor="hand2", command=self.scan_assets
        )
        btn_scan.pack(side="right", padx=5)

        btn_add_file = tk.Button(
            assets_header, text="➕ ファイル追加", bg="#313244", fg=self.accent_green,
            activebackground="#45475a", activeforeground="#ffffff", font=("Segoe UI", 8, "bold"),
            bd=0, padx=8, pady=2, cursor="hand2", command=self.add_asset_file
        )
        btn_add_file.pack(side="right")

        # リストボックス
        list_frame = ttk.Frame(assets_card)
        list_frame.pack(fill="x", pady=5)
        
        self.asset_listbox = tk.Listbox(
            list_frame, bg="#11111b", fg=self.fg_color, selectbackground=self.accent_blue,
            selectforeground="#11111b", font=("Consolas", 9), bd=0, height=5,
            highlightthickness=1, highlightbackground=self.border_color
        )
        self.asset_listbox.pack(side="left", fill="x", expand=True)
        
        scroll = ttk.Scrollbar(list_frame, orient="vertical", command=self.asset_listbox.yview)
        scroll.pack(side="right", fill="y")
        self.asset_listbox.config(yscrollcommand=scroll.set)

        # B. レイヤー設定エリア
        layers_card = ttk.Frame(left_container, style="Card.TFrame", padding=10)
        layers_card.pack(fill="both", expand=True)
        ttk.Label(layers_card, text="⚙️ レイヤー合成パラメータ設定", style="SubHeader.TLabel").pack(anchor="w", pady=(0, 10))

        # 3つのレイヤー用アコーディオン風フレーム
        self.layer_ui_configs = []
        for i, lyr in enumerate(self.layers):
            lyr_frame = tk.LabelFrame(
                layers_card, text=f" {lyr.name} ", 
                bg=self.card_bg, fg=self.accent_blue,
                font=("Segoe UI", 9, "bold"), bd=1, relief="solid",
                highlightbackground=self.border_color
            )
            lyr_frame.pack(fill="x", pady=4)
            
            ui = self.build_layer_controls(lyr_frame, lyr, i)
            self.layer_ui_configs.append(ui)

        # --- 右ペイン構成 ---
        # A. プレビューエリア
        preview_card = ttk.Frame(right_container, style="Card.TFrame", padding=10)
        preview_card.pack(fill="x", pady=(0, 10))
        
        preview_header = ttk.Frame(preview_card, style="Card.TFrame")
        preview_header.pack(fill="x", pady=(0, 5))
        ttk.Label(preview_header, text="👁️ 静止画プレビュー", style="SubHeader.TLabel").pack(side="left")
        
        self.lbl_preview_info = ttk.Label(preview_header, text="No Video", style="Bold.TLabel", foreground=self.accent_purple)
        self.lbl_preview_info.pack(side="right")

        # プレビュー描画用キャンバス
        self.preview_canvas = tk.Canvas(
            preview_card, bg="#11111b", width=384, height=216, 
            bd=0, highlightthickness=1, highlightbackground=self.border_color
        )
        self.preview_canvas.pack(fill="x", pady=5)
        
        # タイムラインスライダー
        slider_frame = ttk.Frame(preview_card, style="Card.TFrame")
        slider_frame.pack(fill="x", pady=2)
        
        self.preview_slider = ttk.Scale(
            slider_frame, from_=0, to=99, orient="horizontal", command=self.on_slider_move
        )
        self.preview_slider.pack(side="left", fill="x", expand=True, padx=(0, 8))
        
        self.lbl_slider_time = ttk.Label(slider_frame, text="0.0s (0/100)", style="Bold.TLabel", width=12)
        self.lbl_slider_time.pack(side="right")

        # 簡易プレビュー動画生成ボタン
        btn_quick_preview = tk.Button(
            preview_card, text="🎬 3秒間の簡易ビデオプレビューを生成して再生", bg="#313244", fg=self.accent_gold,
            activebackground="#45475a", activeforeground="#ffffff", font=("Segoe UI", 9, "bold"),
            bd=0, pady=5, cursor="hand2", command=self.generate_quick_preview
        )
        btn_quick_preview.pack(fill="x", pady=(5, 0))

        # B. アクション ＆ 量産設定エリア
        actions_card = ttk.Frame(right_container, style="Card.TFrame", padding=10)
        actions_card.pack(fill="x", pady=(0, 10))
        ttk.Label(actions_card, text="🚀 レンダリング ＆ 量産オプション", style="SubHeader.TLabel").pack(anchor="w", pady=(0, 8))

        # 量産設定
        options_frame = ttk.Frame(actions_card, style="Card.TFrame")
        options_frame.pack(fill="x", pady=5)

        ttk.Label(options_frame, text="量産生成本数:", style="Card.TLabel").grid(row=0, column=0, sticky="w", pady=4)
        self.spin_batch_count = ttk.Spinbox(options_frame, from_=1, to=100, width=5)
        self.spin_batch_count.set(5)
        self.spin_batch_count.grid(row=0, column=1, sticky="w", padx=5)

        self.var_rand_filter = tk.BooleanVar(value=True)
        chk_filter = tk.Checkbutton(
            options_frame, text="フィルターのランダム適用", variable=self.var_rand_filter,
            bg=self.card_bg, fg=self.fg_color, activebackground=self.card_bg, activeforeground=self.fg_color,
            selectcolor="#11111b"
        )
        chk_filter.grid(row=1, column=0, columnspan=2, sticky="w", pady=2)

        self.var_rand_blend = tk.BooleanVar(value=True)
        chk_blend = tk.Checkbutton(
            options_frame, text="ブレンドモードのランダム適用", variable=self.var_rand_blend,
            bg=self.card_bg, fg=self.fg_color, activebackground=self.card_bg, activeforeground=self.fg_color,
            selectcolor="#11111b"
        )
        chk_blend.grid(row=2, column=0, columnspan=2, sticky="w", pady=2)

        self.var_rand_speed = tk.BooleanVar(value=False)
        chk_speed = tk.Checkbutton(
            options_frame, text="再生速度のランダム適用", variable=self.var_rand_speed,
            bg=self.card_bg, fg=self.fg_color, activebackground=self.card_bg, activeforeground=self.fg_color,
            selectcolor="#11111b"
        )
        chk_speed.grid(row=3, column=0, columnspan=2, sticky="w", pady=2)

        # 実行ボタン行
        btn_frame = ttk.Frame(actions_card, style="Card.TFrame")
        btn_frame.pack(fill="x", pady=8)

        self.btn_mix_single = tk.Button(
            btn_frame, text="🎨 設定通りに1本合成", bg=self.accent_blue, fg="#11111b",
            activebackground="#74c7ec", activeforeground="#11111b", font=("Segoe UI", 10, "bold"),
            bd=0, padx=12, pady=8, cursor="hand2", command=self.start_single_mix
        )
        self.btn_mix_single.pack(side="left", fill="x", expand=True, padx=(0, 4))

        self.btn_mix_batch = tk.Button(
            btn_frame, text="⚡ ランダム量産開始", bg=self.accent_green, fg="#11111b",
            activebackground="#a6e3a1", activeforeground="#11111b", font=("Segoe UI", 10, "bold"),
            bd=0, padx=12, pady=8, cursor="hand2", command=self.start_batch_mix
        )
        self.btn_mix_batch.pack(side="right", fill="x", expand=True, padx=(4, 0))

        # 中断ボタン（通常非表示、実行時有効化）
        self.btn_cancel = tk.Button(
            actions_card, text="🛑 処理をキャンセル", bg=self.accent_red, fg="#11111b",
            activebackground="#f38ba8", activeforeground="#11111b", font=("Segoe UI", 9, "bold"),
            bd=0, pady=6, cursor="hand2", command=self.request_cancel
        )
        self.btn_cancel.pack(fill="x", pady=(2, 0))
        self.btn_cancel.pack_forget()

        # C. ログ・ステータス
        log_card = ttk.Frame(right_container, style="Card.TFrame", padding=10)
        log_card.pack(fill="both", expand=True)
        ttk.Label(log_card, text="💻 コンソールログ", style="SubHeader.TLabel").pack(anchor="w", pady=(0, 5))

        self.log_text = scrolledtext.ScrolledText(
            log_card, bg="#11111b", fg=self.accent_green, insertbackground="white",
            font=("Consolas", 8), bd=0, relief="flat", height=8
        )
        self.log_text.pack(fill="both", expand=True)
        
        # D. 進捗プログレスバー
        self.progress_bar = ttk.Progressbar(log_card, mode="determinate")
        self.progress_bar.pack(fill="x", pady=(5, 0))

        self.append_log("✨ MovieCreator Video Mixer 準備完了。\n")

    def build_layer_controls(self, parent, lyr, index):
        """各レイヤーのコントロールUIを構築"""
        parent.columnconfigure(1, weight=3)
        parent.columnconfigure(3, weight=2)
        
        widgets = {}

        # 1行目: 動画アセット選択
        ttk.Label(parent, text="動画アセット:", style="Card.TLabel").grid(row=0, column=0, sticky="w", padx=2, pady=2)
        
        # 割り当て用Combobox
        cb_asset = ttk.Combobox(parent, state="readonly", font=("Segoe UI", 9))
        cb_asset.grid(row=0, column=1, columnspan=3, sticky="ew", padx=2, pady=2)
        cb_asset.bind("<<ComboboxSelected>>", lambda e: self.on_layer_asset_changed(index, cb_asset.get()))
        widgets["cb_asset"] = cb_asset

        # 2行目: ブレンドモード ＆ フィルター
        ttk.Label(parent, text="ブレンド:", style="Card.TLabel").grid(row=1, column=0, sticky="w", padx=2, pady=2)
        
        blend_modes = ["Normal", "Screen", "Add", "Multiply", "Difference", "Overlay"]
        cb_blend = ttk.Combobox(parent, values=blend_modes, state="readonly", width=10)
        cb_blend.set(lyr.blend_mode)
        if index == 0:
            cb_blend.config(state="disabled") # 最背面はNormal固定
        else:
            cb_blend.bind("<<ComboboxSelected>>", lambda e: self.update_param(index, "blend_mode", cb_blend.get()))
        cb_blend.grid(row=1, column=1, sticky="w", padx=2, pady=2)
        widgets["cb_blend"] = cb_blend

        ttk.Label(parent, text="フィルター:", style="Card.TLabel").grid(row=1, column=2, sticky="w", padx=2, pady=2)
        
        filters = ["None", "Grayscale", "Sepia", "HueRotate", "RGBSplit", "Neon"]
        cb_filter = ttk.Combobox(parent, values=filters, state="readonly", width=10)
        cb_filter.set(lyr.filter_type)
        cb_filter.bind("<<ComboboxSelected>>", lambda e: self.on_filter_changed(index, cb_filter.get()))
        cb_filter.grid(row=1, column=3, sticky="w", padx=2, pady=2)
        widgets["cb_filter"] = cb_filter

        # 3行目: 黒抜き閾値 (最背面以外のみ)
        ttk.Label(parent, text="黒抜き閾値:", style="Card.TLabel").grid(row=2, column=0, sticky="w", padx=2, pady=2)
        
        val_lbl_chroma = ttk.Label(parent, text=str(lyr.chroma_threshold), style="Bold.TLabel", width=4)
        
        def make_chroma_cmd(idx, lbl):
            return lambda val: self.update_slider_param(idx, "chroma_threshold", float(val), lbl, int)
        
        scale_chroma = ttk.Scale(
            parent, from_=0, to=100, value=lyr.chroma_threshold,
            command=make_chroma_cmd(index, val_lbl_chroma)
        )
        scale_chroma.grid(row=2, column=1, sticky="ew", padx=2, pady=2)
        val_lbl_chroma.grid(row=2, column=2, sticky="w", padx=2, pady=2)
        widgets["scale_chroma"] = scale_chroma
        widgets["lbl_chroma"] = val_lbl_chroma
        
        if index == 0:
            scale_chroma.config(state="disabled") # 最背面は黒抜き不要

        # 不透明度
        ttk.Label(parent, text="不透明度:", style="Card.TLabel").grid(row=2, column=3, sticky="w", padx=2, pady=2)
        val_lbl_opacity = ttk.Label(parent, text=f"{int(lyr.opacity*100)}%", style="Bold.TLabel", width=5)
        
        def make_opacity_cmd(idx, lbl):
            return lambda val: self.update_slider_param(idx, "opacity", float(val)/100.0, lbl, lambda v: f"{int(v*100)}%")

        scale_opacity = ttk.Scale(
            parent, from_=0, to=100, value=int(lyr.opacity*100),
            command=make_opacity_cmd(index, val_lbl_opacity)
        )
        scale_opacity.grid(row=2, column=4, sticky="ew", padx=2, pady=2)
        val_lbl_opacity.grid(row=2, column=5, sticky="w", padx=2, pady=2)
        widgets["scale_opacity"] = scale_opacity
        widgets["lbl_opacity"] = val_lbl_opacity

        # 4行目: 再生速度 ＆ ディレイ (最背面以外のみ) ＆ ループ
        ttk.Label(parent, text="再生速度:", style="Card.TLabel").grid(row=3, column=0, sticky="w", padx=2, pady=2)
        
        speeds = ["0.5", "1.0", "1.5", "2.0"]
        cb_speed = ttk.Combobox(parent, values=speeds, state="readonly", width=5)
        cb_speed.set(str(lyr.speed))
        cb_speed.bind("<<ComboboxSelected>>", lambda e: self.update_param(index, "speed", float(cb_speed.get())))
        cb_speed.grid(row=3, column=1, sticky="w", padx=2, pady=2)
        widgets["cb_speed"] = cb_speed

        ttk.Label(parent, text="開始遅延:", style="Card.TLabel").grid(row=3, column=2, sticky="w", padx=2, pady=2)
        val_lbl_delay = ttk.Label(parent, text=f"{lyr.delay:.1f}s", style="Bold.TLabel", width=6)
        
        def make_delay_cmd(idx, lbl):
            return lambda val: self.update_slider_param(idx, "delay", float(val), lbl, lambda v: f"{v:.1f}s")
            
        scale_delay = ttk.Scale(
            parent, from_=0.0, to=5.0, value=lyr.delay,
            command=make_delay_cmd(index, val_lbl_delay)
        )
        scale_delay.grid(row=3, column=3, sticky="ew", padx=2, pady=2)
        val_lbl_delay.grid(row=3, column=4, sticky="w", padx=2, pady=2)
        widgets["scale_delay"] = scale_delay
        widgets["lbl_delay"] = val_lbl_delay
        
        if index == 0:
            cb_speed.config(state="disabled")
            scale_delay.config(state="disabled")

        # ループ設定チェックボックス
        var_loop = tk.BooleanVar(value=lyr.loop)
        chk_loop = tk.Checkbutton(
            parent, text="ループ", variable=var_loop,
            bg=self.card_bg, fg=self.fg_color, activebackground=self.card_bg, activeforeground=self.fg_color,
            selectcolor="#11111b", command=lambda: self.update_param(index, "loop", var_loop.get())
        )
        chk_loop.grid(row=3, column=5, sticky="w", padx=2, pady=2)
        widgets["chk_loop"] = chk_loop
        widgets["var_loop"] = var_loop
        
        if index == 0:
            chk_loop.config(state="disabled")

        # 5行目: フィルターがHueRotateの時のみ表示される色相スライダー
        self.hue_lbl = ttk.Label(parent, text="色相シフト:", style="Card.TLabel")
        self.hue_lbl.grid(row=4, column=0, sticky="w", padx=2, pady=2)
        self.hue_lbl.grid_remove() # 初期状態は非表示
        
        self.val_lbl_hue = ttk.Label(parent, text=f"{lyr.hue_offset}°", style="Bold.TLabel", width=5)
        self.val_lbl_hue.grid(row=4, column=2, sticky="w", padx=2, pady=2)
        self.val_lbl_hue.grid_remove()

        def make_hue_cmd(idx, lbl):
            return lambda val: self.update_slider_param(idx, "hue_offset", float(val), lbl, lambda v: f"{int(v)}°")

        self.scale_hue = ttk.Scale(
            parent, from_=0, to=180, value=lyr.hue_offset,
            command=make_hue_cmd(index, self.val_lbl_hue)
        )
        self.scale_hue.grid(row=4, column=1, sticky="ew", padx=2, pady=2)
        self.scale_hue.grid_remove()
        
        widgets["lbl_hue_title"] = self.hue_lbl
        widgets["scale_hue"] = self.scale_hue
        widgets["lbl_hue"] = self.val_lbl_hue

        return widgets

    def scan_assets(self):
        """exports/ と output/ から動画ファイルをスキャンして読み込む"""
        self.video_assets = []
        self.append_log("🔍 素材動画ファイルをスキャン中...\n")
        
        # 拡張子パターン
        patterns = ["*.mp4", "*.webm", "*.mov", "*.avi"]
        
        scanned_files = []
        # exports
        if os.path.exists(EXPORTS_DIR):
            for pat in patterns:
                scanned_files.extend(glob.glob(os.path.join(EXPORTS_DIR, pat)))
        # output
        if os.path.exists(OUTPUT_DIR):
            for pat in patterns:
                scanned_files.extend(glob.glob(os.path.join(OUTPUT_DIR, pat)))
                
        # 重複削除＆ソート
        scanned_files = sorted(list(set(scanned_files)), key=os.path.getmtime, reverse=True)
        
        self.asset_listbox.delete(0, tk.END)
        
        # リスト追加
        self.video_assets.append("") # 未設定枠
        self.asset_listbox.insert(tk.END, "(設定なし)")
        
        for path in scanned_files:
            # 相対パス表記などで見やすくする
            filename = os.path.basename(path)
            folder = "exports" if "exports" in path else "output"
            display_name = f"[{folder}] {filename}"
            
            self.video_assets.append(path)
            self.asset_listbox.insert(tk.END, display_name)
            
        self.append_log(f"✅ スキャン完了: {len(scanned_files)} 個の動画が見つかりました。\n")
        
        # 各レイヤーのドロップダウンリストを更新
        dropdown_list = ["(設定なし)"] + [
            f"[{'exports' if 'exports' in p else 'output'}] {os.path.basename(p)}" 
            for p in self.video_assets if p
        ]
        
        for i, ui in enumerate(self.layer_ui_configs):
            ui["cb_asset"].config(values=dropdown_list)
            # 現在のパスに対応する値を選択
            curr_path = self.layers[i].filepath
            if curr_path and curr_path in self.video_assets:
                idx = self.video_assets.index(curr_path)
                ui["cb_asset"].current(idx)
            else:
                ui["cb_asset"].current(0)
                self.layers[i].filepath = ""

    def add_asset_file(self):
        """手動で動画ファイルを選択してアセットに追加"""
        file_path = filedialog.askopenfilename(
            title="素材動画ファイルを選択",
            filetypes=[("Video files", "*.mp4 *.webm *.mov *.avi"), ("All files", "*.*")]
        )
        if file_path:
            file_path = os.path.abspath(file_path)
            if file_path not in self.video_assets:
                self.video_assets.insert(1, file_path) # "(設定なし)"の直後に挿入
                filename = os.path.basename(file_path)
                display_name = f"[manual] {filename}"
                self.asset_listbox.insert(1, display_name)
                
                # ドロップダウン再生成
                dropdown_list = ["(設定なし)"] + [
                    f"[{'exports' if 'exports' in p else 'output' if 'output' in p else 'manual'}] {os.path.basename(p)}" 
                    for p in self.video_assets if p
                ]
                for ui in self.layer_ui_configs:
                    ui["cb_asset"].config(values=dropdown_list)
                
                self.append_log(f"➕ 手動追加しました: {filename}\n")
                
                # 自動で選択
                self.asset_listbox.select_clear(0, tk.END)
                self.asset_listbox.select_set(1)

    def on_layer_asset_changed(self, layer_idx, selection):
        """レイヤーの割り当て動画が変更された時の処理"""
        if selection == "(設定なし)" or not selection:
            self.layers[layer_idx].filepath = ""
            self.append_log(f"Layer {layer_idx+1}: 割り当て解除\n")
        else:
            # 選択インデックスを取得
            try:
                # cb_assetの現在値からインデックス取得
                cb_val = self.layer_ui_configs[layer_idx]["cb_asset"].current()
                self.layers[layer_idx].filepath = self.video_assets[cb_val]
                self.append_log(f"Layer {layer_idx+1}: 割り当て ➔ {os.path.basename(self.layers[layer_idx].filepath)}\n")
            except Exception as e:
                print(e)
                
        # レイヤー1(背景)が変わったらプレビュー全体の基準を再構築
        if layer_idx == 0:
            self.rebuild_preview_base()
        else:
            self.clear_preview_cache()
            self.update_preview()

    def on_filter_changed(self, layer_idx, filter_type):
        """フィルターが変更された時、HueRotateなら色相スライダーを表示"""
        self.layers[layer_idx].filter_type = filter_type
        ui = self.layer_ui_configs[layer_idx]
        
        if filter_type == "HueRotate":
            ui["lbl_hue_title"].grid()
            ui["scale_hue"].grid()
            ui["lbl_hue"].grid()
        else:
            ui["lbl_hue_title"].grid_remove()
            ui["scale_hue"].grid_remove()
            ui["lbl_hue"].grid_remove()
            
        self.clear_preview_cache()
        self.update_preview()

    def update_param(self, layer_idx, param_name, value):
        """通常のドロップダウン等のパラメータ変更時"""
        setattr(self.layers[layer_idx], param_name, value)
        self.clear_preview_cache()
        self.update_preview()

    def update_slider_param(self, layer_idx, param_name, value, label_widget, format_func):
        """スライダーパラメータ変更時（リアルタイムプレビュー更新）"""
        setattr(self.layers[layer_idx], param_name, value)
        label_widget.config(text=str(format_func(value)))
        
        # ドラッグ時の負荷軽減のため、プレビュー更新を短時間遅延させるか、プレビューキャッシュをクリアして再描画
        self.clear_preview_cache()
        self.update_preview()

    def rebuild_preview_base(self):
        """レイヤー1(背景)の情報からプレビュー基準を更新"""
        self.clear_preview_cache()
        bg_path = self.layers[0].filepath
        if not bg_path or not os.path.exists(bg_path):
            self.lbl_preview_info.config(text="No Base Video", foreground=self.accent_red)
            self.preview_slider.config(to=100)
            self.preview_slider.set(0)
            return

        cap = cv2.VideoCapture(bg_path)
        self.preview_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.preview_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self.preview_total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 100
        self.preview_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        self.preview_duration = self.preview_total_frames / self.preview_fps
        cap.release()

        self.lbl_preview_info.config(
            text=f"Base: {self.preview_width}x{self.preview_height} | {self.preview_fps:.1f}fps | {self.preview_duration:.1f}s",
            foreground=self.accent_purple
        )
        
        self.preview_slider.config(to=self.preview_total_frames - 1)
        self.preview_slider.set(0)
        self.preview_frame_idx = 0
        self.update_slider_label()
        self.update_preview()

    def update_slider_label(self):
        curr_time = self.preview_frame_idx / self.preview_fps
        self.lbl_slider_time.config(
            text=f"{curr_time:.1f}s ({self.preview_frame_idx}/{self.preview_total_frames})"
        )

    def on_slider_move(self, val):
        idx = int(float(val))
        if idx != self.preview_frame_idx:
            self.preview_frame_idx = idx
            self.update_slider_label()
            self.update_preview()

    def clear_preview_cache(self):
        self.preview_cache.clear()

    def update_preview(self):
        """現在のフレームインデックスに基づいて合成し、Canvasに描画"""
        bg_path = self.layers[0].filepath
        if not bg_path or not os.path.exists(bg_path):
            # 背景がない場合は黒画面を表示
            self.preview_canvas.delete("all")
            self.preview_canvas.create_text(
                192, 108, text="背景動画(Layer 1)を選択してください", 
                fill=self.fg_sub, font=("Segoe UI", 10)
            )
            return

        # キャッシュ確認
        cache_key = self.preview_frame_idx
        if cache_key in self.preview_cache:
            self.draw_preview_image(self.preview_cache[cache_key])
            return

        # 合成処理
        frame = self.generate_composite_frame(self.preview_frame_idx)
        if frame is not None:
            # プレビューサイズ（384x216）にリサイズ
            preview_img = cv2.resize(frame, (384, 216))
            preview_img = cv2.cvtColor(preview_img, cv2.COLOR_BGR2RGB)
            
            # キャッシュ保存
            self.preview_cache[cache_key] = preview_img
            self.draw_preview_image(preview_img)

    def draw_preview_image(self, rgb_img):
        # PIL ImageTk に変換
        im = Image.fromarray(rgb_img)
        self.current_preview_image = ImageTk.PhotoImage(image=im)
        self.preview_canvas.delete("all")
        self.preview_canvas.create_image(0, 0, anchor="nw", image=self.current_preview_image)

    # --- 画像処理・合成の核心部 ---
    def apply_filter(self, img, filter_type, hue_offset=0):
        """OpenCVで各種エフェクト・フィルター処理"""
        if filter_type == "None" or filter_type == "":
            return img
            
        if filter_type == "Grayscale":
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
            
        elif filter_type == "Sepia":
            # セピア変換行列
            kernel = np.array([
                [0.272, 0.534, 0.131],
                [0.349, 0.686, 0.168],
                [0.393, 0.769, 0.189]
            ])
            sepia = cv2.transform(img, kernel)
            return np.clip(sepia, 0, 255).astype(np.uint8)
            
        elif filter_type == "HueRotate":
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            h, s, v = cv2.split(hsv)
            # OpenCVのHチャンネルは0-180の範囲
            h = ((h.astype(int) + int(hue_offset)) % 180).astype(np.uint8)
            hsv_rot = cv2.merge([h, s, v])
            return cv2.cvtColor(hsv_rot, cv2.COLOR_HSV2BGR)
            
        elif filter_type == "RGBSplit":
            # 色収差エフェクト。RチャンネルとBチャンネルを左右に少しずらす
            shift = int(img.shape[1] * 0.008) or 3
            b, g, r = cv2.split(img)
            
            # チャンネルをローリングシフト
            b_shifted = np.roll(b, shift, axis=1)
            r_shifted = np.roll(r, -shift, axis=1)
            
            return cv2.merge([b_shifted, g, r_shifted])
            
        elif filter_type == "Neon":
            # エッジ検出を行い、ネオン風に光らせる
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            
            # Cannyエッジを太くし、ブラーをかける
            edges_dilated = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
            glow = cv2.GaussianBlur(edges_dilated, (9, 9), 0)
            
            # ネオンカラー（シアン #00f0ff ➔ OpenCV of BGR:[255, 240, 0]）
            neon_mask = edges_dilated > 0
            glow_mask = glow > 0
            
            neon_img = np.zeros_like(img)
            # ブラー光沢部分（薄いシアン）
            neon_img[glow_mask] = [200, 180, 0]
            # コアの光部分（明るいシアン/白）
            neon_img[neon_mask] = [255, 255, 255]
            
            # 元画像とエッジ発光画像をブレンド
            return cv2.addWeighted(img, 0.4, neon_img, 0.8, 0)
            
        return img

    def apply_blend_mode(self, base, lyr, mode, mask=None, opacity=1.0):
        """様々なブレンドモードを適用したNumPy高速合成"""
        base_f = base.astype(float)
        lyr_f = lyr.astype(float)
        
        # 1. ブレンド計算
        if mode == "Normal":
            blend = lyr_f
            
        elif mode == "Screen":
            blend = 255.0 - ((255.0 - base_f) * (255.0 - lyr_f) / 255.0)
            
        elif mode == "Add":
            blend = np.minimum(base_f + lyr_f, 255.0)
            
        elif mode == "Multiply":
            blend = (base_f * lyr_f) / 255.0
            
        elif mode == "Difference":
            blend = np.abs(base_f - lyr_f)
            
        elif mode == "Overlay":
            mask_low = base_f < 128.0
            blend = np.zeros_like(base_f)
            # 低輝度部分
            blend[mask_low] = (2.0 * base_f[mask_low] * lyr_f[mask_low]) / 255.0
            # 高輝度部分
            blend[~mask_low] = 255.0 - 2.0 * (255.0 - base_f[~mask_low]) * (255.0 - lyr_f[~mask_low]) / 255.0
            
        else:
            blend = lyr_f

        # 2. マスク（黒抜き）および不透明度(opacity)の適用
        if mask is not None:
            # マスクの正規化アルファ (0.0 - 1.0)
            alpha = (mask.astype(float) / 255.0) * opacity
        else:
            alpha = np.ones_like(base_f) * opacity
            
        # 3チャンネルに拡張
        if len(alpha.shape) == 2:
            alpha = np.expand_dims(alpha, axis=2)

        # ブレンド結果と背面画像をアルファブレンド
        composite = blend * alpha + base_f * (1.0 - alpha)
        return np.clip(composite, 0, 255).astype(np.uint8)

    def generate_composite_frame(self, frame_idx):
        """指定されたフレームインデックスの合成画像を生成"""
        # 背景（レイヤー1）
        bg_path = self.layers[0].filepath
        if not bg_path or not os.path.exists(bg_path):
            return None

        # 背景画像取得
        cap_bg = cv2.VideoCapture(bg_path)
        cap_bg.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame_composite = cap_bg.read()
        cap_bg.release()
        
        if not ret or frame_composite is None:
            return None

        # 背景サイズ
        bg_h, bg_w = frame_composite.shape[:2]

        # 背景にフィルター適用
        frame_composite = self.apply_filter(
            frame_composite, self.layers[0].filter_type, self.layers[0].hue_offset
        )

        # レイヤー2、レイヤー3を順に重ねる
        for lyr_idx in [1, 2]:
            lyr = self.layers[lyr_idx]
            if not lyr.filepath or not os.path.exists(lyr.filepath):
                continue
                
            # ディレイの考慮
            # 現在の時間が開始ディレイ秒未満なら合成しない
            time_sec = frame_idx / self.preview_fps
            if time_sec < lyr.delay:
                continue

            # 重ねる動画の読み込みフレームインデックスを計算
            cap_lyr = cv2.VideoCapture(lyr.filepath)
            total_lyr_frames = int(cap_lyr.get(cv2.CAP_PROP_FRAME_COUNT)) or 100
            
            # ディレイ分を引いた経過フレーム数
            elapsed_frames = int((time_sec - lyr.delay) * self.preview_fps)
            # 再生速度を考慮したフレームインデックス
            target_lyr_idx = int(elapsed_frames * lyr.speed)

            # 範囲外・ループ処理
            if target_lyr_idx >= total_lyr_frames:
                if lyr.loop:
                    target_lyr_idx = target_lyr_idx % total_lyr_frames
                else:
                    target_lyr_idx = total_lyr_frames - 1  # 最終フレーム固定

            cap_lyr.set(cv2.CAP_PROP_POS_FRAMES, target_lyr_idx)
            ret_lyr, frame_lyr = cap_lyr.read()
            cap_lyr.release()

            if not ret_lyr or frame_lyr is None:
                continue

            # 背景解像度に合わせてアスペクト比維持しつつリサイズ＆中央配置
            frame_lyr_resized = self.resize_and_pad(frame_lyr, bg_w, bg_h)

            # フィルター適用
            frame_lyr_processed = self.apply_filter(
                frame_lyr_resized, lyr.filter_type, lyr.hue_offset
            )

            # クロマキー（Luminance Key）マスク作成 (黒抜き)
            mask = None
            if lyr.chroma_threshold > 0:
                # 輝度の計算 (B,G,Rの最大値)
                max_val = np.max(frame_lyr_processed, axis=2)
                _, mask = cv2.threshold(max_val, lyr.chroma_threshold, 255, cv2.THRESH_BINARY)
                # エッジをなめらかにするため軽くぼかす
                mask = cv2.GaussianBlur(mask, (3, 3), 0)

            # 合成
            frame_composite = self.apply_blend_mode(
                frame_composite, frame_lyr_processed, lyr.blend_mode, 
                mask=mask, opacity=lyr.opacity
            )

        return frame_composite

    def resize_and_pad(self, img, target_w, target_h):
        """アスペクト比を維持してターゲット解像度にリサイズし、黒枠を付加"""
        h, w = img.shape[:2]
        if w == target_w and h == target_h:
            return img

        # スケール計算
        scale = min(target_w / w, target_h / h)
        new_w = int(w * scale)
        new_h = int(h * scale)

        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

        # パディング (余白黒埋め)
        pad_x = (target_w - new_w) // 2
        pad_y = (target_h - new_h) // 2

        padded = np.zeros((target_h, target_w, 3), dtype=np.uint8)
        padded[pad_y:pad_y+new_h, pad_x:pad_x+new_w] = resized

        return padded

    # --- プレビュー動画再生 ---
    def generate_quick_preview(self):
        """3秒間のプレビュービデオを一時的に生成して再生"""
        if not self.layers[0].filepath:
            messagebox.showwarning("警告", "背景動画(Layer 1)が選択されていません。")
            return
            
        self.append_log("🎬 簡易プレビュー動画をレンダリング中（約3秒分）...\n")
        
        # UIロック
        self.set_ui_state("disabled")
        
        def worker():
            temp_preview_path = os.path.join(OUTPUT_DIR, "temp_mixed_preview.mp4")
            
            # 3秒分のフレーム数
            preview_sec = min(3.0, self.preview_duration)
            frames_to_render = int(preview_sec * self.preview_fps)
            
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            # プレビューなので低解像度 (960x540) で高速処理
            target_w = 960
            target_h = 540
            
            out = cv2.VideoWriter(temp_preview_path, fourcc, self.preview_fps, (target_w, target_h))
            
            for f in range(frames_to_render):
                if self.cancel_requested:
                    break
                    
                frame = self.generate_composite_frame(f)
                if frame is None:
                    break
                
                # リサイズ
                frame_res = cv2.resize(frame, (target_w, target_h))
                out.write(frame_res)
                
                # 進捗
                self.progress_bar["value"] = (f / frames_to_render) * 100
                
            out.release()
            
            if self.cancel_requested:
                self.log_queue.put("🛑 プレビュー生成がキャンセルされました。\n")
                self.cancel_requested = False
            else:
                self.log_queue.put(f"🎉 プレビュービデオ生成完了: {temp_preview_path}\n")
                # システム既定のプレーヤーで再生
                try:
                    os.startfile(temp_preview_path)
                except Exception as e:
                    self.log_queue.put(f"⚠️ 再生エラー: {e}\n")
                    
            self.progress_bar["value"] = 0
            self.root.after(10, lambda: self.set_ui_state("normal"))

        self.btn_cancel.pack(fill="x", pady=(2, 0))
        threading.Thread(target=worker, daemon=True).start()

    # --- レンダリング ＆ 量産 実行処理 ---
    def start_single_mix(self):
        """現在の設定で1本の動画を合成出力"""
        if not self.layers[0].filepath:
            messagebox.showwarning("警告", "背景動画(Layer 1)が選択されていません。")
            return
            
        self.set_ui_state("disabled")
        self.btn_cancel.pack(fill="x", pady=(2, 0))
        
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        out_filename = f"mixed_{timestamp}.mp4"
        out_path = os.path.join(MIXED_DIR, out_filename)
        
        def worker():
            self.log_queue.put(f"\n▶ レンダリング開始: {out_filename}\n")
            success = self.render_video(out_path)
            if success:
                self.log_queue.put(f"🎉 保存完了: {out_path}\n")
                # 保存ディレクトリを開く
                try:
                    os.startfile(MIXED_DIR)
                except Exception:
                    pass
            self.root.after(10, lambda: self.set_ui_state("normal"))
            self.root.after(10, lambda: self.btn_cancel.pack_forget())

        threading.Thread(target=worker, daemon=True).start()

    def start_batch_mix(self):
        """ランダム設定で一括量産レンダリングを実行"""
        # アセットが足りない場合
        valid_assets = [p for p in self.video_assets if p]
        if len(valid_assets) < 2:
            messagebox.showwarning("警告", "量産には少なくとも2つ以上の動画アセットが必要です。")
            return
            
        try:
            batch_count = int(self.spin_batch_count.get())
        except ValueError:
            batch_count = 5
            
        self.set_ui_state("disabled")
        self.btn_cancel.pack(fill="x", pady=(2, 0))
        
        def worker():
            self.log_queue.put(f"\n🚀 【量産モード起動】 合計 {batch_count} 本の動画を自動生成します。\n")
            
            filters = ["None", "Grayscale", "Sepia", "HueRotate", "RGBSplit", "Neon"]
            blend_modes = ["Normal", "Screen", "Add", "Multiply", "Difference", "Overlay"]
            speeds = [0.5, 1.0, 1.5, 2.0]
            
            generated_count = 0
            
            for b in range(batch_count):
                if self.cancel_requested:
                    self.log_queue.put("🛑 量産処理がユーザーによって中断されました。\n")
                    break
                    
                self.log_queue.put(f"\n───────────────────\n🎬 【{b+1} / {batch_count} 本目】 パラメータ自動選定中...\n")
                
                # 1. 動画アセットのランダム選定 (2〜3個)
                num_layers = random.choice([2, 3])
                chosen_assets = random.sample(valid_assets, min(num_layers, len(valid_assets)))
                
                # レイヤー1 (背景)
                self.layers[0].filepath = chosen_assets[0]
                self.log_queue.put(f"  - 背景 (Layer 1): {os.path.basename(chosen_assets[0])}\n")
                
                # レイヤーの動画サイズに基づいて基準リビルド
                self.rebuild_preview_base_silent()
                
                # レイヤー2
                self.layers[1].filepath = chosen_assets[1]
                self.log_queue.put(f"  - 重ね (Layer 2): {os.path.basename(chosen_assets[1])}\n")
                
                # レイヤー3 (3レイヤー選択された場合のみ)
                if len(chosen_assets) > 2:
                    self.layers[2].filepath = chosen_assets[2]
                    self.log_queue.put(f"  - 重ね (Layer 3): {os.path.basename(chosen_assets[2])}\n")
                else:
                    self.layers[2].filepath = ""
                    
                # 2. パラメータのランダム設定
                for idx in [0, 1, 2]:
                    lyr = self.layers[idx]
                    if not lyr.filepath:
                        continue
                        
                    # フィルターのランダム適用
                    if self.var_rand_filter.get():
                        lyr.filter_type = random.choice(filters)
                        if lyr.filter_type == "HueRotate":
                            lyr.hue_offset = random.randint(0, 180)
                    else:
                        lyr.filter_type = "None"
                        
                    # ブレンドモードのランダム適用 (最背面以外のみ)
                    if idx > 0 and self.var_rand_blend.get():
                        lyr.blend_mode = random.choice(blend_modes)
                    else:
                        lyr.blend_mode = "Normal"
                        
                    # 再生速度のランダム適用 (最背面以外のみ)
                    if idx > 0 and self.var_rand_speed.get():
                        lyr.speed = random.choice(speeds)
                    else:
                        lyr.speed = 1.0
                        
                    # その他パラメータ
                    if idx > 0:
                        lyr.chroma_threshold = random.randint(15, 35) # 黒抜き強さ
                        lyr.opacity = random.uniform(0.7, 1.0)       # 不透明度
                        lyr.delay = random.choice([0.0, 0.5, 1.0])    # ディレイ
                        lyr.loop = True
                        
                    self.log_queue.put(f"    * L{idx+1} [Blend:{lyr.blend_mode} | FX:{lyr.filter_type}(H+{lyr.hue_offset if lyr.filter_type=='HueRotate' else 0}) | Spd:{lyr.speed}x | Opac:{int(lyr.opacity*100)}%]\n")

                # 出力ファイル名
                fx_tag = f"B2{self.layers[1].blend_mode}_F2{self.layers[1].filter_type}"
                if self.layers[2].filepath:
                    fx_tag += f"_B3{self.layers[2].blend_mode}_F3{self.layers[2].filter_type}"
                
                timestamp = time.strftime("%Y%m%d_%H%M%S")
                out_filename = f"mixed_{timestamp}_{fx_tag}.mp4"
                out_path = os.path.join(MIXED_DIR, out_filename)
                
                # レンダリング実行
                success = self.render_video(out_path)
                if success:
                    generated_count += 1
                    self.log_queue.put(f"🎉 生成完了 ({generated_count}/{batch_count}): {out_filename}\n")
                    
            self.log_queue.put(f"\n✨ 量産完了: 計 {generated_count} 本の動画を {MIXED_DIR} に出力しました。\n")
            
            # UIを最新のランダム選定状態にリセット
            self.root.after(10, self.sync_ui_from_state)
            self.root.after(10, self.rebuild_preview_base)
            
            self.root.after(10, lambda: self.set_ui_state("normal"))
            self.root.after(10, lambda: self.btn_cancel.pack_forget())

        threading.Thread(target=worker, daemon=True).start()

    def rebuild_preview_base_silent(self):
        """量産バッチ中などにUI更新を行わずに背景パラメータのみ再読込"""
        bg_path = self.layers[0].filepath
        if not bg_path or not os.path.exists(bg_path):
            return
        cap = cv2.VideoCapture(bg_path)
        self.preview_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
        self.preview_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080
        self.preview_total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 100
        self.preview_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        self.preview_duration = self.preview_total_frames / self.preview_fps
        cap.release()

    def sync_ui_from_state(self):
        """ランダム量産後に、現在のモデル状態をGUIパーツに反映"""
        dropdown_list = ["(設定なし)"] + [
            f"[{'exports' if 'exports' in p else 'output' if 'output' in p else 'manual'}] {os.path.basename(p)}" 
            for p in self.video_assets if p
        ]
        
        for i, ui in enumerate(self.layer_ui_configs):
            lyr = self.layers[i]
            
            # 動画ドロップダウン
            if lyr.filepath and lyr.filepath in self.video_assets:
                idx = self.video_assets.index(lyr.filepath)
                ui["cb_asset"].current(idx)
            else:
                ui["cb_asset"].current(0)
                
            # ブレンド
            ui["cb_blend"].set(lyr.blend_mode)
            
            # フィルター
            ui["cb_filter"].set(lyr.filter_type)
            
            # フィルターに応じたHue表示の切り替え
            self.on_filter_changed(i, lyr.filter_type)
            if lyr.filter_type == "HueRotate":
                ui["scale_hue"].set(lyr.hue_offset)
                ui["lbl_hue"].config(text=f"{int(lyr.hue_offset)}°")
                
            # スライダー
            ui["scale_chroma"].set(lyr.chroma_threshold)
            ui["lbl_chroma"].config(text=str(lyr.chroma_threshold))
            
            ui["scale_opacity"].set(int(lyr.opacity*100))
            ui["lbl_opacity"].config(text=f"{int(lyr.opacity*100)}%")
            
            # 速度 ＆ ディレイ ＆ ループ
            ui["cb_speed"].set(str(lyr.speed))
            
            ui["scale_delay"].set(lyr.delay)
            ui["lbl_delay"].config(text=f"{lyr.delay:.1f}s")
            
            ui["var_loop"].set(lyr.loop)

    def render_video(self, out_path):
        """合成動画をファイルとしてレンダリング出力（コアメソッド）"""
        bg_path = self.layers[0].filepath
        if not bg_path or not os.path.exists(bg_path):
            self.log_queue.put("❌ エラー: 背景動画がありません。\n")
            return False

        # 出力フォーマットは背景動画と同じ
        target_w = self.preview_width
        target_h = self.preview_height
        fps = self.preview_fps
        total_frames = self.preview_total_frames

        # OpenCV VideoWriter 設定 (無音MP4)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        
        out = cv2.VideoWriter(out_path, fourcc, fps, (target_w, target_h))
        
        if not out.isOpened():
            self.log_queue.put("❌ エラー: VideoWriter のオープンに失敗しました。\n")
            return False

        self.log_queue.put(f"  -> 解像度: {target_w}x{target_h} | FPS: {fps:.1f} | 総フレーム数: {total_frames}\n")

        success = True
        try:
            for f in range(total_frames):
                if self.cancel_requested:
                    success = False
                    break
                    
                frame = self.generate_composite_frame(f)
                if frame is None:
                    break
                    
                # 書き込み
                out.write(frame)
                
                # プログレスバー・ログ更新
                if f % 10 == 0 or f == total_frames - 1:
                    pct = (f / total_frames) * 100
                    self.progress_bar["value"] = pct
                    print(f"Rendering: {f}/{total_frames} ({pct:.1f}%)")
                    
            self.progress_bar["value"] = 0
            
        except Exception as e:
            self.log_queue.put(f"❌ レンダリング中エラー: {e}\n")
            success = False
            
        finally:
            out.release()
            
        if not success:
            if os.path.exists(out_path):
                try:
                    os.remove(out_path)
                except Exception:
                    pass
            return False
            
        return True

    def request_cancel(self):
        """進行中のスレッド処理を中断"""
        if self.btn_cancel.winfo_ismapped():
            self.cancel_requested = True
            self.append_log("🛑 キャンセル要求を送信しました。現在の処理完了を待っています...\n")

    def set_ui_state(self, state):
        """処理中にUIパーツを無効化 / 有効化"""
        self.btn_mix_single.config(state=state)
        self.btn_mix_batch.config(state=state)
        self.preview_slider.config(state=state)
        
        if state == "disabled":
            self.btn_cancel.pack(fill="x", pady=(2, 0))
        else:
            self.btn_cancel.pack_forget()

    def append_log(self, text):
        self.log_text.insert(tk.END, text)
        self.log_text.see(tk.END)

    def poll_log_queue(self):
        """別スレッドからのログを定期回収"""
        while not self.log_queue.empty():
            msg = self.log_queue.get_nowait()
            self.append_log(msg)
        self.root.after(100, self.poll_log_queue)


if __name__ == "__main__":
    root = tk.Tk()
    app = VideoMixerApp(root)
    root.mainloop()
