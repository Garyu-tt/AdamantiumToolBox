"""Small pure numeric helper for the hello Frank Addon."""
def total(numbers):
    if not isinstance(numbers, list) or len(numbers) > 100:
        raise ValueError("invalid numbers")
    if any(type(value) not in (int, float) for value in numbers):
        raise ValueError("numbers only")
    return sum(numbers)
