"""Example Frank Addon. No privileged APIs, no implicit permissions."""
def handle(action, params):
    if action == "echo":
        return {"echo": params}
    if action == "sum":
        numbers = params.get("numbers", [])
        if not isinstance(numbers, list) or len(numbers) > 100:
            raise ValueError("invalid numbers")
        if any(type(n) not in (int, float) for n in numbers):
            raise ValueError("numbers only")
        return {"sum": sum(numbers)}
    raise ValueError("unknown action")
