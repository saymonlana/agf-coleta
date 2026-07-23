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
import io

try:
    from openpyxl import Workbook
    OPENPYXL_OK = True
except ImportError:
    OPENPYXL_OK = False

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
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Token, X-Folder-Id, X-File-Id')
        self.end_headers()
    
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        if self.path == '/upload-excel':
            self.handle_upload_excel(body)
        elif self.path == '/generate-excel':
            self.handle_generate_excel(body)
        elif self.path == '/proxy/box':
            self.handle_proxy_box(body)
        else:
            self.send_response(404)
            self.end_headers()
    
    def handle_upload_excel(self, body):
        try:
            token = self.headers.get('X-Token', '')
            folder_id = self.headers.get('X-Folder-Id', '')
            file_id = self.headers.get('X-File-Id', '') or None
            
            if not token:
                self.send_json(400, {'error': 'Token nao fornecido'})
                return
            
            file_name = 'Planilha Dados Aplicativo.xlsx'
            
            boundary = uuid.uuid4().hex
            attributes = json.dumps({'name': file_name, 'parent': {'id': folder_id}})
            
            attr_part = f'--{boundary}\r\nContent-Disposition: form-data; name="attributes"\r\n\r\n{attributes}\r\n'.encode()
            file_header = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file_name}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'.encode()
            closing = f'\r\n--{boundary}--\r\n'.encode()
            
            upload_body = attr_part + file_header + body + closing
            
            if file_id:
                url = f'https://upload.box.com/api/2.0/files/{file_id}/content'
            else:
                url = 'https://upload.box.com/api/2.0/files/content'
            
            req = urllib.request.Request(url, data=upload_body, method='POST')
            req.add_header('Authorization', f'Bearer {token}')
            req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
            
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read().decode('utf-8'))
                self.send_json(200, result)
        
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8') if e.fp else ''
            self.send_json(e.code, {'error': str(e), 'detail': error_body})
        except Exception as e:
            self.send_json(500, {'error': str(e)})
    
    def handle_generate_excel(self, body):
        try:
            if not OPENPYXL_OK:
                self.send_json(500, {'error': 'openpyxl nao instalado'})
                return
            
            data = json.loads(body)
            camadas = data.get('camadas', {})
            token = data.get('token', '')
            file_id = data.get('file_id', None)
            folder_id = data.get('folder_id', '')
            
            wb = Workbook()
            wb.remove(wb.active)
            
            for nome_camada, registros in camadas.items():
                ws = wb.create_sheet(title=nome_camada[:31])
                if not registros:
                    continue
                headers = list(registros[0].keys())
                ws.append(headers)
                for reg in registros:
                    ws.append([str(reg.get(h, '')) for h in headers])
            
            buf = io.BytesIO()
            wb.save(buf)
            buf.seek(0)
            xlsx_bytes = buf.read()
            
            xlsx_b64 = base64.b64encode(xlsx_bytes).decode('ascii')
            file_name = 'Planilha Dados Aplicativo.xlsx'
            
            boundary = uuid.uuid4().hex
            attributes = json.dumps({'name': file_name, 'parent': {'id': folder_id}})
            
            attr_part = f'--{boundary}\r\nContent-Disposition: form-data; name="attributes"\r\n\r\n{attributes}\r\n'.encode()
            file_header = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file_name}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'.encode()
            closing = f'\r\n--{boundary}--\r\n'.encode()
            
            upload_body = attr_part + file_header + xlsx_bytes + closing
            
            if file_id:
                url = f'https://upload.box.com/api/2.0/files/{file_id}/content'
            else:
                url = 'https://upload.box.com/api/2.0/files/content'
            
            req = urllib.request.Request(url, data=upload_body, method='POST')
            req.add_header('Authorization', f'Bearer {token}')
            req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
            
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read().decode('utf-8'))
                self.send_json(200, result)
        
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8') if e.fp else ''
            self.send_json(e.code, {'error': str(e), 'detail': error_body})
        except Exception as e:
            self.send_json(500, {'error': str(e)})
    
    def handle_proxy_box(self, body):
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
                
                ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else ''
                content_types = {
                    'geojson': 'application/geo+json',
                    'json': 'application/geo+json',
                    'kml': 'application/vnd.google-earth.kml+xml',
                    'kmz': 'application/vnd.google-earth.kmz',
                    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'xls': 'application/vnd.ms-excel',
                    'csv': 'text/csv',
                }
                file_ct = content_types.get(ext, 'application/octet-stream')
                file_header = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file_name}"\r\nContent-Type: {file_ct}\r\n\r\n'.encode()
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

    def do_GET(self):
        super().do_GET()
    
    def send_json(self, code, obj):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(obj).encode('utf-8'))

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
