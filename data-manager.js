/**
 * CLT研究数据管理系统 V2
 * 负责采集、存储、管理和导出实验数据
 * 支持多设备实时同步（使用 Firebase Firestore）
 */

// ============================================
// 🔥 Firebase 配置（多设备数据同步）
// ============================================

// ⚠️ 请将以下占位符替换为您自己的 Firebase 项目配置
// 申请地址: https://console.firebase.google.com/
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBGi7uyQkCoyIoXGKIcCdDXojgwQ0pl2nY",
  authDomain: "clt-research-website.firebaseapp.com",
  projectId: "clt-research-website",
  storageBucket: "clt-research-website.firebasestorage.app",
  messagingSenderId: "71205781808",
  appId: "1:71205781808:web:9ec2aa427a1a6e11efc8f5"
};

let db = null;
let useFirebase = false;
let pendingData = [];
let firebaseInitialized = false;
const PENDING_DATA_KEY = 'clt_pending_sync_data';

function loadPendingDataFromStorage() {
  try {
    pendingData = JSON.parse(localStorage.getItem(PENDING_DATA_KEY) || '[]');
  } catch (error) {
    console.error('❌ Error loading pending sync data:', error);
    pendingData = [];
  }
}

function persistPendingData() {
  try {
    localStorage.setItem(PENDING_DATA_KEY, JSON.stringify(pendingData));
  } catch (error) {
    console.error('❌ Error persisting pending sync data:', error);
  }
}

function queuePendingData(data) {
  const exists = pendingData.some(item => item.sessionId === data.sessionId);
  if (!exists) {
    pendingData.push(data);
    persistPendingData();
    console.log('📦 Submission queued for later sync:', data.sessionId);
  }
}

function removePendingData(sessionId) {
  pendingData = pendingData.filter(item => item.sessionId !== sessionId);
  persistPendingData();
}

function initializeFirebase() {
  if (firebaseInitialized) return useFirebase;
  loadPendingDataFromStorage();
  
  try {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
      useFirebase = true;
      firebaseInitialized = true;
      console.log('✅ Firebase initialized successfully - Multi-device sync enabled');
      syncPendingData();
      return true;
    } else {
      console.warn('⚠️ Firebase SDK not loaded, falling back to localStorage only');
    }
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    console.log('📱 Falling back to localStorage - data will NOT sync across devices');
  }
  useFirebase = false;
  firebaseInitialized = true;
  return false;
}

async function syncPendingData() {
  if (!useFirebase || pendingData.length === 0) return;
  console.log(`📤 Syncing ${pendingData.length} pending records to Firebase...`);
  const queuedItems = [...pendingData];
  for (const data of queuedItems) {
    const saved = await saveToFirestore(data);
    if (saved) {
      removePendingData(data.sessionId);
    }
  }
  console.log(`✅ Pending sync complete. ${pendingData.length} records remaining.`);
}

async function saveToFirestoreWithRetry(data, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const saved = await saveToFirestore(data);
    if (saved) {
      return true;
    }
    if (attempt < retries) {
      console.warn(`⚠️ Firestore save retry ${attempt}/${retries - 1} for`, data.sessionId);
      await new Promise(resolve => setTimeout(resolve, attempt * 1200));
    }
  }
  return false;
}

async function saveToFirestore(data) {
  if (!useFirebase || !db) return false;
  try {
    const docRef = await db.collection('clt_research_data').add({
      ...data,
      serverTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
      clientTimestamp: data.timestamp || new Date().toISOString()
    });
    console.log('✅ Data saved to Firebase:', docRef.id);
    return true;
  } catch (error) {
    console.error('❌ Error saving to Firestore:', error);
    return false;
  }
}

async function loadFromFirestore() {
  if (!useFirebase || !db) return [];
  try {
    const snapshot = await db.collection('clt_research_data')
      .orderBy('clientTimestamp', 'desc')
      .get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`📥 Loaded ${data.length} records from Firebase`);
    return data;
  } catch (error) {
    console.error('❌ Error loading from Firestore:', error);
    return [];
  }
}

function listenToFirestore(callback) {
  if (!useFirebase || !db) return null;
  console.log('👂 Firebase real-time listener started');
  return db.collection('clt_research_data')
    .orderBy('clientTimestamp', 'desc')
    .onSnapshot(snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`🔄 Firebase data updated: ${data.length} records`);
      callback(data);
    }, error => {
      console.error('❌ Firestore listener error:', error);
    });
}

async function clearFirestoreData() {
  if (!useFirebase || !db) return;
  try {
    const snapshot = await db.collection('clt_research_data').get();
    if (snapshot.docs.length === 0) {
      console.log('ℹ️ No data in Firestore to clear');
      return;
    }
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log('✅ All Firestore data cleared');
  } catch (error) {
    console.error('❌ Error clearing Firestore:', error);
  }
}

// ============================================
// ⚙️ 实验设置同步（跨设备）
// ============================================

