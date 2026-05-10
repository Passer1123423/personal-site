"""
seed.py

这个文件用于向数据库插入一组测试数据。

当前用途：
1. 验证 SQLite 数据库能正常写入
2. 验证 Asset、ComicSeries、ComicPart、ComicChapter、ComicPage 之间的关系能跑通
3. 为后面写 API 提供一组可查询的数据

注意：
这不是正式的后台管理功能。
它只是开发阶段用的一次性测试脚本。
"""

from sqlmodel import Session, select

from .database import create_db_and_tables, engine
from .models import Asset, ComicChapter, ComicPage, ComicPart, ComicSeries


def seed_demo_comic():
    """
    插入一组演示漫画数据。

    数据结构是：

    ComicSeries
    └── ComicPart
        └── ComicChapter
            ├── ComicPage -> Asset
            └── ComicPage -> Asset

    也就是：
    一个漫画系列
    一个分部
    一个章节
    两张漫画页
    """

    # 先确保数据库表已经创建。
    # 如果表已经存在，不会重复创建。
    create_db_and_tables()

    # 打开一次数据库会话。
    # session 可以理解为一次数据库操作窗口。
    with Session(engine) as session:
        # 检查是否已经插入过 demo 数据。
        #
        # 因为 ComicSeries.slug 是唯一的，
        # 如果重复插入 demo-comic，会报唯一约束错误。
        existing_series = session.exec(
            select(ComicSeries).where(ComicSeries.slug == "demo-comic")
        ).first()

        if existing_series:
            print("测试漫画数据已经存在，不重复插入。")
            return

        # 1. 创建封面资源。
        #
        # 现在还没有真正做上传功能，
        # 所以这里先用假的 url。
        #
        # 后面做上传后，url 会变成真实图片地址。
        cover_asset = Asset(
            filename="demo-cover.jpg",
            original_name="demo-cover.jpg",
            mime_type="image/jpeg",
            size=0,
            url="/uploads/demo/demo-cover.jpg",
            usage="comic_cover",
        )

        part_cover_asset = Asset(
            filename="demo-part-1-cover.jpg",
            original_name="demo-part-1-cover.jpg",
            mime_type="image/jpeg",
            size=0,
            url="/uploads/demo/demo-part-1-cover.jpg",
            usage="comic_cover",
        )

        # 2. 创建两张漫画页图片资源。
        page_asset_1 = Asset(
            filename="demo-page-001.jpg",
            original_name="demo-page-001.jpg",
            mime_type="image/jpeg",
            size=0,
            url="/uploads/demo/demo-page-001.jpg",
            usage="comic_page",
        )

        page_asset_2 = Asset(
            filename="demo-page-002.jpg",
            original_name="demo-page-002.jpg",
            mime_type="image/jpeg",
            size=0,
            url="/uploads/demo/demo-page-002.jpg",
            usage="comic_page",
        )

        # 先把 Asset 加入 session。
        #
        # add 只是暂时登记，真正写入数据库要等 commit。
        session.add(cover_asset)
        session.add(part_cover_asset)
        session.add(page_asset_1)
        session.add(page_asset_2)

        # flush 会把当前对象先送入数据库，
        # 这样可以确保它们的 id 已经可用。
        #
        # 因为后面的 ComicSeries 和 ComicPage 需要引用这些 id。
        session.flush()

        # 3. 创建漫画系列。
        series = ComicSeries(
            slug="demo-comic",
            title="测试漫画",
            summary="这是用于验证数据库结构的测试漫画。",
            cover_asset_id=cover_asset.id,
            status="ongoing",
            visibility="public",
            display_order=1,
        )

        session.add(series)
        session.flush()

        # 4. 创建漫画分部。
        part = ComicPart(
            series_id=series.id,
            slug="part-1",
            title="第一部",
            summary="测试漫画的第一部分。",
            cover_asset_id=part_cover_asset.id,
            status="ongoing",
            visibility="public",
            display_order=1,
        )

        session.add(part)
        session.flush()

        # 5. 创建漫画章节。
        chapter = ComicChapter(
            part_id=part.id,
            slug="chapter-1",
            title="第 1 话",
            summary="这是测试章节。",
            visibility="public",
            display_order=1,
        )

        session.add(chapter)
        session.flush()

        # 6. 创建漫画页。
        #
        # ComicPage 本身不直接存图片地址。
        # 它通过 asset_id 关联 Asset。
        page_1 = ComicPage(
            chapter_id=chapter.id,
            asset_id=page_asset_1.id,
            display_order=1,
            width=None,
            height=None,
        )

        page_2 = ComicPage(
            chapter_id=chapter.id,
            asset_id=page_asset_2.id,
            display_order=2,
            width=None,
            height=None,
        )

        session.add(page_1)
        session.add(page_2)

        # commit 才是真正提交到数据库。
        session.commit()

        print("测试漫画数据插入完成。")
        print(f"ComicSeries id: {series.id}")
        print(f"ComicPart id: {part.id}")
        print(f"ComicChapter id: {chapter.id}")


if __name__ == "__main__":
    seed_demo_comic()
