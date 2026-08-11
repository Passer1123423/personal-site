export type Project = {
  title: string
  description: string
  coverClass: string
}

export const projects: Project[] = [
  {
    title: '一维势垒穿透可视化',
    description: '数值求解能量本征态，展示波函数、概率密度与含时演化。',
    coverClass: 'from-slate-900 to-blue-700',
  },
  {
    title: '个人网站系统',
    description: '项目介绍、展示载体。',
    coverClass: 'from-slate-900 to-cyan-700',
  },
  {
    title: 'Saba-note',
    description: '个人笔记功能',
    coverClass: 'from-slate-900 to-cyan-700',
  },
  {
    title: 'CGCNN 材料带隙预测',
    description: '基于晶体图卷积网络与传统机器学习的材料性质预测实践。',
    coverClass: 'from-slate-900 to-indigo-700',
  },
  {
    title: '单片机的智能转轮',
    description: '基于32位Ai8051u的电助力智能转轮设计。',
    coverClass: 'from-slate-900 to-indigo-700',
  },
  {
    title: '单片机智能语音回复',
    description: '基于32位Ai8051u和deepseek云端api的人工智能相应终端。',
    coverClass: 'from-slate-900 to-indigo-700',
  },
]
