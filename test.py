import requests

BOT_TOKEN = "8637404657:AAE6ZwPNlm7XgXx81wfyv4IWVMdm-xVJfuQ"

url = f"https://api.telegram.org/bot{BOT_TOKEN}/getMe"

res = requests.get(url)

print("Status:", res.status_code)
print(res.json())