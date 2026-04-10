from __future__ import annotations

from pathlib import Path
from typing import Iterable

from .numbers import to_js_number


def write_js_object(
    output_path: Path,
    const_name: str,
    data: dict,
    *,
    comments: Iterable[str] | None = None,
    quote_keys: bool = True,
    max_decimals: int = 8,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    lines: list[str] = []
    if comments:
        for comment_line in comments:
            if comment_line:
                lines.append(f"// {comment_line}")
            else:
                lines.append("//")

    lines.append(f"const {const_name} = {{")
    items = sorted(data.items(), key=lambda item: item[0])
    for index, (key, value) in enumerate(items):
        key_repr = f'"{key}"' if quote_keys else str(key)
        value_repr = to_js_number(value, max_decimals=max_decimals)
        trailing_comma = "," if index < len(items) - 1 else ""
        lines.append(f"  {key_repr}: {value_repr}{trailing_comma}")
    lines.append("};")

    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
