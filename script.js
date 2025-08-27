// HAR分析器主要JavaScript文件

class HARAnalyzer {
    constructor() {
        this.harData = null;
        this.filteredRequests = [];
        this.selectedRequest = null;
        this.selectedIndex = -1; // 当前选中的请求索引
        this.currentFilters = {
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            statusCodes: ['2xx', '3xx', '4xx', '5xx'],
            contentTypes: ['html', 'css', 'js', 'json', 'image', 'other']
        };
        this.searchTerm = '';
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // 文件上传相关事件
        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.getElementById('uploadArea');
        
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // 拖拽上传
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.processFile(files[0]);
            }
        });

        // 搜索功能
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.applyFilters();
        });

        // 筛选功能
        const filterBtn = document.getElementById('filterBtn');
        const filterMenu = document.getElementById('filterMenu');
        
        filterBtn.addEventListener('click', () => {
            filterMenu.classList.toggle('show');
        });

        // 点击其他地方关闭筛选菜单
        document.addEventListener('click', (e) => {
            if (!filterBtn.contains(e.target) && !filterMenu.contains(e.target)) {
                filterMenu.classList.remove('show');
            }
        });

        // 筛选选项变化
        filterMenu.addEventListener('change', () => {
            this.updateFilters();
            this.applyFilters();
        });

        // 清除按钮
        const clearBtn = document.getElementById('clearBtn');
        clearBtn.addEventListener('click', () => {
            this.clearData();
        });

        // 关闭详情面板
        const closeDetails = document.getElementById('closeDetails');
        closeDetails.addEventListener('click', () => {
            this.clearSelection();
        });

        // 排序按钮
        const sortBtn = document.getElementById('sortBtn');
        sortBtn.addEventListener('click', () => {
            this.showSortMenu();
        });

        // 键盘导航
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardNavigation(e);
        });

        // 请求列表滚动同步
        const requestsList = document.getElementById('requestsList');
        requestsList.addEventListener('scroll', () => {
            this.handleRequestsListScroll();
        });
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    processFile(file) {
        if (!file.name.endsWith('.har') && !file.name.endsWith('.json')) {
            alert('请选择有效的HAR文件（.har或.json格式）');
            return;
        }

        this.showLoading(true);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const harContent = JSON.parse(e.target.result);
                this.parseHARData(harContent, file.name);
            } catch (error) {
                console.error('解析HAR文件失败:', error);
                alert('HAR文件格式错误，请检查文件是否有效');
                this.showLoading(false);
            }
        };
        
        reader.onerror = () => {
            alert('读取文件失败');
            this.showLoading(false);
        };
        
        reader.readAsText(file);
    }

    parseHARData(harContent, fileName) {
        try {
            // 验证HAR文件结构
            if (!harContent.log || !harContent.log.entries) {
                throw new Error('无效的HAR文件结构');
            }

            this.harData = harContent;
            this.filteredRequests = harContent.log.entries;
            
            // 更新UI
            document.getElementById('fileName').textContent = fileName;
            document.getElementById('requestCount').textContent = `${this.filteredRequests.length} 个请求`;
            
            // 显示分析界面
            document.getElementById('uploadSection').style.display = 'none';
            document.getElementById('analyzerSection').style.display = 'block';
            
            // 渲染请求列表
            this.renderRequestsList();
            
            this.showLoading(false);
        } catch (error) {
            console.error('解析HAR数据失败:', error);
            alert('HAR文件解析失败: ' + error.message);
            this.showLoading(false);
        }
    }

    renderRequestsList() {
        const requestsList = document.getElementById('requestsList');
        requestsList.innerHTML = '';

        this.filteredRequests.forEach((entry, index) => {
            const requestItem = this.createRequestItem(entry, index);
            requestsList.appendChild(requestItem);
        });
    }

    createRequestItem(entry, index) {
        const div = document.createElement('div');
        div.className = 'request-item';
        div.dataset.index = index;
        
        const request = entry.request;
        const response = entry.response;
        const timing = entry.timings;
        
        // 计算总时间
        const totalTime = Object.values(timing).reduce((sum, time) => {
            return sum + (time > 0 ? time : 0);
        }, 0);

        // 获取内容类型
        const contentType = this.getContentType(response);
        
        // 获取响应大小
        const responseSize = response.content.size || response.bodySize || 0;
        
        div.innerHTML = `
            <div class="request-header">
                <span class="request-method method-${request.method.toLowerCase()}">${request.method}</span>
                <span class="request-status status-${Math.floor(response.status / 100)}xx">${response.status}</span>
            </div>
            <div class="request-url">${request.url}</div>
            <div class="request-meta">
                <span>类型: ${contentType}</span>
                <span>大小: ${this.formatBytes(responseSize)}</span>
                <span>时间: ${Math.round(totalTime)}ms</span>
            </div>
        `;

        div.addEventListener('click', () => {
            this.selectRequest(entry, index, div);
        });

        return div;
    }

    selectRequest(entry, index, element) {
        // 清除之前的选择
        document.querySelectorAll('.request-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // 选择当前项
        element.classList.add('selected');
        this.selectedRequest = entry;
        this.selectedIndex = index;
        
        // 显示详情
        this.renderRequestDetails(entry);
        
        // 确保选中的项在可视区域内
        this.scrollToSelectedItem(element);
    }

    handleKeyboardNavigation(event) {
        // 只在分析界面显示时处理键盘导航
        const analyzerSection = document.getElementById('analyzerSection');
        if (analyzerSection.style.display === 'none' || !this.filteredRequests.length) {
            return;
        }

        // 防止在输入框中触发导航
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                this.navigateUp();
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.navigateDown();
                break;
            case 'Enter':
                event.preventDefault();
                if (this.selectedIndex >= 0) {
                    this.selectCurrentItem();
                }
                break;
            case 'Escape':
                event.preventDefault();
                this.clearSelection();
                break;
        }
    }

    navigateUp() {
        if (this.selectedIndex > 0) {
            this.selectedIndex--;
            this.selectItemByIndex(this.selectedIndex);
        } else if (this.selectedIndex === -1 && this.filteredRequests.length > 0) {
            // 如果没有选中任何项，选中最后一项
            this.selectedIndex = this.filteredRequests.length - 1;
            this.selectItemByIndex(this.selectedIndex);
        }
    }

    navigateDown() {
        if (this.selectedIndex < this.filteredRequests.length - 1) {
            this.selectedIndex++;
            this.selectItemByIndex(this.selectedIndex);
        } else if (this.selectedIndex === -1 && this.filteredRequests.length > 0) {
            // 如果没有选中任何项，选中第一项
            this.selectedIndex = 0;
            this.selectItemByIndex(this.selectedIndex);
        }
    }

    selectItemByIndex(index) {
        const requestItems = document.querySelectorAll('.request-item');
        if (index >= 0 && index < requestItems.length) {
            const element = requestItems[index];
            const entry = this.filteredRequests[index];
            this.selectRequest(entry, index, element);
        }
    }

    selectCurrentItem() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredRequests.length) {
            const entry = this.filteredRequests[this.selectedIndex];
            this.renderRequestDetails(entry);
        }
    }

    scrollToSelectedItem(element) {
        const requestsList = document.getElementById('requestsList');
        const containerRect = requestsList.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        // 检查元素是否在可视区域内
        if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
            // 滚动到元素位置，使其在容器中央
            const scrollTop = element.offsetTop - requestsList.offsetTop - (requestsList.clientHeight / 2) + (element.clientHeight / 2);
            requestsList.scrollTop = scrollTop;
        }
    }

    handleRequestsListScroll() {
        // 这里可以添加滚动同步逻辑
        // 例如：同步详情面板的滚动位置
        this.syncDetailsPanelScroll();
    }

    syncDetailsPanelScroll() {
        // 获取请求列表的滚动位置
        const requestsList = document.getElementById('requestsList');
        const detailsContent = document.getElementById('detailsContent');
        
        if (!requestsList || !detailsContent) return;
        
        // 计算滚动比例
        const scrollRatio = requestsList.scrollTop / (requestsList.scrollHeight - requestsList.clientHeight);
        
        // 如果详情面板有内容，同步滚动
        if (detailsContent.scrollHeight > detailsContent.clientHeight) {
            const targetScrollTop = scrollRatio * (detailsContent.scrollHeight - detailsContent.clientHeight);
            detailsContent.scrollTop = targetScrollTop;
        }
    }

    renderRequestDetails(entry) {
        const detailsContent = document.getElementById('detailsContent');
        
        const request = entry.request;
        const response = entry.response;
        const timing = entry.timings;
        
        detailsContent.innerHTML = `
            <div class="details-tabs">
                <button class="tab-button active" data-tab="general">概览</button>
                <button class="tab-button" data-tab="request">请求</button>
                <button class="tab-button" data-tab="response">响应</button>
                <button class="tab-button" data-tab="timing">时间</button>
            </div>
            
            <div class="tab-content active" id="general-tab">
                ${this.renderGeneralTab(entry)}
            </div>
            
            <div class="tab-content" id="request-tab">
                ${this.renderRequestTab(request)}
            </div>
            
            <div class="tab-content" id="response-tab">
                ${this.renderResponseTab(response)}
            </div>
            
            <div class="tab-content" id="timing-tab">
                ${this.renderTimingTab(timing)}
            </div>
        `;

        // 添加标签页切换事件
        detailsContent.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    renderGeneralTab(entry) {
        const request = entry.request;
        const response = entry.response;
        
        return `
            <div class="detail-section">
                <h4>基本信息</h4>
                <table class="detail-table">
                    <tr><td><strong>URL</strong></td><td>${request.url}</td></tr>
                    <tr><td><strong>方法</strong></td><td>${request.method}</td></tr>
                    <tr><td><strong>状态码</strong></td><td>${response.status} ${response.statusText}</td></tr>
                    <tr><td><strong>内容类型</strong></td><td>${this.getContentType(response)}</td></tr>
                    <tr><td><strong>响应大小</strong></td><td>${this.formatBytes(response.content.size || response.bodySize || 0)}</td></tr>
                    <tr><td><strong>开始时间</strong></td><td>${new Date(entry.startedDateTime).toLocaleString()}</td></tr>
                </table>
            </div>
        `;
    }

    renderRequestTab(request) {
        let html = `
            <div class="detail-section">
                <h4>请求头</h4>
                <table class="detail-table">
                    <thead>
                        <tr><th>名称</th><th>值</th></tr>
                    </thead>
                    <tbody>
        `;
        
        request.headers.forEach(header => {
            html += `<tr><td>${header.name}</td><td>${header.value}</td></tr>`;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;

        // 查询参数
        if (request.queryString && request.queryString.length > 0) {
            html += `
                <div class="detail-section">
                    <h4>查询参数</h4>
                    <table class="detail-table">
                        <thead>
                            <tr><th>名称</th><th>值</th></tr>
                        </thead>
                        <tbody>
            `;
            
            request.queryString.forEach(param => {
                html += `<tr><td>${param.name}</td><td>${param.value}</td></tr>`;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        // 请求体
        if (request.postData) {
            html += `
                <div class="detail-section">
                    <h4>请求体</h4>
                    <div class="code-block">${this.formatRequestBody(request.postData)}</div>
                </div>
            `;
        }

        return html;
    }

    renderResponseTab(response) {
        let html = `
            <div class="detail-section">
                <h4>响应头</h4>
                <table class="detail-table">
                    <thead>
                        <tr><th>名称</th><th>值</th></tr>
                    </thead>
                    <tbody>
        `;
        
        response.headers.forEach(header => {
            html += `<tr><td>${header.name}</td><td>${header.value}</td></tr>`;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;

        // 响应体
        if (response.content && response.content.text) {
            html += `
                <div class="detail-section">
                    <h4>响应体</h4>
                    <div class="code-block">${this.formatResponseBody(response.content)}</div>
                </div>
            `;
        }

        return html;
    }

    renderTimingTab(timing) {
        const totalTime = Object.values(timing).reduce((sum, time) => {
            return sum + (time > 0 ? time : 0);
        }, 0);

        return `
            <div class="detail-section">
                <h4>时间分析</h4>
                <table class="detail-table">
                    <tr><td><strong>DNS查询</strong></td><td>${timing.dns >= 0 ? timing.dns + 'ms' : 'N/A'}</td></tr>
                    <tr><td><strong>TCP连接</strong></td><td>${timing.connect >= 0 ? timing.connect + 'ms' : 'N/A'}</td></tr>
                    <tr><td><strong>SSL握手</strong></td><td>${timing.ssl >= 0 ? timing.ssl + 'ms' : 'N/A'}</td></tr>
                    <tr><td><strong>发送请求</strong></td><td>${timing.send >= 0 ? timing.send + 'ms' : 'N/A'}</td></tr>
                    <tr><td><strong>等待响应</strong></td><td>${timing.wait >= 0 ? timing.wait + 'ms' : 'N/A'}</td></tr>
                    <tr><td><strong>接收响应</strong></td><td>${timing.receive >= 0 ? timing.receive + 'ms' : 'N/A'}</td></tr>
                    <tr><td><strong>总时间</strong></td><td><strong>${Math.round(totalTime)}ms</strong></td></tr>
                </table>
            </div>
        `;
    }

    switchTab(tabName) {
        // 切换标签按钮状态
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // 切换内容
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    updateFilters() {
        const filterMenu = document.getElementById('filterMenu');
        
        // 更新方法筛选
        this.currentFilters.methods = [];
        filterMenu.querySelectorAll('input[value="GET"], input[value="POST"], input[value="PUT"], input[value="DELETE"], input[value="PATCH"]').forEach(checkbox => {
            if (checkbox.checked) {
                this.currentFilters.methods.push(checkbox.value);
            }
        });
        
        // 更新状态码筛选
        this.currentFilters.statusCodes = [];
        filterMenu.querySelectorAll('input[value="2xx"], input[value="3xx"], input[value="4xx"], input[value="5xx"]').forEach(checkbox => {
            if (checkbox.checked) {
                this.currentFilters.statusCodes.push(checkbox.value);
            }
        });
        
        // 更新内容类型筛选
        this.currentFilters.contentTypes = [];
        filterMenu.querySelectorAll('input[value="html"], input[value="css"], input[value="js"], input[value="json"], input[value="image"], input[value="other"]').forEach(checkbox => {
            if (checkbox.checked) {
                this.currentFilters.contentTypes.push(checkbox.value);
            }
        });
    }

    applyFilters() {
        if (!this.harData) return;
        
        this.filteredRequests = this.harData.log.entries.filter(entry => {
            const request = entry.request;
            const response = entry.response;
            
            // 方法筛选
            if (!this.currentFilters.methods.includes(request.method)) {
                return false;
            }
            
            // 状态码筛选
            const statusCategory = Math.floor(response.status / 100) + 'xx';
            if (!this.currentFilters.statusCodes.includes(statusCategory)) {
                return false;
            }
            
            // 内容类型筛选
            const contentType = this.getContentType(response);
            if (!this.currentFilters.contentTypes.includes(contentType)) {
                return false;
            }
            
            // 高级搜索筛选
            if (this.searchTerm) {
                if (!this.matchesSearch(entry, this.searchTerm)) {
                    return false;
                }
            }
            
            return true;
        });
        
        // 重置选中索引
        this.selectedIndex = -1;
        
        // 更新请求计数
        document.getElementById('requestCount').textContent = `${this.filteredRequests.length} 个请求`;
        
        // 重新渲染列表
        this.renderRequestsList();
        
        // 清除选择
        this.clearSelection();
    }

    matchesSearch(entry, searchTerm) {
        const request = entry.request;
        const response = entry.response;
        
        // 基本信息搜索
        const basicInfo = [
            request.url,
            request.method,
            response.status.toString(),
            response.statusText
        ].join(' ').toLowerCase();
        
        if (basicInfo.includes(searchTerm)) {
            return true;
        }
        
        // 请求头搜索
        const requestHeaders = request.headers.map(h => `${h.name}: ${h.value}`).join(' ').toLowerCase();
        if (requestHeaders.includes(searchTerm)) {
            return true;
        }
        
        // 响应头搜索
        const responseHeaders = response.headers.map(h => `${h.name}: ${h.value}`).join(' ').toLowerCase();
        if (responseHeaders.includes(searchTerm)) {
            return true;
        }
        
        // 查询参数搜索
        if (request.queryString) {
            const queryParams = request.queryString.map(q => `${q.name}=${q.value}`).join(' ').toLowerCase();
            if (queryParams.includes(searchTerm)) {
                return true;
            }
        }
        
        // 请求体搜索
        if (request.postData && request.postData.text) {
            if (request.postData.text.toLowerCase().includes(searchTerm)) {
                return true;
            }
        }
        
        // 响应体搜索
        if (response.content && response.content.text) {
            if (response.content.text.toLowerCase().includes(searchTerm)) {
                return true;
            }
        }
        
        // Cookie搜索
        if (request.cookies) {
            const cookies = request.cookies.map(c => `${c.name}=${c.value}`).join(' ').toLowerCase();
            if (cookies.includes(searchTerm)) {
                return true;
            }
        }
        
        return false;
    }

    showSortMenu() {
        const sortOptions = [
            { label: '按时间排序', value: 'time' },
            { label: '按URL排序', value: 'url' },
            { label: '按状态码排序', value: 'status' },
            { label: '按响应大小排序', value: 'size' },
            { label: '按响应时间排序', value: 'duration' }
        ];

        const menu = document.createElement('div');
        menu.className = 'sort-menu';
        menu.innerHTML = sortOptions.map(option => 
            `<div class="sort-option" data-sort="${option.value}">${option.label}</div>`
        ).join('');

        // 定位菜单
        const sortBtn = document.getElementById('sortBtn');
        const rect = sortBtn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = rect.bottom + 5 + 'px';
        menu.style.right = (window.innerWidth - rect.right) + 'px';
        menu.style.background = 'white';
        menu.style.border = '1px solid #e2e8f0';
        menu.style.borderRadius = '8px';
        menu.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.1)';
        menu.style.zIndex = '1000';
        menu.style.minWidth = '150px';

        document.body.appendChild(menu);

        // 添加点击事件
        menu.addEventListener('click', (e) => {
            if (e.target.classList.contains('sort-option')) {
                const sortType = e.target.dataset.sort;
                this.sortRequests(sortType);
                document.body.removeChild(menu);
            }
        });

        // 点击其他地方关闭菜单
        const closeMenu = (e) => {
            if (!menu.contains(e.target) && e.target !== sortBtn) {
                document.body.removeChild(menu);
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    sortRequests(sortType) {
        this.filteredRequests.sort((a, b) => {
            switch (sortType) {
                case 'time':
                    return new Date(a.startedDateTime) - new Date(b.startedDateTime);
                case 'url':
                    return a.request.url.localeCompare(b.request.url);
                case 'status':
                    return a.response.status - b.response.status;
                case 'size':
                    const sizeA = a.response.content.size || a.response.bodySize || 0;
                    const sizeB = b.response.content.size || b.response.bodySize || 0;
                    return sizeB - sizeA; // 降序
                case 'duration':
                    const durationA = Object.values(a.timings).reduce((sum, time) => sum + (time > 0 ? time : 0), 0);
                    const durationB = Object.values(b.timings).reduce((sum, time) => sum + (time > 0 ? time : 0), 0);
                    return durationB - durationA; // 降序
                default:
                    return 0;
            }
        });

        this.renderRequestsList();
    }

    getContentType(response) {
        const contentTypeHeader = response.headers.find(h => h.name.toLowerCase() === 'content-type');
        if (!contentTypeHeader) return 'other';
        
        const contentType = contentTypeHeader.value.toLowerCase();
        
        if (contentType.includes('text/html')) return 'html';
        if (contentType.includes('text/css')) return 'css';
        if (contentType.includes('javascript') || contentType.includes('text/js')) return 'js';
        if (contentType.includes('application/json')) return 'json';
        if (contentType.includes('image/')) return 'image';
        
        return 'other';
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatRequestBody(postData) {
        if (!postData) return '';
        
        if (postData.text) {
            try {
                // 尝试格式化JSON
                const parsed = JSON.parse(postData.text);
                return JSON.stringify(parsed, null, 2);
            } catch (e) {
                return postData.text;
            }
        }
        
        if (postData.params) {
            return postData.params.map(p => `${p.name}=${p.value}`).join('\n');
        }
        
        return '';
    }

    formatResponseBody(content) {
        if (!content || !content.text) return '';
        
        const mimeType = content.mimeType || '';
        
        if (mimeType.includes('application/json')) {
            try {
                const parsed = JSON.parse(content.text);
                return JSON.stringify(parsed, null, 2);
            } catch (e) {
                return content.text;
            }
        }
        
        return content.text;
    }

    clearSelection() {
        document.querySelectorAll('.request-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const detailsContent = document.getElementById('detailsContent');
        detailsContent.innerHTML = `
            <div class="no-selection">
                <i class="fas fa-mouse-pointer"></i>
                <p>选择一个请求查看详细信息</p>
                <p class="keyboard-hint">使用 ↑↓ 键导航，Enter 键选择</p>
            </div>
        `;
        
        this.selectedRequest = null;
        this.selectedIndex = -1;
    }

    clearData() {
        this.harData = null;
        this.filteredRequests = [];
        this.selectedRequest = null;
        this.selectedIndex = -1;
        
        // 重置UI
        document.getElementById('uploadSection').style.display = 'block';
        document.getElementById('analyzerSection').style.display = 'none';
        document.getElementById('fileInput').value = '';
        
        // 重置搜索和筛选
        document.getElementById('searchInput').value = '';
        this.searchTerm = '';
        
        // 重置筛选选项
        document.querySelectorAll('#filterMenu input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = true;
        });
        this.currentFilters = {
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            statusCodes: ['2xx', '3xx', '4xx', '5xx'],
            contentTypes: ['html', 'css', 'js', 'json', 'image', 'other']
        };
    }

    showLoading(show) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.harAnalyzer = new HARAnalyzer();
});

