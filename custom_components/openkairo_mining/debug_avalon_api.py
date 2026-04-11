import socket
import time

def query(ip, port, cmd):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(3)
        s.connect((ip, port))
        # Avalon often expects a newline or null terminator
        s.sendall(f"{cmd}\n".encode())
        resp = b""
        while True:
            chunk = s.recv(4096)
            if not chunk: break
            resp += chunk
        s.close()
        return resp.decode(errors='ignore')
    except Exception as e:
        return f"Error ({cmd}): {e}"

ip = "192.168.1.237"
port = 4028

for c in ["summary", "devs", "stats", "psu", "power"]:
    print(f"--- {c} ---")
    print(query(ip, port, c))
    print("\n")
