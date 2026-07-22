#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
MovieCreator Pipeline Control Center (GUI)
------------------------------------------
・MovieCreator メインWebアプリ (npm run dev)
・販売パッケージ生成 (package_builder.py)
・SNS Autopilot (sns_autopilot.py)
・LINE/X Webhook サーバー (server_bot.py)
を一括で管理・起動・監視する統合デスクトップ GUI コントロールパネル。
"""

import os
import sys
import json
import subprocess
import threading
import queue
import webbrowser
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog

# Windowsコンソール出力の文字化け・UnicodeEncodeError対策
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.join(BASE_DIR, "scripts")
CONFIG_PATH = os.path.join(SCRIPTS_DIR, "config.json")
CONFIG_EXAMPLE_PATH = os.path.join(SCRIPTS_DIR, "config.example.json")
EXPORTS_DIR = os.path.join(BASE_DIR, "exports")

if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)

try:
    from sns_autopilot import generate_pr_comment_with_ai, load_config
    from server_bot import post_to_twitter
except ImportError:
    pass


class PipelineGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("MovieCreator - Integrated Pipeline Control Center")
        self.root.geometry("900x700")
        self.root.minsize(750, 550)

        # プロセス管理
        self.main_app_process = None
        self.server_process = None
        self.log_queue = queue.Queue()

        # ダークモードテーマ設定
        self.bg_color = "#181825"
        self.card_bg = "#1e1e2e"
        self.fg_color = "#cdd6f4"
        self.accent_blue = "#89b4fa"
        self.accent_green = "#a6e3a1"
        self.accent_red = "#f38ba8"
        self.accent_purple = "#cba6f7"
        self.accent_gold = "#f9e2af"

        self.root.configure(bg=self.bg_color)
        self.setup_styles()
        self.create_widgets()

        # ログキューの定期ポーリング
        self.root.after(100, self.poll_log_queue)

    def setup_styles(self):
        self.style = ttk.Style()
        self.style.theme_use("default")

        self.style.configure(".", background=self.bg_color, foreground=self.fg_color, font=("Segoe UI", 10))
        self.style.configure("Card.TFrame", background=self.card_bg, relief="flat")
        self.style.configure("Header.TLabel", background=self.bg_color, foreground="#f5e0dc", font=("Segoe UI", 16, "bold"))
        self.style.configure("SubHeader.TLabel", background=self.card_bg, foreground=self.accent_blue, font=("Segoe UI", 11, "bold"))
        self.style.configure("Status.TLabel", background=self.card_bg, font=("Segoe UI", 10, "bold"))

    def create_widgets(self):
        # 1. ヘッダーエリア
        header_frame = ttk.Frame(self.root, padding=(15, 12, 15, 5))
        header_frame.pack(fill="x")

        title_lbl = ttk.Label(header_frame, text="🎬 MovieCreator Pipeline Control Center", style="Header.TLabel")
        title_lbl.pack(side="left")

        # 2. メインコンテナ
        main_container = ttk.Frame(self.root, padding=15)
        main_container.pack(fill="both", expand=True)

        # A. メインWebアプリ起動カード (npm run dev)
        main_app_card = ttk.Frame(main_container, style="Card.TFrame", padding=12)
        main_app_card.pack(fill="x", pady=(0, 10))

        app_title = ttk.Label(main_app_card, text="🌟 MovieCreator Web App (Vite Dev Server)", style="SubHeader.TLabel")
        app_title.grid(row=0, column=0, columnspan=3, sticky="w", pady=(0, 8))

        self.btn_main_app = tk.Button(
            main_app_card, text="🎨 MovieCreator Web UI 起動\n(npm run dev)",
            bg="#f9e2af", fg="#11111b", activebackground="#f5c2e7", activeforeground="#11111b",
            font=("Segoe UI", 10, "bold"), bd=0, padx=12, pady=8, cursor="hand2",
            command=self.toggle_main_app
        )
        self.btn_main_app.grid(row=1, column=0, padx=5, pady=2, sticky="ew")

        btn_open_browser = tk.Button(
            main_app_card, text="🌐 ブラウザで開く\n(http://localhost:5173)",
            bg="#89b4fa", fg="#11111b", activebackground="#74c7ec", activeforeground="#11111b",
            font=("Segoe UI", 10, "bold"), bd=0, padx=12, pady=8, cursor="hand2",
            command=self.open_browser
        )
        btn_open_browser.grid(row=1, column=1, padx=5, pady=2, sticky="ew")

        self.lbl_main_app_status = tk.Label(
            main_app_card, text="Main App: OFFLINE", bg=self.card_bg, fg="#f38ba8",
            font=("Segoe UI", 10, "bold")
        )
        self.lbl_main_app_status.grid(row=1, column=2, padx=10, pady=2)

        main_app_card.columnconfigure(0, weight=2)
        main_app_card.columnconfigure(1, weight=2)
        main_app_card.columnconfigure(2, weight=1)

        # B. Python パイプラインアクションカード
        ctrl_card = ttk.Frame(main_container, style="Card.TFrame", padding=12)
        ctrl_card.pack(fill="x", pady=(0, 10))

        ctrl_title = ttk.Label(ctrl_card, text="⚡ 自動化 ＆ 配信パイプラインアクション", style="SubHeader.TLabel")
        ctrl_title.grid(row=0, column=0, columnspan=3, sticky="w", pady=(0, 8))

        # ボタン行 1
        btn_pack = tk.Button(
            ctrl_card, text="📦 販売パッケージ一括生成\n(package_builder.py)",
            bg="#313244", fg="#89b4fa", activebackground="#45475a", activeforeground="#ffffff",
            font=("Segoe UI", 10, "bold"), bd=0, padx=10, pady=6, cursor="hand2",
            command=self.run_package_builder
        )
        btn_pack.grid(row=1, column=0, padx=4, pady=3, sticky="ew")

        btn_autopilot = tk.Button(
            ctrl_card, text="🚀 SNS Autopilot 実行\n(sns_autopilot.py)",
            bg="#313244", fg="#a6e3a1", activebackground="#45475a", activeforeground="#ffffff",
            font=("Segoe UI", 10, "bold"), bd=0, padx=10, pady=6, cursor="hand2",
            command=self.run_sns_autopilot
        )
        btn_autopilot.grid(row=1, column=1, padx=4, pady=3, sticky="ew")

        self.btn_server = tk.Button(
            ctrl_card, text="🟢 Webhook サーバー起動\n(server_bot.py)",
            bg="#313244", fg="#fab387", activebackground="#45475a", activeforeground="#ffffff",
            font=("Segoe UI", 10, "bold"), bd=0, padx=10, pady=6, cursor="hand2",
            command=self.toggle_server
        )
        self.btn_server.grid(row=1, column=2, padx=4, pady=3, sticky="ew")

        # ボタン行 2 (サブ機能)
        btn_config = tk.Button(
            ctrl_card, text="⚙️ config.json 編集",
            bg="#181825", fg="#cba6f7", activebackground="#313244", activeforeground="#ffffff",
            font=("Segoe UI", 9), bd=1, relief="solid", padx=10, pady=4, cursor="hand2",
            command=self.open_config_editor
        )
        btn_config.grid(row=2, column=0, padx=4, pady=(6, 0), sticky="ew")

        btn_exports = tk.Button(
            ctrl_card, text="📁 exports フォルダを開く",
            bg="#181825", fg="#94e2d5", activebackground="#313244", activeforeground="#ffffff",
            font=("Segoe UI", 9), bd=1, relief="solid", padx=10, pady=4, cursor="hand2",
            command=self.open_exports_dir
        )
        btn_exports.grid(row=2, column=1, padx=4, pady=(6, 0), sticky="ew")

        self.lbl_server_status = tk.Label(
            ctrl_card, text="Server: OFFLINE", bg=self.card_bg, fg="#f38ba8",
            font=("Segoe UI", 10, "bold")
        )

        self.lbl_server_status.grid(row=2, column=2, padx=4, pady=(6, 0))

        # ボタン行 3 (成果物X投稿)
        btn_achievement = tk.Button(
            ctrl_card, text="🎁 成果ポスト作成 & 投稿 (SAMPLE保護合成)",
            bg="#cba6f7", fg="#11111b", activebackground="#f5c2e7", activeforeground="#11111b",
            font=("Segoe UI", 10, "bold"), bd=0, padx=10, pady=6, cursor="hand2",
            command=self.create_achievement_post
        )
        btn_achievement.grid(row=3, column=0, columnspan=2, padx=4, pady=(8, 0), sticky="ew")

        btn_output = tk.Button(
            ctrl_card, text="📁 output フォルダを開く",
            bg="#181825", fg="#94e2d5", activebackground="#313244", activeforeground="#ffffff",
            font=("Segoe UI", 9), bd=1, relief="solid", padx=10, pady=4, cursor="hand2",
            command=self.open_output_dir
        )
        btn_output.grid(row=3, column=2, padx=4, pady=(8, 0), sticky="ew")

        ctrl_card.columnconfigure(0, weight=1)
        ctrl_card.columnconfigure(1, weight=1)
        ctrl_card.columnconfigure(2, weight=1)

        # C. リアルタイムコンソールログ
        log_card = ttk.Frame(main_container, style="Card.TFrame", padding=12)
        log_card.pack(fill="both", expand=True)

        log_header = ttk.Frame(log_card, style="Card.TFrame")
        log_header.pack(fill="x", pady=(0, 5))

        log_lbl = ttk.Label(log_header, text="💻 統合コンソールログ", style="SubHeader.TLabel")
        log_lbl.pack(side="left")

        btn_clear_log = tk.Button(
            log_header, text="🧹 ログ消去", bg="#181825", fg="#a6adc8",
            activebackground="#313244", bd=0, font=("Segoe UI", 9), cursor="hand2",
            command=self.clear_log
        )
        btn_clear_log.pack(side="right")

        self.log_text = scrolledtext.ScrolledText(
            log_card, bg="#11111b", fg="#a6e3a1", insertbackground="white",
            font=("Consolas", 10), bd=0, relief="flat"
        )
        self.log_text.pack(fill="both", expand=True)

        self.append_log("✨ MovieCreator Integrated Control Center 準備完了。\n")

    def append_log(self, text):
        """ログ領域へメッセージ追加"""
        self.log_text.insert(tk.END, text)
        self.log_text.see(tk.END)

    def poll_log_queue(self):
        """スレッドから送られたログをメインスレッドで描画"""
        while not self.log_queue.empty():
            msg = self.log_queue.get_nowait()
            self.append_log(msg)
        self.root.after(100, self.poll_log_queue)

    def clear_log(self):
        self.log_text.delete("1.0", tk.END)

    def open_browser(self):
        """ブラウザで http://localhost:5173 を開く"""
        webbrowser.open("http://localhost:5173")

    def toggle_main_app(self):
        """MovieCreator メインWebアプリ (npm run dev) の起動/停止切替"""
        if self.main_app_process is None or self.main_app_process.poll() is not None:
            # 起動
            env = os.environ.copy()
            env["BROWSER"] = "chrome"

            # Windowsでは npm.cmd
            npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
            cmd = [npm_cmd, "run", "dev"]

            try:
                self.main_app_process = subprocess.Popen(
                    cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, encoding="utf-8", errors="replace", cwd=BASE_DIR, env=env
                )
                self.btn_main_app.config(text="🛑 メインWeb UI 停止\n(npm run dev)", bg="#f38ba8", fg="#11111b")
                self.lbl_main_app_status.config(text="Main App: ONLINE\n(http://localhost:5173)", fg="#a6e3a1")
                self.append_log("\n🚀 MovieCreator メインWebアプリ (Vite Dev Server) を起動しました。\n")

                def read_app_log():
                    for line in self.main_app_process.stdout:
                        self.log_queue.put(f"[MainApp] {line}")
                    self.lbl_main_app_status.config(text="Main App: OFFLINE", fg="#f38ba8")
                    self.btn_main_app.config(text="🎨 MovieCreator Web UI 起動\n(npm run dev)", bg="#f9e2af", fg="#11111b")
                    self.main_app_process = None

                threading.Thread(target=read_app_log, daemon=True).start()

            except Exception as e:
                messagebox.showerror("Error", f"メインWebアプリ起動失敗: {e}")
        else:
            # 停止
            try:
                # WindowsのTaskkillツリー終了
                if sys.platform == "win32":
                    subprocess.call(["taskkill", "/F", "/T", "/PID", str(self.main_app_process.pid)])
                else:
                    self.main_app_process.terminate()
                self.main_app_process = None
                self.btn_main_app.config(text="🎨 MovieCreator Web UI 起動\n(npm run dev)", bg="#f9e2af", fg="#11111b")
                self.lbl_main_app_status.config(text="Main App: OFFLINE", fg="#f38ba8")
                self.append_log("\n🛑 MovieCreator メインWebアプリを停止しました。\n")
            except Exception as e:
                messagebox.showerror("Error", f"メインWebアプリ停止失敗: {e}")

    def run_script_in_thread(self, script_name, args=None):
        """Pythonスクリプトを別スレッドで実行"""
        def worker():
            cmd = [sys.executable, os.path.join(SCRIPTS_DIR, script_name)]
            if args:
                cmd.extend(args)

            self.log_queue.put(f"\n▶ 実行開始: {' '.join(cmd)}\n" + "-" * 50 + "\n")
            try:
                proc = subprocess.Popen(
                    cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, encoding="utf-8", errors="replace", cwd=BASE_DIR
                )
                for line in proc.stdout:
                    self.log_queue.put(line)
                proc.wait()
                self.log_queue.put("-" * 50 + f"\n✔ 終了コード: {proc.returncode}\n")
            except Exception as e:
                self.log_queue.put(f"\n❌ エラー発生 ({script_name}): {e}\n")

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()

    def run_package_builder(self):
        """販売パッケージ一括生成"""
        self.run_script_in_thread("package_builder.py")

    def run_sns_autopilot(self):
        """SNS Autopilot 実行"""
        self.run_script_in_thread("sns_autopilot.py")

    def toggle_server(self):
        """Webhook サーバー (server_bot.py) の起動/停止切替"""
        if self.server_process is None or self.server_process.poll() is not None:
            cmd = [sys.executable, os.path.join(SCRIPTS_DIR, "server_bot.py")]
            try:
                self.server_process = subprocess.Popen(
                    cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, encoding="utf-8", errors="replace", cwd=BASE_DIR
                )
                self.btn_server.config(text="🔴 サーバー停止\n(server_bot.py)", fg="#f38ba8")
                self.lbl_server_status.config(text="Server: ONLINE", fg="#a6e3a1")
                self.append_log("\n🚀 Webhook サーバー (server_bot.py) を起動しました。\n")

                def read_server_log():
                    for line in self.server_process.stdout:
                        self.log_queue.put(f"[Server] {line}")
                    self.lbl_server_status.config(text="Server: OFFLINE", fg="#f38ba8")
                    self.btn_server.config(text="🟢 Webhook サーバー起動\n(server_bot.py)", fg="#fab387")
                    self.server_process = None

                threading.Thread(target=read_server_log, daemon=True).start()

            except Exception as e:
                messagebox.showerror("Error", f"サーバー起動失敗: {e}")
        else:
            try:
                if sys.platform == "win32":
                    subprocess.call(["taskkill", "/F", "/T", "/PID", str(self.server_process.pid)])
                else:
                    self.server_process.terminate()
                self.server_process = None
                self.btn_server.config(text="🟢 Webhook サーバー起動\n(server_bot.py)", fg="#fab387")
                self.lbl_server_status.config(text="Server: OFFLINE", fg="#f38ba8")
                self.append_log("\n🛑 Webhook サーバーを停止しました。\n")
            except Exception as e:
                messagebox.showerror("Error", f"サーバー停止失敗: {e}")

    def open_exports_dir(self):
        """exports ディレクトリをエクスプローラーで開く"""
        if not os.path.exists(EXPORTS_DIR):
            os.makedirs(EXPORTS_DIR, exist_ok=True)
        os.startfile(EXPORTS_DIR)

    def open_config_editor(self):
        """config.json 編集ダイアログを開く"""
        if not os.path.exists(CONFIG_PATH):
            if os.path.exists(CONFIG_EXAMPLE_PATH):
                import shutil
                shutil.copyfile(CONFIG_EXAMPLE_PATH, CONFIG_PATH)
            else:
                messagebox.showerror("Error", "config.example.json が見つかりません。")
                return

        win = tk.Toplevel(self.root)
        win.title("config.json 設定エディタ")
        win.geometry("600x480")
        win.configure(bg=self.bg_color)

        lbl = ttk.Label(win, text="⚙️ config.json の編集", style="Header.TLabel")
        lbl.pack(anchor="w", padx=15, pady=10)

        editor = scrolledtext.ScrolledText(win, bg="#11111b", fg="#cdd6f4", font=("Consolas", 10), bd=0)
        editor.pack(fill="both", expand=True, padx=15, pady=(0, 10))

        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                editor.insert(tk.END, f.read())
        except Exception as e:
            editor.insert(tk.END, f"// ファイル読込エラー: {e}")

        def save_config():
            content = editor.get("1.0", tk.END)
            try:
                json_data = json.loads(content)
                with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                    json.dump(json_data, f, ensure_ascii=False, indent=2)
                messagebox.showinfo("Success", "config.json を保存しました！")
                win.destroy()
            except json.JSONDecodeError as e:
                messagebox.showerror("JSON Error", f"JSON構文エラーがあります:\n{e}")
            except Exception as e:
                messagebox.showerror("Error", f"保存エラー: {e}")

        btn_save = tk.Button(
            win, text="💾 保存する", bg="#a6e3a1", fg="#11111b",
            font=("Segoe UI", 10, "bold"), bd=0, padx=15, pady=6, cursor="hand2",
            command=save_config
        )
        btn_save.pack(anchor="e", padx=15, pady=(0, 12))

    def open_output_dir(self):
        """output ディレクトリをエクスプローラーで開く"""
        output_dir = os.path.join(BASE_DIR, "output")
        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        os.startfile(output_dir)

    def create_achievement_post(self):
        """成果ポスト自動化処理の実行"""
        output_dir = os.path.join(BASE_DIR, "output")
        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        # 動画ファイルを選択
        file_path = filedialog.askopenfilename(
            title="ポストする動画を選択してください",
            initialdir=output_dir,
            filetypes=[("Video files", "*.mp4 *.webm *.mov *.avi"), ("All files", "*.*")]
        )
        if not file_path:
            return

        # 別スレッドで合成とテキスト生成を実行
        self.append_log(f"\n[XPost] 成果ポスト作成プロセスを開始しました: {os.path.basename(file_path)}\n")
        
        # 進捗インジケーター（簡易モーダルダイアログ）の表示
        progress_win = tk.Toplevel(self.root)
        progress_win.title("処理中...")
        progress_win.geometry("320x130")
        progress_win.configure(bg=self.bg_color)
        progress_win.grab_set() # モーダルにする
        progress_win.resizable(False, False)

        # 親ウィンドウの中央に配置
        progress_win.update_idletasks()
        width = progress_win.winfo_width()
        height = progress_win.winfo_height()
        x = self.root.winfo_x() + (self.root.winfo_width() // 2) - (width // 2)
        y = self.root.winfo_y() + (self.root.winfo_height() // 2) - (height // 2)
        progress_win.geometry(f"+{x}+{y}")

        lbl = ttk.Label(progress_win, text="🎬 保護動画を合成 ＆ AI文案生成中...", font=("Segoe UI", 10, "bold"), background=self.bg_color, foreground=self.fg_color)
        lbl.pack(pady=20)
        
        pb = ttk.Progressbar(progress_win, mode="indeterminate", length=200)
        pb.pack(pady=5)
        pb.start(10)

        def worker():
            temp_output = os.path.join(output_dir, "temp_protected_post.mp4")
            
            try:
                # 1. 元動画の解像度を取得して最適なフォントサイズなどを計算
                import cv2
                cap = cv2.VideoCapture(file_path)
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080
                cap.release()

                # 2. Pillowを使って動的に白文字（斜め＆半透明）のウォーターマーク画像を生成
                self.log_queue.put("[XPost] 一時ウォーターマーク画像の生成を開始...\n")
                from PIL import Image, ImageDraw, ImageFont
                
                temp_watermark = os.path.join(output_dir, "temp_watermark.png")
                img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
                
                # 文字サイズは高さの8%
                font_size = int(height * 0.08)
                
                # OSに応じたフォントの読み込み
                font_path = "C:\\Windows\\Fonts\\arial.ttf"
                if sys.platform != "win32" or not os.path.exists(font_path):
                    font_path = "arial.ttf"
                
                try:
                    font = ImageFont.truetype(font_path, font_size)
                except IOError:
                    font = ImageFont.load_default()
                
                text = "SAMPLE"
                
                # 回転用の一時画像を作成
                txt_w = font_size * 5
                txt_h = font_size * 2
                txt_img = Image.new('RGBA', (txt_w, txt_h), (0, 0, 0, 0))
                txt_draw = ImageDraw.Draw(txt_img)
                
                # 白文字、不透明度30% (アルファ76) で綺麗にアンチエイリアス描画
                txt_draw.text((txt_w // 10, txt_h // 4), text, font=font, fill=(255, 255, 255, 76))
                
                # 30度回転 (反時計回り)
                rotated_txt = txt_img.rotate(30, resample=Image.BICUBIC, expand=1)
                rot_w, rot_h = rotated_txt.size
                
                # 左上、中央、右下の3箇所にペースト
                positions = [
                    (int(width * 0.2) - rot_w // 2, int(height * 0.2) - rot_h // 2),
                    (width // 2 - rot_w // 2, height // 2 - rot_h // 2),
                    (int(width * 0.8) - rot_w // 2, int(height * 0.8) - rot_h // 2)
                ]
                
                for pos in positions:
                    x = max(0, min(width - rot_w, pos[0]))
                    y = max(0, min(height - rot_h, pos[1]))
                    img.alpha_composite(rotated_txt, (x, y))
                
                img.save(temp_watermark, "PNG")

                # 3. ffmpegによる合成
                ffmpeg_exe = os.path.join(BASE_DIR, "tools", "ffmpeg", "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")
                if not os.path.exists(ffmpeg_exe):
                    ffmpeg_exe = "ffmpeg"
                
                self.log_queue.put("[XPost] ffmpeg による SAMPLE 保護レイヤーの合成を開始...\n")
                
                cmd = [
                    ffmpeg_exe, "-y",
                    "-i", file_path,
                    "-loop", "1",
                    "-i", temp_watermark,
                    "-filter_complex", "[0:v][1:v]overlay=shortest=1",
                    "-c:v", "libx264",
                    "-pix_fmt", "yuv420p",
                    "-c:a", "copy",
                    temp_output
                ]

                # コマンド実行（コンソール窓非表示設定）
                startupinfo = None
                if sys.platform == "win32":
                    startupinfo = subprocess.STARTUPINFO()
                    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                
                proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, startupinfo=startupinfo)
                if proc.returncode != 0:
                    raise RuntimeError(f"ffmpeg 合成に失敗しました (code {proc.returncode}):\n{proc.stderr[-500:]}")
                
                # 一時PNGファイルの削除
                try:
                    if os.path.exists(temp_watermark):
                        os.remove(temp_watermark)
                except Exception:
                    pass
                
                self.log_queue.put("[XPost] SAMPLE 保護テキストの合成完了。\n")

                # 2. AI文章生成
                self.log_queue.put("[XPost] Gemini API によるXポスト解説文の生成を開始...\n")
                config = load_config(CONFIG_PATH) or {}
                gemini_key = config.get("ai", {}).get("gemini_api_key")
                filename = os.path.basename(file_path)
                
                pr_text = generate_pr_comment_with_ai(gemini_key, filename)
                self.log_queue.put("[XPost] Xポスト解説文の生成完了。\n")

                # メインスレッドでダイアログ表示
                self.root.after(0, lambda: [progress_win.destroy(), self.show_x_post_review_dialog(file_path, temp_output, pr_text)])

            except Exception as e:
                self.log_queue.put(f"[XPost] エラーが発生しました: {e}\n")
                self.root.after(0, lambda: [progress_win.destroy(), messagebox.showerror("処理エラー", str(e))])

        threading.Thread(target=worker, daemon=True).start()

    def show_x_post_review_dialog(self, original_path, protected_path, initial_text):
        """添削・掲載ダイアログの表示"""
        win = tk.Toplevel(self.root)
        win.title("📝 X (Twitter) 投稿レビュー ＆ 掲載")
        win.geometry("650x550")
        win.configure(bg=self.bg_color)
        win.grab_set()

        # 親ウィンドウの中央に配置
        win.update_idletasks()
        width = win.winfo_width()
        height = win.winfo_height()
        x = self.root.winfo_x() + (self.root.winfo_width() // 2) - (width // 2)
        y = self.root.winfo_y() + (self.root.winfo_height() // 2) - (height // 2)
        win.geometry(f"+{x}+{y}")

        lbl_header = ttk.Label(win, text="📝 X (Twitter) 投稿のレビューと添削", style="Header.TLabel")
        lbl_header.pack(anchor="w", padx=15, pady=10)

        # ファイル情報フレーム
        info_frame = ttk.Frame(win, style="Card.TFrame", padding=10)
        info_frame.pack(fill="x", padx=15, pady=5)

        lbl_orig = ttk.Label(info_frame, text=f"元動画: {os.path.basename(original_path)}", style="Status.TLabel", background=self.card_bg)
        lbl_orig.pack(anchor="w")

        lbl_prot = ttk.Label(info_frame, text="※ SAMPLE保護レイヤーが自動合成されています", foreground=self.accent_purple, background=self.card_bg)
        lbl_prot.pack(anchor="w", pady=(2, 5))

        # 再生ボタン
        def play_protected():
            try:
                os.startfile(protected_path)
            except Exception as e:
                messagebox.showerror("エラー", f"動画の再生に失敗しました: {e}")

        btn_play = tk.Button(
            info_frame, text="🎥 合成動画を再生して確認", bg=self.accent_blue, fg="#11111b",
            font=("Segoe UI", 9, "bold"), bd=0, padx=10, pady=4, cursor="hand2",
            command=play_protected
        )
        btn_play.pack(anchor="w", pady=2)

        # テキストエリア
        lbl_text = ttk.Label(win, text="🖊️ ポストする文章 (280文字以内、日本語1文字=2、英数字1文字=1換算):", style="Status.TLabel")
        lbl_text.pack(anchor="w", padx=15, pady=(10, 2))

        editor = scrolledtext.ScrolledText(win, bg="#11111b", fg=self.fg_color, insertbackground="white", font=("Segoe UI", 10), bd=0)
        editor.pack(fill="both", expand=True, padx=15, pady=(0, 5))
        editor.insert(tk.END, initial_text)

        # 文字数カウント表示用ラベル
        lbl_count = ttk.Label(win, text="文字数: 0 / 280 (X制限値)", foreground=self.accent_green)
        lbl_count.pack(anchor="w", padx=15, pady=2)

        def update_char_count(event=None):
            text = editor.get("1.0", tk.END).strip()
            # Xの簡易的な重み付き文字数カウント (全角=2文字, 半角=1文字)
            length = 0
            for char in text:
                length += 2 if ord(char) > 127 else 1
            
            lbl_count.config(text=f"X換算文字数: {length} / 280")
            if length > 280:
                lbl_count.config(foreground=self.accent_red)
            else:
                lbl_count.config(foreground=self.accent_green)

        editor.bind("<KeyRelease>", update_char_count)
        update_char_count() # 初期呼び出し

        # アクションボタンフレーム
        btn_frame = ttk.Frame(win, padding=15)
        btn_frame.pack(fill="x", side="bottom")

        def on_post():
            text_to_post = editor.get("1.0", tk.END).strip()
            if not text_to_post:
                messagebox.showwarning("警告", "投稿メッセージが空です。")
                return

            config = load_config(CONFIG_PATH) or {}
            twitter_cfg = config.get("twitter", {})

            # 投稿確認ダイアログ
            if not messagebox.askyesno("投稿確認", "この内容で保護付き動画をXへ投稿します。よろしいですか？"):
                return

            # 投稿処理スレッド
            self.append_log("\n[XPost] X (Twitter) への自動投稿処理を開始中...\n")
            
            # 投稿ボタンを一時無効化
            btn_submit.config(state="disabled", text="投稿中...")

            def post_worker():
                try:
                    success, result = post_to_twitter(protected_path, text_to_post, twitter_cfg)
                    if success:
                        self.log_queue.put(f"[XPost] 投稿成功！ URL: {result}\n")
                        self.root.after(0, lambda: [
                            messagebox.showinfo("成功", f"Xへの投稿が完了しました！\n{result}"),
                            win.destroy()
                        ])
                    else:
                        self.log_queue.put(f"[XPost] 投稿失敗: {result}\n")
                        self.root.after(0, lambda: [
                            messagebox.showerror("エラー", f"Xへの投稿に失敗しました:\n{result}"),
                            btn_submit.config(state="normal", text="🚀 投稿する")
                        ])
                except Exception as ex:
                    self.log_queue.put(f"[XPost] 投稿中に例外発生: {ex}\n")
                    self.root.after(0, lambda: [
                        messagebox.showerror("エラー", f"例外が発生しました:\n{ex}"),
                        btn_submit.config(state="normal", text="🚀 投稿する")
                    ])

            threading.Thread(target=post_worker, daemon=True).start()

        btn_cancel = tk.Button(
            btn_frame, text="❌ キャンセル", bg=self.accent_red, fg="#11111b",
            font=("Segoe UI", 10, "bold"), bd=0, padx=15, pady=6, cursor="hand2",
            command=win.destroy
        )
        btn_cancel.pack(side="left")

        btn_submit = tk.Button(
            btn_frame, text="🚀 Xへ投稿する", bg=self.accent_green, fg="#11111b",
            font=("Segoe UI", 10, "bold"), bd=0, padx=20, pady=6, cursor="hand2",
            command=on_post
        )
        btn_submit.pack(side="right")


def main():
    root = tk.Tk()
    app = PipelineGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
