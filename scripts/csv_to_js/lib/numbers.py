from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


def parse_decimal(value: str) -> Decimal | None:
    normalized = value.strip().replace("\u00a0", "").replace(" ", "")
    if not normalized:
        return None
    normalized = normalized.replace(",", ".")
    try:
        return Decimal(normalized)
    except InvalidOperation as error:
        raise ValueError(f"Invalid numeric value: {value!r}") from error


def to_js_number(value: int | float | Decimal, *, max_decimals: int = 8) -> str:
    if isinstance(value, bool):
        raise TypeError("Boolean is not a valid numeric value")
    if isinstance(value, int):
        return str(value)

    decimal_value = value if isinstance(value, Decimal) else Decimal(str(value))
    quant = Decimal("1").scaleb(-max_decimals)
    rounded = decimal_value.quantize(quant, rounding=ROUND_HALF_UP)
    text = format(rounded, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    if text in {"", "-0"}:
        return "0"
    return text
