import requests
import sys

url = 'http://localhost:3000/api/parse-syllabus'
files = {'file': open('test_syllabus.png', 'rb')}

print('Testing API through Next.js proxy...')
try:
    response = requests.post(url, files=files, timeout=30)
    print(f'Status: {response.status_code}')
    
    if response.status_code == 200:
        data = response.json()
        print(f'Response keys: {list(data.keys())}')
        print(f'Course name: {data.get("course_name", "N/A")}')
        if 'target_learning_flow' in data:
            print(f'Steps: {len(data["target_learning_flow"])}')
        print('✅ API is working!')
    else:
        print(f'Error: {response.text[:500]}')
except Exception as e:
    print(f'Exception: {e}')
    sys.exit(1)
