from fastapi import Depends, HTTPException, status

from app.models.user import User
from app.security.security import get_current_user

# Role name constants — must match what is stored in the roles table.
LOAN_OFFICER = "loan_officer"
PROCESSOR = "loan_processor"
UNDERWRITER = "underwriter"
ACCOUNT_MANAGER = "account_manager"
IT_ADMIN = "it_admin"


def require_roles(*allowed: str):
    """Dependency factory that enforces at least one matching role.

    Usage:
        @router.delete("/{id}", dependencies=[Depends(require_roles(IT_ADMIN))])
    """
    def _check(current_user: User = Depends(get_current_user)) -> User:
        user_role_names = {ur.role.name for ur in current_user.roles}
        if not user_role_names.intersection(set(allowed)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return _check
