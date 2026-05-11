/**
 * CLT研究数据管理系统 V3 (Firebase 版)
 * 负责采集、存储、管理和导出实验数据
 * 支持多设备实时同步（使用 Firebase Firestore）
 */

// ============================================
// ☁️ Firebase 配置
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyBGi7uyQkCoyIoXGKIcCdDXojgwQ0pl2nY",
  authDomain: "clt-research-website.firebaseapp.com",
  projectId: "clt-research-website",
  storageBucket: "clt-research-website.firebasestorage.app",
  messagingSenderId: "71205781808",
  appId: "1:71205781808:web:9ec2aa427a1a6e11efc8f5"
};

// ============================================
// 📦 Firebase SDK 初始化状态
// ============================================

let firebaseInitialized = false;
let firestoreDb = null;
let useFirebase = false;

function checkFirebaseAvailable() {
  return typeof firebase !== 'undefined' && firebase.apps;
}

async function initializeFirebase() {
  if (firebaseInitialized) return useFirebase;

  loadPendingDataFromStorage();
  clearLegacyBackupData();

  if (!checkFirebaseAvailable()) {
    console.warn('⚠️ Firebase SDK not loaded. Falling back to localStorage only.');
    useFirebase = false;
    firebaseInitialized = true;
    return false;
  }

  try {
    if (firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
    }
    firestoreDb = firebase.firestore();
    await firestoreDb.enablePersistence({ synchronizeTabs: true });
    useFirebase = true;
    console.log('✅ Firebase Firestore initialized - Multi-device sync enabled');
    syncPendingData();
  } catch (error) {
    console.error('❌ Firebase init error:', error);
    useFirebase = false;
  }

  firebaseInitialized = true;
  return useFirebase;
}

// ============================================
// 📦 本地离线队列
// ============================================

const PENDING_DATA_KEY = 'clt_pending_sync_data';
const RESEARCH_DATA_KEY = 'clt_research_data_v2';
const LEGACY_RESEARCH_DATA_KEY = 'clt_research_data';

let pendingData = [];

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
  const recordKey = getRecordKey(data);
  const exists = pendingData.some(item => getRecordKey(item) === recordKey);
  if (!exists) {
    pendingData.push(data);
    persistPendingData();
    console.log('📦 Submission queued for later sync:', recordKey);
  }
}

function removePendingData(sessionId) {
  pendingData = pendingData.filter(item => getRecordKey(item) !== sessionId);
  persistPendingData();
}

function clearLegacyBackupData() {
  try {
    localStorage.removeItem(LEGACY_RESEARCH_DATA_KEY);
  } catch (error) {
    console.error('❌ Error clearing legacy backup data:', error);
  }
}

// ============================================
// 🗂️ Firestore Collection 名称
// ============================================

const DATA_COLLECTION = 'clt_research_data';
const SETTINGS_DOC = 'experiment_settings';

// ============================================
// 🔑 记录主键
// ============================================

function getRecordKey(record) {
  return record?.user_id || record?.sessionId || record?.id || '';
}

// ============================================
// ☁️ Firestore 数据操作
// ============================================

async function saveToFirestore(data) {
  if (!useFirebase || !firestoreDb) return false;

  const recordKey = getRecordKey(data);
  const docRef = firestoreDb.collection(DATA_COLLECTION).doc(recordKey);

  try {
    await docRef.set(data, { merge: true });
    console.log('✅ Data saved to Firestore:', recordKey);
    return true;
  } catch (error) {
    console.error('❌ Firestore save error:', error);
    return false;
  }
}

async function loadFromFirestore() {
  if (!useFirebase || !firestoreDb) return [];

  try {
    const snapshot = await firestoreDb.collection(DATA_COLLECTION)
      .orderBy('submit_time', 'desc')
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      data.id = doc.id;
      return data;
    });
  } catch (error) {
    console.error('❌ Firestore load error:', error);
    return [];
  }
}

function listenToFirestore(callback) {
  if (!useFirebase || !firestoreDb) return null;

  console.log('👂 Firestore real-time listener started');
  let unsubscribe = null;

  unsubscribe = firestoreDb.collection(DATA_COLLECTION)
    .orderBy('submit_time', 'desc')
    .onSnapshot(
      (snapshot) => {
        const data = snapshot.docs.map(doc => {
          const d = doc.data();
          d.id = doc.id;
          return d;
        });
        callback(data);
      },
      (error) => {
        console.error('❌ Firestore listener error:', error);
      }
    );

  return () => {
    if (unsubscribe) {
      unsubscribe();
      console.log('🔇 Firestore listener stopped');
    }
  };
}

