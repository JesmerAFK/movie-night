from moviebox_api import Session
s = Session()
print(f"Session dir: {dir(s)}")
if hasattr(s, 'headers'):
    print("Session has headers")
else:
    print("Session DOES NOT have headers")
