/**
 * EzyCover 航班预订 + 旅游险实验版 - 配置文件 V3
 * 
 * 核心功能：
 * 1. 航班预订基础模块（左侧 60%）
 * 2. 旅游险推荐模块（右侧 40%）
 * 3. 响应时间可控（默认 1s）
 * 4. 所有变量控制仅管理员可见
 */

// ============================================
// 🔐 管理员密钥
// ============================================
const ADMIN_PASSWORD = 'ezycover2024';

// ============================================
// 📊 获取保存的响应时间
// ============================================
function getSavedResponseTime() {
  const saved = localStorage.getItem('ezycover_responseTime');
  return saved ? parseInt(saved) : 1000;
}

// ============================================
// 📊 实验变量控制
// ============================================
const EXPERIMENT_VARIABLES = {
  // 响应时间（毫秒）
  responseTime: getSavedResponseTime(), // 从localStorage读取，默认1000ms
  
  // 语言
  language: 'zh', // zh/en
  
  // 心理距离维度（后续添加）
  psychologicalDistance: 'low', // low/high
  
  // 航班查询响应时间
  flightQueryTime: 1000
};

// ============================================
// ☁️ 跨设备设置同步
// ============================================

async function syncExperimentSettings() {
  if (typeof dataManager === 'undefined' || !dataManager.loadSettings) {
    console.log('⚠️ dataManager not ready, skipping settings sync');
    return;
  }
  
  try {
    const cloudSettings = await dataManager.loadSettings();
    
    if (cloudSettings) {
      // 从云端同步设置到本地
      if (cloudSettings.responseTime !== undefined && cloudSettings.responseTime !== null) {
        const newResponseTime = parseInt(cloudSettings.responseTime);
        if (newResponseTime !== EXPERIMENT_VARIABLES.responseTime) {
          console.log('🔄 Syncing response time from cloud:', newResponseTime, 'ms');
          EXPERIMENT_VARIABLES.responseTime = newResponseTime;
          localStorage.setItem('ezycover_responseTime', newResponseTime.toString());
          
          // 触发UI更新
          window.dispatchEvent(new CustomEvent('experimentSettingsChanged', {
            detail: { responseTime: newResponseTime }
          }));
        }
      }
      
      if (cloudSettings.language) {
        EXPERIMENT_VARIABLES.language = cloudSettings.language;
      }
    }
  } catch (error) {
    console.error('❌ Error syncing settings:', error);
  }
}

function startSettingsListener() {
  if (typeof dataManager === 'undefined' || !dataManager.listenToSettingsChanges) {
    console.log('⚠️ dataManager not ready, waiting...');
    setTimeout(startSettingsListener, 1000);
    return;
  }
  
  dataManager.listenToSettingsChanges(async (settings) => {
    console.log('🔔 Settings changed from cloud:', settings);
    
    if (settings.responseTime !== undefined && settings.responseTime !== null) {
      const newResponseTime = parseInt(settings.responseTime);
      if (newResponseTime !== EXPERIMENT_VARIABLES.responseTime) {
        EXPERIMENT_VARIABLES.responseTime = newResponseTime;
        localStorage.setItem('ezycover_responseTime', newResponseTime.toString());
        
        window.dispatchEvent(new CustomEvent('experimentSettingsChanged', {
          detail: { responseTime: newResponseTime }
        }));
        
        console.log('✅ Response time synced:', newResponseTime, 'ms');
      }
    }
  });
  
  console.log('✅ Settings listener started');
}

// 页面加载时同步设置
function initSettingsSync() {
  if (typeof dataManager === 'undefined') {
    console.log('⏳ Waiting for dataManager to be ready...');
    setTimeout(initSettingsSync, 500);
    return;
  }
  
  syncExperimentSettings();
  startSettingsListener();
  console.log('✅ Settings sync initialized');
}

// 延迟启动，等待 dataManager 初始化
setTimeout(initSettingsSync, 1000);