async function clearFirestoreData() {
  if (!useFirebase || !firestoreDb) return;

  try {
    const snapshot = await firestoreDb.collection(DATA_COLLECTION).get();
    const batch = firestoreDb.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log('✅ All cloud data cleared');
  } catch (error) {
    console.error('❌ Error clearing cloud data:', error);
  }
}

async function deleteFirestoreRecord(recordKey) {
  if (!useFirebase || !firestoreDb) return false;

  try {
    await firestoreDb.collection(DATA_COLLECTION).doc(recordKey).delete();
    console.log('✅ Firestore record deleted:', recordKey);
    return true;
  } catch (error) {
    console.error('❌ Error deleting Firestore record:', error);
    return false;
  }
}

// ============================================
// 🔄 离线队列同步
// ============================================

async function syncPendingData() {
  if (!useFirebase || pendingData.length === 0) return;

  console.log(`📤 Syncing ${pendingData.length} pending records to cloud...`);
  const queuedItems = [...pendingData];

  for (const data of queuedItems) {
    const saved = await saveToFirestore(data);
    if (saved) {
      removePendingData(getRecordKey(data));
    }
  }

  console.log(`✅ Pending sync complete. ${pendingData.length} records remaining.`);
}

async function saveToFirestoreWithRetry(data, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const saved = await saveToFirestore(data);
    if (saved) return true;
    if (attempt < retries) {
      console.warn(`⚠️ Firestore save retry ${attempt}/${retries - 1} for`, getRecordKey(data));
      await new Promise(resolve => setTimeout(resolve, attempt * 1200));
    }
  }
  return false;
}

// ============================================
// ⚙️ 实验设置同步
// ============================================

