import argparse
from sqlmodel import Session, select

from app.database import engine
from app.models import User
from app.core.security import hash_password


VALID_ROLES = {"reader", "author", "admin"}


def create_user(
    username: str,
    display_name: str,
    password: str,
    role: str,
    bio: str = "",
):
    if role not in VALID_ROLES:
        raise ValueError(f"role 必须是以下之一: {', '.join(sorted(VALID_ROLES))}")

    with Session(engine) as session:
        existing_user = session.exec(
            select(User).where(User.username == username)
        ).first()

        if existing_user:
            raise ValueError(f"用户已存在: {username}")

        user = User(
            username=username,
            display_name=display_name,
            password_hash=hash_password(password),
            role=role,
            bio=bio,
        )

        session.add(user)
        session.commit()
        session.refresh(user)

        return user


def main():
    parser = argparse.ArgumentParser(description="Create a site user.")
    parser.add_argument("--username", required=True)
    parser.add_argument("--display-name", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--role", default="reader", choices=sorted(VALID_ROLES))
    parser.add_argument("--bio", default="")

    args = parser.parse_args()

    user = create_user(
        username=args.username,
        display_name=args.display_name,
        password=args.password,
        role=args.role,
        bio=args.bio,
    )

    print("User created:")
    print(f"  id: {user.id}")
    print(f"  username: {user.username}")
    print(f"  display_name: {user.display_name}")
    print(f"  role: {user.role}")
    print(f"  is_active: {user.is_active}")


if __name__ == "__main__":
    main()