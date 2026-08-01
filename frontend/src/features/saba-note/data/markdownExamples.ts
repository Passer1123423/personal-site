export type MarkdownExample = {
  id: string;
  title: string;
  description: string;
  source: string;
};

export type MarkdownExampleSection = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  examples: MarkdownExample[];
};

export const SABA_NOTE_MARKDOWN_EXAMPLES: MarkdownExampleSection[] = [
  {
    id: "latex",
    eyebrow: "LaTeX",
    title: "常用公式",
    description: "行内公式使用单个 $，独立公式块使用两个 $。",
    examples: [
      {
        id: "scripts",
        title: "上下标与分组",
        description: "单字符可直接书写；多个字符需要放进花括号。",
        source: String.raw`行内：$x_i^2 + a_{n+1} + e^{-i\omega t}$`,
      },
      {
        id: "matrix",
        title: "矩阵",
        description: "pmatrix 带圆括号；也可换成 bmatrix 使用方括号。",
        source: String.raw`$$
A = \begin{pmatrix}
  a & b \\
  c & d
\end{pmatrix}
$$`,
      },
      {
        id: "accents",
        title: "点、箭头与算符标记",
        description: "常用于时间导数、向量、平均值和量子算符。",
        source: String.raw`$\dot{x},\ \ddot{x},\ \vec{v},\ \hat{H},\ \bar{x}$`,
      },
      {
        id: "delimiters",
        title: "绝对值、范数与自适应括号",
        description: "left 和 right 会让定界符随内部公式自动伸缩。",
        source: String.raw`$$
\left|\frac{x+1}{x-1}\right|,
\qquad
\left\|\vec{v}\right\| = \sqrt{\sum_i v_i^2}
$$`,
      },
      {
        id: "quantum",
        title: "量子力学常用记号",
        description: "包括 ket、bra、内积、期望值与定态薛定谔方程。",
        source: String.raw`$$
|\psi\rangle,
\quad \langle\phi|\psi\rangle,
\quad \langle\psi|\hat{A}|\psi\rangle,
\quad \hat{H}|\psi\rangle = E|\psi\rangle
$$`,
      },
      {
        id: "calculus",
        title: "偏导、梯度、积分与求和",
        description: "frac 适合分式导数，partial、nabla 分别表示偏导和梯度。",
        source: String.raw`$$
\frac{\partial f}{\partial x}
+ \nabla^2 \psi
= \int_{-\infty}^{\infty} f(x)\,dx
+ \sum_{n=1}^{N} a_n
$$`,
      },
    ],
  },
  {
    id: "markdown",
    eyebrow: "Markdown",
    title: "常用格式",
    description: "这些写法会在实时预览和 Derivation 阅读页中保持一致。",
    examples: [
      {
        id: "headings-emphasis",
        title: "标题与强调",
        description: "正文通常从二级标题开始，便于自动生成目录。",
        source: [
          "## 二级标题",
          "### 三级标题",
          "",
          "这是 **粗体**、*斜体* 和 ~~删除线~~。",
        ].join("\n"),
      },
      {
        id: "lists-quotes",
        title: "列表、任务与引用",
        description: "支持 GFM 任务列表和嵌套项目。",
        source: [
          "- 第一项",
          "  - 子项目",
          "- [x] 已完成",
          "- [ ] 待处理",
          "",
          "> 引用适合补充来源、前提或旁注。",
        ].join("\n"),
      },
      {
        id: "table",
        title: "表格",
        description: "宽表格会在容器内部横向滚动。",
        source: [
          "| 符号 | 含义 |",
          "| --- | --- |",
          "| $E$ | 能量 |",
          "| $\\hbar$ | 约化普朗克常数 |",
        ].join("\n"),
      },
      {
        id: "code",
        title: "代码块",
        description: "在开头标注语言可启用语法高亮。",
        source: [
          "```ts",
          "const energy = (frequency: number) => h * frequency;",
          "```",
        ].join("\n"),
      },
      {
        id: "callout-footnote",
        title: "提示块与脚注",
        description: "提示块适合突出重要前提，脚注适合保留补充说明。",
        source: [
          "> [!IMPORTANT]",
          "> 先确认公式中的单位制。",
          "",
          "这句话带有一条脚注。[^note]",
          "",
          "[^note]: 脚注会自动排列在正文底部。",
        ].join("\n"),
      },
    ],
  },
];