// ============================================
// 🌍 多语言配置
// ============================================
const LANGUAGE_CONFIG = {
  zh: {
    // 顶部标题
    mainTitle: 'EzyCover - 特定旅游地区保险购买平台',
    mainSubtitle: '按需选择・分级保障',
    
    // 左侧地区选择模块
    regionModuleTitle: '选择旅游地区',
    departureLabel: '出发地',
    departureHint: '请选择出发地',
    destinationLabel: '目的地',
    destinationHint: '请选择目的地',
    dateLabel: '出行日期',
    dateHint: '请选择出行日期',
    queryButton: '确认选择',
    querying: '正在加载...',
    querySuccess: '选择成功',
    
    // 右侧保险模块
    insuranceModuleTitle: '选择保险方案',
    basicInsurance: 'Basic 基础级',
    basicPrice: '¥18 / 天',
    basicCoverage: '基础旅游 / 飞行保障',
    premiumInsurance: 'Premium 进阶级',
    premiumPrice: '¥38 / 天',
    premiumCoverage: '含基础 + 航班延迟补偿',
    luxuryInsurance: 'Luxury 豪华级',
    luxuryPrice: '¥68 / 天',
    luxuryCoverage: '全面保障 + 紧急救援',
    noInsurance: '不购买保险',
    noInsurancePrice: '¥0 / 天',
    noInsuranceCoverage: '无任何保障',
    
    // 按钮文本
    detailsButton: '详情',
    confirmButton: '确认选择',
    
    // 底部说明
    disclaimer: '本网站为学术实验模拟平台，不提供真实保险投保服务'
  },
  en: {
    // Top title
    mainTitle: 'EzyCover - Regional Travel Insurance Purchase Platform',
    mainSubtitle: 'Choose as Needed・Tiered Protection',
    
    // Left region selection module
    regionModuleTitle: 'Select Travel Region',
    departureLabel: 'Departure',
    departureHint: 'Select departure city',
    destinationLabel: 'Destination',
    destinationHint: 'Select destination city',
    dateLabel: 'Travel Date',
    dateHint: 'Select travel date',
    queryButton: 'Confirm Selection',
    querying: 'Loading...',
    querySuccess: 'Selection successful',
    
    // Right insurance module
    insuranceModuleTitle: 'Select Insurance Plan',
    basicInsurance: 'Basic Level',
    basicPrice: '$2.7 / day',
    basicCoverage: 'Basic travel / flight protection',
    premiumInsurance: 'Premium Level',
    premiumPrice: '$5.7 / day',
    premiumCoverage: 'Includes basic + flight delay compensation',
    luxuryInsurance: 'Luxury Level',
    luxuryPrice: '$10.2 / day',
    luxuryCoverage: 'Comprehensive protection + emergency rescue',
    noInsurance: 'No Insurance',
    noInsurancePrice: '$0 / day',
    noInsuranceCoverage: 'No coverage',
    
    // Button text
    detailsButton: 'Details',
    confirmButton: 'Confirm Selection',
    
    // Bottom disclaimer
    disclaimer: 'This website is an academic experimental simulation platform and does not provide real insurance services'
  }
};

// ============================================
// ✈️ 航班数据配置
// ============================================
const DEPARTURE_CITY = {
  zh: { code: 'HKG', name: '香港', country: '中国香港' },
  en: { code: 'HKG', name: 'Hong Kong', country: 'Hong Kong' }
};

const CITIES = {
  zh: [
    { code: 'BJS', name: '北京', country: '中国' },
    { code: 'BKK', name: '曼谷', country: '泰国' },
    { code: 'LAX', name: '洛杉矶', country: '美国' }
  ],
  en: [
    { code: 'BJS', name: 'Beijing', country: 'China' },
    { code: 'BKK', name: 'Bangkok', country: 'Thailand' },
    { code: 'LAX', name: 'Los Angeles', country: 'USA' }
  ]
};

// ============================================
// 📅 航班日期配置
// ============================================
const FLIGHT_DATES = {
  zh: [
    { value: '3days', label: '3天后' },
    { value: '1month', label: '1个月后' },
    { value: '3months', label: '3个月后' }
  ],
  en: [
    { value: '3days', label: 'In 3 days' },
    { value: '1month', label: 'In 1 month' },
    { value: '3months', label: 'In 3 months' }
  ]
};

