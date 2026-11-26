import sys
from pathlib import Path
from importlib.metadata import version

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "android/app/src/main/assets/python"))

from frostwork import Page, navigation, UnsupportedSelector


def test_local_distribution_metadata_satisfies_w3lib_floor():
    assert version('frostwork') == '0.2.2'


def test_navigation_base_and_refresh():
    html = b'<base href="/shop/"><meta http-equiv="refresh" content="5;url=sale"><h1>Mug</h1>'
    nav = navigation(html, "https://example.com/p")
    assert nav.base_url == "https://example.com/shop/"
    assert nav.meta_refresh.delay == 5.0
    assert nav.meta_refresh.url == "https://example.com/shop/sale"


def test_navigation_shortest_refresh_and_noscript():
    html = """<noscript><meta http-equiv="refresh" content="0;url=/disabled"></noscript>
    <meta http-equiv="refresh" content="8;url=/later">
    <meta http-equiv="refresh" content="2;url=/first">
    <meta http-equiv="refresh" content="2;url=/tie">"""
    nav = navigation(html, "https://example.com/page")
    assert nav.meta_refresh == (2.0, "https://example.com/tie")


def test_css_and_xpath_multifield_extraction():
    html = b"""<main><article class='product'><h1>Widget</h1>
    <span class='price'>$9</span><img src='/a.png'><img src='/b.png'></article></main>"""
    page = (Page()
            .field("name", "article.product h1::text")
            .field("price", ".price::text")
            .field_all("images", "img::attr(src)")
            .field_join("summary", "//article[@class='product']/h1/text()", " ", syntax="xpath"))
    item = page.extract(html)
    assert item.to_dict() == {
        "name": "Widget", "price": "$9", "images": ["/a.png", "/b.png"], "summary": "Widget"
    }
    assert item.get_all("images") == ["/a.png", "/b.png"]


def test_child_and_attribute_selectors():
    html = "<div id='root'><a class='active' href='/one'>One</a><section><a class='active' href='/nested'>Nested</a><a href='/two'>Two</a></section></div>"
    item = Page().field_all("links", "#root > a.active::attr(href)").extract(html)
    assert item.get("links") == ["/one"]


def test_xpath_descendant_axis():
    html = "<div><section><a>Nested</a></section><a>Direct</a></div>"
    item = Page().field_all("links", "//div//a/text()", syntax="xpath").extract(html)
    assert item.get("links") == ["Nested", "Direct"]


def test_unsupported_css_is_explicit():
    try:
        Page().field("x", "a:hover").extract("<a>link</a>")
    except UnsupportedSelector:
        return
    raise AssertionError("unsupported pseudo-class must not silently return an empty result")
