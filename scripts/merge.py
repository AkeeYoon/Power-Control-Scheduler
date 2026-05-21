import os
import re

dist_html_path = r"c:\Users\D30\.gemini\PJArea_V2.0\dist\index.html"
public_js_path = r"c:\Users\D30\.gemini\PJArea_V2.0\public\js"
output_path = r"c:\Users\D30\.gemini\PJArea_V2.0\index.html"
backup_path = r"c:\Users\D30\.gemini\PJArea_V2.0\index.backup.html"

# Backup original
if not os.path.exists(backup_path) and os.path.exists(output_path):
    with open(output_path, 'r', encoding='utf-8') as f:
        with open(backup_path, 'w', encoding='utf-8') as bf:
            bf.write(f.read())

with open(dist_html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Replace scripts
def repl(match):
    src = match.group(1)
    filename = src.split('/')[-1]
    js_file = os.path.join(public_js_path, filename)
    if os.path.exists(js_file):
        with open(js_file, 'r', encoding='utf-8') as jf:
            js_content = jf.read()
        return f'<script>\n{js_content}\n</script>'
    return match.group(0)

new_html = re.sub(r'<script\s+src="[^"]*/js/([^"]+)"\s*></script>', repl, html_content)

with open(output_path, 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Merge completed successfully.")