// ============================================
// 🛫 旅游险卡片配置
// ============================================
const INSURANCE_CARDS = {
  basic: {
    title: 'basicInsurance',
    price: 'basicPrice',
    coverage: 'basicCoverage',
    icon: '🧳',
    color: '#E8F4F8'
  },
  premium: {
    title: 'premiumInsurance',
    price: 'premiumPrice',
    coverage: 'premiumCoverage',
    icon: '🛡️',
    color: '#F0E8F8'
  }
};

// ============================================
// ✈️ 虚拟航班数据生成
// ============================================
function generateFlights(departure, destination) {
  const airlines = ['CA', 'MU', 'CZ', 'ZH', 'BZ'];
  const times = ['08:00', '10:30', '13:15', '15:45', '18:20'];
  const prices = [580, 620, 650, 720, 780];
  
  return times.map((time, index) => ({
    id: `FL${Math.random().toString(36).substr(2, 9)}`,
    airline: airlines[index],
    flightNumber: `${airlines[index]}${Math.floor(Math.random() * 9000) + 1000}`,
    departure: departure,
    destination: destination,
    departureTime: time,
    arrivalTime: `${parseInt(time.split(':')[0]) + 2}:${time.split(':')[1]}`,
    price: prices[index],
    duration: '2h 30m',
    aircraft: ['Boeing 737', 'Airbus A320', 'Boeing 787', 'Airbus A330', 'Boeing 777'][index]
  }));
}

// ============================================
// 💰 保险价格配置
// ============================================
const INSURANCE_PRICES = {
  basic: [8, 10],      // 基础出行保：8元或10元
  premium: [15, 20]    // 全面安心保：15元或20元
};

// ============================================
// 📋 CLT研究核心问卷配置（24题量表 + 4题基本信息）
// ============================================
const SURVEY_SCALE_TEXT = {
  zh: '请根据你的真实感受选择答案：1 = 十分同意 2 = 比较同意 3 = 中立 4 = 比较不同意 5 = 十分不同意',
  en: 'Please answer based on your genuine feelings: 1 = Strongly agree 2 = Agree 3 = Neutral 4 = Disagree 5 = Strongly disagree'
};

const createIntro = (lang) => ({
  type: 'intro',
  text: lang === 'zh'
    ? '请根据你的真实感受选择答案。本问卷仅用于学术研究，答案无对错，请独立作答。'
    : 'Please answer based on your genuine feelings. This questionnaire is for academic research only. There are no right or wrong answers, so please answer independently.'
});

const createSection = (title, note) => ({
  type: 'section',
  title,
  note
});

const createLikert = (variable, zhText, enText) => ({
  type: 'likert',
  id: variable,
  variable,
  text: { zh: zhText, en: enText }
});

const createSingleChoice = (variable, zhText, enText, optionsZh, optionsEn) => ({
  type: 'single_choice',
  id: variable,
  variable,
  text: { zh: zhText, en: enText },
  options: { zh: optionsZh, en: optionsEn }
});

