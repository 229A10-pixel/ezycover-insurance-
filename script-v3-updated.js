/**
 * EzyCover 航班预订 + 旅游险实验版 - JavaScript V3 更新版
 * 基础布局 + 响应时间控制 + 弹窗系统
 */

// ============================================
// 🔐 管理员认证
// ============================================
let isAdmin = false;

// ============================================
// 📊 获取保存的响应时间
// ============================================
function getSavedResponseTime() {
  const saved = localStorage.getItem('ezycover_responseTime');
  return saved ? parseInt(saved) : EXPERIMENT_VARIABLES.responseTime;
}

// ============================================
// 📊 应用状态
// ============================================
let appState = {
  currentLanguage: EXPERIMENT_VARIABLES.language,
  responseTime: getSavedResponseTime(),
  isLoading: false,
  selectedFlight: null,
  selectedInsurance: null,
  surveyAnswers: {}
};

// ============================================
// 🎯 初始化
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});

function initializeApp() {
  // 检查管理员登录
  checkAdminAccess();
  
  // 渲染主页
  renderHomepage();
  
  // 设置事件监听
  setupEventListeners();
  
  // 监听云端设置变化
  window.addEventListener('experimentSettingsChanged', (event) => {
    const { responseTime } = event.detail;
    if (responseTime) {
      appState.responseTime = responseTime;
      document.getElementById('custom-response-time').value = responseTime;
      
      // 更新按钮状态
      document.querySelectorAll('.response-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-time') === responseTime.toString()) {
          btn.classList.add('active');
        }
      });
      
      console.log('✅ UI updated with synced response time:', responseTime);
    }
  });
}

// ============================================
// 🔐 管理员认证
// ============================================
function checkAdminAccess() {
  const adminToggle = document.getElementById('admin-toggle');
  const adminPanel = document.getElementById('admin-panel');
  
  adminToggle.addEventListener('click', function() {
    if (!isAdmin) {
      const password = prompt('请输入管理员密码：');
      if (password === ADMIN_PASSWORD) {
        isAdmin = true;
        adminPanel.classList.remove('hidden');
      } else {
        alert('密码错误！');
      }
    } else {
      isAdmin = false;
      adminPanel.classList.add('hidden');
    }
  });
  
  // 关闭管理员面板
  document.getElementById('close-admin-panel').addEventListener('click', function() {
    isAdmin = false;
    adminPanel.classList.add('hidden');
  });
}

// ============================================
// 🎨 设置事件监听
// ============================================
function setupEventListeners() {
  // 响应时间按钮
  document.querySelectorAll('.response-btn').forEach(btn => {
    btn.addEventListener('click', handleResponseTimeChange);
  });
  
  // 自定义响应时间输入框
  document.getElementById('custom-response-time')?.addEventListener('change', function() {
    const responseTime = parseInt(this.value);
    appState.responseTime = responseTime;
    EXPERIMENT_VARIABLES.responseTime = responseTime;
    localStorage.setItem('ezycover_responseTime', this.value);
    
    // 同步到云端（异步，不阻塞）
    if (typeof dataManager !== 'undefined' && dataManager.saveSettings) {
      dataManager.saveSettings({ responseTime: responseTime })
        .then(() => console.log('✅ Response time synced to cloud'))
        .catch(err => console.error('❌ Sync error:', err));
    }
    
    alert('修改成功！响应时间: ' + responseTime + 'ms');
    
    // 更新按钮状态
    document.querySelectorAll('.response-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-time') === responseTime.toString()) {
        btn.classList.add('active');
      }
    });
  });
  
  // 管理员语言控制
  document.querySelectorAll('.language-btn').forEach(btn => {
    btn.addEventListener('click', handleAdminLanguageChange);
  });
  
  // 用户语言切换（右上方）
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', handleUserLanguageChange);
  });
  
  // 查询航班按钮
  document.getElementById('query-button')?.addEventListener('click', handleFlightQuery);
  
  // 下拉框变化
  document.getElementById('departure-select')?.addEventListener('change', handleDepartureChange);
  document.getElementById('destination-select')?.addEventListener('change', handleDestinationChange);
  document.getElementById('date-select')?.addEventListener('change', handleDateChange);
}