async function saveSettingsToFirestore(settings) {
  if (!useFirebase || !db) {
    localStorage.setItem('experiment_settings', JSON.stringify(settings));
    return false;
  }
  try {
    await db.collection('experiment_settings').doc('main').set({
      ...settings,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'device_' + navigator.userAgent.slice(-8)
    });
    console.log('✅ Settings saved to cloud:', settings);
    return true;
  } catch (error) {
    console.error('❌ Error saving settings:', error);
    localStorage.setItem('experiment_settings', JSON.stringify(settings));
    return false;
  }
}

async function loadSettingsFromFirestore() {
  if (!useFirebase || !db) {
    return JSON.parse(localStorage.getItem('experiment_settings') || 'null');
  }
  try {
    const doc = await db.collection('experiment_settings').doc('main').get();
    if (doc.exists) {
      const settings = doc.data();
      delete settings.lastUpdated;
      delete settings.updatedBy;
      console.log('✅ Settings loaded from cloud:', settings);
      return settings;
    }
  } catch (error) {
    console.error('❌ Error loading settings:', error);
  }
  return JSON.parse(localStorage.getItem('experiment_settings') || 'null');
}

function listenToSettingsChanges(callback) {
  if (!useFirebase || !db) {
    window.addEventListener('storage', (e) => {
      if (e.key === 'experiment_settings') {
        callback(JSON.parse(e.newValue || '{}'));
      }
    });
    return () => {};
  }
  console.log('👂 Settings listener started');
  return db.collection('experiment_settings').doc('main')
    .onSnapshot(doc => {
      if (doc.exists) {
        const settings = doc.data();
        delete settings.lastUpdated;
        delete settings.updatedBy;
        console.log('🔄 Settings updated from cloud:', settings);
        callback(settings);
      }
    }, error => {
      console.error('❌ Settings listener error:', error);
    });
}

