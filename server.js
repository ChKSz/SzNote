const express = require('express');
const fs = require('fs');
const fsPromises = fs.promises; // For asynchronous file operations
const NodeCache = require('node-cache'); // For caching
const crypto = require('crypto'); // 新增: 用于内容加密
const ALGORITHM = 'aes-256-cbc'; // 加密算法
const IV_LENGTH = 16; // IV长度

// 从密码派生密钥
function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

// 加密内容
function encryptContent(plainText, password) {
    const salt = crypto.randomBytes(16);
    const key = deriveKey(password, salt);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return {
        encrypted: true,
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        data: encrypted
    };
}

// 解密内容
function decryptContent(encryptedObj, password) {
    const salt = Buffer.from(encryptedObj.salt, 'base64');
    const iv = Buffer.from(encryptedObj.iv, 'base64');
    const key = deriveKey(password, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedObj.data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Initialize cache: stdTTL is time-to-live in seconds, checkperiod is how often to check for expired items
const noteCache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // Cache notes for 10 minutes
const path = require('path');
const bcrypt = require('bcrypt'); // 引入 bcrypt 库
const app = express();

// 创建存储笔记的目录
const NOTES_DIR = path.join(__dirname, 'notes');
if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR);
}

// 定义密码哈希的盐值轮数 (决定哈希计算强度，值越大越安全但越慢)
const SALT_ROUNDS = 10;

// 简单的内存频率限制器
class RateLimiter {
    constructor(windowMs = 15 * 60 * 1000, maxRequests = 100) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        this.requests = new Map();
    }

    isAllowed(ip) {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        
        if (!this.requests.has(ip)) {
            this.requests.set(ip, []);
        }
        
        const userRequests = this.requests.get(ip);
        // 清理过期请求
        const validRequests = userRequests.filter(time => time > windowStart);
        this.requests.set(ip, validRequests);
        
        if (validRequests.length >= this.maxRequests) {
            return false;
        }
        
        validRequests.push(now);
        return true;
    }
}

// 安全日志记录器
const securityLogger = {
    logFailedAuth(ip, noteId) {
        console.log(`[SECURITY] ${new Date().toISOString()} Failed auth attempt from ${ip} for note ${noteId}`);
    },
    logSuspiciousActivity(ip, activity) {
        console.log(`[SECURITY] ${new Date().toISOString()} Suspicious activity from ${ip}: ${activity}`);
    },
    logRateLimit(ip, endpoint) {
        console.log(`[SECURITY] ${new Date().toISOString()} Rate limit exceeded from ${ip} on ${endpoint}`);
    }
};

// 安全日志函数
function safeLog(message, data = null) {
    // 根据用户要求，不输出日志
}

// 创建频率限制器
const generalLimiter = new RateLimiter(15 * 60 * 1000, 100); // 15分钟100次
const passwordLimiter = new RateLimiter(15 * 60 * 1000, 5);   // 15分钟5次

// 读取配置文件
const configPath = path.join(__dirname, 'config.json');
let config = {
    port: 8888,
    maxNoteSize: 100000,
    cacheTTL: 600,
    cacheCheckPeriod: 120,
};
if (fs.existsSync(configPath)) {
    try {
        const userConfig = safeJSONParse(fs.readFileSync(configPath, 'utf-8'), 10000);
        config = { ...config, ...userConfig };
    } catch (e) {
        console.error('读取config.json失败，使用默认配置', e);
    }
}

// 解析不同类型的请求体
app.use(express.text({ type: 'text/plain' })); // 用于保存笔记内容的纯文本请求
app.use(express.json()); // 用于密码设置等JSON请求

// 频率限制中间件
function rateLimitMiddleware(limiter, name) {
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        if (!limiter.isAllowed(ip)) {
            securityLogger.logRateLimit(ip, name);
            return res.status(429).json({ 
                message: '请求过于频繁，请稍后再试',
                retryAfter: Math.ceil(limiter.windowMs / 1000)
            });
        }
        next();
    };
}