async function saveSettingsToFirestore(settings) {
  localStorage.setItem('experiment_settings', JSON.stringify(settings));
  if (!useFirebase || !firestoreDb) return false;

  try {
    await firestoreDb.collection(SETTINGS_DOC).doc('main').set({
      responseTime: settings.responseTime ?? null,
      language: settings.language ?? null,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log('✅ Settings saved to Firestore:', settings);
    return true;
  } catch (error) {
    console.error('❌ Error saving settings:', error);
    return false;
  }
}

async function loadSettingsFromFirestore() {
  const localSettings = JSON.parse(localStorage.getItem('experiment_settings') || 'null');
  if (!useFirebase || !firestoreDb) return localSettings;

  try {
    const doc = await firestoreDb.collection(SETTINGS_DOC).doc('main').get();
    if (doc.exists) {
      const data = doc.data();
      const settings = {
        responseTime: data.responseTime,
        language: data.language
      };
      console.log('✅ Settings loaded from Firestore:', settings);
      return settings;
    }
  } catch (error) {
    console.error('❌ Error loading settings:', error);
  }
  return localSettings;
}

function listenToSettingsChanges(callback) {
  if (!useFirebase || !firestoreDb) return null;

  let lastSerialized = null;
  let unsubscribe = null;

  unsubscribe = firestoreDb.collection(SETTINGS_DOC).doc('main')
    .onSnapshot(
      (doc) => {
        if (doc.exists) {
          const settings = doc.data();
          const serialized = JSON.stringify(settings);
          if (serialized !== lastSerialized) {
            lastSerialized = serialized;
            callback({
              responseTime: settings.responseTime,
              language: settings.language
            });
          }
        }
      },
      (error) => {
        console.error('❌ Settings listener error:', error);
      }
    );

  return () => {
    if (unsubscribe) unsubscribe();
  };
}

// ============================================
// 🛠️ 辅助函数
// ============================================

function escapeCsvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

function mergeDataSets(primary = [], secondary = []) {
  const seen = new Set();
  const merged = [];

  [...primary, ...secondary].forEach(item => {
    const key = item?.user_id || item?.sessionId || item?.id;
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });

  return merged;
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
    const key = variable || questionId;
    this.sessionData.surveyAnswers[key] = answer;
  }

  async completeSession(submitTimestamp) {
    const ts = submitTimestamp instanceof Date ? submitTimestamp : new Date();
    this.sessionData.timestamp = ts.toISOString();
    this.sessionData.endTime = ts.toISOString();
    this.sessionData.submitTimestamp = ts;

    const analysisData = this.convertToAnalysisFormat();

    this.saveToLocalStorage(analysisData);
    let savedToCloud = false;

    if (useFirebase) {
      savedToCloud = await saveToFirestore(analysisData);
    } else {
      console.warn('⚠️ Firebase unavailable, queueing submission locally');
    }

    if (!savedToCloud) {
      queuePendingData(analysisData);
    } else {
      removePendingData(getRecordKey(analysisData));
    }

    console.log('📤 completeSession result:', {
      recordKey: getRecordKey(analysisData),
      savedToCloud,
      queuedForSync: !savedToCloud
    });

    window.dispatchEvent(new CustomEvent('dataUpdated', { detail: analysisData }));

    return {
      data: analysisData,
      savedToCloud,
      queuedForSync: !savedToCloud
    };
  }

  convertToAnalysisFormat() {
    const survey = this.sessionData.surveyAnswers;
    const choices = this.sessionData.userChoices;

    return {
      user_id: this.sessionData.sessionId,
      session_id: this.sessionData.sessionId,
      loading_time: this.sessionData.responseTime,
      insurance_choice: choices.insurance || '',
      departure: choices.departure || '',
      destination: choices.destination || '',
      travel_date: choices.date || '',
      gender: survey.gender || '',
      age: survey.age || '',
      edu: survey.edu || '',
      travel_exp: survey.travel_exp || '',
      time1: survey.time1 || '',
      time2: survey.time2 || '',
      time3: survey.time3 || '',
      space1: survey.space1 || '',
      space2: survey.space2 || '',
      space3: survey.space3 || '',
      social1: survey.social1 || '',
      social2: survey.social2 || '',
      social3: survey.social3 || '',
      hypo1: survey.hypo1 || '',
      hypo2: survey.hypo2 || '',
      hypo3: survey.hypo3 || '',
      speed1: survey.speed1 || '',
      speed2: survey.speed2 || '',
      speed3: survey.speed3 || '',
      cl1: survey.cl1 || '',
      cl2: survey.cl2 || '',
      cl3: survey.cl3 || '',
      int1: survey.int1 || '',
      int2: survey.int2 || '',
      int3: survey.int3 || '',
      wtp1: survey.wtp1 || '',
      wtp2: survey.wtp2 || '',
      wtp3: survey.wtp3 || '',
      submit_time: this.sessionData.timestamp
    };
  }

  getAnswerByVariable(variable) {
    const value = this.sessionData.surveyAnswers[variable];
    return value === undefined ? null : value;
  }

  saveToLocalStorage(data) {
    try {
      let allData = JSON.parse(localStorage.getItem(RESEARCH_DATA_KEY) || '[]');
      const recordKey = getRecordKey(data);
      const exists = allData.some(d => getRecordKey(d) === recordKey);
      if (!exists) {
        allData.push(data);
        localStorage.setItem(RESEARCH_DATA_KEY, JSON.stringify(allData));
        console.log('💾 Data saved to localStorage');
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  async loadAllData() {
    if (useFirebase) {
      this.allCloudData = await loadFromFirestore();
      const localData = JSON.parse(localStorage.getItem(RESEARCH_DATA_KEY) || '[]');
      return mergeDataSets(this.allCloudData, localData);
    }
    return JSON.parse(localStorage.getItem(RESEARCH_DATA_KEY) || '[]');
  }

  getAllData() {
    if (useFirebase) {
      const localData = JSON.parse(localStorage.getItem(RESEARCH_DATA_KEY) || '[]');
      return mergeDataSets(this.allCloudData, localData);
    }
    return JSON.parse(localStorage.getItem(RESEARCH_DATA_KEY) || '[]');
  }

  async getAllDataAsync() {
    return await this.loadAllData();
  }

  async refreshCloudData() {
    if (useFirebase) {
      this.allCloudData = await loadFromFirestore();
      const localData = JSON.parse(localStorage.getItem(RESEARCH_DATA_KEY) || '[]');
      return mergeDataSets(this.allCloudData, localData);
    }
    return this.getAllData();
  }

  listenToDataUpdates(callback) {
    if (useFirebase) {
      return listenToFirestore(callback);
    } else {
      const handler = (e) => {
        if (e.key === RESEARCH_DATA_KEY) {
          callback(JSON.parse(e.newValue || '[]'));
        }
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    }
  }

  async filterDataAsync(filters) {
    let data = await this.loadAllData();
    if (filters.loading_time) {
      data = data.filter(d => d.loading_time === filters.loading_time);
    }
    if (filters.insurance_choice) {
      data = data.filter(d => d.insurance_choice === filters.insurance_choice);
    }
    return data;
  }

  filterData(filters) {
    let data = this.getAllData();
    if (filters.loading_time) {
      data = data.filter(d => d.loading_time === filters.loading_time);
    }
    if (filters.insurance_choice) {
      data = data.filter(d => d.insurance_choice === filters.insurance_choice);
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
      'user_id', 'loading_time', 'insurance_choice', 'departure', 'destination', 'travel_date',
      'gender', 'age', 'edu', 'travel_exp',
      'time1', 'time2', 'time3',
      'space1', 'space2', 'space3',
      'social1', 'social2', 'social3',
      'hypo1', 'hypo2', 'hypo3',
      'speed1', 'speed2', 'speed3',
      'cl1', 'cl2', 'cl3',
      'int1', 'int2', 'int3',
      'wtp1', 'wtp2', 'wtp3',
      'submit_time'
    ];

    const rows = data.map(d => [
      d.user_id || d.sessionId || d.id || '',
      d.loading_time ?? d.responseTime ?? '',
      d.insurance_choice || '',
      d.departure || '',
      d.destination || '',
      d.travel_date || '',
      d.gender || '',
      d.age || '',
      d.edu || '',
      d.travel_exp || '',
      d.time1 || '',
      d.time2 || '',
      d.time3 || '',
      d.space1 || '',
      d.space2 || '',
      d.space3 || '',
      d.social1 || '',
      d.social2 || '',
      d.social3 || '',
      d.hypo1 || '',
      d.hypo2 || '',
      d.hypo3 || '',
      d.speed1 || '',
      d.speed2 || '',
      d.speed3 || '',
      d.cl1 || '',
      d.cl2 || '',
      d.cl3 || '',
      d.int1 || '',
      d.int2 || '',
      d.int3 || '',
      d.wtp1 || '',
      d.wtp2 || '',
      d.wtp3 || '',
      d.submit_time || d.timestamp || d.clientTimestamp || ''
    ]);

    let csv = headers.join(',') + '\r\n';
    rows.forEach(row => {
      csv += row.map(escapeCsvCell).join(',') + '\r\n';
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
      localStorage.removeItem(LEGACY_RESEARCH_DATA_KEY);
      localStorage.removeItem(RESEARCH_DATA_KEY);
      if (useFirebase) {
        await clearFirestoreData();
      }
      this.allCloudData = [];
      alert('数据已清空');
    }
  }

  async deleteRecord(recordKey) {
    if (!recordKey) return false;

    const confirmed = confirm(`确定要删除这条记录吗？\n${recordKey}`);
    if (!confirmed) return false;

    const removeFromLocal = () => {
      try {
        const localData = JSON.parse(localStorage.getItem(RESEARCH_DATA_KEY) || '[]');
        const nextData = localData.filter(item => getRecordKey(item) !== recordKey);
        localStorage.setItem(RESEARCH_DATA_KEY, JSON.stringify(nextData));
        this.allCloudData = this.allCloudData.filter(item => getRecordKey(item) !== recordKey);
      } catch (error) {
        console.error('❌ Error deleting local record:', error);
      }
    };

    if (useFirebase) {
      await deleteFirestoreRecord(recordKey);
    }
    removeFromLocal();
    return true;
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
      avgLoadingTime: 0
    };

    data.forEach(d => {
      stats.insuranceDistribution[d.insurance_choice] = (stats.insuranceDistribution[d.insurance_choice] || 0) + 1;
    });

    const wtpValues = data.flatMap(d => [d.wtp1, d.wtp2, d.wtp3])
      .map(value => Number(value) || 0)
      .filter(value => value > 0);
    stats.wtpAverage = wtpValues.reduce((a, b) => a + b, 0) / data.length || 0;

    const loadingTimes = data.map(d => Number(d.loading_time ?? d.responseTime) || 0);
    stats.avgLoadingTime = loadingTimes.reduce((a, b) => a + b, 0) / data.length || 0;

    return stats;
  }

  isFirebaseEnabled() {
    return useFirebase;
  }

  async saveSettings(settings) {
    return await saveSettingsToFirestore(settings);
  }

  async loadSettings() {
    return await loadSettingsFromFirestore();
  }

  listenToSettingsChanges(callback) {
    return listenToSettingsChanges(callback);
  }
}

// ============================================
// 🚀 启动
// ============================================

let dataManager = new DataManager();
