"""
AGF Coleta - Servidor local para testar o app
Execute: python servidor.py
Acesse: http://localhost:8080
"""
import http.server
import socketserver
import os
import json
import urllib.request
import urllib.error
import base64
import uuid

PORT = int(os.environ.get('PORT', 8080))
DIR = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
    
    def do_POST(self):
        if self.path == '/proxy/box':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            try:
                data = json.loads(body)
                url = data.get('url', '')
                method = data.get('method', 'GET')
                headers = data.get('headers', {})
                
                if data.get('upload'):
                    boundary = uuid.uuid4().hex
                    
                    attributes = data.get('attributes', '{}')
                    attr_part = f'--{boundary}\r\nContent-Disposition: form-data; name="attributes"\r\n\r\n{attributes}\r\n'.encode()
                    
                    file_b64 = data.get('fileBase64', '')
                    file_name = data.get('fileName', 'file.geojson')
                    file_bytes = base64.b64decode(file_b64)
                    file_header = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file_name}"\r\nContent-Type: application/geo+json\r\n\r\n'.encode()
                    closing = f'\r\n--{boundary}--\r\n'.encode()
                    
                    upload_body = attr_part + file_header + file_bytes + closing
                    
                    req = urllib.request.Request(url, data=upload_body, method='POST')
                    for key, value in headers.items():
                        req.add_header(key, value)
                    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
                elif data.get('form'):
                    boundary = uuid.uuid4().hex
                    parts = []
                    for entry in data['form']:
                        if entry.get('type') == 'file':
                            file_bytes = base64.b64decode(entry['value'])
                            header = f'--{boundary}\r\nContent-Disposition: form-data; name="{entry["key"]}"; filename="{entry.get("filename", "file")}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode()
                            parts.append(header + file_bytes)
                        else:
                            text_part = f'--{boundary}\r\nContent-Disposition: form-data; name="{entry["key"]}"\r\n\r\n{entry["value"]}\r\n'.encode()
                            parts.append(text_part)
                    closing = f'\r\n--{boundary}--\r\n'.encode()
                    upload_body = b''.join(parts) + closing
                    
                    req = urllib.request.Request(url, data=upload_body, method=method)
                    for key, value in headers.items():
                        req.add_header(key, value)
                    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
                else:
                    payload = data.get('body', None)
                    req = urllib.request.Request(url, method=method)
                    for key, value in headers.items():
                        req.add_header(key, value)
                    if payload:
                        if isinstance(payload, dict):
                            req.data = json.dumps(payload).encode('utf-8')
                            req.add_header('Content-Type', 'application/json')
                        elif isinstance(payload, str):
                            req.data = payload.encode('utf-8')
                
                with urllib.request.urlopen(req) as resp:
                    response_data = resp.read().decode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(response_data.encode('utf-8'))
            
            except urllib.error.HTTPError as e:
                error_body = e.read().decode('utf-8') if e.fp else ''
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e), 'detail': error_body}).encode('utf-8'))
            
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        super().do_GET()

print(f'AGF Coleta - Servidor Local')
print(f'Diretorio: {DIR}')
print(f'Acesse: http://localhost:{PORT}')
print(f'   Pressione Ctrl+C para parar')
print()

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor parado')
