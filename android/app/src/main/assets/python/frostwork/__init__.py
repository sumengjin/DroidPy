"""DroidPy's pure-Python Frostwork compatibility layer.

This is a deliberately small Android-friendly fallback. It implements the
navigation API used by w3lib 2.6 and a practical Page extraction subset.
It does not claim streaming-parser performance or full selector parity.
"""
from __future__ import annotations

from html.parser import HTMLParser
from typing import NamedTuple
from urllib.parse import urljoin
import codecs
import re

__version__ = "0.2.2+droidpy"

_VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
         "meta", "param", "source", "track", "wbr"}
_REFRESH = re.compile(r"^\s*([0-9]+(?:\.[0-9]+)?)\s*[;,]\s*url\s*=\s*(.*?)\s*$", re.I | re.S)


class MetaRefresh(NamedTuple):
    delay: float
    url: str


class Navigation(NamedTuple):
    base_url: str | None
    meta_refresh: MetaRefresh | None


class UnsupportedSelector(ValueError):
    pass


class _Node:
    __slots__ = ("tag", "attrs", "parent", "children")

    def __init__(self, tag="", attrs=None, parent=None):
        self.tag = tag.lower()
        self.attrs = dict(attrs or ())
        self.parent = parent
        self.children = []

    def text(self):
        return "".join(child if isinstance(child, str) else child.text()
                       for child in self.children)


class _TreeParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = _Node("#document")
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = _Node(tag, attrs, self.stack[-1])
        self.stack[-1].children.append(node)
        if tag.lower() not in _VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].children.append(_Node(tag, attrs, self.stack[-1]))

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag.lower():
                del self.stack[index:]
                break

    def handle_data(self, data):
        if data:
            self.stack[-1].children.append(data)


def _decode(html, encoding=None, content_type=None):
    if isinstance(html, str):
        return html
    raw = bytes(html)
    if raw.startswith(codecs.BOM_UTF8):
        return raw.decode("utf-8-sig", "replace")
    if raw.startswith(codecs.BOM_UTF16_LE):
        return raw.decode("utf-16", "replace")
    if raw.startswith(codecs.BOM_UTF16_BE):
        return raw.decode("utf-16", "replace")
    label = encoding
    if not label and content_type:
        match = re.search(r"charset\s*=\s*['\"]?([^;\s'\"]+)", content_type, re.I)
        if match:
            label = match.group(1)
    if not label:
        head = raw[:4096].decode("ascii", "ignore")
        match = re.search(r"<meta[^>]+charset\s*=\s*['\"]?([^;\s'\"]+)", head, re.I)
        if match:
            label = match.group(1)
    try:
        return raw.decode(label or "utf-8", "replace")
    except (LookupError, TypeError):
        return raw.decode("utf-8", "replace")


def navigation(html, url, encoding=None, *, content_type=None,
               base_url=True, meta_refresh=True, scripting=True):
    """Read the first usable base URL and shortest meta-refresh declaration."""
    source = _decode(html, encoding, content_type)
    parser = _TreeParser()
    parser.feed(source)
    base = url if base_url else None
    refresh = None
    parser.close()
    for node in _walk(parser.root):
        ancestor = node.parent
        inside_noscript = False
        while ancestor is not None:
            if ancestor.tag == "noscript":
                inside_noscript = True
                break
            ancestor = ancestor.parent
        if scripting and inside_noscript:
            continue
        if base_url and node.tag == "base" and base == url:
            href = node.attrs.get("href")
            if href:
                candidate = urljoin(url, href.strip())
                if candidate:
                    base = candidate
        if meta_refresh and node.tag == "meta":
            if node.attrs.get("http-equiv", "").strip().lower() != "refresh":
                continue
            match = _REFRESH.match(node.attrs.get("content", ""))
            if not match:
                continue
            delay = float(match.group(1))
            target = match.group(2).strip().strip("\"'")
            resolved = urljoin(base or url, target) if target else (base or url)
            if refresh is None or delay <= refresh.delay:
                refresh = MetaRefresh(delay, resolved)
    return Navigation(base, refresh)


