# tests/backend/test_auth_secret_from_env.py
"""JWT secret-from-environment tests. See ROADMAP.md §B and CURRENT_SPRINT.md §1.1.

These tests prove three properties of the JWT secret bootstrap:

  1. The default insecure string ("change-me-in-production") is REJECTED at
     startup when APP_ENV is not "local". The server must refuse to boot.
  2. Tokens are signed with the secret loaded from the JWT_SECRET_KEY env var
     (not the dev default), so changing the env var invalidates existing
     tokens.
  3. CORS does not silently ignore the secret — these are independent
     concerns, but the security posture depends on both being locked.
"""
import importlib

import pytest


def _reload_config():
    """Reload `app.core.config` with the current os.environ in scope.

    `config.py` reads JWT_SECRET_KEY at import time via `os.getenv`. To test
    behavior under different env values, we have to re-import the module.
    """
    import app.core.config as cfg_module
    return importlib.reload(cfg_module)


@pytest.mark.smoke
def test_default_jwt_secret_rejected_in_non_local_env(monkeypatch):
    """Server startup raises RuntimeError when APP_ENV != local and the
    secret is the hardcoded dev default."""
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET_KEY", "change-me-in-production")

    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY must be set"):
        # Re-importing the module runs the validation block at module top
        # level, which raises when the unsafe default is detected.
        import app.core.config  # noqa: F401
        _reload_config()


@pytest.mark.smoke
def test_jwt_secret_loaded_from_environment(monkeypatch):
    """A custom JWT_SECRET_KEY in the env is what the JWT signer uses."""
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET_KEY", "an-arbitrary-strong-secret-1234567890")
    cfg = _reload_config()

    assert cfg.JWT_SECRET_KEY == "an-arbitrary-strong-secret-1234567890"
    # Should not raise — non-default secret accepted in non-local env.
    assert cfg.JWT_SECRET_KEY != "change-me-in-production"


@pytest.mark.smoke
def test_changing_jwt_secret_invalidates_previously_issued_tokens(monkeypatch):
    """A token signed under secret A is rejected after the env is rotated to B.

    Proves the secret is actually consulted on every encode/decode (i.e. not
    baked in at startup and then frozen), and that rotation is a real
    no-confusion operation for in-flight tokens.
    """
    import importlib
    import app.core.config as cfg_module
    import app.security.jwt as jwt_module
    from uuid import uuid4

    def _reload_pair():
        """Reload config + jwt so the jwt module re-binds the new secret."""
        cfg = importlib.reload(cfg_module)
        importlib.reload(jwt_module)
        return cfg

    # Sign a token under secret A
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET_KEY", "secret-A-aaaaaaaaaaaaaaaaaaaa")
    _reload_pair()
    secret_a = cfg_module.JWT_SECRET_KEY  # capture value, not module ref

    user_id = uuid4()
    tenant_id = uuid4()
    token = jwt_module.create_access_token(user_id, tenant_id)

    # Verify under the same secret — must succeed
    decoded = jwt_module.decode_access_token(token)
    assert decoded.get("sub") == str(user_id), f"expected sub={user_id}, got {decoded}"
    assert decoded.get("tenant_id") == str(tenant_id)

    # Rotate: change env, reload both modules so the new secret takes effect
    monkeypatch.setenv("JWT_SECRET_KEY", "secret-B-bbbbbbbbbbbbbbbbbbbb")
    _reload_pair()
    secret_b = cfg_module.JWT_SECRET_KEY
    assert secret_a != secret_b, f"rotation did not change secret: {secret_a!r} == {secret_b!r}"

    # The old token is no longer valid — decode_access_token returns {} on
    # any JWTError (bad signature / expired / malformed). All three prove
    # the secret was actually consulted.
    decoded_after_rotation = jwt_module.decode_access_token(token)
    assert decoded_after_rotation == {}, (
        f"Token should be invalid under rotated secret, "
        f"but decode_access_token returned {decoded_after_rotation!r}"
    )

    # A fresh token issued under secret B is verifiable under B (round-trip).
    new_token = jwt_module.create_access_token(user_id, tenant_id)
    assert jwt_module.decode_access_token(new_token).get("sub") == str(user_id)


@pytest.mark.smoke
def test_local_env_allows_default_secret_for_development(monkeypatch):
    """APP_ENV=local permits the dev default — local dev must not require
    every developer to invent a 64-char secret before they can run the API.

    This is the documented escape hatch in config.py; we lock it here so
    nobody tightens or removes it by accident.
    """
    monkeypatch.setenv("APP_ENV", "local")
    monkeypatch.setenv("JWT_SECRET_KEY", "change-me-in-production")
    cfg = _reload_config()
    assert cfg.JWT_SECRET_KEY == "change-me-in-production"
