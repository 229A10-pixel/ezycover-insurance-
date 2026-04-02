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
// 📋 CLT研究核心问卷配置（10题）
// ============================================
const CLT_SURVEY_QUESTIONS = {
  zh: [
    // 问卷说明
    {
      id: 'intro',
      type: 'intro',
      text: '感谢您参与本次研究！本问卷仅用于学术研究，答案无对错，请根据您的真实感受作答。'
    },
    
    // 自变量 - 时间距离
    {
      id: 'q1',
      text: '您本次选择的出行时间是？',
      type: 'multiple_choice',
      options: ['3天后（近时间距离）', '1个月后（远时间距离）'],
      variable: 'temporal_distance'
    },
    
    // 自变量 - 空间距离
    {
      id: 'q2',
      text: '您本次选择的旅游目的地属于？',
      type: 'multiple_choice',
      options: ['国内（近空间距离）', '海外（远空间距离）'],
      variable: 'spatial_distance'
    },
    
    // 自变量 - 假设距离
    {
      id: 'q3',
      text: '您本次出行的确定性如何？',
      type: 'multiple_choice',
      options: ['已确定出行（高假设距离）', '仅模拟规划（低假设距离）'],
      variable: 'hypothetical_distance'
    },
    
    // 自变量 - 社会距离
    {
      id: 'q4',
      text: '您是为谁购买保险？',
      type: 'multiple_choice',
      options: ['自己（近社会距离）', '家人/朋友（远社会距离）'],
      variable: 'social_distance'
    },
    
    // 因变量 - 保险购买倾向
    {
      id: 'q5',
      text: '您最终选择的保险等级是？',
      type: 'multiple_choice',
      options: ['不购买', 'Basic（基础级）', 'Premium（进阶级）', 'Luxury（豪华级）'],
      variable: 'insurance_choice'
    },
    
    // 因变量 - WTP（支付意愿）
    {
      id: 'q6',
      text: '您最多愿意为所选保险每天支付多少元？',
      type: 'multiple_choice',
      options: ['0-20元', '20-40元', '40元以上'],
      variable: 'wtp_amount'
    },
    
    // 因变量 - WTP（接受程度）
    {
      id: 'q7',
      text: '您对所选保险价格的接受程度？',
      scale: 5,
      scaleLabels: ['1分（极不愿意）', '2分', '3分', '4分', '5分（非常愿意）'],
      variable: 'wtp_acceptance'
    },
    
    // 因变量 - 构念水平感知
    {
      id: 'q8',
      text: '您在选择保险时更关注？',
      scale: 5,
      scaleLabels: ['1分（仅关注价格/条款等具体细节）', '2分', '3分', '4分', '5分（仅关注安全/安心等抽象价值）'],
      variable: 'construal_level'
    },
    
    // 控制变量 - 风险感知
    {
      id: 'q9',
      text: '您对旅游/飞行风险的感知程度？',
      scale: 5,
      scaleLabels: ['1分（风险极低）', '2分', '3分', '4分', '5分（风险极高）'],
      variable: 'risk_perception'
    },
    
    // 控制变量 - 人口统计
    {
      id: 'q10',
      text: '您的年龄区间是？',
      type: 'multiple_choice',
      options: ['18岁以下', '18-25岁', '26-35岁', '36岁及以上'],
      variable: 'age_group'
    },
    
    // 操纵检验 - 时间距离感知
    {
      id: 'q11',
      text: '您感觉这次出行的时间离现在很近。',
      scale: 5,
      scaleLabels: ['1分（完全不同意）', '2分', '3分', '4分', '5分（非常同意）'],
      variable: 'manipulation_check_temporal'
    },
    
    // 操纵检验 - 空间距离感知
    {
      id: 'q12',
      text: '您感觉这次旅行的目的地离您很近。',
      scale: 5,
      scaleLabels: ['1分（完全不同意）', '2分', '3分', '4分', '5分（非常同意）'],
      variable: 'manipulation_check_spatial'
    },
    
    // 操纵检验 - 网站速度感知
    {
      id: 'q13',
      text: '您觉得本网站的查询 / 加载速度很快。',
      scale: 5,
      scaleLabels: ['1分（完全不同意）', '2分', '3分', '4分', '5分（非常同意）'],
      variable: 'manipulation_check_speed'
    }
  ],
  en: [
    // Survey Introduction
    {
      id: 'intro',
      type: 'intro',
      text: 'Thank you for participating in this research! This survey is for academic purposes only. There are no right or wrong answers. Please answer based on your genuine experience.'
    },
    
    // Independent Variable - Temporal Distance
    {
      id: 'q1',
      text: 'What is your travel time for this trip?',
      type: 'multiple_choice',
      options: ['In 3 days (Near temporal distance)', 'In 1 month (Far temporal distance)'],
      variable: 'temporal_distance'
    },
    
    // Independent Variable - Spatial Distance
    {
      id: 'q2',
      text: 'Is your travel destination?',
      type: 'multiple_choice',
      options: ['Domestic (Near spatial distance)', 'Overseas (Far spatial distance)'],
      variable: 'spatial_distance'
    },
    
    // Independent Variable - Hypothetical Distance
    {
      id: 'q3',
      text: 'How certain is your trip?',
      type: 'multiple_choice',
      options: ['Confirmed trip (High hypothetical distance)', 'Simulated planning (Low hypothetical distance)'],
      variable: 'hypothetical_distance'
    },
    
    // Independent Variable - Social Distance
    {
      id: 'q4',
      text: 'Who are you buying insurance for?',
      type: 'multiple_choice',
      options: ['Myself (Near social distance)', 'Family/Friends (Far social distance)'],
      variable: 'social_distance'
    },
    
    // Dependent Variable - Insurance Choice
    {
      id: 'q5',
      text: 'What insurance level did you choose?',
      type: 'multiple_choice',
      options: ['No Insurance', 'Basic Level', 'Premium Level', 'Luxury Level'],
      variable: 'insurance_choice'
    },
    
    // Dependent Variable - WTP (Amount)
    {
      id: 'q6',
      text: 'What is the maximum you are willing to pay per day for insurance?',
      type: 'multiple_choice',
      options: ['0-20 yuan', '20-40 yuan', '40+ yuan'],
      variable: 'wtp_amount'
    },
    
    // Dependent Variable - WTP (Acceptance)
    {
      id: 'q7',
      text: 'How acceptable is the price of your chosen insurance?',
      scale: 5,
      scaleLabels: ['1 (Very Unwilling)', '2', '3', '4', '5 (Very Willing)'],
      variable: 'wtp_acceptance'
    },
    
    // Dependent Variable - Construal Level
    {
      id: 'q8',
      text: 'When choosing insurance, what do you focus on?',
      scale: 5,
      scaleLabels: ['1 (Focus on specific details like price/terms)', '2', '3', '4', '5 (Focus on abstract values like safety/peace of mind)'],
      variable: 'construal_level'
    },
    
    // Control Variable - Risk Perception
    {
      id: 'q9',
      text: 'How do you perceive travel/flight risks?',
      scale: 5,
      scaleLabels: ['1 (Very Low Risk)', '2', '3', '4', '5 (Very High Risk)'],
      variable: 'risk_perception'
    },
    
    // Control Variable - Demographics
    {
      id: 'q10',
      text: 'What is your age group?',
      type: 'multiple_choice',
      options: ['Under 18', '18-25', '26-35', '36+'],
      variable: 'age_group'
    },
    
    // Manipulation Check - Temporal Distance Perception
    {
      id: 'q11',
      text: 'I feel that this trip is very close in time to now.',
      scale: 5,
      scaleLabels: ['1 (Completely Disagree)', '2', '3', '4', '5 (Strongly Agree)'],
      variable: 'manipulation_check_temporal'
    },
    
    // Manipulation Check - Spatial Distance Perception
    {
      id: 'q12',
      text: 'I feel that the destination of this trip is very close to me.',
      scale: 5,
      scaleLabels: ['1 (Completely Disagree)', '2', '3', '4', '5 (Strongly Agree)'],
      variable: 'manipulation_check_spatial'
    },
    
    // Manipulation Check - Website Speed Perception
    {
      id: 'q13',
      text: 'I think the query/loading speed of this website is very fast.',
      scale: 5,
      scaleLabels: ['1 (Completely Disagree)', '2', '3', '4', '5 (Strongly Agree)'],
      variable: 'manipulation_check_speed'
    }
  ]
};