def _walk(node):
    for child in node.children:
        if isinstance(child, _Node):
            yield child
            yield from _walk(child)


def _split_css(selector):
    parts, buf, depth, quote, pending = [], [], 0, None, None
    for char in selector.strip():
        if quote:
            buf.append(char)
            if char == quote:
                quote = None
        elif char in "\"'":
            quote = char
            buf.append(char)
        elif char == "[":
            depth += 1
            buf.append(char)
        elif char == "]":
            depth -= 1
            buf.append(char)
        elif depth == 0 and char == ">":
            if buf:
                parts.append((">", "".join(buf).strip()))
                buf = []
            elif parts:
                parts[-1] = (">", parts[-1][1])
            pending = None
        elif depth == 0 and char.isspace():
            if buf:
                parts.append((pending or " ", "".join(buf).strip()))
                buf = []
                pending = " "
        else:
            buf.append(char)
    if buf:
        parts.append((pending or " ", "".join(buf).strip()))
    if not parts:
        raise UnsupportedSelector("Empty CSS selector")
    return parts


def _matches(node, compound):
    if not compound or any(token in compound for token in (":", "+", "~", ",")):
        raise UnsupportedSelector("Unsupported CSS pseudo-class, sibling, or grouped selector: " + compound)
    match = re.match(r"^([A-Za-z][\w-]*|\*)?", compound)
    tag = match.group(1) if match else None
    if tag and tag != "*" and node.tag != tag.lower():
        return False
    rest = compound[match.end():] if match else compound
    for token in re.finditer(r"#([\w-]+)|\.([\w-]+)|\[([^\]]+)\]", rest):
        ident, cls, attr = token.groups()
        if ident and node.attrs.get("id") != ident:
            return False
        if cls and cls not in node.attrs.get("class", "").split():
            return False
        if attr:
            pair = re.fullmatch(r"\s*([\w:-]+)\s*(?:=\s*(['\"]?)(.*?)\2\s*)?", attr)
            if not pair:
                raise UnsupportedSelector("Unsupported CSS attribute selector: [" + attr + "]")
            name, _, expected = pair.groups()
            if name not in node.attrs:
                return False
            if expected is not None and node.attrs.get(name) != expected:
                return False
    consumed = re.sub(r"^([A-Za-z][\w-]*|\*)?", "", compound)
    consumed = re.sub(r"#([\w-]+)|\.([\w-]+)|\[([^\]]+)\]", "", consumed)
    if consumed.strip():
        raise UnsupportedSelector("Unsupported CSS selector token: " + consumed)
    return True


def _css_nodes(root, selector):
    parts = _split_css(selector)
    candidates = list(_walk(root))
    result = []
    for node in candidates:
        if not _matches(node, parts[-1][1]):
            continue
        current = node
        matched = True
        for combinator, compound in reversed(parts[:-1]):
            parent = current.parent
            if combinator == ">":
                if parent is None or parent is root or not _matches(parent, compound):
                    matched = False
                    break
                current = parent
            else:
                while parent is not None and parent is not root and not _matches(parent, compound):
                    parent = parent.parent
                if parent is None or parent is root:
                    matched = False
                    break
                current = parent
        if matched:
            result.append(node)
    return result


