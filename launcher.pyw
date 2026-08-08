import subprocess
import webbrowser
import sys
import os
import time
import signal
import socket
import tkinter as tk
from tkinter import messagebox

# Determine project directory
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_URL = "http://localhost:3000/"

# Global process handle
node_process = None

# Single-Instance Socket Lock
instance_lock_socket = None

def check_single_instance():
    global instance_lock_socket
    try:
        instance_lock_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        instance_lock_socket.bind(('127.0.0.1', 39999))
    except Exception:
        # Launcher is already running! Focus web dashboard and exit duplicate process immediately.
        webbrowser.open(SERVER_URL)
        sys.exit(0)

check_single_instance()

def is_port_in_use(port=3000):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0



def start_node_server():
    global node_process
    if node_process and node_process.poll() is None:
        return  # Already running

    bot_js = os.path.join(PROJECT_DIR, "bot.js")
    
    # Hide CMD Window on Windows
    creation_flags = 0
    if os.name == 'nt':
        creation_flags = subprocess.CREATE_NO_WINDOW

    try:
        node_process = subprocess.Popen(
            ["node", bot_js],
            cwd=PROJECT_DIR,
            creationflags=creation_flags
        )
    except Exception as e:
        messagebox.showerror("Error", f"Failed to start Node.js server:\n{e}\n\nPlease ensure Node.js is installed.")

def stop_node_server():
    global node_process
    if node_process:
        try:
            if os.name == 'nt':
                subprocess.call(['taskkill', '/F', '/T', '/PID', str(node_process.pid)], creationflags=subprocess.CREATE_NO_WINDOW)
            else:
                node_process.terminate()
        except Exception:
            pass
        node_process = None

import threading
import json
import urllib.request

latest_repo_url = "https://github.com/WADADADANG/HyperHotkey"

def check_update_bg():
    global latest_repo_url
    time.sleep(2.5)  # Wait for server to start
    try:
        req = urllib.request.Request("http://localhost:3000/api/update-check", headers={'User-Agent': 'HyperHotkey-Launcher'})
        with urllib.request.urlopen(req, timeout=4) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                if data.get('hasUpdate'):
                    latest_v = data.get('latestVersion', '')
                    if data.get('repoUrl'):
                        latest_repo_url = data.get('repoUrl')
                    root.after(0, lambda: show_update_banner(latest_v))
    except Exception:
        pass

def show_update_banner(latest_v):
    update_btn.config(text=f"🚀 Update Available: v{latest_v} (Click to View)")
    update_frame.pack(fill="x", padx=25, pady=(8, 0))
    root.geometry("420x310")

def open_update_link():
    webbrowser.open(latest_repo_url)

def open_dashboard():
    webbrowser.open(SERVER_URL)

def restart_server():
    stop_node_server()
    time.sleep(1)
    start_node_server()
    messagebox.showinfo("HyperHotkey", "Server restarted successfully!")

def on_close():
    if messagebox.askokcancel("Exit HyperHotkey", "Do you want to stop HyperHotkey and close?"):
        stop_node_server()
        root.destroy()

# ============================================================================
# MODERN PYTHON GUI LAUNCHER (Tkinter)
# ============================================================================
# Fix Windows Taskbar AppUserModelID to display custom icon instead of Python icon
try:
    import ctypes
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID('HyperHotkey.Automation.v2.2.1')
except Exception:
    pass

start_node_server()

root = tk.Tk()
root.title("HyperHotkey v2.2.1 Launcher")
root.geometry("420x260")
root.resizable(False, False)
root.configure(bg="#0f172a")

# Load Custom Application Icon for Window Titlebar & Taskbar
ico_path = os.path.join(PROJECT_DIR, "icon.ico")
png_path = os.path.join(PROJECT_DIR, "icon.png")

if os.path.exists(ico_path):
    try:
        root.iconbitmap(ico_path)
    except Exception:
        pass

if os.path.exists(png_path):
    try:
        app_icon = tk.PhotoImage(file=png_path)
        root.iconphoto(True, app_icon)
    except Exception:
        pass

# Center window on screen
root.eval('tk::PlaceWindow . center')

# Header Title
title_label = tk.Label(
    root,
    text="🚀 HyperHotkey v2.2.1",
    font=("Segoe UI", 16, "bold"),
    fg="#38bdf8",
    bg="#0f172a"
)
title_label.pack(pady=(20, 5))

subtitle_label = tk.Label(
    root,
    text="Background Control Center & Anti-Detect Suite",
    font=("Segoe UI", 9),
    fg="#94a3b8",
    bg="#0f172a"
)
subtitle_label.pack(pady=(0, 15))

# Status Box
status_frame = tk.Frame(root, bg="#1e293b", bd=1, relief="solid", highlightbackground="#334155")
status_frame.pack(fill="x", padx=25, pady=5)

status_dot = tk.Label(status_frame, text="●", font=("Segoe UI", 12, "bold"), fg="#10b981", bg="#1e293b")
status_dot.pack(side="left", padx=(10, 5), pady=8)

status_text = tk.Label(
    status_frame,
    text="Server Running at http://localhost:3000/",
    font=("Segoe UI", 9, "bold"),
    fg="#f8fafc",
    bg="#1e293b"
)
status_text.pack(side="left", pady=8)

# Action Buttons Frame
btn_frame = tk.Frame(root, bg="#0f172a")
btn_frame.pack(pady=20)

btn_open = tk.Button(
    btn_frame,
    text="🌐 Open Web Dashboard",
    font=("Segoe UI", 10, "bold"),
    fg="#ffffff",
    bg="#3b82f6",
    activebackground="#2563eb",
    activeforeground="#ffffff",
    relief="flat",
    cursor="hand2",
    padx=15,
    pady=6,
    command=open_dashboard
)
btn_open.grid(row=0, column=0, padx=8)

btn_restart = tk.Button(
    btn_frame,
    text="🔄 Restart",
    font=("Segoe UI", 9, "bold"),
    fg="#cbd5e1",
    bg="#334155",
    activebackground="#475569",
    activeforeground="#ffffff",
    relief="flat",
    cursor="hand2",
    padx=10,
    pady=6,
    command=restart_server
)
btn_restart.grid(row=0, column=1, padx=8)

# Update Alert Frame (Hidden by default, shown when update is available)
update_frame = tk.Frame(root, bg="#78350f", bd=1, relief="solid", highlightbackground="#f59e0b")

update_btn = tk.Button(
    update_frame,
    text="🚀 Update Available! (Click to View)",
    font=("Segoe UI", 9, "bold"),
    fg="#fef3c7",
    bg="#78350f",
    activebackground="#92400e",
    activeforeground="#ffffff",
    relief="flat",
    cursor="hand2",
    pady=5,
    command=open_update_link
)
update_btn.pack(fill="x")

# Window Close Event Protocol
root.protocol("WM_DELETE_WINDOW", on_close)

# Open browser dashboard automatically 1 second after launch
root.after(1000, open_dashboard)

# Start background update check thread
threading.Thread(target=check_update_bg, daemon=True).start()

# Start Tkinter Loop
root.mainloop()
