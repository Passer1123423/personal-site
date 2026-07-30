import SabaNoteAsyncState from "../components/SabaNoteAsyncState";
import SabaNoteShell from "../components/SabaNoteShell";

export default function SabaNoteManagePage() {
  return (
    <SabaNoteShell eyebrow="知识结构">
      <div className="py-10">
        <SabaNoteAsyncState
          title="知识结构管理将在这里接入"
          description="Node、Category、Tag 与 Relation 的创建、编辑和安全删除会集中在这个页面，不进入阅读视图。"
        />
      </div>
    </SabaNoteShell>
  );
}