def _xpath_nodes(root, selector):
    value = selector.strip()
    if value in (".", "self::node()"):
        return [root]
    if not value.startswith(("/", ".")):
        raise UnsupportedSelector("XPath must be an absolute or relative path")
    if any(token in value for token in ("|", "::", "contains(", "starts-with(", "last()")):
        raise UnsupportedSelector("Unsupported XPath expression: " + value)
    attr_name = None
    text_only = value.endswith("/text()")
    if text_only:
        value = value[:-7]
    attr_match = re.search(r"/@([\w:-]+)$", value)
    if attr_match:
        attr_name = attr_match.group(1)
        value = value[:attr_match.start()]

    if value.startswith(".//"):
        index, axis = 3, "descendant"
    elif value.startswith("//"):
        index, axis = 2, "descendant"
    elif value.startswith("./"):
        index, axis = 2, "child"
    elif value.startswith("/"):
        index, axis = 1, "child"
    else:
        raise UnsupportedSelector("Unsupported XPath path: " + value)

    steps = []
    while index < len(value):
        slash = value.find("/", index)
        segment = value[index:] if slash < 0 else value[index:slash]
        if segment:
            steps.append((axis, segment))
        if slash < 0:
            break
        if value.startswith("//", slash):
            axis, index = "descendant", slash + 2
        else:
            axis, index = "child", slash + 1

    current = [root]
    for axis, segment in steps:
        match = re.fullmatch(r"([A-Za-z*][\w*-]*)(?:\[@([\w:-]+)(?:=['\"]([^'\"]*)['\"])?\])?", segment)
        if not match:
            raise UnsupportedSelector("Unsupported XPath step: " + segment)
        tag, attr, expected = match.groups()
        next_nodes = []
        for parent in current:
            pool = list(_walk(parent)) if axis == "descendant" else [
                child for child in parent.children if isinstance(child, _Node)
            ]
            for node in pool:
                if tag != "*" and node.tag != tag.lower():
                    continue
                if attr and attr not in node.attrs:
                    continue
                if expected is not None and node.attrs.get(attr) != expected:
                    continue
                next_nodes.append(node)
        current = next_nodes
    if attr_name:
        return [node.attrs[attr_name] for node in current if attr_name in node.attrs]
    if text_only:
        return [child for node in current for child in node.children if isinstance(child, str)]
    return current

def _query(root, selector, syntax="css"):
    expression = selector.strip()
    pseudo = None
    if syntax == "css":
        attr = re.search(r"::attr\(([\w:-]+)\)$", expression)
        if attr:
            pseudo = ("attr", attr.group(1))
            expression = expression[:attr.start()]
        elif expression.endswith("::text"):
            pseudo = ("text", None)
            expression = expression[:-6]
        nodes = _css_nodes(root, expression)
    elif syntax == "xpath":
        nodes = _xpath_nodes(root, expression)
    else:
        raise ValueError("syntax must be 'css' or 'xpath'")
    if pseudo == "attr":
        return [node.attrs[pseudo[1]] for node in nodes if isinstance(node, _Node) and pseudo[1] in node.attrs]
    if pseudo == "text":
        return [node.text() for node in nodes if isinstance(node, _Node)]
    return [node.text() if isinstance(node, _Node) else str(node) for node in nodes]


class Item:
    def __init__(self, values, raw):
        self._values, self._raw = values, raw

    def get(self, name, default=None):
        return self._values.get(name, default)

    def value(self, name, default=None):
        return self.get(name, default)

    def get_all(self, name):
        return self._raw.get(name, [])

    def to_dict(self):
        return dict(self._values)


class Page:
    """Small declarative extractor supporting common CSS and XPath selectors."""
    def __init__(self):
        self._fields = []

    def field(self, name, selector, *, syntax="css", map=None):
        self._fields.append((name, selector, syntax, "one", None, map))
        return self

    def field_all(self, name, selector, *, syntax="css", map=None):
        self._fields.append((name, selector, syntax, "all", None, map))
        return self

    def field_join(self, name, selector, separator=" ", *, syntax="css", map=None):
        self._fields.append((name, selector, syntax, "join", separator, map))
        return self

    def extract(self, html, encoding=None, *, content_type=None, url=None):
        source = _decode(html, encoding, content_type)
        parser = _TreeParser()
        parser.feed(source)
        parser.close()
        values, raw = {}, {}
        for name, selector, syntax, mode, separator, mapper in self._fields:
            found = _query(parser.root, selector, syntax)
            raw[name] = found
            if mode == "all":
                value = list(found)
            elif mode == "join":
                value = separator.join(found)
            else:
                value = found[0] if found else None
            values[name] = mapper(value) if mapper else value
        return Item(values, raw)


def extract(html, queries, encoding=None, *, content_type=None, url=None, strict=True):
    """Compatibility helper for simple named selectors: {name: selector}."""
    page = Page()
    for name, selector in queries.items():
        try:
            page.field(name, selector)
        except UnsupportedSelector:
            if strict:
                raise
    return page.extract(html, encoding, content_type=content_type, url=url)
