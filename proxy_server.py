import http.server
import urllib.request
import urllib.parse
import ssl
import sys
import os

PORT = 8765

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Intercept proxy calls for SeaVision
        if self.path.startswith('/seavision-api/'):
            # Extract the actual path after /seavision-api/
            # Example: /seavision-api/vessels?latitude=12.66&longitude=100.9&radius=100&age=12
            subpath = self.path[len('/seavision-api/'):]
            target_url = f"https://api.seavision.volpe.dot.gov/v1/{subpath}"
            
            # Retrieve the client's x-api-key header
            api_key = self.headers.get('x-api-key')
            
            print(f"Proxying: {self.path} -> {target_url} (Key length: {len(api_key) if api_key else 0})")
            
            req = urllib.request.Request(target_url, method='GET')
            if api_key:
                req.add_header('x-api-key', api_key)
            
            try:
                # Bypass SSL certificate validation if there's any certificate mismatch on target
                context = ssl._create_unverified_context()
                with urllib.request.urlopen(req, context=context) as response:
                    self.send_response(response.status)
                    
                    # Forward Content-Type header
                    content_type = response.headers.get('Content-Type')
                    if content_type:
                        self.send_header('Content-Type', content_type)
                    
                    # Add CORS headers in case they run from different local setups
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(response.read())
            except urllib.error.HTTPError as e:
                # Handle HTTP errors from the Volpe gateway
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(e.read())
            except Exception as e:
                # Handle other network / connection errors
                self.send_response(500)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(f"Proxy Error: {str(e)}".encode('utf-8'))
        else:
            # Otherwise serve local file normally
            super().do_GET()

if __name__ == '__main__':
    # Change directory to the script's directory to serve files from here
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, ProxyHandler)
    print(f"============================================================")
    print(f" THE SHIELD 3.0 · Local Proxy Server Running")
    print(f" URL: http://localhost:{PORT}/UDC_Simulator_17.html")
    print(f" SeaVision proxy prefix: http://localhost:{PORT}/seavision-api/")
    print(f" Press Ctrl+C to stop.")
    print(f"============================================================")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down proxy server.")
        sys.exit(0)
