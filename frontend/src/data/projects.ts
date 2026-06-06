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
    title: '黄焖鸡项目：CGCNN 带隙预测',
    description: '基于晶体图卷积网络与传统机器学习的材料性质预测实践。',
    coverClass: 'from-slate-900 to-indigo-700',
  },
  {
    title: '个人网站系统',
    description: '用于项目展示、作品发布、文件上传与朋友协作更新。',
    coverClass: 'from-slate-900 to-cyan-700',
  },
]
