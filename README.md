# SzNote - 极简笔记

<div align="center">

![SzNote Logo](https://github.com/ChKSz/SzNote/blob/adf5bbd41d4415c7d54ed9cbe013e6343d624056/Pic/logo.png?raw=true)

**轻松记录，专注于你的想法**

![Node.js](https://img.shields.io/badge/Node.js-22.17.1-green.svg)
![Express](https://img.shields.io/badge/Express-4.18.2-blue.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)
![Version](https://img.shields.io/badge/Version-1.5.0-red.svg)

 

</div>

## ✨ 特性

- 🚀 **极简设计** - 专注于内容创作，无干扰界面
- 📝 **Markdown 支持** - 实时编辑和预览，支持完整 Markdown 语法
- 🔒 **密码保护** - 使用 bcrypt 哈希和 AES-256-CBC 加密保护隐私内容
- 🎯 **自定义 ID** - 通过自定义 ID 快速创建和访问笔记
- 📱 **响应式设计** - 适配桌面和移动设备
- 🌙 **深色模式** - 自动检测系统主题偏好
- ⚡ **高性能** - 内存缓存和自动清理机制
- 🛠️ **工具栏** - 丰富的 Markdown 编辑快捷工具
- 👁️ **预览模式** - 可切换的纯预览模式
- 🎮 **新手引导** - 友好的用户引导流程



## 🚀 快速开始

### 环境要求

- Node.js 18.0 或更高版本
- npm 或 yarn 包管理器

### 安装

1. **克隆仓库**
   ```bash
   git clone https://github.com/ChKSz/SzNote.git
   cd SzNote
   ```

2. **安装依赖**
   ```bash
   npm i
   ```

3. **启动应用**
   ```bash
   npm start
   ```

4. **访问应用**
   
   打开浏览器访问 `http://localhost:8888`

### Docker 部署 

```bash
# 构建镜像
docker build -t sznote .

# 运行容器
docker run -d -p 8888:8888 -v $(pwd)/notes:/app/notes --name sznote sznote
```

## 📁 项目结构

```
SzNote/
├── server.js              # 后端文件
├── package.json           # 项目依赖
├── config.json            # 应用配置文件
├── notes/                 # 笔记存储目录
│   ├── 114514.json       # 示例笔记文件
│   └── ...
├── public/                # 静态资源目录
│   ├── index.html         # 主页面
│   ├── css/
│   │   └── style.css      # 样式文件
│   ├── js/
│   │   └── script.js      # 前端逻辑
│   ├── NotesIcon.png      # 应用图标
│   └── NotesIconWhite.png # 深色模式图标
└── README.md              # 项目说明文档
```

## ⚙️ 配置选项

编辑 `config.json` 文件来自定义应用设置：

```json
{
  "port": 8888,                // 服务器端口
  "maxNoteSize": 100000,       // 笔记最大大小
  "cacheTTL": 600,             // 缓存生存时间
  "cacheCheckPeriod": 120,     // 缓存检查周期
  "noteExpireDays": 30         // 笔记过期天数
}
```


## 🛡️ 安全特性

- **输入验证**: 笔记 ID 必须是 `a-z , A-Z , 0-9 , -`中的组合
- **密码哈希**: 使用 bcrypt 安全存储密码
- **内容加密**: 受保护笔记使用 AES-256-CBC 加密
- **防护攻击**: 防止路径遍历和 DoS 攻击
- **内容限制**: 限制笔记大小防止滥用

## 🎯 使用场景

- 📚 **个人笔记** - 记录日常想法和灵感
- 📖 **学习笔记** - 整理学习资料和知识点
- 💼 **工作记录** - 会议纪要和项目文档
- 🔐 **隐私内容** - 需要密码保护的敏感信息
- 📱 **移动办公** - 随时随地访问和编辑笔记
- 🤝 **内容分享** - 通过自定义 ID 分享笔记

## 🤝 贡献指南

我们欢迎所有形式的贡献！
当然最欢迎的还是捐赠（

### 开发环境设置

1. Fork 本仓库
2. 创建功能分支: 
`
git checkout -b feature/amazing-feature`
3. 提交更改: 
`git commit -m 'Add amazing feature'`
4. 推送分支: 
`git push origin feature/amazing-feature`
5. 提交 Pull Request


## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](https://github.com/ChKSz/SzNote/blob/main/LICENSE) 文件了解详情。

## 🙏 致谢

- [Marked.js](https://marked.js.org/) - Markdown 解析器
- [Font Awesome](https://fontawesome.com/) - 图标库
- [Google Fonts](https://fonts.google.com/) - Inter 字体
- [Express.js](https://expressjs.com/) - Web 框架
- [Rovodev](https://community.atlassian.com/forums/Rovo-for-Software-Teams-Beta/Introducing-Rovo-Dev-CLI-AI-Powered-Development-in-your-terminal/ba-p/3043623) - 协助开发（偷懒小助手）
- 当然还有我自己啦（doge

## 🔗 相关链接

- 作者: [ChKSz](https://page.chksz.top)
- 项目链接: [SzNote](https://github.com/ChKSz/SzNote)
- 问题反馈: [Issues](https://github.com/ChKSz/SzNote/issues)

---

<div align="center">

**如果这个项目对你有帮助，请给它一个 ⭐**


Made by [ChKSz](https://page.chksz.top)

Thanks~
</div>