// ============================================
// 📊 数据管理系统
// ============================================
class DataManager {
  constructor() {
    this.sessionId = this.generateSessionId();
    const responseTime = typeof EXPERIMENT_VARIABLES !== 'undefined' ? EXPERIMENT_VARIABLES.responseTime : 1000;
    const language = typeof EXPERIMENT_VARIABLES !== 'undefined' ? EXPERIMENT_VARIABLES.language : 'zh';
    
    this.sessionData = {
      sessionId: this.sessionId,
      startTime: new Date().toISOString(),
      responseTime: responseTime,
      language: language,
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
    this.allCloudData = [];
    this.loadAllData();
    initializeFirebase();
  }

  generateSessionId() {
    return 'SESSION_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  recordUserChoice(type, value) {
    this.sessionData.userChoices[type] = value;
    if (type === 'departure' && !this.sessionData.decisionStartTime) {
      this.sessionData.decisionStartTime = new Date();
    }
  }

  recordInsuranceChoice(insurance) {
    this.sessionData.userChoices.insurance = insurance;
    this.sessionData.decisionEndTime = new Date();
    this.sessionData.decisionTime = (this.sessionData.decisionEndTime - this.sessionData.decisionStartTime) / 1000;
  }

  recordSurveyAnswer(questionId, answer, variable) {
    this.sessionData.surveyAnswers[questionId] = {
      answer: answer,
      variable: variable
    };
  }

  async completeSession() {
    this.sessionData.timestamp = new Date().toISOString();
    this.sessionData.endTime = new Date().toISOString();
    
    const analysisData = this.convertToAnalysisFormat();
    
    this.saveToLocalStorage(analysisData);
    let savedToCloud = false;
    
    if (useFirebase) {
      savedToCloud = await saveToFirestoreWithRetry(analysisData);
    } else {
      console.warn('⚠️ Firebase unavailable, queueing submission locally');
    }

    if (!savedToCloud) {
      queuePendingData(analysisData);
    } else {
      removePendingData(analysisData.sessionId);
    }
    
    window.dispatchEvent(new CustomEvent('dataUpdated', { detail: analysisData }));
    
    return {
      data: analysisData,
      savedToCloud,
      queuedForSync: !savedToCloud
    };
  }

  convertToAnalysisFormat() {
    const data = {
      sessionId: this.sessionData.sessionId,
      responseTime: this.sessionData.responseTime,
      language: this.sessionData.language,
      decisionTime: this.sessionData.decisionTime || 0,
      temporal_distance: this.getAnswerByVariable('temporal_distance'),
      spatial_distance: this.getAnswerByVariable('spatial_distance'),
      hypothetical_distance: this.getAnswerByVariable('hypothetical_distance'),
      social_distance: this.getAnswerByVariable('social_distance'),
      insurance_choice: this.getAnswerByVariable('insurance_choice'),
      wtp_amount: this.getAnswerByVariable('wtp_amount'),
      wtp_acceptance: this.getAnswerByVariable('wtp_acceptance'),
      construal_level: this.getAnswerByVariable('construal_level'),
      risk_perception: this.getAnswerByVariable('risk_perception'),
      age_group: this.getAnswerByVariable('age_group'),
      manipulation_check_temporal: this.getAnswerByVariable('manipulation_check_temporal'),
      manipulation_check_spatial: this.getAnswerByVariable('manipulation_check_spatial'),
      manipulation_check_speed: this.getAnswerByVariable('manipulation_check_speed'),
      departure: this.sessionData.userChoices.departure,
      destination: this.sessionData.userChoices.destination,
      date: this.sessionData.userChoices.date,
      timestamp: this.sessionData.timestamp
    };
    
    return data;
  }

  getAnswerByVariable(variable) {
    for (const [questionId, data] of Object.entries(this.sessionData.surveyAnswers)) {
      if (data.variable === variable) {
        return data.answer;
      }
    }
    return null;
  }

  saveToLocalStorage(data) {
    try {
      let allData = JSON.parse(localStorage.getItem('clt_research_data') || '[]');
      const exists = allData.some(d => d.sessionId === data.sessionId);
      if (!exists) {
        allData.push(data);
        localStorage.setItem('clt_research_data', JSON.stringify(allData));
        console.log('💾 Data saved to localStorage');
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  async loadAllData() {
    if (useFirebase) {
      this.allCloudData = await loadFromFirestore();
      return this.allCloudData;
    }
    return JSON.parse(localStorage.getItem('clt_research_data') || '[]');
  }

  getAllData() {
    if (useFirebase) {
      return this.allCloudData;
    }
    return JSON.parse(localStorage.getItem('clt_research_data') || '[]');
  }

  async getAllDataAsync() {
    return await this.loadAllData();
  }

  async refreshCloudData() {
    if (useFirebase) {
      this.allCloudData = await loadFromFirestore();
      return this.allCloudData;
    }
    return this.getAllData();
  }

  listenToDataUpdates(callback) {
    if (useFirebase) {
      return listenToFirestore(callback);
    } else {
      const handler = (e) => {
        if (e.key === 'clt_research_data') {
          callback(JSON.parse(e.newValue || '[]'));
        }
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    }
  }

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

  async exportToCSVAsync() {
    const data = await this.loadAllData();
    this.exportDataToCSV(data);
  }

  exportToCSV() {
    const data = this.getAllData();
    if (useFirebase && data.length === 0) {
      this.refreshCloudData().then(() => {
        this.exportDataToCSV(this.allCloudData);
      });
    } else {
      this.exportDataToCSV(data);
    }
  }

  exportDataToCSV(data) {
    if (data.length === 0) {
      alert('没有数据可导出');
      return;
    }

    const headers = [
      '会话ID', '响应时间(ms)', '语言', '决策时长(秒)',
      '时间距离', '空间距离', '假设距离', '社会距离',
      '保险选择', 'WTP金额', '价格接受度', '构念水平',
      '风险感知', '年龄组', '时间距离感知', '空间距离感知', '网站速度感知',
      '出发地', '目的地', '出行日期', '提交时间'
    ];

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
      d.timestamp || d.clientTimestamp || ''
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell || ''}"`).join(',') + '\n';
    });

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

  exportToExcel() {
    this.exportToCSV();
  }

  async clearAllData() {
    if (confirm('确定要清空所有数据吗？此操作不可撤销。')) {
      localStorage.removeItem('clt_research_data');
      if (useFirebase) {
        await clearFirestoreData();
      }
      this.allCloudData = [];
      alert('数据已清空');
    }
  }

  async getStatisticsAsync() {
    const data = await this.loadAllData();
    return this.calculateStatistics(data);
  }

  getStatistics() {
    const data = this.getAllData();
    return this.calculateStatistics(data);
  }

  calculateStatistics(data) {
    const stats = {
      totalRecords: data.length,
      insuranceDistribution: {},
      wtpAverage: 0,
      avgDecisionTime: 0
    };

    data.forEach(d => {
      stats.insuranceDistribution[d.insurance_choice] = (stats.insuranceDistribution[d.insurance_choice] || 0) + 1;
    });

    const wtpValues = data.map(d => {
      if (d.wtp_amount === '0-20元') return 10;
      if (d.wtp_amount === '20-40元') return 30;
      if (d.wtp_amount === '40元以上') return 50;
      return 0;
    });
    stats.wtpAverage = wtpValues.reduce((a, b) => a + b, 0) / data.length || 0;

    const decisionTimes = data.map(d => d.decisionTime || 0);
    stats.avgDecisionTime = decisionTimes.reduce((a, b) => a + b, 0) / data.length || 0;

    return stats;
  }

  isFirebaseEnabled() {
    return useFirebase;
  }

  async saveSettings(settings) {
    await saveSettingsToFirestore(settings);
  }

  async loadSettings() {
    return await loadSettingsFromFirestore();
  }

  listenToSettingsChanges(callback) {
    return listenToSettingsChanges(callback);
  }
}

// 全局数据管理器实例
let dataManager = new DataManager();
