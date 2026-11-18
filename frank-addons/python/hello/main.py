"""Example Frank Addon: callable via frankenstein.python.hello.*."""
from modules.numbers import total

def handle(action, params):
    if action == "echo":
        return {"echo": params}
    if action == "sum":
        return {"sum": total(params.get("numbers", []))}
    raise ValueError("unknown action")
