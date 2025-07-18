const editor = document.getElementById('editor');
        const markdownPreview = document.getElementById('markdownPreview');
        const noteIdLink = document.getElementById('noteIdLink');
        const customIdInput = document.getElementById('customIdInput');
        const goIdButton = document.getElementById('goIdButton');
        const copyIdButton = document.getElementById('copyIdButton'); // 新增
        const saveStatusElement = document.getElementById('saveStatus'); // 新增
        const container = document.querySelector('.container');

        // 新增：编辑器工具栏元素
        const editorToolbar = document.getElementById('editorToolbar');
        const toolbarButtons = editorToolbar.querySelectorAll('button');

        // 新增：欢迎引导元素
        const welcomeOverlay = document.getElementById('welcomeOverlay');
        const welcomeTitle = document.getElementById('welcomeTitle');
        const welcomeDescription = document.getElementById('welcomeDescription');
        const welcomeNext = document.getElementById('welcomeNext');
        const welcomeSkip = document.getElementById('welcomeSkip');
        const progressDots = document.querySelectorAll('.progress-dot');

        // Password Modal Elements (for unlocking a note)
        const passwordModal = document.getElementById('passwordModal');
        const modalPasswordInput = document.getElementById('modalPasswordInput');
        const unlockNoteButton = document.getElementById('unlockNoteButton');
        const modalErrorMessage = document.getElementById('modalErrorMessage');
        const lockedContentPlaceholder = document.querySelector('.locked-content');

        // Settings Modal Elements
        const openSettingsModalButton = document.getElementById('openSettingsModalButton');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettingsModalButton = document.getElementById('closeSettingsModalButton');
        const currentNoteIdInSettings = document.getElementById('currentNoteIdInSettings');
        const changeNoteIdInput = document.getElementById('changeNoteIdInput');
        const applyChangeNoteIdButton = document.getElementById('applyChangeNoteIdButton');
        const changeIdMessage = document.getElementById('changeIdMessage');

        // Password Management in Settings Modal
        const newPasswordInput = document.getElementById('newPasswordInput');
        const currentPasswordForSetInput = document.getElementById('currentPasswordForSetInput');
        const setPasswordButton = document.getElementById('setPasswordButton');
        const setPasswordMessage = document.getElementById('setPasswordMessage');
        const removePasswordInput = document.getElementById('removePasswordInput');
        const removePasswordButton = document.getElementById('removePasswordButton');
        const removePasswordMessage = document.getElementById('removePasswordMessage');

        // Expire Days Management Elements
        const currentExpireDays = document.getElementById('currentExpireDays');
        const expireButtons = document.querySelectorAll('.expire-btn');
        const expireMessage = document.getElementById('expireMessage');

        let saveTimeout;
        let currentNoteId = ''; // 初始化 currentNoteId
        let currentNoteExpireDays = 3; // 当前笔记的过期天数

        // 安全密码管理器
        class SecurePasswordManager {
            constructor() {
                this.tempPassword = null;
                this.clearTimer = null;
            }
            
            setPassword(password) {
                this.clearPassword(); // 清除之前的密码
                this.tempPassword = password;
                // 设置自动清理 - 5分钟后清理
                this.clearTimer = setTimeout(() => {
                    this.clearPassword();
                }, 300000);
            }
            
            getPassword() {
                return this.tempPassword;
            }
            
            clearPassword() {
                if (this.tempPassword) {
                    // 尝试清零内存中的密码字符串
                    this.tempPassword = null;
                }
                if (this.clearTimer) {
                    clearTimeout(this.clearTimer);
                    this.clearTimer = null;
                }
            }
        }

        const passwordManager = new SecurePasswordManager();

        // 安全存储管理器
        const secureStorage = {
            setItem(key, value) {
                try {
                    // 使用sessionStorage并进行简单编码
                    sessionStorage.setItem(key, btoa(encodeURIComponent(value)));
                } catch (e) {
                    console.warn('Storage not available');
                }
            },
            getItem(key) {
                try {
                    const value = sessionStorage.getItem(key);
                    return value ? decodeURIComponent(atob(value)) : null;
                } catch (e) {
                    return null;
                }
            },
            removeItem(key) {
                try {
                    sessionStorage.removeItem(key);
                } catch (e) {
                    console.warn('Storage not available');
                }
            }
        };

        // 新增：欢迎引导状态
        let currentWelcomeStep = 0;
        const welcomeSteps = [
            {
                title: '欢迎使用 SzNote',
                description: '这是一个极简的在线笔记应用，支持 Markdown 语法、实时预览、密码保护、自动保存和过期管理等功能。',
                target: null
            },
            {
                title: '智能自动保存',
                description: '编辑内容时会自动保存，无需手动操作。让你专注于创作而不用担心丢失内容。',
                target: '#editor'
            },
            {
                title: '安全加密存储',
                description: '为笔记设置密码后，内容会在服务器端加密存储，只有输入正确密码才能解锁查看。即使服务器文件被窃取也无法破解内容。',
                target: '#openSettingsModalButton'
            },
            {
                title: '编辑与预览模式',
                description: '支持分屏编辑和纯预览两种模式。左侧输入内容，右侧实时预览渲染效果。可在设置中切换显示模式，纯预览模式下双击可快速切回编辑。',
                target: '#editor'
            },
            {
                title: '工具栏与快捷操作',
                description: '使用上方工具栏可快速插入粗体、斜体、链接等格式，支持 Ctrl+B、Ctrl+I、Ctrl+K 等快捷键。代码块支持语法高亮和一键复制。',
                target: '#editorToolbar'
            },
            {
                title: '过期时间管理',
                description: '可在设置中为笔记设置过期时间（3天、7天、30天或365天），过期后笔记会自动删除，帮你管理存储空间。',
                target: '#openSettingsModalButton'
            }
        ];

        // 新增：改进的自动保存类
        class AutoSave {
            constructor(editor, saveCallback) {
                this.editor = editor;
                this.saveCallback = saveCallback;
                this.debounceTimer = null;
                this.lastSavedContent = '';
                this.isSaving = false;
                
                this.editor.addEventListener('input', this.handleInput.bind(this));
            }
            
            handleInput() {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.save();
                }, 2000); // 2秒延迟
                
                this.updateSaveStatus('正在保存...');
            }
            
            async save() {
                if (this.isSaving) return;
                
                const content = this.editor.value;
                if (content === this.lastSavedContent) return;
                
                this.isSaving = true;
                this.updateSaveStatus('正在保存...');
                
                try {
                    await this.saveCallback(content);
                    this.lastSavedContent = content;
                    this.updateSaveStatus('已保存', 'success');
                } catch (error) {
                    this.updateSaveStatus('保存失败', 'error');
                } finally {
                    this.isSaving = false;
                }
            }
            
            updateSaveStatus(message, type = 'info') {
                if (saveStatusElement) {
                    saveStatusElement.textContent = message;
                    saveStatusElement.className = `save-status ${type}`;
                }
            }
        }

        // 新增：编辑器工具栏功能
        class EditorToolbar {
            constructor(editor, toolbar) {
                this.editor = editor;
                this.toolbar = toolbar;
                this.init();
            }
            
            init() {
                this.toolbar.querySelectorAll('button').forEach(button => {
                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.handleAction(button.dataset.action);
                    });
                });
                
                // 添加快捷键支持
                document.addEventListener('keydown', this.handleKeyboard.bind(this));
            }
            
            handleAction(action) {
                const selection = this.getSelection();
                let replacement = '';
                let cursorOffset = 0;
                let selectLength = 0;
                
                switch (action) {
                    case 'bold':
                        replacement = `**${selection || '加粗'}**`;
                        cursorOffset = selection ? 2 : 2;
                        selectLength = selection ? selection.length : 2;
                        break;
                    case 'italic':
                        replacement = `*${selection || '斜体'}*`;
                        cursorOffset = selection ? 1 : 1;
                        selectLength = selection ? selection.length : 2;
                        break;
                    case 'link':
                        replacement = `[${selection || '链接文本'}](URL)`;
                        cursorOffset = 1;
                        selectLength = selection ? selection.length : 4;
                        break;
                    case 'image':
                        replacement = `![${selection || '图片描述'}](图片URL)`;
                        cursorOffset = 2;
                        selectLength = selection ? selection.length : 4;
                        break;
                    case 'code':
                        replacement = `\`${selection || '代码'}\``;
                        cursorOffset = 1;
                        selectLength = selection ? selection.length : 2;
                        break;
                    case 'list':
                        replacement = `- ${selection || '列表项'}`;
                        cursorOffset = 2;
                        selectLength = selection ? selection.length : 3;
                        break;
                    case 'quote':
                        replacement = `> ${selection || '引用'}`;
                        cursorOffset = 2;
                        selectLength = selection ? selection.length : 2;
                        break;
                    case 'heading': {
                        // 获取当前行
                        const start = this.editor.selectionStart;
                        const value = this.editor.value;
                        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                        const lineEnd = value.indexOf('\n', start);
                        const end = lineEnd === -1 ? value.length : lineEnd;
                        const line = value.substring(lineStart, end);
                        const headingMatch = line.match(/^(#{1,6})\s/);
                        let level = headingMatch ? headingMatch[1].length + 1 : 1;
                        if (level > 6) level = 1;
                        const hashes = '#'.repeat(level);
                        // 替换当前行的#
                        const newLine = line.replace(/^(#{1,6})?\s*/, `${hashes} `);
                        replacement = newLine;
                        // 替换整行
                        this.editor.setSelectionRange(lineStart, end);
                        this.insertText(newLine, hashes.length + 1, (selection || '标题').length);
                        return;
                    }
                }
                
                this.insertText(replacement, cursorOffset, selectLength);
            }
            
            handleKeyboard(event) {
                if (event.ctrlKey || event.metaKey) {
                    switch (event.key.toLowerCase()) {
                        case 'b':
                            event.preventDefault();
                            this.handleAction('bold');
                            break;
                        case 'i':
                            event.preventDefault();
                            this.handleAction('italic');
                            break;
                        case 'k':
                            event.preventDefault();
                            this.handleAction('link');
                            break;
                    }
                }
            }
            
            getSelection() {
                const start = this.editor.selectionStart;
                const end = this.editor.selectionEnd;
                return this.editor.value.substring(start, end);
            }
            
            insertText(text, cursorOffset = 0, selectLength = 0) {
                const start = this.editor.selectionStart;
                const end = this.editor.selectionEnd;
                const before = this.editor.value.substring(0, start);
                const after = this.editor.value.substring(end);
                
                // 保存当前滚动位置
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                
                this.editor.value = before + text + after;
                this.editor.focus();
                
                // 设置光标或选区位置
                if (selectLength > 0) {
                    this.editor.setSelectionRange(start + cursorOffset, start + cursorOffset + selectLength);
                } else {
                    const newCursorPos = start + text.length;
                    this.editor.setSelectionRange(newCursorPos, newCursorPos);
                }
                
                // 恢复滚动位置，防止页面跳动
                window.scrollTo(0, scrollTop);
                
                // 触发input事件以触发自动保存
                this.editor.dispatchEvent(new Event('input'));
            }
        }

        // 新增：欢迎引导功能
        class WelcomeTour {
            constructor() {
                this.currentStep = 0;
                this.init();
            }
            
            init() {
                welcomeNext.addEventListener('click', () => this.nextStep());
                welcomeSkip.addEventListener('click', () => this.endTour());
                
                // 检查是否是首次访问
                const isFirstVisit = !secureStorage.getItem('sznote_visited');
                if (isFirstVisit) {
                    this.startTour();
                }
            }
            
            startTour() {
                welcomeOverlay.style.display = 'flex';
                this.showStep(0);
            }
            
            showStep(stepIndex) {
                this.currentStep = stepIndex;
                const step = welcomeSteps[stepIndex];
                
                // 添加淡出动画
                const content = document.querySelector('.welcome-content');
                content.style.opacity = '0';
                content.style.transform = 'translateY(10px)';
                
                setTimeout(() => {
                    welcomeTitle.textContent = step.title;
                    welcomeDescription.textContent = step.description;
                    
                    // 更新进度点
                    progressDots.forEach((dot, index) => {
                        dot.classList.toggle('active', index === stepIndex);
                        // 添加点击事件
                        if (!dot.hasClickListener) {
                            dot.addEventListener('click', () => {
                                if (index <= this.currentStep) {
                                    this.showStep(index);
                                }
                            });
                            dot.hasClickListener = true;
                        }
                    });
                    
                    // 高亮目标元素
                    this.highlightTarget(step.target);
                    
                    // 更新按钮文本
                    if (stepIndex === welcomeSteps.length - 1) {
                        welcomeNext.textContent = '完成';
                    } else {
                        welcomeNext.textContent = '下一步';
                    }
                    
                    // 添加淡入动画
                    content.style.opacity = '1';
                    content.style.transform = 'translateY(0)';
                }, 150);
            }
            
            highlightTarget(selector) {
                // 移除之前的高亮
                document.querySelectorAll('.welcome-highlight').forEach(el => {
                    el.classList.remove('welcome-highlight');
                });
                
                if (selector) {
                    const target = document.querySelector(selector);
                    if (target) {
                        target.classList.add('welcome-highlight');
                        
                        // 平滑滚动到目标元素
                        setTimeout(() => {
                            const rect = target.getBoundingClientRect();
                            const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
                            
                            if (!isVisible) {
                                target.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center',
                                    inline: 'nearest'
                                });
                            }
                        }, 200);
                    }
                }
            }
            
            nextStep() {
                if (this.currentStep < welcomeSteps.length - 1) {
                    this.showStep(this.currentStep + 1);
                } else {
                    this.endTour();
                }
            }
            
            endTour() {
                welcomeOverlay.style.display = 'none';
                secureStorage.setItem('sznote_visited', 'true');
                
                // 移除高亮
                document.querySelectorAll('.welcome-highlight').forEach(el => {
                    el.classList.remove('welcome-highlight');
                });
            }
        }

        // 新增：初始化欢迎引导
        const welcomeTour = new WelcomeTour();

        // --- 初始化笔记ID和URL ---
        function initializeNoteId() {
            let pathId = window.location.pathname.slice(1);
            if (pathId && /^[a-zA-Z0-9_-]+$/.test(pathId)) { // 简单的ID验证
                currentNoteId = pathId;
            } else {
                currentNoteId = generateRandomId();
                window.history.replaceState({}, '', `/${currentNoteId}`); // Replace so user can't go back to empty path
            }
            updateNoteIdDisplay();
            loadNoteContent();
        }

        function generateRandomId() {
            // 从索引 2 开始取 4 个字符，即 substring(2, 2+4) = substring(2, 6)
            return Math.random().toString(36).substring(2, 6); 
        }

        function updateNoteIdDisplay() {
            noteIdLink.textContent = currentNoteId;
            noteIdLink.href = `/${currentNoteId}`;
            customIdInput.value = currentNoteId; // Update main page ID input
            currentNoteIdInSettings.textContent = currentNoteId; // Update settings modal ID display
            changeNoteIdInput.value = currentNoteId; // Prefill change ID input in settings
        }

        // --- 加载和保存笔记内容 ---
        async function loadNoteContent(password = null) {
            console.log(`Loading note ${currentNoteId} with password: ${password ? 'YES' : 'NO'}`);
            editor.value = '⏳ 正在加载笔记...'; // 修改加载提示
            editor.disabled = true;
            markdownPreview.textContent = ''; // 使用textContent更安全
            showContentArea(false); // 隐藏内容区，显示加载中或锁定状态
            if (editor.classList) editor.classList.remove('locked-note'); // 新增：移除锁定样式
            if (markdownPreview.classList) markdownPreview.classList.remove('locked-note'); // 新增：移除锁定样式

            const headers = { 'Content-Type': 'text/plain' };
            if (password) {
                headers['X-Note-Password'] = password;
            }

            try {
                const response = await fetch(`/api/note/${currentNoteId}`, { headers });
                const data = await response.json();

                if (response.status === 401 && data.protected) {
                    // 笔记受保护且密码不正确或未提供
                    container.dataset.noteLocked = "true";
                    lockedContentPlaceholder.style.display = 'flex';
                    showPasswordModal(true); // 显示密码弹窗
                    modalPasswordInput.value = ''; // 清空密码输入
                    modalErrorMessage.textContent = data.message || '请输入密码以解锁此笔记。';
                    editor.value = '// 此笔记受密码保护 //'; // 恢复提示
                    editor.disabled = true;
                    // 使用安全的方式设置内容
                    markdownPreview.textContent = '';
                    const lockMessage = document.createElement('p');
                    lockMessage.style.textAlign = 'center';
                    lockMessage.style.color = '#888';
                    lockMessage.textContent = '笔记内容已锁定';
                    markdownPreview.appendChild(lockMessage);
                    if (editor.classList) editor.classList.add('locked-note'); // 新增：添加锁定样式
                    if (markdownPreview.classList) markdownPreview.classList.add('locked-note'); // 新增：添加锁定样式
                    passwordManager.clearPassword(); // 清除已验证的密码
                } else if (!response.ok) {
                    editor.value = `// 加载笔记失败: ${data.message || response.status} //`; // 错误时提示
                    editor.disabled = true;
                    throw new Error(`HTTP error! status: ${response.status} - ${data.message || '未知错误'}`);
                } else {
                    // 成功加载或笔记未受保护
                    container.dataset.noteLocked = "false";
                    lockedContentPlaceholder.style.display = 'none';
                    editor.value = data.content;
                    autoResizeTextarea(editor); // 自动调整高度
                    passwordManager.setPassword(password); // 存储已验证的密码
                    showContentArea(true); // 显示内容区
                    
                    // 从笔记内容中加载显示模式设置
                    loadDisplayModeFromNote(data.content);
                    
                    // 加载过期天数设置
                    if (data.expireDays) {
                        currentNoteExpireDays = data.expireDays;
                    }
                    
                    renderMarkdownPreview(); // 渲染预览
                    showPasswordModal(false); // 隐藏密码弹窗
                    editor.disabled = false; // Re-enable if not protected
                    // 只有内容较短时才自动聚焦
                    if ((data.content || '').length < 500 && currentDisplayMode === 'both') {
                        editor.focus(); // 加载成功后聚焦编辑器（仅在分屏模式下）
                    }
                }
            } catch (error) {
                console.error('加载笔记失败:', error);
                editor.value = '// 加载笔记时发生网络错误 //'; // 网络错误提示
                editor.disabled = true;
                renderMarkdownPreview();
                showContentArea(true); // 显示内容区，即使有错误也方便调试
            }
        }
        
        async function saveNote(content) { // Changed to async
            if (!currentNoteId) return;
            if (saveStatusElement) saveStatusElement.textContent = '正在保存...'; // 新增
            try {
                const headers = { 'Content-Type': 'application/json' };
                // 如果笔记有密码保护，添加密码头
                const currentPassword = passwordManager.getPassword();
                if (currentPassword) {
                    headers['X-Note-Password'] = currentPassword;
                }
                
                const response = await fetch(`/api/note/${currentNoteId}`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ content })
                });
                if (response.ok) {
                    if (saveStatusElement) { // 新增
                        saveStatusElement.textContent = '已保存';
                        setTimeout(() => {
                            if (saveStatusElement.textContent === '已保存') {
                                saveStatusElement.textContent = '';
                            }
                        }, 2000); // 2秒后清除状态
                    }
                } else {
                    const errorData = await response.json();
                    showError(errorData.message || `保存失败: ${response.status}`);
                    if (saveStatusElement) saveStatusElement.textContent = '保存失败'; // 新增
                }
            } catch (error) {
                showError(`保存出错: ${error.message}`);
                if (saveStatusElement) saveStatusElement.textContent = '保存失败'; // 新增
            }
        }

        // --- Markdown 预览功能 ---
        function renderMarkdownPreview() {
            updateMarkdownPreview();
        }

        // 统一的Markdown预览更新函数
        async function updateMarkdownPreview() {
            const content = editor.value;
            renderWithInternalRenderer(content);
            
            // 重新添加复制按钮到新渲染的代码块
            setTimeout(() => {
                addCodeBlockCopyFunctionality();
            }, 100);
        }

        // HTML 清理函数 - 防止XSS攻击
        function sanitizeHTML(html) {
            // 创建一个临时div来解析HTML
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            // 允许的标签和属性
            const allowedTags = ['p', 'br', 'strong', 'em', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                               'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
            const allowedAttrs = ['href', 'class', 'data-language', 'src', 'alt', 'title'];
            
            // 递归清理所有元素
            function cleanElement(element) {
                const tagName = element.tagName.toLowerCase();
                
                if (!allowedTags.includes(tagName)) {
                    element.remove();
                    return;
                }
                
                // 清理属性
                const attrs = Array.from(element.attributes);
                attrs.forEach(attr => {
                    if (!allowedAttrs.includes(attr.name.toLowerCase())) {
                        element.removeAttribute(attr.name);
                    } else {
                        // 清理属性值中的JavaScript
                        const value = attr.value;
                        if (value.toLowerCase().includes('javascript:') || 
                            value.toLowerCase().includes('data:') ||
                            value.toLowerCase().includes('vbscript:')) {
                            element.removeAttribute(attr.name);
                        }
                    }
                });
                
                // 递归处理子元素
                Array.from(element.children).forEach(child => cleanElement(child));
            }
            
            Array.from(temp.children).forEach(child => cleanElement(child));
            return temp.innerHTML;
        }

        // 内置渲染器
        function renderWithInternalRenderer(content) {
            // 移除显示模式标记，不在预览中显示
            const cleanContent = content.replace(/^<!--\s*DISPLAY_MODE:\s*\w*\s*-->\n?/m, '');
            let html = marked.parse(cleanContent);

            // 处理代码块，添加Prism.js类名和语法高亮
            html = html.replace(/<pre><code( class=\"language-([^\"]*)\")?>([^]*?)<\/code><\/pre>/g, function(match, classAttr, language, code) {
                // 标准化语言名称
                const normalizedLang = normalizeLanguage(language);
                const prismClass = `language-${normalizedLang}`;
                
                // 解码HTML实体
                code = code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
                
                // 在代码前添加空行
                let lines = code.split('\n');
                lines.unshift('');
                
                // 重新编码以防XSS
                const encodedCode = lines.join('\n')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
                
                return `<pre class="${prismClass}" data-language="${normalizedLang}"><code class="${prismClass}">${encodedCode}</code></pre>`;
            });

            // 清理HTML防止XSS
            html = sanitizeHTML(html);

            markdownPreview.innerHTML = html;
            
            // 应用Prism.js高亮
            if (window.Prism) {
                try {
                    Prism.highlightAllUnder(markdownPreview);
                } catch (error) {
                    console.warn('Prism.js高亮失败:', error);
                }
            } else {
                console.warn('Prism.js未加载，使用默认代码块样式');
            }
        }


        // 初始化 marked 选项，单回车换行
        if (window.marked) {
            marked.setOptions({ breaks: true });
        }

        // 语言别名映射
        const languageAliases = {
            'js': 'javascript',
            'ts': 'typescript',
            'py': 'python',
            'sh': 'bash',
            'shell': 'bash',
            'yml': 'yaml',
            'md': 'markdown',
            'c++': 'cpp',
            'c#': 'csharp',
            'cs': 'csharp'
        };

        // 标准化语言名称
        function normalizeLanguage(lang) {
            if (!lang) return 'javascript';
            const normalized = lang.toLowerCase();
            return languageAliases[normalized] || normalized;
        }

        // 新增：初始化自动保存和工具栏
        let autoSave;
        let editorToolbarInstance;

        function initializeEditor() {
            // 初始化自动保存
            autoSave = new AutoSave(editor, saveNote);
            
            // 初始化工具栏
            editorToolbarInstance = new EditorToolbar(editor, editorToolbar);
            
            // 监听编辑器内容变化
            editor.addEventListener('input', () => {
                updateMarkdownPreview();
            });
        }

        // --- 密码管理功能 (在设置模态框内) ---
        async function setOrUpdatePassword() {
            const newPwd = newPasswordInput.value;
            const currentPwd = currentPasswordForSetInput.value;

            if (newPwd.length < 4) {
                displayModalMessage(setPasswordMessage, '新密码至少需要4个字符。', 'error');
                return;
            }

            try {
                const response = await fetch(`/api/password/${currentNoteId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'set', password: currentPwd, newPassword: newPwd })
                });
                const data = await response.json();

                if (response.ok) {
                    displayModalMessage(setPasswordMessage, data.message || '密码设置成功！', 'success');
                    newPasswordInput.value = '';
                    currentPasswordForSetInput.value = '';
                    // 成功设置密码后，以新密码重新加载笔记（避免被锁定）
                    passwordManager.setPassword(newPwd); // 临时存储新密码
                    loadNoteContent(newPwd); 
                } else {
                    displayModalMessage(setPasswordMessage, data.message || '设置密码失败。', 'error');
                }
            } catch (error) {
                console.error('设置密码失败:', error);
                displayModalMessage(setPasswordMessage, '网络或服务器错误，请稍后再试。', 'error');
            }
        }

        async function removePassword() {
            const pwdToRemove = removePasswordInput.value;

            try {
                const response = await fetch(`/api/password/${currentNoteId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'remove', password: pwdToRemove })
                });
                const data = await response.json();

                if (response.ok) {
                    displayModalMessage(removePasswordMessage, data.message || '密码移除成功！', 'success');
                    removePasswordInput.value = '';
                    // 重新加载笔记（现在应该没有密码保护了）
                    loadNoteContent();
                } else {
                    displayModalMessage(removePasswordMessage, data.message || '移除密码失败。', 'error');
                }
            } catch (error) {
                console.error('移除密码失败:', error);
                displayModalMessage(removePasswordMessage, '网络或服务器错误，请稍后再试。', 'error');
            }
        }

        function displayModalMessage(element, msg, type) {
            element.textContent = msg;
            element.className = `modal-message ${type}`;
            setTimeout(() => {
                element.textContent = '';
                element.className = 'modal-message';
            }, 3000);
        }

        function showPasswordModal(show) {
            passwordModal.style.display = show ? 'flex' : 'none';
            if (show) {
                modalPasswordInput.focus();
            }
        }

        async function unlockNote() {
            const password = modalPasswordInput.value;
            if (!password) {
                modalErrorMessage.textContent = '请输入密码';
                return;
            }

            try {
                await loadNoteContent(password);
                showPasswordModal(false);
            } catch (error) {
                modalErrorMessage.textContent = '密码错误，请重试';
            }
        }

        function showContentArea(show) {
            const editorEl = document.getElementById('editor');
            const previewEl = document.getElementById('markdownPreview');
            
            if (show) {
                editorEl.style.display = 'block';
                previewEl.style.display = 'block';
            } else {
                editorEl.style.display = 'none';
                previewEl.style.display = 'none';
            }
        }

        function openSettingsModal() {
            settingsModal.style.display = 'flex';
            currentNoteIdInSettings.textContent = currentNoteId;
            changeNoteIdInput.value = currentNoteId;
            
            // 更新显示模式选择状态
            updateToggleUI(currentDisplayMode);
            
            // 更新过期天数显示
            updateExpireDaysUI(currentNoteExpireDays);
        }

        function closeSettingsModal() {
            settingsModal.style.display = 'none';
        }

        async function changeNoteId() {
            const newId = changeNoteIdInput.value.trim();
            
            if (!newId || !/^[a-zA-Z0-9_-]{1,50}$/.test(newId)) {
                displayModalMessage(changeIdMessage, '笔记ID格式无效。只能包含字母、数字、下划线和连字符，长度1-50个字符。', 'error');
                return;
            }

            if (newId === currentNoteId) {
                displayModalMessage(changeIdMessage, '新ID与当前ID相同。', 'error');
                return;
            }

            try {
                // 保存当前笔记内容到新ID
                const response = await fetch(`/api/note/${newId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: editor.value
                });

                if (response.ok) {
                    // 更新URL和当前笔记ID
                    currentNoteId = newId;
                    window.history.pushState({}, '', `/${currentNoteId}`);
                    updateNoteIdDisplay();
                    
                    displayModalMessage(changeIdMessage, '笔记ID更改成功！', 'success');
                    closeSettingsModal();
                } else {
                    const errorData = await response.json();
                    displayModalMessage(changeIdMessage, errorData.message || '更改笔记ID失败。', 'error');
                }
            } catch (error) {
                console.error('更改笔记ID失败:', error);
                displayModalMessage(changeIdMessage, '网络或服务器错误，请稍后再试。', 'error');
            }
        }

        function showError(message) {
            console.error('Error:', message);
            // 可以在这里添加更友好的错误提示UI
        }

        // --- 过期天数管理功能 ---
        function updateExpireDaysUI(days) {
            currentExpireDays.textContent = days;
            expireButtons.forEach(btn => {
                if (parseInt(btn.dataset.days) === days) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        async function setExpireDays(days) {
            if (!currentNoteId) {
                displayModalMessage(expireMessage, '请先创建或加载笔记！', 'error');
                return;
            }
            
            // 确保笔记内容已保存
            if (editor.value.trim() === '' || editor.value === '⏳ 正在加载笔记...') {
                displayModalMessage(expireMessage, '请先输入笔记内容！', 'error');
                return;
            }
            
            try {
                // 先保存当前笔记内容，确保笔记存在
                await saveNote(editor.value);
                
                const headers = { 'Content-Type': 'application/json' };
                const currentPassword = passwordManager.getPassword();
                if (currentPassword) {
                    headers['X-Note-Password'] = currentPassword;
                }
                
                const response = await fetch(`/api/expire/${currentNoteId}`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ expireDays: days })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    currentNoteExpireDays = days;
                    updateExpireDaysUI(days);
                    displayModalMessage(expireMessage, data.message || `过期时间已设置为${days}天！`, 'success');
                } else if (response.status === 401) {
                    displayModalMessage(expireMessage, '需要密码验证，请先解锁笔记！', 'error');
                } else if (response.status === 404) {
                    displayModalMessage(expireMessage, '笔记不存在，请先保存笔记内容！', 'error');
                } else {
                    displayModalMessage(expireMessage, data.message || '设置过期时间失败。', 'error');
                }
            } catch (error) {
                console.error('设置过期时间失败:', error);
                displayModalMessage(expireMessage, '网络或服务器错误，请稍后再试。', 'error');
            }
        }

        // 合并初始化逻辑，保证所有按钮和功能正常

        document.addEventListener('DOMContentLoaded', function() {
            initializeNoteId();
            initializeEditor();
            
            // 初始化显示模式（默认为分屏模式）
            applyDisplayMode('both');

            // 密码模态框事件
            unlockNoteButton.addEventListener('click', unlockNote);
            modalPasswordInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    unlockNote();
                }
            });

            // 设置模态框事件
            openSettingsModalButton.addEventListener('click', openSettingsModal);
            closeSettingsModalButton.addEventListener('click', closeSettingsModal);
            applyChangeNoteIdButton.addEventListener('click', changeNoteId);
            setPasswordButton.addEventListener('click', setOrUpdatePassword);
            removePasswordButton.addEventListener('click', removePassword);

            // 过期天数按钮事件
            expireButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    const days = parseInt(this.dataset.days);
                    setExpireDays(days);
                });
            });

            // 笔记导航事件
            goIdButton.addEventListener('click', function() {
                const newId = customIdInput.value.trim();
                if (newId && /^[a-zA-Z0-9_-]+$/.test(newId)) {
                    currentNoteId = newId;
                    window.history.pushState({}, '', `/${currentNoteId}`);
                    updateNoteIdDisplay();
                    loadNoteContent();
                }
            });

            customIdInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    goIdButton.click();
                }
            });

            // 复制链接功能
            noteIdLink.addEventListener('click', function(e) {
                e.preventDefault();
                const url = window.location.href;
                navigator.clipboard.writeText(url).then(function() {
                    showCopyTip('已复制到剪贴板');
                }).catch(function(err) {
                    showCopyTip('复制失败');
                });
            });

            // 点击模态框外部关闭
            window.addEventListener('click', function(event) {
                if (event.target === passwordModal) {
                    showPasswordModal(false);
                }
                if (event.target === settingsModal) {
                    closeSettingsModal();
                }
            });


        });


        // 添加美观提示框函数
        function showCopyTip(msg) {
            let tip = document.getElementById('copyTipBox');
            if (!tip) {
                tip = document.createElement('div');
                tip.id = 'copyTipBox';
                document.body.appendChild(tip);
            }
            tip.textContent = msg;
            tip.classList.add('show');
            clearTimeout(tip._hideTimer);
            tip._hideTimer = setTimeout(() => {
                tip.classList.remove('show');
            }, 1800);
        }


        // 显示模式设置
        const displayModeBoth = document.getElementById('displayModeBoth');
        const displayModePreview = document.getElementById('displayModePreview');
        const displayModeToggle = document.getElementById('displayModeToggle');
        const toggleLabels = document.querySelectorAll('.toggle-label');
        
        // 显示模式变量
        let currentDisplayMode = 'both'; // 默认显示模式
        
        // 监听显示模式选择变化
        displayModeBoth.addEventListener('change', function() {
            if (this.checked) {
                setDisplayMode('both');
            }
        });
        
        displayModePreview.addEventListener('change', function() {
            if (this.checked) {
                setDisplayMode('preview');
            }
        });

        // 监听开关点击
        displayModeToggle.addEventListener('click', function() {
            const newMode = currentDisplayMode === 'both' ? 'preview' : 'both';
            setDisplayMode(newMode);
        });

        // 监听标签点击
        toggleLabels.forEach(label => {
            label.addEventListener('click', function() {
                const mode = this.dataset.mode;
                setDisplayMode(mode);
            });
        });

        // 设置显示模式
        function setDisplayMode(mode) {
            // 确保模式有效，防止传入undefined
            if (!mode || (mode !== 'both' && mode !== 'preview')) {
                mode = 'both'; // 默认为分屏模式
            }
            currentDisplayMode = mode;
            applyDisplayMode(mode);
            updateToggleUI(mode);
            saveDisplayModeToNote(mode);
        }

        // 更新开关UI状态
        function updateToggleUI(mode) {
            // 更新隐藏的radio按钮
            if (mode === 'preview') {
                displayModePreview.checked = true;
            } else {
                displayModeBoth.checked = true;
            }

            // 更新开关样式
            if (mode === 'preview') {
                displayModeToggle.classList.add('preview-mode');
            } else {
                displayModeToggle.classList.remove('preview-mode');
            }

            // 更新标签状态
            toggleLabels.forEach(label => {
                if (label.dataset.mode === mode) {
                    label.classList.add('active');
                } else {
                    label.classList.remove('active');
                }
            });
        }

        // 应用显示模式
        function applyDisplayMode(mode) {
            const editorEl = document.getElementById('editor');
            const previewEl = document.getElementById('markdownPreview');
            const splitView = document.querySelector('.split-view');
            
            if (mode === 'preview') {
                // 仅预览模式
                editorEl.style.display = 'none';
                previewEl.style.display = 'block';
                splitView.style.display = 'block';
                splitView.classList.add('preview-only'); // 添加预览模式类
                previewEl.style.width = '100%';
                previewEl.style.flex = '1';
                
                // 隐藏工具栏
                editorToolbar.style.display = 'none';
                
                // 添加双击切换提示
                addPreviewModeHint();
            } else {
                // 分屏模式 (both)
                editorEl.style.display = 'block';
                previewEl.style.display = 'block';
                splitView.style.display = 'flex';
                splitView.classList.remove('preview-only'); // 移除预览模式类
                previewEl.style.width = '';
                previewEl.style.flex = '';
                
                // 显示工具栏
                editorToolbar.style.display = 'flex';
                
                // 移除预览模式提示
                removePreviewModeHint();
            }
        }

        // 添加预览模式提示和双击切换功能
        function addPreviewModeHint() {
            const previewEl = document.getElementById('markdownPreview');
            
            // 添加双击事件监听器
            previewEl.addEventListener('dblclick', switchToEditMode);
            
            // 添加提示样式
            previewEl.style.cursor = 'pointer';
            previewEl.title = '双击切换到编辑模式';
        }

        // 移除预览模式提示
        function removePreviewModeHint() {
            const previewEl = document.getElementById('markdownPreview');
            
            // 移除双击事件监听器
            previewEl.removeEventListener('dblclick', switchToEditMode);
            
            // 移除提示样式
            previewEl.style.cursor = '';
            previewEl.title = '';
        }

        // 切换到编辑模式
        function switchToEditMode() {
            setDisplayMode('both');
        }

        // 保存显示模式到笔记内容
        async function saveDisplayModeToNote(mode) {
            if (!currentNoteId) return;
            
            try {
                // 获取当前笔记内容
                let content = editor.value;
                
                // 检查是否已经有相同的显示模式标记
                const existingMatch = content.match(/^<!--\s*DISPLAY_MODE:\s*(\w*)\s*-->/m);
                if (existingMatch && existingMatch[1] === mode) {
                    return; // 已经是相同模式，无需保存
                }
                
                // 移除现有的显示模式标记
                content = content.replace(/^<!--\s*DISPLAY_MODE:\s*\w*\s*-->\n?/m, '');
                
                // 只有非默认模式且模式有效时才添加标记
                if (mode && mode !== 'both' && mode !== 'undefined') {
                    content = `<!-- DISPLAY_MODE: ${mode} -->\n${content}`;
                }
                
                // 更新编辑器内容
                editor.value = content;
                autoResizeTextarea(editor); // 自动调整高度
                
                // 保存到服务器
                await saveNote(content);
            } catch (error) {
                console.error('保存显示模式失败:', error);
            }
        }

        // 从笔记内容中读取显示模式
        function loadDisplayModeFromNote(content) {
            const match = content.match(/^<!--\s*DISPLAY_MODE:\s*(\w*)\s*-->/m);
            if (match) {
                const mode = match[1];
                // 验证模式是否有效
                if (mode === 'both' || mode === 'preview') {
                    currentDisplayMode = mode;
                    
                    // 更新UI和应用显示模式
                    updateToggleUI(mode);
                    applyDisplayMode(mode);
                    
                    return mode;
                }
            }
            
            // 默认模式或无效模式时
            currentDisplayMode = 'both';
            updateToggleUI('both');
            applyDisplayMode('both');
            return 'both';
        }


        // 添加代码块复制功能
        function addCodeBlockCopyFunctionality() {
            // 为所有代码块添加复制按钮
            function addCopyButtonsToCodeBlocks() {
                const codeBlocks = document.querySelectorAll('#markdownPreview pre');
                codeBlocks.forEach(codeBlock => {
                    // 检查是否已经有复制按钮
                    if (!codeBlock.querySelector('.copy-button')) {
                        const copyButton = document.createElement('button');
                        copyButton.className = 'copy-button';
                        copyButton.textContent = 'Copy';
                        copyButton.addEventListener('click', function(e) {
                            e.stopPropagation();
                            copyCodeBlock(codeBlock, copyButton);
                        });
                        codeBlock.appendChild(copyButton);
                    }
                });
            }

            // 复制代码块内容
            function copyCodeBlock(codeBlock, button) {
                const codeContent = codeBlock.querySelector('code');
                if (codeContent) {
                    // 获取代码文本内容
                    let textToCopy = '';
                    
                    // 检查是否是Prism.js处理的代码块
                    if (codeContent.classList.contains('language-')) {
                        // Prism.js代码块，直接获取文本内容
                        textToCopy = codeContent.textContent || codeContent.innerText;
                    } else {
                        // 传统代码块，检查是否有code-line结构
                        const codeLines = codeContent.querySelectorAll('.code-line');
                        if (codeLines.length > 0) {
                            // 如果有代码行，提取每行文本
                            codeLines.forEach((line, index) => {
                                if (index > 0) textToCopy += '\n';
                                textToCopy += line.textContent;
                            });
                        } else {
                            // 如果没有代码行，直接获取文本内容
                            textToCopy = codeContent.textContent || codeContent.innerText;
                        }
                    }
                    
                    // 清理文本：移除开头的空行
                    textToCopy = textToCopy.replace(/^\n/, '');
                    
                    // 复制到剪贴板
                    if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(textToCopy).then(() => {
                            showCopySuccess(button);
                        }).catch(() => {
                            fallbackCopyTextToClipboard(textToCopy, button);
                        });
                    } else {
                        fallbackCopyTextToClipboard(textToCopy, button);
                    }
                }
            }

            // 监听内容更新，为新的代码块添加按钮
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'childList') {
                        addCopyButtonsToCodeBlocks();
                    }
                });
            });

            // 开始观察
            const previewElement = document.getElementById('markdownPreview');
            if (previewElement) {
                observer.observe(previewElement, {
                    childList: true,
                    subtree: true
                });
            }

            // 初始添加按钮
            addCopyButtonsToCodeBlocks();
        }

        // 备用复制方法
        function fallbackCopyTextToClipboard(text, button) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                showCopySuccess(button);
            } catch (err) {
                console.error('复制失败:', err);
                showCopyError(button);
            }
            
            document.body.removeChild(textArea);
        }

        // 显示复制成功提示
        function showCopySuccess(button) {
            button.textContent = 'Copied!';
            button.classList.add('copy-success');
            
            setTimeout(() => {
                button.textContent = 'Copy';
                button.classList.remove('copy-success');
            }, 2000);
        }

        // 显示复制失败提示
        function showCopyError(button) {
            button.textContent = 'Failed';
            button.classList.add('copy-error');
            
            setTimeout(() => {
                button.textContent = 'Copy';
                button.classList.remove('copy-error');
            }, 2000);
        }

        // 自动调整textarea高度的函数
        function autoResizeTextarea(textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }

        // 初始化编辑器自动调整高度
        function initAutoResize() {
            // 初始调整
            autoResizeTextarea(editor);
            
            // 监听输入事件
            editor.addEventListener('input', function() {
                autoResizeTextarea(this);
            });
            
            // 监听内容变化（比如加载笔记时）
            const observer = new MutationObserver(function() {
                autoResizeTextarea(editor);
            });
            
            // 也可以监听值的变化
            let lastValue = editor.value;
            setInterval(function() {
                if (editor.value !== lastValue) {
                    lastValue = editor.value;
                    autoResizeTextarea(editor);
                }
            }, 100);
        }

        // 页面加载完成后添加复制功能和自动调整高度
        addCodeBlockCopyFunctionality();
        initAutoResize();