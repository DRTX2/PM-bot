with open("Router - Project Events.json", "r") as f:
    content = f.read()

import re
# We need to replace the malformed operator configuration
bad_block = re.search(r'"operator": \{.*?\n          \]\n        \},', content, re.DOTALL)
if bad_block:
    new_block = '''"operator": {
                "type": "number",
                "operation": "larger"
              }
            }
          ]
        },'''
    content = content[:bad_block.start()] + new_block + content[bad_block.end():]
    with open("Router - Project Events.json", "w") as f:
        f.write(content)
    print("Fixed!")
else:
    print("Not found")