const SURVEY_DEFINITIONS = {
  zh: [
    createIntro('zh'),
    createSection('一、时间距离感知', SURVEY_SCALE_TEXT.zh),
    createLikert('time1', '我觉得这次旅行计划在时间上离我很遥远。', 'I feel that this trip plan is very far away in time.'),
    createLikert('time2', '我感觉这场旅行是在很久以后才会发生。', 'I feel that this trip will happen only after a long time.'),
    createLikert('time3', '我认为这次旅行并不是近期会发生的事情。', 'I think this trip will not happen anytime soon.'),
    createSection('二、空间距离感知', SURVEY_SCALE_TEXT.zh),
    createLikert('space1', '我觉得这次旅行的目的地离我地理位置很远。', 'I feel that the destination of this trip is geographically far from me.'),
    createLikert('space2', '我感觉这个地方对我来说是一个遥远的地点。', 'I feel that this place is a distant location for me.'),
    createLikert('space3', '我认为这次旅行发生在远离我当前生活的区域。', 'I think this trip takes place in an area far from my current life.'),
    createSection('三、社会距离感知', SURVEY_SCALE_TEXT.zh),
    createLikert('social1', '我觉得这次的旅行同伴与我关系比较疏远。', 'I feel that the travel companion(s) are relatively distant from me.'),
    createLikert('social2', '我感觉同行的人与我的日常生活没有密切联系。', 'I feel that the people traveling with me have little connection to my daily life.'),
    createLikert('social3', '我认为这次旅行和我不熟悉的人有关。', 'I think this trip involves people I am not familiar with.'),
    createSection('四、假设距离感知', SURVEY_SCALE_TEXT.zh),
    createLikert('hypo1', '我觉得这次旅行计划是不确定的。', 'I feel that this trip plan is uncertain.'),
    createLikert('hypo2', '我感觉这场旅行只是可能发生，而不是一定会发生。', 'I feel that this trip may happen, but it is not guaranteed.'),
    createLikert('hypo3', '我认为这次旅行的情况并没有完全确定。', 'I think the situation of this trip is not fully certain.'),
    createSection('五、网站响应速度感知', SURVEY_SCALE_TEXT.zh),
    createLikert('speed1', '我觉得这个网站的响应速度很快。', 'I feel the website responds very quickly.'),
    createLikert('speed2', '我感觉页面加载过程快速且流畅。', 'I feel the page loading process is fast and smooth.'),
    createLikert('speed3', '我认为网站运行高效，没有明显延迟。', 'I think the website runs efficiently without noticeable delay.'),
    createSection('六、构念水平感知', SURVEY_SCALE_TEXT.zh),
    createLikert('cl1', '我更关注保险的核心价值，而不是细小条款。', 'I focus more on the core value of the insurance than on minor terms.'),
    createLikert('cl2', '我更看重保险的整体保障，而不是具体细节。', 'I value the overall protection of the insurance more than specific details.'),
    createLikert('cl3', '我倾向于从整体、抽象的角度看待这份保险。', 'I tend to view this insurance from an overall, abstract perspective.'),
    createSection('七、购买意愿', SURVEY_SCALE_TEXT.zh),
    createLikert('int1', '我愿意购买这份旅游险。', 'I am willing to buy this travel insurance.'),
    createLikert('int2', '我购买这份保险的意愿很强。', 'I have a strong intention to buy this insurance.'),
    createLikert('int3', '如果参加这次旅行，我会选择这份保险。', 'If I took this trip, I would choose this insurance.'),
    createSection('八、支付意愿', SURVEY_SCALE_TEXT.zh),
    createLikert('wtp1', '我愿意为这份保险支付更高的价格。', 'I am willing to pay a higher price for this insurance.'),
    createLikert('wtp2', '我认为这份保险值得我花钱购买。', 'I think this insurance is worth paying for.'),
    createLikert('wtp3', '我能够接受这份保险的费用。', 'I can accept the cost of this insurance.'),
    createSection('九、基本信息', '请根据你的真实情况选择答案 / Please select the option that best describes you'),
    createSingleChoice('gender', '性别', 'Gender', ['男', '女', '不愿透露'], ['Male', 'Female', 'Prefer not to say']),
    createSingleChoice('age', '年龄', 'Age', ['18–25', '26–35', '36–45', '46 岁以上'], ['18–25', '26–35', '36–45', '46+']),
    createSingleChoice('edu', '学历', 'Education', ['高中及以下', '大专', '本科', '硕士及以上'], ['High school or below', 'College', 'Bachelor', 'Master’s or above']),
    createSingleChoice('travel_exp', '旅游及保险经验', 'Travel & insurance experience', ['无', '较少', '一般', '较多', '非常丰富'], ['None', 'Low', 'Moderate', 'High', 'Very high'])
  ],
  en: [
    createIntro('en'),
    createSection('I. Temporal Distance Perception', SURVEY_SCALE_TEXT.en),
    createLikert('time1', 'I feel that this trip plan is very far away in time.', 'I feel that this trip plan is very far away in time.'),
    createLikert('time2', 'I feel that this trip will happen only after a long time.', 'I feel that this trip will happen only after a long time.'),
    createLikert('time3', 'I think this trip will not happen anytime soon.', 'I think this trip will not happen anytime soon.'),
    createSection('II. Spatial Distance Perception', SURVEY_SCALE_TEXT.en),
    createLikert('space1', 'I feel that the destination of this trip is geographically far from me.', 'I feel that the destination of this trip is geographically far from me.'),
    createLikert('space2', 'I feel that this place is a distant location for me.', 'I feel that this place is a distant location for me.'),
    createLikert('space3', 'I think this trip takes place in an area far from my current life.', 'I think this trip takes place in an area far from my current life.'),
    createSection('III. Social Distance Perception', SURVEY_SCALE_TEXT.en),
    createLikert('social1', 'I feel that the travel companion(s) are relatively distant from me.', 'I feel that the travel companion(s) are relatively distant from me.'),
    createLikert('social2', 'I feel that the people traveling with me have little connection to my daily life.', 'I feel that the people traveling with me have little connection to my daily life.'),
    createLikert('social3', 'I think this trip involves people I am not familiar with.', 'I think this trip involves people I am not familiar with.'),
    createSection('IV. Hypothetical Distance Perception', SURVEY_SCALE_TEXT.en),
    createLikert('hypo1', 'I feel that this trip plan is uncertain.', 'I feel that this trip plan is uncertain.'),
    createLikert('hypo2', 'I feel that this trip may happen, but it is not guaranteed.', 'I feel that this trip may happen, but it is not guaranteed.'),
    createLikert('hypo3', 'I think the situation of this trip is not fully certain.', 'I think the situation of this trip is not fully certain.'),
    createSection('V. Website Speed Perception', SURVEY_SCALE_TEXT.en),
    createLikert('speed1', 'I feel the website responds very quickly.', 'I feel the website responds very quickly.'),
    createLikert('speed2', 'I feel the page loading process is fast and smooth.', 'I feel the page loading process is fast and smooth.'),
    createLikert('speed3', 'I think the website runs efficiently without noticeable delay.', 'I think the website runs efficiently without noticeable delay.'),
    createSection('VI. Construal Level Perception', SURVEY_SCALE_TEXT.en),
    createLikert('cl1', 'I focus more on the core value of the insurance than on minor terms.', 'I focus more on the core value of the insurance than on minor terms.'),
    createLikert('cl2', 'I value the overall protection of the insurance more than specific details.', 'I value the overall protection of the insurance more than specific details.'),
    createLikert('cl3', 'I tend to view this insurance from an overall, abstract perspective.', 'I tend to view this insurance from an overall, abstract perspective.'),
    createSection('VII. Purchase Intention', SURVEY_SCALE_TEXT.en),
    createLikert('int1', 'I am willing to buy this travel insurance.', 'I am willing to buy this travel insurance.'),
    createLikert('int2', 'I have a strong intention to buy this insurance.', 'I have a strong intention to buy this insurance.'),
    createLikert('int3', 'If I took this trip, I would choose this insurance.', 'If I took this trip, I would choose this insurance.'),
    createSection('VIII. Willingness to Pay', SURVEY_SCALE_TEXT.en),
    createLikert('wtp1', 'I am willing to pay a higher price for this insurance.', 'I am willing to pay a higher price for this insurance.'),
    createLikert('wtp2', 'I think this insurance is worth paying for.', 'I think this insurance is worth paying for.'),
    createLikert('wtp3', 'I can accept the cost of this insurance.', 'I can accept the cost of this insurance.'),
    createSection('IX. Demographics', 'Please select the option that best describes you'),
    createSingleChoice('gender', 'Gender', 'Gender', ['Male', 'Female', 'Prefer not to say'], ['Male', 'Female', 'Prefer not to say']),
    createSingleChoice('age', 'Age', 'Age', ['18–25', '26–35', '36–45', '46+'], ['18–25', '26–35', '36–45', '46+']),
    createSingleChoice('edu', 'Education', 'Education', ['High school or below', 'College', 'Bachelor', 'Master’s or above'], ['High school or below', 'College', 'Bachelor', 'Master’s or above']),
    createSingleChoice('travel_exp', 'Travel & insurance experience', 'Travel & insurance experience', ['None', 'Low', 'Moderate', 'High', 'Very high'], ['None', 'Low', 'Moderate', 'High', 'Very high'])
  ]
};

const CLT_SURVEY_QUESTIONS = {
  zh: SURVEY_DEFINITIONS.zh,
  en: SURVEY_DEFINITIONS.en
};
