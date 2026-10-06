import urllib.request
import json

try:
    req = urllib.request.Request("https://api.github.com/users/ManishX-ui/repos", headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        repos = json.loads(resp.read().decode())
        print("Public repos for ManishX-ui:")
        for r in repos:
            print(f" - {r['name']}: {r['html_url']}")
except Exception as e:
    print("Error checking repos:", e)
