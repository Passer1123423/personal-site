# Service Design

## comic_admin.py

位置：

```txt
backend/app/services/comic_admin.py

作用：

comic_admin.py 用于集中管理漫画内容的后台逻辑，避免把数据库操作直接写进 scripts 或 API 路由中。

当前包含几类函数：

1. 文件识别
guess_mime_type()
list_image_files()

用于从缓存目录中筛选合法图片，并按当前规则排序。

2. 查询函数
get_series()
get_part()
get_chapter()
get_pages()

只负责获取已有数据，不负责创建。

3. 获取或创建函数
get_or_create_series()
get_or_create_part()
create_next_chapter()

用于导入或发布流程。

4. 导入函数
copy_image_to_uploads()
create_asset()
create_comic_page()
import_comic_chapter_from_dir()

负责把缓存区中的一组图片注册成一章漫画。

5. 删除函数
delete_chapter()
delete_part()
delete_series()
delete_chapter_files()
reorder_chapters()

负责删除漫画内容和对应资源，并维护显示顺序。

Session 约定

service 函数应优先接收外部传入的 Session。

def delete_chapter(session: Session, ...):
    ...

scripts 或 API 负责创建 session：

with Session(engine) as session:
    delete_chapter(session=session, ...)

这样后续 scripts、API、后台 UI 都可以复用同一套 service。

