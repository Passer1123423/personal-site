import re

from sqlmodel import Session, select

from app.models import (
    Novel,
    NovelChapter,
    NovelTextBuffer,
    now_utc,
)

from app.services.novel_admin import (
    create_chapter,
    reset_chapter_content,
)


VALID_CONTENT_TYPES = {"markdown", "plain_text"}


def normalize_content_type(content_type: str | None) -> str:
    content_type = (content_type or "markdown").strip()

    if content_type not in VALID_CONTENT_TYPES:
        raise ValueError("content_type 必须是 markdown 或 plain_text")

    return content_type


def plain_text_to_markdown(content: str | None) -> str:
    """
    将普通文本转成基础 Markdown。

    当前规则保持保守：
    1. 统一换行符
    2. 去掉首尾空白
    3. 空行分段
    4. 段内单换行合并为空格
    """

    content = (content or "").replace("\r\n", "\n").replace("\r", "\n").strip()

    if not content:
        return ""

    paragraphs = re.split(r"\n\s*\n", content)

    markdown_paragraphs = []

    for paragraph in paragraphs:
        lines = [
            line.strip()
            for line in paragraph.split("\n")
            if line.strip()
        ]

        if lines:
            markdown_paragraphs.append(" ".join(lines))

    return "\n\n".join(markdown_paragraphs)


def buffer_content_to_markdown(buffer: NovelTextBuffer) -> str:
    if buffer.content_type == "markdown":
        return buffer.content or ""

    if buffer.content_type == "plain_text":
        return plain_text_to_markdown(buffer.content)

    raise ValueError("未知 content_type")


def get_text_buffer(
    session: Session,
    buffer_id: str,
    user_id: str | None = None,
) -> NovelTextBuffer:
    statement = select(NovelTextBuffer).where(NovelTextBuffer.id == buffer_id)

    if user_id:
        statement = statement.where(NovelTextBuffer.user_id == user_id)

    buffer = session.exec(statement).first()

    if not buffer:
        raise ValueError("未找到文字缓冲区")

    return buffer


def get_latest_chapter_buffer(
    session: Session,
    user_id: str,
    chapter_id: str,
) -> NovelTextBuffer | None:
    statement = (
        select(NovelTextBuffer)
        .where(NovelTextBuffer.user_id == user_id)
        .where(NovelTextBuffer.chapter_id == chapter_id)
        .order_by(NovelTextBuffer.updated_at.desc())
    )

    return session.exec(statement).first()


def list_user_text_buffers(
    session: Session,
    user_id: str,
    novel_id: str | None = None,
) -> list[NovelTextBuffer]:
    statement = (
        select(NovelTextBuffer)
        .where(NovelTextBuffer.user_id == user_id)
        .order_by(NovelTextBuffer.updated_at.desc())
    )

    if novel_id:
        statement = statement.where(NovelTextBuffer.novel_id == novel_id)

    return session.exec(statement).all()


def clear_chapter_buffers(
    session: Session,
    user_id: str,
    chapter_id: str,
) -> None:
    buffers = session.exec(
        select(NovelTextBuffer)
        .where(NovelTextBuffer.user_id == user_id)
        .where(NovelTextBuffer.chapter_id == chapter_id)
    ).all()

    for buffer in buffers:
        session.delete(buffer)

    session.commit()


def create_text_buffer(
    session: Session,
    user_id: str,
    novel_id: str,
    chapter_id: str | None = None,
    content: str | None = None,
    content_type: str | None = "markdown",
) -> NovelTextBuffer:
    content_type = normalize_content_type(content_type)

    buffer = NovelTextBuffer(
        user_id=user_id,
        novel_id=novel_id,
        chapter_id=chapter_id,
        content_type=content_type,
        content=content or "",
    )

    session.add(buffer)
    session.commit()
    session.refresh(buffer)

    return buffer


def load_chapter_to_buffer(
    session: Session,
    user_id: str,
    novel: Novel,
    chapter: NovelChapter,
) -> NovelTextBuffer:
    """
    编辑已有章节前，把正式 chapter.content 加载到文字缓冲区。

    编辑已有章节只支持 markdown。
    """

    clear_chapter_buffers(
        session=session,
        user_id=user_id,
        chapter_id=chapter.id,
    )

    return create_text_buffer(
        session=session,
        user_id=user_id,
        novel_id=novel.id,
        chapter_id=chapter.id,
        content=chapter.content,
        content_type="markdown",
    )


def create_empty_buffer_for_novel(
    session: Session,
    user_id: str,
    novel: Novel,
    content_type: str | None = "markdown",
) -> NovelTextBuffer:
    """
    用于新建章节前的空文字缓冲区。

    此时 chapter_id 为空。
    """

    return create_text_buffer(
        session=session,
        user_id=user_id,
        novel_id=novel.id,
        chapter_id=None,
        content="",
        content_type=content_type,
    )


def update_text_buffer(
    session: Session,
    buffer_id: str,
    user_id: str,
    content: str | None = None,
    content_type: str | None = None,
) -> NovelTextBuffer:
    buffer = get_text_buffer(
        session=session,
        buffer_id=buffer_id,
        user_id=user_id,
    )

    if content_type is not None:
        buffer.content_type = normalize_content_type(content_type)

    buffer.content = content or ""
    buffer.updated_at = now_utc()

    session.add(buffer)
    session.commit()
    session.refresh(buffer)

    return buffer


def publish_buffer_to_existing_chapter(
    session: Session,
    buffer_id: str,
    user_id: str,
    novel_slug: str,
    chapter_slug: str,
) -> NovelChapter:
    buffer = get_text_buffer(
        session=session,
        buffer_id=buffer_id,
        user_id=user_id,
    )

    markdown_content = buffer_content_to_markdown(buffer)

    chapter = reset_chapter_content(
        session=session,
        novel_slug=novel_slug,
        chapter_slug=chapter_slug,
        content=markdown_content,
    )

    session.delete(buffer)
    session.commit()

    return chapter


def publish_buffer_to_new_chapter(
    session: Session,
    buffer_id: str,
    user_id: str,
    novel_slug: str,
    chapter_slug: str,
    custom_title: str | None = None,
) -> NovelChapter:
    buffer = get_text_buffer(
        session=session,
        buffer_id=buffer_id,
        user_id=user_id,
    )

    markdown_content = buffer_content_to_markdown(buffer)

    chapter = create_chapter(
        session=session,
        novel_slug=novel_slug,
        chapter_slug=chapter_slug,
        custom_title=custom_title,
        content=markdown_content,
    )

    session.delete(buffer)
    session.commit()

    return chapter


def delete_text_buffer(
    session: Session,
    buffer_id: str,
    user_id: str,
) -> None:
    buffer = get_text_buffer(
        session=session,
        buffer_id=buffer_id,
        user_id=user_id,
    )

    session.delete(buffer)
    session.commit()
