import json
import os
import glob

brain_dir = r'C:\Users\karim\.gemini\antigravity-ide\brain'
files_to_recover = {}

for root, _, files in os.walk(brain_dir):
    for file in files:
        if file == 'transcript_full.jsonl':
            with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                for line in f:
                    try:
                        entry = json.loads(line)
                        if 'tool_calls' in entry and entry['tool_calls']:
                            for call in entry['tool_calls']:
                                if call['function']['name'] == 'default_api:write_to_file':
                                    args = json.loads(call['function']['arguments'])
                                    if 'CodeContent' in args and 'TargetFile' in args:
                                        path = args['TargetFile'].replace('\\\\', '/').replace('\\', '/')
                                        if 'mameko/app/src/main/java' in path:
                                            new_path = path.replace('com/example/mameko', 'com/mameko').replace('com/mameko/my/id', 'com/mameko')
                                            files_to_recover[new_path] = args['CodeContent']
                    except Exception as e:
                        pass

for path, content in files_to_recover.items():
    print('Recovering ' + path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    # also apply the package rename on the content
    content = content.replace('com.example.mameko', 'com.mameko').replace('com.mameko.my.id', 'com.mameko')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
