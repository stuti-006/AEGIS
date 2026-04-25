import sqlite3


def test_auth_service_register_login_refresh(tmp_path, monkeypatch):
    # Patch module-level DB_PATH used by AuthService
    import services.auth_service as auth_mod

    db_path = tmp_path / "test_auth.db"
    monkeypatch.setattr(auth_mod, "DB_PATH", str(db_path), raising=True)

    auth = auth_mod.AuthService()
    user = auth.create_user("test@example.com", "password123")

    # Login
    user2 = auth.authenticate("test@example.com", "password123")
    assert user2 is not None
    assert user2.user_id == user.user_id

    # Access token should validate
    access = auth.create_access_token(user)
    u_from_token = auth.validate_access_token(access)
    assert u_from_token.user_id == user.user_id

    # Refresh token rotation
    refresh, jti, exp = auth.create_refresh_token(user)
    auth.persist_refresh_token(jti=jti, user_id=user.user_id, expires_at=exp)

    u_r, jti_r = auth.validate_refresh_token(refresh)
    assert u_r.user_id == user.user_id
    assert jti_r == jti

    auth.revoke_refresh_token(jti)
    try:
        auth.validate_refresh_token(refresh)
        assert False, "revoked refresh token should fail validation"
    except ValueError:
        pass