// ============================================
// ⏱️ 响应时间控制
// ============================================
function handleResponseTimeChange(event) {
  const time = event.target.getAttribute('data-time');
  const responseTime = parseInt(time);
  
  appState.responseTime = responseTime;
  EXPERIMENT_VARIABLES.responseTime = responseTime;
  localStorage.setItem('ezycover_responseTime', time);
  
  // 同步到云端（异步，不阻塞）
  if (typeof dataManager !== 'undefined' && dataManager.saveSettings) {
    dataManager.saveSettings({ responseTime: responseTime })
      .then(() => console.log('✅ Response time synced to cloud'))
      .catch(err => console.error('❌ Sync error:', err));
  } else {
    console.log('⚠️ dataManager not ready, saving locally only');
  }
  
  alert('修改成功！响应时间: ' + time + 'ms');
  
  // 更新按钮状态
  document.querySelectorAll('.response-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // 更新输入框
  document.getElementById('custom-response-time').value = time;
}

// ============================================
// 🌐 管理员语言控制
// ============================================
function handleAdminLanguageChange(event) {
  const language = event.target.getAttribute('data-language');
  appState.currentLanguage = language;
  
  // 更新按钮状态
  document.querySelectorAll('.language-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // 重新渲染页面
  renderHomepage();
}

// ============================================
// 🌐 用户语言切换
// ============================================
function handleUserLanguageChange(event) {
  const language = event.target.getAttribute('data-lang');
  appState.currentLanguage = language;
  
  // 更新按钮状态
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // 重新渲染页面
  renderHomepage();
}

// ============================================
// ✈️ 航班查询处理（简化为地区选择确认）
// ============================================
function handleFlightQuery() {
  if (appState.isLoading) return;
  
  const departure = document.getElementById('departure-select').value;
  const destination = document.getElementById('destination-select').value;
  const date = document.getElementById('date-select').value;
  
  // 验证选择
  if (!departure || !destination || !date) {
    const alertMessage = appState.currentLanguage === 'zh' 
      ? '请选择出发地、目的地和出行日期'
      : 'Please select departure city, destination, and travel date';
    alert(alertMessage);
    return;
  }
  
  if (departure === destination) {
    const alertMessage = appState.currentLanguage === 'zh' 
      ? '出发地和目的地不能相同'
      : 'Departure and destination cannot be the same';
    alert(alertMessage);
    return;
  }
  
  // 记录用户选择到数据管理器
  if (dataManager) {
    dataManager.recordUserChoice('departure', departure);
    dataManager.recordUserChoice('destination', destination);
    dataManager.recordUserChoice('date', date);
  }
  
  appState.isLoading = true;
  
  // 显示加载动画
  showLoadingAnimation();
  
  // 延迟后显示成功信息
  setTimeout(() => {
    hideLoadingAnimation();
    const resultElement = document.getElementById('query-result');
    if (resultElement) {
      resultElement.classList.add('show');
    }
    appState.isLoading = false;
  }, appState.responseTime);
}

// ============================================
// 📊 显示加载动画
// ============================================
function showLoadingAnimation() {
  const overlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');
  
  const lang = LANGUAGE_CONFIG[appState.currentLanguage];
  loadingText.textContent = lang.querying;
  
  overlay.style.display = 'flex';
}

// ============================================
// 📊 隐藏加载动画
// ============================================
function hideLoadingAnimation() {
  const overlay = document.getElementById('loading-overlay');
  overlay.style.display = 'none';
}

// ============================================
// 🛫 显示航班查询结果弹窗
// ============================================
function showFlightsModal(departure, destination) {
  const modal = document.getElementById('flights-modal');
  const flightsList = document.getElementById('flights-list');
  const flightsModalTitle = document.getElementById('flights-modal-title');
  const lang = LANGUAGE_CONFIG[appState.currentLanguage];
  
  // 更新模态框标题
  flightsModalTitle.textContent = appState.currentLanguage === 'zh' ? '航班查询结果' : 'Flight Search Results';
  
  // 生成虚拟航班数据
  const flights = generateFlights(departure, destination);
  
  // 渲染航班列表
  let html = '';
  flights.forEach(flight => {
    const departureLabel = appState.currentLanguage === 'zh' ? '出发' : 'Departure';
    const arrivalLabel = appState.currentLanguage === 'zh' ? '到达' : 'Arrival';
    const aircraftLabel = appState.currentLanguage === 'zh' ? '机型' : 'Aircraft';
    const flightNumberLabel = appState.currentLanguage === 'zh' ? '航班号' : 'Flight No.';
    const buyLabel = appState.currentLanguage === 'zh' ? '购买' : 'Book';
    
    html += `
      <div class="flight-item" onclick="selectFlight(this, '${flight.id}')">
        <div class="flight-header">
          <div class="flight-airline">${flight.airline} ${flight.flightNumber}</div>
          <div class="flight-price">¥${flight.price}</div>
        </div>
        <div class="flight-time">
          <div class="flight-time-item">
            <div class="flight-time-value">${flight.departureTime}</div>
            <div class="flight-time-label">${departureLabel}</div>
          </div>
          <div class="flight-duration">${flight.duration}</div>
          <div class="flight-time-item">
            <div class="flight-time-value">${flight.arrivalTime}</div>
            <div class="flight-time-label">${arrivalLabel}</div>
          </div>
        </div>
        <div class="flight-details">
          <span>${aircraftLabel}: ${flight.aircraft}</span>
          <span>${flightNumberLabel}: ${flight.flightNumber}</span>
        </div>
        <button class="flight-buy-btn" onclick="buyFlight(event, '${flight.id}')">${buyLabel}</button>
      </div>
    `;
  });
  
  flightsList.innerHTML = html;
  modal.classList.add('show');
}

// ============================================
// 🛫 选择航班
// ============================================
function selectFlight(element, flightId) {
  // 移除其他选中状态
  document.querySelectorAll('.flight-item').forEach(item => {
    item.classList.remove('selected');
  });
  // 添加当前选中状态
  element.classList.add('selected');
  appState.selectedFlight = flightId;
}

// ============================================
// 🛫 购买航班
// ============================================
function buyFlight(event, flightId) {
  event.stopPropagation();
  appState.selectedFlight = flightId;
  closeFlightsModal();
  showInsuranceModal();
}

// ============================================
// 🛫 关闭航班弹窗
// ============================================
function closeFlightsModal() {
  const modal = document.getElementById('flights-modal');
  modal.classList.remove('show');
}

// ============================================
// 💰 显示保险选择弹窗
// ============================================
function showInsuranceModal() {
  const modal = document.getElementById('insurance-modal');
  const insuranceOptions = document.getElementById('insurance-options');
  const insuranceModalTitle = document.getElementById('insurance-modal-title');
  const lang = LANGUAGE_CONFIG[appState.currentLanguage];
  
  // 更新模态框标题
  insuranceModalTitle.textContent = appState.currentLanguage === 'zh' ? '选择保险方案' : 'Select Insurance Plan';
  
  const confirmLabel = appState.currentLanguage === 'zh' ? '确认选择' : 'Confirm Selection';
  
  let html = `
    <div class="insurance-option" onclick="selectInsurance(this, 'basic', 8)">
      <div class="insurance-option-icon">🧳</div>
      <div class="insurance-option-name">${lang.basicInsurance}</div>
      <div class="insurance-option-price">¥8 / 天</div>
      <div class="insurance-option-coverage">${lang.basicCoverage}</div>
    </div>
    <div class="insurance-option" onclick="selectInsurance(this, 'basic', 10)">
      <div class="insurance-option-icon">🧳</div>
      <div class="insurance-option-name">${lang.basicInsurance}</div>
      <div class="insurance-option-price">¥10 / 天</div>
      <div class="insurance-option-coverage">${lang.basicCoverage}</div>
    </div>
    <div class="insurance-option" onclick="selectInsurance(this, 'premium', 15)">
      <div class="insurance-option-icon">🛡️</div>
      <div class="insurance-option-name">${lang.premiumInsurance}</div>
      <div class="insurance-option-price">¥15 / 天</div>
      <div class="insurance-option-coverage">${lang.premiumCoverage}</div>
    </div>
    <div class="insurance-option" onclick="selectInsurance(this, 'premium', 20)">
      <div class="insurance-option-icon">🛡️</div>
      <div class="insurance-option-name">${lang.premiumInsurance}</div>
      <div class="insurance-option-price">¥20 / 天</div>
      <div class="insurance-option-coverage">${lang.premiumCoverage}</div>
    </div>
    <button class="insurance-confirm-btn" onclick="confirmInsurance()">${confirmLabel}</button>
  `;
  
  insuranceOptions.innerHTML = html;
  modal.classList.add('show');
}

// ============================================
// 💰 选择保险
// ============================================
function selectInsurance(element, type, price) {
  // 移除其他选中状态
  document.querySelectorAll('.insurance-option').forEach(item => {
    item.classList.remove('selected');
  });
  // 添加当前选中状态
  element.classList.add('selected');
  appState.selectedInsurance = { type, price };
}

// ============================================
// 💰 关闭保险弹窗
// ============================================
function closeInsuranceModal() {
  const modal = document.getElementById('insurance-modal');
  modal.classList.remove('show');
}

// ============================================
// 💰 确认保险选择
// ============================================
function confirmInsurance() {
  if (!appState.selectedInsurance) {
    const alertMessage = appState.currentLanguage === 'zh' ? '请选择保险方案' : 'Please select an insurance plan';
    alert(alertMessage);
    return;
  }
  closeInsuranceModal();
  showSurveyModal();
}

// ============================================
// 📋 显示问卷弹窗
// ============================================
function showSurveyModal() {
  const modal = document.getElementById('survey-modal');
  const surveyQuestions = document.getElementById('survey-questions');
  const surveyModalTitle = document.getElementById('survey-modal-title');
  const surveySubmitBtn = document.getElementById('survey-submit-btn');
  const lang = LANGUAGE_CONFIG[appState.currentLanguage];
  const questions = CLT_SURVEY_QUESTIONS[appState.currentLanguage];
  
  // 更新模态框标题和按钮
  surveyModalTitle.textContent = appState.currentLanguage === 'zh' ? '用户反馈问卷' : 'User Feedback Survey';
  surveySubmitBtn.textContent = appState.currentLanguage === 'zh' ? '提交问卷' : 'Submit Survey';
  
  let html = '';
  questions.forEach((question) => {
    // 问卷说明
    if (question.type === 'intro') {
      html += `<div class="survey-intro">${question.text}</div>`;
    }
    // 普通问题
    else {
      html += `<div class="survey-question">`;
      html += `<div class="survey-question-text">${question.text}</div>`;
      
      if (question.type === 'multiple_choice') {
        // 多选框
        html += `<div class="survey-multiple-choice">`;
        question.options.forEach((option) => {
          html += `
            <label class="survey-checkbox">
              <input 
                type="radio" 
                name="${question.id}" 
                value="${option}"
                onchange="saveSurveyAnswer('${question.id}', this.value, '${question.variable}')"
              />
              <span>${option}</span>
            </label>
          `;
        });
        html += `</div>`;
      } else {
        // 默认：1-5 分量表
        html += `<div class="survey-scale">`;
        for (let i = 1; i <= question.scale; i++) {
          html += `
            <button class="survey-scale-btn" onclick="selectSurveyAnswer('${question.id}', ${i}, this, '${question.variable}')">
              ${i}
            </button>
          `;
        }
        html += `</div>`;
        // 显示量表标签
        if (question.scaleLabels) {
          html += `<div class="survey-scale-labels">`;
          html += `<span class="scale-label-left">${question.scaleLabels[0]}</span>`;
          html += `<span class="scale-label-right">${question.scaleLabels[question.scaleLabels.length - 1]}</span>`;
          html += `</div>`;
        }
      }
      
      html += `</div>`;
    }
  });
  
  surveyQuestions.innerHTML = html;
  modal.classList.add('show');
}

// ============================================
// 📋 选择问卷答案
// ============================================
function selectSurveyAnswer(questionId, score, element, variable) {
  // 移除同一行的其他选中状态
  element.parentElement.querySelectorAll('.survey-scale-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  // 添加当前选中状态
  element.classList.add('selected');
  // 保存答案
  appState.surveyAnswers[questionId] = score;
  // 记录到数据管理器
  if (dataManager) {
    dataManager.recordSurveyAnswer(questionId, score, variable);
  }
}

// ============================================
// 📋 保存问卷答案（文本输入、多选等）
// ============================================
function saveSurveyAnswer(questionId, value, variable) {
  appState.surveyAnswers[questionId] = value;
  // 记录到数据管理器
  if (dataManager) {
    dataManager.recordSurveyAnswer(questionId, value, variable);
  }
}

// ============================================
// 📋 关闭问卷弹窗
// ============================================
function closeSurveyModal() {
  const modal = document.getElementById('survey-modal');
  modal.classList.remove('show');
}

// ============================================
// 📋 提交问卷
// ============================================
async function submitSurvey() {
  const questions = CLT_SURVEY_QUESTIONS[appState.currentLanguage];
  const submitButton = document.getElementById('survey-submit-btn');
  
  // 获取所有实际问题（排除说明等）
  const actualQuestions = questions.filter(q => q.type !== 'intro');
  
  // 检查是否所有问题都已回答
  let unansweredCount = 0;
  actualQuestions.forEach(question => {
    if (!appState.surveyAnswers[question.id] || appState.surveyAnswers[question.id] === '') {
      unansweredCount++;
    }
  });
  
  if (unansweredCount > 0) {
    const alertMessage = appState.currentLanguage === 'zh' 
      ? `请回答所有问题（还有 ${unansweredCount} 个问题未回答）`
      : `Please answer all questions (${unansweredCount} questions remaining)`;
    alert(alertMessage);
    return;
  }
  
  // 完成数据收集
  let submitResult = null;
  if (dataManager) {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = appState.currentLanguage === 'zh' ? '提交中...' : 'Submitting...';
    }
    submitResult = await dataManager.completeSession();
  }
  
  // 关闭问卷
  closeSurveyModal();
  
  // 显示完成弹窗
  if (typeof showCompletionPopup === 'function') {
    showCompletionPopup(submitResult);
  }
  
  // 重置状态
  appState.selectedFlight = null;
  appState.selectedInsurance = null;
  appState.surveyAnswers = {};

  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = appState.currentLanguage === 'zh' ? '提交问卷' : 'Submit Survey';
  }
}

// ============================================
// 📍 下拉框变化处理
// ============================================
function handleDepartureChange() {
  // 隐藏之前的结果
  const resultElement = document.getElementById('query-result');
  if (resultElement) {
    resultElement.classList.remove('show');
  }
}

function handleDestinationChange() {
  // 隐藏之前的结果
  const resultElement = document.getElementById('query-result');
  if (resultElement) {
    resultElement.classList.remove('show');
  }
}

function handleDateChange() {
  // 隐藏之前的结果
  const resultElement = document.getElementById('query-result');
  if (resultElement) {
    resultElement.classList.remove('show');
  }
}

// ============================================
// 🎨 渲染主页
// ============================================
function renderHomepage() {
  const mainContent = document.getElementById('main-content');
  const lang = LANGUAGE_CONFIG[appState.currentLanguage];
  
  // 更新用户语言按钮状态
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-lang="${appState.currentLanguage}"]`).classList.add('active');
  
  let html = `
    <!-- 顶部标题区域 -->
    <div class="title-section">
      <h1 class="main-title">${lang.mainTitle}</h1>
      <p class="main-subtitle">${lang.mainSubtitle}</p>
    </div>
    
    <!-- 中间内容区域（左右两栏） -->
    <div class="content-container">
      <!-- 左侧：地区选择模块（60%） -->
      <div class="flight-module">
        <div class="module">
          <h2 class="module-title">${lang.regionModuleTitle}</h2>
          
          <form class="flight-form">
            <!-- 出发地下拉框 -->
            <div class="form-group">
              <label>${lang.departureLabel}</label>
              <select id="departure-select">
                <option value="">${lang.departureHint}</option>
                ${generateCityOptions()}
              </select>
              <div class="form-hint">${lang.departureHint}</div>
            </div>
            
            <!-- 目的地下拉框 -->
            <div class="form-group">
              <label>${lang.destinationLabel}</label>
              <select id="destination-select">
                <option value="">${lang.destinationHint}</option>
                ${generateCityOptions()}
              </select>
              <div class="form-hint">${lang.destinationHint}</div>
            </div>
            
            <!-- 出行日期下拉框 -->
            <div class="form-group">
              <label>${lang.dateLabel}</label>
              <select id="date-select">
                <option value="">${lang.dateHint}</option>
                ${generateDateOptions()}
              </select>
              <div class="form-hint">${lang.dateHint}</div>
            </div>
            
            <!-- 确认按钮 -->
            <button type="button" id="query-button" class="query-button">
              ${lang.queryButton}
            </button>
            
            <!-- 查询结果 -->
            <div id="query-result" class="query-result">
              ${lang.querySuccess}
            </div>
          </form>
        </div>
      </div>
      
      <!-- 右侧：保险选择模块（40%） -->
      <div class="insurance-module">
        <div class="module">
          <h2 class="module-title">${lang.insuranceModuleTitle}</h2>
          
          <div class="insurance-cards">
            <!-- Basic 基础级 -->
            <div class="insurance-card" id="card-basic" onclick="selectInsurance('basic')">
              <div class="insurance-card-header">
                <span class="insurance-icon">🧳</span>
                <div class="insurance-card-title">${lang.basicInsurance}</div>
              </div>
              <div class="insurance-price">${lang.basicPrice}</div>
              <button type="button" class="insurance-expand-btn" onclick="event.stopPropagation(); toggleInsuranceDescription('basic')">${lang.detailsButton}</button>
              <div class="insurance-description" id="desc-basic" style="display: none;">
                ${lang.basicCoverage}
              </div>
            </div>
            
            <!-- Premium 进阶级 -->
            <div class="insurance-card" id="card-premium" onclick="selectInsurance('premium')">
              <div class="insurance-card-header">
                <span class="insurance-icon">🛡️</span>
                <div class="insurance-card-title">${lang.premiumInsurance}</div>
              </div>
              <div class="insurance-price">${lang.premiumPrice}</div>
              <button type="button" class="insurance-expand-btn" onclick="event.stopPropagation(); toggleInsuranceDescription('premium')">${lang.detailsButton}</button>
              <div class="insurance-description" id="desc-premium" style="display: none;">
                ${lang.premiumCoverage}
              </div>
            </div>
            
            <!-- Luxury 豪华级 -->
            <div class="insurance-card" id="card-luxury" onclick="selectInsurance('luxury')">
              <div class="insurance-card-header">
                <span class="insurance-icon">✨</span>
                <div class="insurance-card-title">${lang.luxuryInsurance}</div>
              </div>
              <div class="insurance-price">${lang.luxuryPrice}</div>
              <button type="button" class="insurance-expand-btn" onclick="event.stopPropagation(); toggleInsuranceDescription('luxury')">${lang.detailsButton}</button>
              <div class="insurance-description" id="desc-luxury" style="display: none;">
                ${lang.luxuryCoverage}
              </div>
            </div>
            
            <!-- 不购买保险 -->
            <div class="insurance-card" id="card-none" onclick="selectInsurance('none')">
              <div class="insurance-card-header">
                <span class="insurance-icon">✕</span>
                <div class="insurance-card-title">${lang.noInsurance}</div>
              </div>
              <div class="insurance-price">${lang.noInsurancePrice}</div>
              <button type="button" class="insurance-expand-btn" onclick="event.stopPropagation(); toggleInsuranceDescription('none')">${lang.detailsButton}</button>
              <div class="insurance-description" id="desc-none" style="display: none;">
                ${lang.noInsuranceCoverage}
              </div>
            </div>
          </div>
          
          <!-- 确认选择按钮 -->
          <button class="insurance-confirm-btn" onclick="confirmInsuranceSelection()">${lang.confirmButton}</button>
        </div>
      </div>
    </div>
    
    <!-- 底部说明区域 -->
    <div class="footer-section">
      ${lang.disclaimer}
    </div>
  `;
  
  mainContent.innerHTML = html;
  
  // 重新设置事件监听
  setupEventListeners();
}

// ============================================
// 🏙️ 生成城市选项
// ============================================
function generateCityOptions() {
  const cities = CITIES[appState.currentLanguage];
  return cities.map(city => `
    <option value="${city.code}">${city.name} (${city.country})</option>
  `).join('');
}

// ============================================
// 📅 生成日期选项
// ============================================
function generateDateOptions() {
  const dates = FLIGHT_DATES[appState.currentLanguage];
  return dates.map(date => `
    <option value="${date.value}">${date.label}</option>
  `).join('');
}

// ============================================
// 💰 主页面保险选择处理
// ============================================
function selectInsurance(type) {
  // 移除其他选中状态
  document.querySelectorAll('.insurance-card').forEach(card => {
    card.classList.remove('selected');
  });
  // 添加当前选中状态
  document.getElementById(`card-${type}`).classList.add('selected');
  appState.selectedInsurance = type;
}

// ============================================
// 💰 确认主页面保险选择
// ============================================
function confirmInsuranceSelection() {
  if (!appState.selectedInsurance) {
    const alertMessage = appState.currentLanguage === 'zh' ? '请选择保险方案' : 'Please select an insurance plan';
    alert(alertMessage);
    return;
  }
  
  // 记录保险选择到数据管理器
  if (dataManager) {
    dataManager.recordInsuranceChoice(appState.selectedInsurance);
  }
  
  // 显示问卷
  showSurveyModal();
}

// ============================================
// 🎨 切换保险描述
// ============================================
function toggleInsuranceDescription(type) {
  const desc = document.getElementById(`desc-${type}`);
  if (desc) {
    desc.style.display = desc.style.display === 'none' ? 'block' : 'none';
  }
}

// ============================================
// 🔄 获取当前状态
// ============================================
function getCurrentState() {
  return {
    ...appState,
    isAdmin: isAdmin
  };
}