// 安全头中间件
app.use((req, res, next) => {
    // 安全头设置
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // CSP策略
    res.setHeader('Content-Security-Policy', 
        ""
    );
    
    // 生产环境强制HTTPS
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    next();
});

// 根据用户要求，移除请求日志中间件

// 应用通用频率限制
app.use('/api/', rateLimitMiddleware(generalLimiter, 'general'));

// 只为字体文件添加CORS头
app.use('/public', (req, res, next) => {
  if (req.path.endsWith('.woff2') || req.path.endsWith('.woff') || req.path.endsWith('.ttf')) {
    res.header('Access-Control-Allow-Origin', '*');
  }
  next();
});

// 注意：静态文件服务将在API路由之后定义，确保API路由优先匹配
app.use(express.static('public'));

/**
 * 安全清理和验证笔记ID
 * @param {string} noteId 笔记ID
 * @returns {string|null} 清理后的安全noteId，或null如果无效
 */
function sanitizeNoteId(noteId) {
    if (!noteId || typeof noteId !== 'string') return null;
    const cleaned = noteId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (cleaned.length === 0 || cleaned.length > 50) return null;
    return cleaned;
}

/**
 * 安全解析JSON
 * @param {string} jsonString JSON字符串
 * @param {number} maxSize 最大大小限制
 * @returns {object} 解析后的对象
 */
function safeJSONParse(jsonString, maxSize = 1024 * 1024) {
    if (jsonString.length > maxSize) {
        throw new Error('JSON too large');
    }
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        throw new Error('Invalid JSON format');
    }
}

/**
 * 读取笔记数据
 * @param {string} noteId 笔记ID
 * @returns {object|null} 笔记数据对象，或null如果文件不存在
 */
async function readNoteData(noteId) { // Changed to async
    const sanitizedNoteId = sanitizeNoteId(noteId);
    if (!sanitizedNoteId) {
        throw new Error('Invalid note ID');
    }

    const cachedNote = noteCache.get(sanitizedNoteId);
    if (cachedNote) {
        // console.log(`Cache hit for note ${sanitizedNoteId}`);
        return cachedNote;
    }
    
    // 使用 path.resolve 确保路径安全
    const notePath = path.resolve(NOTES_DIR, `${sanitizedNoteId}.json`);
    if (!notePath.startsWith(path.resolve(NOTES_DIR))) {
        throw new Error('Invalid path detected');
    }
    
    try {
        if (fs.existsSync(notePath)) { // Keep sync check for existence for now, or make it fully async
            const data = await fsPromises.readFile(notePath, 'utf-8');
            const noteData = safeJSONParse(data, 500000); // 限制为500KB
            noteCache.set(sanitizedNoteId, noteData); // Store in cache after reading
            // console.log(`Cache miss, loaded note ${sanitizedNoteId} from disk`);
            return noteData;
        }
    } catch (e) {
        console.error(`Error reading or parsing JSON for note ${sanitizedNoteId}:`, e);
        // Invalidate cache if there was an error reading this specific note
        noteCache.del(sanitizedNoteId);
        return null; 
    }
    return null;
}

/**
 * 写入笔记数据
 * @param {string} noteId 笔记ID
 * @param {object} data 笔记数据对象
 */
async function writeNoteData(noteId, data) { // Changed to async
    const sanitizedNoteId = sanitizeNoteId(noteId);
    if (!sanitizedNoteId) {
        throw new Error('Invalid note ID');
    }

    // 使用 path.resolve 确保路径安全
    const notePath = path.resolve(NOTES_DIR, `${sanitizedNoteId}.json`);
    if (!notePath.startsWith(path.resolve(NOTES_DIR))) {
        throw new Error('Invalid path detected');
    }

    try {
        await fsPromises.writeFile(notePath, JSON.stringify(data, null, 2));
        noteCache.set(sanitizedNoteId, data); // Update cache after writing
        // console.log(`Note ${sanitizedNoteId} written to disk and cache updated`);
    } catch (e) {
        console.error(`Error writing note ${sanitizedNoteId} to disk:`, e);
        // Optionally, invalidate cache if write fails, though it might be better to keep stale data than no data
        noteCache.del(sanitizedNoteId); 
        throw e; // Re-throw the error to be handled by the caller
    }
}

