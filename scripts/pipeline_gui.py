#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
MovieCreator Pipeline Control Center (GUI)
------------------------------------------
販売パッケージ生成 (package_builder.py)、
SNS Autopilot (sns_autopilot.py)、
LINE/X Webhook サーバー (server_bot.py)
を一括で管理・起動・監視するデスクトップ GUI コントロールパネル。
"""

import os
import sys
import json
import subprocess
import threading
import queue
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

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


class PipelineGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("MovieCreator - Pipeline Control Center")
        self.root.geometry("860x640")
        self.root.minsize(700, 500)

        # サーバープロセスの管理
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

        self.root.configure(bg=self.bg_color)
        self.setup_styles()
        self.create_widgets()

        # ログキューの定期ポーリング
        self.root.after(100, self.poll_log_queue)

    def setup_styles(self):
        self.style = ttk.Style()
        self.style.theme_use("default")

        # 全体フレーム背景
        self.style.configure(".", background=self.bg_color, foreground=self.fg_color, font=("Segoe UI", 10))
        self.style.configure("Card.TFrame", background=self.card_bg, relief="flat")
        self.style.configure("Header.TLabel", background=self.bg_color, foreground="#f5e0dc", font=("Segoe UI", 16, "bold"))
        self.style.configure("SubHeader.TLabel", background=self.card_bg, foreground=self.accent_blue, font=("Segoe UI", 11, "bold"))
        self.style.configure("Status.TLabel", background=self.card_bg, font=("Segoe UI", 10, "bold"))

        # ボタンの基本スタイル
        self.style.configure("Action.TButton", font=("Segoe UI", 10, "bold"), padding=8)

    def create_widgets(self):
        # 1. ヘッダーエリア
        header_frame = ttk.Frame(self.root, padding=(15, 12, 15, 5))
        header_frame.pack(fill="x")

        title_lbl = ttk.Label(header_frame, text="🎬 MovieCreator Pipeline Control Center", style="Header.TLabel")
        title_lbl.pack(side="left")

        # 2. メインパネル（左右2分割または上下分割）
        main_container = ttk.Frame(self.root, padding=15)
        main_container.pack(fill="both", expand=True)

        # 上部: コントロールボタン群
        ctrl_card = ttk.Frame(main_container, style="Card.TFrame", padding=15)
        ctrl_card.pack(fill="x", pady=(0, 10))

        ctrl_title = ttk.Label(ctrl_card, text="⚡ 実行アクション", style="SubHeader.TLabel")
        ctrl_title.grid(row=0, column=0, columnspan=3, sticky="w", pady=(0, 10))

        # ボタン行 1
        btn_pack = tk.Button(
            ctrl_card, text="📦 販売パッケージ一括生成\n(package_builder.py)",
            bg="#313244", fg="#89b4fa", activebackground="#45475a", activeforeground="#ffffff",
            font=("Segoe UI", 10, "bold"), bd=0, padx=12, pady=8, cursor="hand2",
            command=self.run_package_builder
        )
        btn_pack.grid(row=1, column=0, padx=5, pady=5, sticky="ew")

        btn_autopilot = tk.Button(
            ctrl_card, text="🚀 SNS Autopilot 実行\n(sns_autopilot.py)",
            bg="#313244", fg="#a6e3a1", activebackground="#45475a", activeforeground="#ffffff",
            font=("Segoe UI", 10, "bold"), bd=0, padx=12, pady=8, cursor="hand2",
            command=self.run_sns_autopilot
        )
        btn_autopilot.grid(row=1, column=1, padx=5, pady=5, sticky="ew")

        self.btn_server = tk.Button(
            ctrl_card, text="🟢 Webhook サーバー起動\n(server_bot.py)",
            bg="#313244", fg="#fab387", activebackground="#45475a", activeforeground="#ffffff",
            font=("Segoe UI", 10, "bold"), bd=0, padx=12, pady=8, cursor="hand2",
            command=self.toggle_server
        )
        self.btn_server.grid(row=1, column=2, padx=5, pady=5, sticky="ew")

        # ボタン行 2 (サブ機能)
        btn_config = tk.Button(
            ctrl_card, text="⚙️ config.json 編集",
            bg="#181825", fg="#cba6f7", activebackground="#313244", activeforeground="#ffffff",
            font=("Segoe UI", 9), bd=1, relief="solid", padx=10, pady=4, cursor="hand2",
            command=self.open_config_editor
        )
        btn_config.grid(row=2, column=0, padx=5, pady=(8, 0), sticky="ew")

        btn_exports = tk.Button(
            ctrl_card, text="📁 exports フォルダを開く",
            bg="#181825", fg="#94e2d5", activebackground="#313244", activeforeground="#ffffff",
            font=("Segoe UI", 9), bd=1, relief="solid", padx=10, pady=4, cursor="hand2",
            command=self.open_exports_dir
        )
        btn_exports.grid(row=2, column=1, padx=5, pady=(8, 0), sticky="ew")

        self.lbl_server_status = tk.Label(
            ctrl_card, text="Server: OFFLINE", bg=self.card_bg, fg="#f38ba8",
            font=("Segoe UI", 10, "bold")
        )
        self.lbl_server_status.grid(row=2, column=2, padx=5, pady=(8, 0))

        ctrl_card.columnconfigure(0, weight=1)
        ctrl_card.columnconfigure(1, weight=1)
        ctrl_card.columnconfigure(2, weight=1)

        # 下部: リアルタイムログ出力エリア
        log_card = ttk.Frame(main_container, style="Card.TFrame", padding=12)
        log_card.pack(fill="both", expand=True)

        log_header = ttk.Frame(log_card, style="Card.TFrame")
        log_header.pack(fill="x", pady=(0, 5))

        log_lbl = ttk.Label(log_header, text="💻 実行コンソールログ", style="SubHeader.TLabel")
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

        self.append_log("✨ MovieCreator Pipeline Control Center 準備完了。\n")

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

    def run_script_in_thread(self, script_name, args=None):
        """Pythonスクリプトを別スレッドで実行し、ログをストリーミング表示"""
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
        """販売パッケージ一括生成の実行"""
        self.run_script_in_thread("package_builder.py")

    def run_sns_autopilot(self):
        """SNS Autopilot の実行"""
        self.run_script_in_thread("sns_autopilot.py")

    def toggle_server(self):
        """Webhook サーバー (server_bot.py) の起動/停止切替"""
        if self.server_process is None or self.server_process.poll() is not None:
            # サーバー起動
            cmd = [sys.executable, os.path.join(SCRIPTS_DIR, "server_bot.py")]
            try:
                self.server_process = subprocess.Popen(
                    cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, encoding="utf-8", errors="replace", cwd=BASE_DIR
                )
                self.btn_server.config(text="🔴 サーバー停止\n(server_bot.py)", fg="#f38ba8")
                self.lbl_server_status.config(text="Server: ONLINE", fg="#a6e3a1")
                self.append_log("\n🚀 Webhook サーバー (server_bot.py) を起動しました。\n")

                # サーバーログ取得スレッド
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
            # サーバー停止
            try:
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
                # JSONバリデーションチェック
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


def main():
    root = tk.Tk()
    app = PipelineGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
