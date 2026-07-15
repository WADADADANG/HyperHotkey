import tkinter as tk
import sys
import json
import threading
import queue
import urllib.request
import traceback

# Queue for thread communication
status_queue = queue.Queue()

def log_debug(msg):
    pass

log_debug("Overlay script started.")

# Thread reader to read updates from stdin sent by Node.js
def read_stdin():
    log_debug("Stdin reader thread started.")
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                log_debug("Stdin EOF reached. Parent process must have exited.")
                break
            line_str = line.strip()
            if line_str:
                log_debug(f"Received line: {line_str}")
                data = json.loads(line_str)
                status_queue.put(data)
        except Exception as e:
            log_debug(f"Exception in stdin reader: {traceback.format_exc()}")
            continue

# Spawn background thread
thread = threading.Thread(target=read_stdin, daemon=True)
thread.start()

root = tk.Tk()
root.title("HyperHotkey Overlay")

# Fixed width, dynamic height
width = 210
# Initial minimal size
root.geometry(f"{width}x50")

# Frameless & Always-on-top
root.attributes("-topmost", True)
root.overrideredirect(True)

# Transparency key on Windows
trans_color = "#010101"
root.configure(bg=trans_color)
root.wm_attributes("-transparentcolor", trans_color)

# Dragging variables
drag_x = 0
drag_y = 0

def start_drag(event):
    global drag_x, drag_y
    drag_x = event.x
    drag_y = event.y

def drag(event):
    deltax = event.x - drag_x
    deltay = event.y - drag_y
    nx = root.winfo_x() + deltax
    ny = root.winfo_y() + deltay
    root.geometry(f"+{nx}+{ny}")

# Main container (Sleek dark panel with Indigo border)
main_frame = tk.Frame(root, bg="#0f172a", bd=0, highlightbackground="#6366f1", highlightcolor="#6366f1", highlightthickness=1)
main_frame.place(x=0, y=0, width=width, height=50) # Will be resized dynamically

main_frame.bind("<Button-1>", start_drag)
main_frame.bind("<B1-Motion>", drag)

# Close API trigger to disable overlay in config
def close_overlay():
    log_debug("Closing overlay window.")
    try:
        req = urllib.request.Request(
            "http://localhost:3000/api/overlay/disable",
            method="POST",
            headers={"Content-Type": "application/json"}
        )
        urllib.request.urlopen(req, timeout=0.5)
    except Exception as e:
        log_debug(f"Failed to post disable overlay status: {e}")
    root.destroy()
    sys.exit(0)

# Compact Close button
close_btn = tk.Button(main_frame, text="✕", bg="#0f172a", fg="#64748b", activebackground="#ef4444", activeforeground="#ffffff", bd=0, font=("Arial", 8, "bold"), command=close_overlay, cursor="hand2")
close_btn.place(x=width - 18, y=4, width=14, height=14)

# Container for status rows
status_frame = tk.Frame(main_frame, bg="#0f172a")
status_frame.pack(fill="both", expand=True, padx=10, pady=(15, 5))
status_frame.bind("<Button-1>", start_drag)
status_frame.bind("<B1-Motion>", drag)

# Keep track of active clients and widgets
current_active_clients = []
label_widgets = {} # client_idx -> label widget reference
name_label_widgets = {} # client_idx -> name label reference

def update_ui(data):
    global current_active_clients, label_widgets, name_label_widgets
    
    active_clients = data.get("activeClients", [])
    client_statuses = data.get("clientStatuses", {})
    client_aliases = data.get("clientAliases", {})
    log_debug(f"update_ui: active_clients={active_clients}, client_statuses={client_statuses}, client_aliases={client_aliases}")
    
    # Check if active clients array changed
    sorted_active = sorted(active_clients)
    if sorted_active != current_active_clients:
        log_debug(f"Active clients list changed: {current_active_clients} -> {sorted_active}")
        # Clear existing rows
        for widget in status_frame.winfo_children():
            widget.destroy()
        label_widgets.clear()
        name_label_widgets.clear()
        
        current_active_clients = sorted_active
        
        if not current_active_clients:
            # Empty state
            lbl = tk.Label(status_frame, text="Standby", bg="#0f172a", fg="#64748b", font=("Segoe UI", 9, "italic"))
            lbl.pack(pady=5)
            lbl.bind("<Button-1>", start_drag)
            lbl.bind("<B1-Motion>", drag)
            
            # Dynamic height for empty state
            height = 50
        else:
            # Rebuild widgets
            for idx in current_active_clients:
                row = tk.Frame(status_frame, bg="#0f172a")
                row.pack(fill="x", pady=2)
                row.bind("<Button-1>", start_drag)
                row.bind("<B1-Motion>", drag)
                
                lbl_name = tk.Label(row, text=f"Client {idx}", bg="#0f172a", fg="#94a3b8", font=("Segoe UI", 9, "bold"))
                lbl_name.pack(side="left")
                lbl_name.bind("<Button-1>", start_drag)
                lbl_name.bind("<B1-Motion>", drag)
                
                lbl_status = tk.Label(row, text="Standby", bg="#0f172a", fg="#64748b", font=("Segoe UI", 9, "bold"), anchor="e")
                lbl_status.pack(side="right", fill="x", expand=True)
                lbl_status.bind("<Button-1>", start_drag)
                lbl_status.bind("<B1-Motion>", drag)
                
                label_widgets[idx] = lbl_status
                name_label_widgets[idx] = lbl_name
                
            # Dynamic height matching items count
            height = len(current_active_clients) * 26 + 24
        
        root.geometry(f"{width}x{height}")
        main_frame.place(x=0, y=0, width=width, height=height)
        
    # Update text & colors for active widgets
    for idx, lbl_status in label_widgets.items():
        client_str = str(idx)
        info = client_statuses.get(client_str, {"status": "Standby", "type": "standby"})
        status_text = info.get("status", "Standby")
        status_type = info.get("type", "standby")
        
        # Limit text length to fit compact width
        if len(status_text) > 13:
            status_text = status_text[:11] + ".."
            
        if status_type == "loop":
            color = "#10b981"  # green
            prefix = "🟢 "
        elif status_type == "buff":
            color = "#3b82f6"  # blue
            prefix = "🔵 "
        else:
            color = "#64748b"  # gray
            prefix = "💤 "
            
        lbl_status.config(text=f"{prefix}{status_text}", fg=color)
        
        # Update name label text with alias if any
        lbl_name = name_label_widgets.get(idx)
        if lbl_name:
            alias = client_aliases.get(client_str, "")
            display_name = alias if alias else f"Client {idx}"
            if len(display_name) > 15:
                display_name = display_name[:13] + ".."
            lbl_name.config(text=display_name)

def check_queue():
    try:
        while True:
            data = status_queue.get_nowait()
            update_ui(data)
            status_queue.task_done()
    except queue.Empty:
        pass
    root.after(50, check_queue)

# Check queue regularly (extremely lightweight)
root.after(50, check_queue)

root.mainloop()