// GET 请求：获取笔记内容 (支持密码验证)
app.get('/api/note/:id', async (req, res) => {
    const noteId = req.params.id;
    // Enhanced ID validation
    if (!noteId || typeof noteId !== 'string' || !/^[a-zA-Z0-9_-]{1,50}$/.test(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID format. Must be 1-50 alphanumeric characters, underscores, or hyphens.' });
    }

    const noteData = await readNoteData(noteId); // Added await
    if (!noteData) {
        // 笔记不存在，返回空内容且未保护
        return res.json({ content: "", protected: false });
    }

    // 更新最后访问时间
    noteData.lastAccessedAt = Date.now();
    // 如果是旧笔记没有这些字段，添加默认值
    if (!noteData.createdAt) noteData.createdAt = Date.now();
    if (!noteData.expireDays) noteData.expireDays = 3;
    await writeNoteData(noteId, noteData);

    // 检查笔记是否受密码保护
    if (noteData.passwordHash) {
        const providedPassword = req.headers['x-note-password']; // 从Header获取密码

        if (!providedPassword) {
            // 未提供密码，返回受保护状态
            return res.status(401).json({ protected: true, message: '请输入密码！' });
        }

        // 验证密码
        try {
            const match = await bcrypt.compare(providedPassword, noteData.passwordHash);
            if (match) {
                // 判断内容是否加密
                if (noteData.content && noteData.content.encrypted) {
                    try {
                        const decrypted = decryptContent(noteData.content, providedPassword);
                        return res.json({ content: decrypted, protected: false });
                    } catch (e) {
                        return res.status(500).json({ protected: true, message: '内容解密失败！' });
                    }
                } else {
                    // 兼容老数据（明文）
                    return res.json({ content: noteData.content, protected: false });
                }
            } else {
                const ip = req.ip || req.connection.remoteAddress || 'unknown';
                securityLogger.logFailedAuth(ip, noteId);
                return res.status(401).json({ protected: true, message: '密码错误！' });
            }
        } catch (error) {
            console.error("Error comparing password for note", noteId, ":", error);
            return res.status(500).json({ message: '服务器错误，请稍后再试！' });
        }
    } else {
        // 笔记未受保护
        return res.json({ content: noteData.content, protected: false });
    }
});

// POST 请求：保存笔记内容 (不涉及previewOnlyMode)
app.post('/api/note/:id', async (req, res) => {
    const noteId = req.params.id;
    // Enhanced ID validation (repeated for consistency, consider a middleware or helper function)
    if (!noteId || typeof noteId !== 'string' || !/^[a-zA-Z0-9_-]{1,50}$/.test(noteId)) {
        return res.status(400).json({ message: '笔记ID格式无效！' });
    }

    // 支持JSON和纯文本两种格式
    let newContent;
    if (typeof req.body === 'string') {
        newContent = req.body;
    } else if (typeof req.body === 'object' && req.body !== null) {
        newContent = req.body.content;
    } else {
        return res.status(400).json({ message: '笔记内容格式无效！' });
    }
    if (!newContent || newContent.length > config.maxNoteSize) { // Limit note size to config.maxNoteSize
        return res.status(413).json({ message: `笔记内容太大！最大大小为${Math.floor(config.maxNoteSize/1024)}KB。` });
    }

    let noteData = await readNoteData(noteId); // Added await

    if (noteData) {
        // 笔记已存在，更新内容，保持原有密码哈希
        if (noteData.passwordHash) {
            // 受保护，需加密内容
            const providedPassword = req.headers['x-note-password'];
            if (!providedPassword) {
                return res.status(401).json({ message: '需要密码才能保存受保护的笔记！' });
            }
            const match = await bcrypt.compare(providedPassword, noteData.passwordHash);
            if (!match) {
                return res.status(401).json({ message: '密码错误，无法保存！' });
            }
            noteData.content = encryptContent(newContent, providedPassword);
        } else {
            // 未受保护，明文存储
            noteData.content = newContent;
        }
        // 更新最后访问时间
        noteData.lastAccessedAt = Date.now();
        // 确保旧笔记有这些字段
        if (!noteData.createdAt) noteData.createdAt = Date.now();
        if (!noteData.expireDays) noteData.expireDays = 3;
    } else {
        // 笔记不存在，创建新笔记 (无密码，默认3天过期)
        const now = Date.now();
        const defaultExpireDays = 3;
        noteData = { 
            content: newContent, 
            passwordHash: null,
            createdAt: now,
            lastAccessedAt: now,
            expireDays: defaultExpireDays
        };
    }

    try {
        await writeNoteData(noteId, noteData);
        res.status(200).send('Note saved');
    } catch (error) {
        console.error(`Failed to save note ${noteId}:`, error);
        res.status(500).json({ message: '保存笔记失败，服务器错误！' });
    }
});

// POST 请求：设置/修改/移除密码
app.post('/api/password/:id', rateLimitMiddleware(passwordLimiter, 'password'), async (req, res) => {
    const noteId = req.params.id;
    // Enhanced ID validation
    if (!noteId || typeof noteId !== 'string' || !/^[a-zA-Z0-9_-]{1,50}$/.test(noteId)) {
        return res.status(400).json({ message: '笔记ID格式无效！' });
    }

    // Ensure req.body is an object for password operations
    if (typeof req.body !== 'object' || req.body === null) {
        return res.status(400).json({ message: '请求体格式无效！' });
    }

    const { action, password, newPassword } = req.body;

    // Validate action
    if (!['set', 'remove'].includes(action)) {
        return res.status(400).json({ message: '操作无效！' });
    }

    // Validate passwords based on action
    if (action === 'set') {
        if (typeof newPassword !== 'string' || newPassword.length < 4 || newPassword.length > 128) {
            return res.status(400).json({ message: '新密码必须是一个4到128个字符的字符串！' });
        }
        // Current password can be empty if not previously set, but if provided, validate its type
        if (password !== undefined && typeof password !== 'string') {
             return res.status(400).json({ message: '当前密码，如果提供，必须是一个字符串！' });
        }
    }
    if (action === 'remove') {
        if (typeof password !== 'string' || password.length === 0) {
            return res.status(400).json({ message: '当前密码是移除保护所必需的，必须是一个非空字符串！' });
        }
    }
    let noteData = await readNoteData(noteId); // Added await

    if (!noteData) {
        // 如果笔记不存在，无法设置/移除密码
        // 但为了方便首次设置密码，我们允许在笔记不存在时创建并设置密码
        noteData = { content: "", passwordHash: null };
    }

    try {
        if (action === 'set') {
            // 设置或修改密码
            // 如果笔记已有密码，需要提供旧密码才能修改
            if (noteData.passwordHash) {
                if (!password || !await bcrypt.compare(password, noteData.passwordHash)) {
                    return res.status(401).json({ message: '密码错误！' });
                }
                // 先用旧密码解密内容
                if (noteData.content && noteData.content.encrypted) {
                    noteData.content = decryptContent(noteData.content, password);
                }
            }
            // 用新密码加密内容
            noteData.content = encryptContent(noteData.content, newPassword);
            noteData.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
            await writeNoteData(noteId, noteData); // Added await
            return res.status(200).json({ message: '密码设置成功！' });

        } else if (action === 'remove') {
            // 移除密码
            if (!noteData.passwordHash) {
                return res.status(400).json({ message: '该笔记未设置密码！' });
            }
            if (!password || !await bcrypt.compare(password, noteData.passwordHash)) {
                return res.status(401).json({ message: '密码错误！' });
            }
            // 解密内容后明文存储
            if (noteData.content && noteData.content.encrypted) {
                noteData.content = decryptContent(noteData.content, password);
            }
            noteData.passwordHash = null; // 移除密码哈希
            await writeNoteData(noteId, noteData); // Added await
            return res.status(200).json({ message: '密码移除成功！' });
        }
    } catch (error) {
        console.error(`Error managing password for note ${noteId}:`, error);
        // Check if it's a bcrypt error or other
        if (error.message && error.message.includes('data and hash arguments required')) {
            return res.status(400).json({ message: '密码操作输入无效！' });
        }
        return res.status(500).json({ message: '服务器错误，请稍后再试！' });
    }
});

// POST 请求：设置笔记过期时间
app.post('/api/expire/:id', async (req, res) => {
    const noteId = req.params.id;
    console.log(`[DEBUG] 收到过期时间设置请求: noteId=${noteId}, body=`, req.body);
    
    // Enhanced ID validation
    if (!noteId || typeof noteId !== 'string' || !/^[a-zA-Z0-9_-]{1,50}$/.test(noteId)) {
        console.log(`[DEBUG] 笔记ID格式无效: ${noteId}`);
        return res.status(400).json({ message: '笔记ID格式无效！' });
    }

    // Ensure req.body is an object
    if (typeof req.body !== 'object' || req.body === null) {
        return res.status(400).json({ message: '请求体格式无效！' });
    }

    const { expireDays } = req.body;

    // Validate expireDays
    if (![3, 7, 30, 365].includes(expireDays)) {
        return res.status(400).json({ message: '过期天数必须是3、7、30或365天之一！' });
    }

    let noteData = await readNoteData(noteId);
    console.log(`[DEBUG] 读取笔记数据结果: noteData=${noteData ? '存在' : '不存在'}`);

    if (!noteData) {
        console.log(`[DEBUG] 笔记不存在，返回404: ${noteId}`);
        return res.status(404).json({ message: '笔记不存在！' });
    }

    // 检查笔记是否受密码保护
    if (noteData.passwordHash) {
        const providedPassword = req.headers['x-note-password'];
        if (!providedPassword) {
            return res.status(401).json({ message: '需要密码才能修改受保护笔记的设置！' });
        }
        const match = await bcrypt.compare(providedPassword, noteData.passwordHash);
        if (!match) {
            return res.status(401).json({ message: '密码错误！' });
        }
    }

    try {
        noteData.expireDays = expireDays;
        await writeNoteData(noteId, noteData);
        res.status(200).json({ message: `笔记过期时间已设置为${expireDays}天！` });
    } catch (error) {
        console.error(`Failed to update expire days for note ${noteId}:`, error);
        res.status(500).json({ message: '设置过期时间失败，服务器错误！' });
    }
});

// 静态文件服务 - 放在API路由之后，通配符路由之前
app.use(express.static('public'));

// 所有其他GET请求都返回index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(config.port, () => {
    console.log(`SzNote服务运行在 http://localhost:${config.port}`);
    console.log(`笔记将存储在 ${NOTES_DIR} 目录下`);
});

// 定期清理过期笔记
setInterval(async () => {
    const now = Date.now();
    const files = fs.readdirSync(NOTES_DIR);
    for (const file of files) {
        if (file.endsWith('.json')) {
            const noteId = file.replace('.json', '');
            try {
                const noteData = await readNoteData(noteId);
                if (noteData && noteData.lastAccessedAt && noteData.expireDays) {
                    const expireMs = noteData.expireDays * 24 * 60 * 60 * 1000;
                    if (now - noteData.lastAccessedAt > expireMs) {
                        const filePath = path.join(NOTES_DIR, file);
                        fs.unlinkSync(filePath);
                        noteCache.del(noteId); // 从缓存中删除
                        console.log(`自动删除过期笔记: ${noteId} (${noteData.expireDays}天未访问)`);
                    }
                }
            } catch (error) {
                console.error(`检查笔记过期时出错: ${noteId}`, error);
            }
        }
    }
}, 12 * 60 * 60 * 1000); // 每12小时检查一次