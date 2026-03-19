/**
 * CLT研究数据管理系统
 * 负责采集、存储、管理和导出实验数据
 * 支持多设备实时同步（使用 Firebase Firestore）
 */
// ============================================
// 🔥 Firebase 配置（多设备数据同步）
// ============================================
// Firebase 配置 - 请替换为您自己的 Firebase 项目配置
// 申请地址: https://console.firebase.google.com/
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDemo-REPLACE-WITH-YOUR-KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
let db = null;
let useFirebase = false;
let pendingData = [];
// 初始化 Firebase
function initializeFirebase() {
  try {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
      useFirebase = true;
      console.log('Firebase initialized successfully - Multi-device sync enabled');
      syncPendingData();
      return true;
    }
  } catch (error) {
    console.warn('Firebase initialization failed, falling back to localStorage:', error);
  }
  useFirebase = false;
  return false;
}
// 同步待提交的数据
async function syncPendingData() {
  if (!useFirebase || pendingData.length === 0) return;
  for (const data of pendingData) {
    await saveToFirestore(data);
  }
  pendingData = [];
}
// 保存到 Firestore
async function saveToFirestore(data) {
  if (!useFirebase || !db) return false;
  try {
    await db.collection('clt_research_data').add({
      ...data,
      serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log('Data saved to Firebase Firestore');
    return true;
  } catch (error) {
    console.error('Error saving to Firestore:', error);
    return false;
  }
}
// 从 Firestore 加载数据
async function loadFromFirestore() {
  if (!useFirebase || !db) return [];
  try {
    const snapshot = await db.collection('clt_research_data')
      .orderBy('timestamp', 'asc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error loading from Firestore:', error);
    return [];
  }
}
// 监听 Firestore 实时更新
function listenToFirestore(callback) {
  if (!useFirebase || !db) return null;
  return db.collection('clt_research_data')
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    }, error => {
      console.error('Firestore listener error:', error);
    });
}
// 从 Firestore 清除所有数据
async function clearFirestoreData() {
  if (!useFirebase || !db) return;
  try {
    const snapshot = await db.collection('clt_research_data').get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log('All Firestore data cleared');
  } catch (error) {
    console.error('Error clearing Firestore:', error);
  }
}
// ============================================
// 📊 数据管理系统
// ============================================
class DataManager {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionData = {
      sessionId: this.sessionId,
      startTime: new Date().toISOString(),
      responseTime: EXPERIMENT_VARIABLES.responseTime,
      language: EXPERIMENT_VARIABLES.language,
      userChoices: {
        departure: null,
        destination: null,
        date: null,
        insurance: null
      },
      decisionStartTime: null,
      decisionEndTime: null,
      surveyAnswers: {},
      timestamp: null
    };
    this.loadAllData();
    initializeFirebase();
  }
  // 生成唯一会话ID
  generateSessionId() {
    return 'SESSION_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  // 记录用户选择
  recordUserChoice(type, value) {
    this.sessionData.userChoices[type] = value;
    if (type === 'departure' && !this.sessionData.decisionStartTime) {
      this.sessionData.decisionStartTime = new Date();
    }
  }
  // 记录保险选择（决策结束）
  recordInsuranceChoice(insurance) {
    this.sessionData.userChoices.insurance = insurance;
    this.sessionData.decisionEndTime = new Date();
    this.sessionData.decisionTime = (this.sessionData.decisionEndTime - this.sessionData.decisionStartTime) / 1000; // 秒
  }
  // 记录问卷答案
  recordSurveyAnswer(questionId, answer, variable) {
    this.sessionData.surveyAnswers[questionId] = {
      answer: answer,
      variable: variable
    };
  }
  // 完成数据收集
  async completeSession() {
    this.sessionData.timestamp = new Date().toISOString();
    this.sessionData.endTime = new Date().toISOString();
    
    // 转换为ANOVA分析格式
    const analysisData = this.convertToAnalysisFormat();
    
    // 同时保存到 localStorage（本地备份）和 Firestore（云端同步）
    this.saveToLocalStorage(analysisData);
    
    if (useFirebase) {
      const saved = await saveToFirestore(analysisData);
      if (!saved) {
        pendingData.push(analysisData);
      }
    } else {
      pendingData.push(analysisData);
    }
    
    // 触发自定义事件以通知其他标签页
    window.dispatchEvent(new CustomEvent('dataUpdated', { detail: analysisData }));
    
    return analysisData;
  }
  // 转换为ANOVA分析格式
  convertToAnalysisFormat() {
    const data = {
      sessionId: this.sessionData.sessionId,
      responseTime: this.sessionData.responseTime,
      language: this.sessionData.language,
      decisionTime: this.sessionData.decisionTime || 0,
      
      // 自变量
      temporal_distance: this.getAnswerByVariable('temporal_distance'),
      spatial_distance: this.getAnswerByVariable('spatial_distance'),
      hypothetical_distance: this.getAnswerByVariable('hypothetical_distance'),
      social_distance: this.getAnswerByVariable('social_distance'),
      
      // 因变量
      insurance_choice: this.getAnswerByVariable('insurance_choice'),
      wtp_amount: this.getAnswerByVariable('wtp_amount'),
      wtp_acceptance: this.getAnswerByVariable('wtp_acceptance'),
      construal_level: this.getAnswerByVariable('construal_level'),
      
      // 控制变量
      risk_perception: this.getAnswerByVariable('risk_perception'),
      age_group: this.getAnswerByVariable('age_group'),
      
      // 操纵检验
      manipulation_check_temporal: this.getAnswerByVariable('manipulation_check_temporal'),
      manipulation_check_spatial: this.getAnswerByVariable('manipulation_check_spatial'),
      manipulation_check_speed: this.getAnswerByVariable('manipulation_check_speed'),
      
      // 实操数据
      departure: this.sessionData.userChoices.departure,
      destination: this.sessionData.userChoices.destination,
      date: this.sessionData.userChoices.date,
      
      // 时间戳
      timestamp: this.sessionData.timestamp
    };
    
    return data;
  }
  // 根据变量名获取答案
  getAnswerByVariable(variable) {
    for (const [questionId, data] of Object.entries(this.sessionData.surveyAnswers)) {
      if (data.variable === variable) {
        return data.answer;
      }
    }
    return null;
  }
  // 保存到本地存储
  saveToLocalStorage(data) {
    let allData = JSON.parse(localStorage.getItem('clt_research_data') || '[]');
    allData.push(data);
    localStorage.setItem('clt_research_data', JSON.stringify(allData));
  }
  // 加载所有数据
  async loadAllData() {
    if (useFirebase) {
      return await loadFromFirestore();
    }
    return JSON.parse(localStorage.getItem('clt_research_data') || '[]');
  }
  // 获取所有数据（同步版本，返回本地缓存）
  getAllData() {
    return JSON.parse(localStorage.getItem('clt_research_data') || '[]');
  }
  // 异步获取所有数据（从云端）
  async getAllDataAsync() {
    return await this.loadAllData();
  }
  // 实时监听数据变化
  listenToDataUpdates(callback) {
    if (useFirebase) {
      return listenToFirestore(callback);
    } else {
      // 降级：使用 storage 事件监听
      const handler = (e) => {
        if (e.key === 'clt_research_data') {
          callback(JSON.parse(e.newValue || '[]'));
        }
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    }
  }
  // 异步筛选数据
  async filterDataAsync(filters) {
    let data = await this.loadAllData();
    
    if (filters.temporal_distance) {
      data = data.filter(d => d.temporal_distance === filters.temporal_distance);
    }
    if (filters.spatial_distance) {
      data = data.filter(d => d.spatial_distance === filters.spatial_distance);
    }
    if (filters.responseTime) {
      data = data.filter(d => d.responseTime === filters.responseTime);
    }
    
    return data;
  }
  // 按条件筛选数据（同步版本，使用本地缓存）
  filterData(filters) {
    let data = this.getAllData();
    
    if (filters.temporal_distance) {
      data = data.filter(d => d.temporal_distance === filters.temporal_distance);
    }
    if (filters.spatial_distance) {
      data = data.filter(d => d.spatial_distance === filters.spatial_distance);
    }
    if (filters.responseTime) {
      data = data.filter(d => d.responseTime === filters.responseTime);
    }
    
    return data;
  }
  // 异步导出为CSV格式
  async exportToCSVAsync() {
    const data = await this.loadAllData();
    this.exportDataToCSV(data);
  }
  // 导出为CSV格式（通用方法）
  exportToCSV() {
    const data = useFirebase ? this.getAllData() : this.loadAllData();
    this.exportDataToCSV(data);
  }
  // 导出数据到 CSV
  exportDataToCSV(data) {
    if (data.length === 0) {
      alert('没有数据可导出');
      return;
    }
    // CSV头部
    const headers = [
      '会话ID',
      '响应时间(ms)',
      '语言',
      '决策时长(秒)',
      '时间距离',
      '空间距离',
      '假设距离',
      '社会距离',
      '保险选择',
      'WTP金额',
      '价格接受度',
      '构念水平',
      '风险感知',
      '年龄组',
      '时间距离感知',
      '空间距离感知',
      '网站速度感知',
      '出发地',
      '目的地',
      '出行日期',
      '提交时间'
    ];
    // CSV行
    const rows = data.map(d => [
      d.sessionId || d.id || '',
      d.responseTime || '',
      d.language || '',
      d.decisionTime || '',
      d.temporal_distance || '',
      d.spatial_distance || '',
      d.hypothetical_distance || '',
      d.social_distance || '',
      d.insurance_choice || '',
      d.wtp_amount || '',
      d.wtp_acceptance || '',
      d.construal_level || '',
      d.risk_perception || '',
      d.age_group || '',
      d.manipulation_check_temporal || '',
      d.manipulation_check_spatial || '',
      d.manipulation_check_speed || '',
      d.departure || '',
      d.destination || '',
      d.date || '',
      d.timestamp || ''
    ]);
    // 生成CSV内容
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell || ''}"`).join(',') + '\n';
    });
    // 下载
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `CLT_Research_Data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  // 导出为Excel格式（使用CSV作为中间格式）
  exportToExcel() {
    this.exportToCSV();
  }
  // 清空所有数据
  async clearAllData() {
    if (confirm('确定要清空所有数据吗？此操作不可撤销。')) {
      localStorage.removeItem('clt_research_data');
      if (useFirebase) {
        await clearFirestoreData();
      }
      alert('数据已清空');
    }
  }
  // 获取数据统计（异步版本）
  async getStatisticsAsync() {
    const data = await this.loadAllData();
    return this.calculateStatistics(data);
  }
  // 获取数据统计（同步版本）
  getStatistics() {
    const data = useFirebase ? this.getAllData() : this.loadAllData();
    return this.calculateStatistics(data);
  }
  // 计算统计数据
  calculateStatistics(data) {
    const stats = {
      totalRecords: data.length,
      insuranceDistribution: {},
      wtpAverage: 0,
      avgDecisionTime: 0
    };
    // 保险选择分布
    data.forEach(d => {
      stats.insuranceDistribution[d.insurance_choice] = (stats.insuranceDistribution[d.insurance_choice] || 0) + 1;
    });
    // WTP平均值
    const wtpValues = data.map(d => {
      if (d.wtp_amount === '0-20元') return 10;
      if (d.wtp_amount === '20-40元') return 30;
      if (d.wtp_amount === '40元以上') return 50;
      return 0;
    });
    stats.wtpAverage = wtpValues.reduce((a, b) => a + b, 0) / data.length || 0;
    // 平均决策时长
    const decisionTimes = data.map(d => d.decisionTime || 0);
    stats.avgDecisionTime = decisionTimes.reduce((a, b) => a + b, 0) / data.length || 0;
    return stats;
  }
}
// 全局数据管理器实例
let dataManager = new DataManager();
