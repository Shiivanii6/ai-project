from fastapi.testclient import TestClient
from backend.main import app
import io

client = TestClient(app)
pdf_bytes = b"%PDF-1.4\n1 0 obj<<>>\nendobj\ntrailer<<>>\n%%EOF\n"
files = {'file': ('test.pdf', io.BytesIO(pdf_bytes), 'application/pdf')}
resp = client.post('/api/parse-syllabus', files=files)
print('status', resp.status_code)
print(resp.text)
