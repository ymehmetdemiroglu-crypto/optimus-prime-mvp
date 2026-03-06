import requests
import json

url = 'http://localhost:8001/api/v1/reports/upload'
file_path = r'c:\Users\hp\Downloads\openrouter_activity_2026-03-05.csv'

with open(file_path, 'rb') as f:
    files = {'file': f}
    response = requests.post(url, files=files)

print("Status Code:", response.status_code)
try:
    print(json.dumps(response.json(), indent=2))
except:
    print(response.text)
