import requests

# Test directly with backend
url = 'http://127.0.0.1:8000/api/parse-syllabus'
files = {'file': ('test_syllabus.png', open('test_syllabus.png', 'rb'), 'image/png')}

print('Testing API DIRECTLY with backend (127.0.0.1:8000)...')
try:
    response = requests.post(url, files=files, timeout=30)
    print(f'Status: {response.status_code}')
    
    if response.status_code == 200:
        data = response.json()
        print(f'Response keys: {list(data.keys())}')
        print(f'Course name: {data.get("course_name", "N/A")}')
        if 'target_learning_flow' in data:
            print(f'Steps: {len(data["target_learning_flow"])}')
        print('✅ Backend API is working!')
    else:
        print(f'Error: {response.text[:500]}')
except Exception as e:
    print(f'Exception: {e}')
