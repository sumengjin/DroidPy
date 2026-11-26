import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "contracts" / "bridge" / "legacy" / "fixtures"


def _load(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_python_stop_without_active_process_fixture():
    response = _load("stop-no-active.python.json")
    assert response == {"ok": True, "stopped": False}


def test_kotlin_stop_without_active_process_fixture():
    response = _load("stop-no-active.kotlin.json")
    assert response == {"ok": True}
    assert "stopped" not in response


def test_legacy_stream_fixtures_keep_expected_event_envelopes():
    stdout = json.loads((FIXTURES / "stdout.jsonl").read_text(encoding="utf-8"))
    done = json.loads((FIXTURES / "done.jsonl").read_text(encoding="utf-8"))

    assert stdout == {"type": "stdout", "data": "hello from DroidPy\n"}
    assert done["type"] == "done"
    assert isinstance(done["exitCode"], int)
    assert isinstance(done["durationMs"], int)
    assert done["durationMs"] >= 0
    assert set(done) == {"type", "exitCode", "durationMs"}
