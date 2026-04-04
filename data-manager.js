/**
 * CLT研究数据管理系统 V2
 * 负责采集、存储、管理和导出实验数据
 * 支持多设备实时同步（使用 Supabase）
 */

// ============================================
// ☁️ Supabase 配置（多设备数据同步）
// ============================================

const SUPABASE_URL = 'https://exeelpqkgdzsbakmazoy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4ZWVscHFrZ2R6c2Jha21hem95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Njg4MTAsImV4cCI6MjA5MDQ0NDgxMH0.9P5-Y1tAV_z30jI3craDSyb3a5sK6-zXw3cjOLF99qM';

let useFirebase = false;
let pendingData = [];
let firebaseInitialized = false;
const PENDING_DATA_KEY = 'clt_pending_sync_data';
const DATA_TABLE = 'clt_research_data';
const SETTINGS_TABLE = 'experiment_settings';

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

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

function getSupabaseHeaders(prefer) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  };
  if (prefer) {
    headers.Prefer = prefer;
  }
  return headers;
}

function mapRowToRecord(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    responseTime: row.response_time,
    language: row.language,
    decisionTime: row.decision_time,
    temporal_distance: row.temporal_distance,
    spatial_distance: row.spatial_distance,
    hypothetical_distance: row.hypothetical_distance,
    social_distance: row.social_distance,
    insurance_choice: row.insurance_choice,
    wtp_amount: row.wtp_amount,
    wtp_acceptance: row.wtp_acceptance,
    construal_level: row.construal_level,
    risk_perception: row.risk_perception,
    age_group: row.age_group,
    manipulation_check_temporal: row.manipulation_check_temporal,
    manipulation_check_spatial: row.manipulation_check_spatial,
    manipulation_check_speed: row.manipulation_check_speed,
    departure: row.departure,
    destination: row.destination,
    date: row.travel_date,
    timestamp: row.client_timestamp,
    clientTimestamp: row.client_timestamp,
    created_at: row.created_at
  };
}

function mapRecordToRow(data) {
  return {
    session_id: data.sessionId,
    response_time: data.responseTime,
    language: data.language,
    decision_time: data.decisionTime,
    temporal_distance: data.temporal_distance,
    spatial_distance: data.spatial_distance,
    hypothetical_distance: data.hypothetical_distance,
    social_distance: data.social_distance,
    insurance_choice: data.insurance_choice,
    wtp_amount: data.wtp_amount,
    wtp_acceptance: data.wtp_acceptance,
    construal_level: data.construal_level,
    risk_perception: data.risk_perception,
    age_group: data.age_group,
    manipulation_check_temporal: data.manipulation_check_temporal,
    manipulation_check_spatial: data.manipulation_check_spatial,
    manipulation_check_speed: data.manipulation_check_speed,
    departure: data.departure,
    destination: data.destination,
    travel_date: data.date,
    client_timestamp: data.timestamp || new Date().toISOString()
  };
}

async function saveToSupabase(data) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await withTimeout(fetch(
      `${SUPABASE_URL}/rest/v1/${DATA_TABLE}?on_conflict=session_id`,
      {
        method: 'POST',
        headers: getSupabaseHeaders('resolution=merge-duplicates,return=representation'),
        body: JSON.stringify(mapRecordToRow(data)),
        signal: controller.signal
      }
    ), 9000, 'Supabase save');

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase save failed: ${response.status} ${errorText}`);
    }

    console.log('✅ Data saved to Supabase:', data.sessionId);
    return true;
  } catch (error) {
    console.error('❌ Supabase save error:', error);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadFromSupabase() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await withTimeout(fetch(
      `${SUPABASE_URL}/rest/v1/${DATA_TABLE}?select=*&order=client_timestamp.desc`,
      { headers: getSupabaseHeaders(), signal: controller.signal }
    ), 9000, 'Supabase load');

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase load failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return Array.isArray(result) ? result.map(mapRowToRecord) : [];
  } catch (error) {
    console.error('❌ Supabase load error:', error);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

function removePendingData(sessionId) {
  pendingData = pendingData.filter(item => item.sessionId !== sessionId);
  persistPendingData();
}

function escapeCsvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

function initializeFirebase() {
  if (firebaseInitialized) return useFirebase;
  loadPendingDataFromStorage();
  useFirebase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  firebaseInitialized = true;
  if (useFirebase) {
    console.log('✅ Supabase initialized successfully - Multi-device sync enabled');
    syncPendingData();
  } else {
    console.warn('⚠️ Supabase not configured, falling back to localStorage only');
  }
  return useFirebase;
}

async function syncPendingData() {
  if (!useFirebase || pendingData.length === 0) return;
  console.log(`📤 Syncing ${pendingData.length} pending records to cloud...`);
  const queuedItems = [...pendingData];
  for (const data of queuedItems) {
    const saved = await saveToSupabase(data);
    if (saved) {
      removePendingData(data.sessionId);
    }
  }
  console.log(`✅ Pending sync complete. ${pendingData.length} records remaining.`);
}

async function saveToFirestoreWithRetry(data, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const saved = await saveToSupabase(data);
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
  return await saveToSupabase(data);
}

async function loadFromFirestore() {
  return await loadFromSupabase();
}

function listenToFirestore(callback) {
  if (!useFirebase) return null;
  console.log('👂 Cloud polling listener started');
  let active = true;

  const poll = async () => {
    if (!active) return;
    const data = await loadFromSupabase();
    callback(data);
  };

  poll();
  const intervalId = setInterval(poll, 3000);
  return () => {
    active = false;
    clearInterval(intervalId);
  };
}

async function clearFirestoreData() {
  if (!useFirebase) return;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${DATA_TABLE}?id=gt.0`, {
      method: 'DELETE',
      headers: getSupabaseHeaders(),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }
    console.log('✅ All cloud data cleared');
  } catch (error) {
    console.error('❌ Error clearing cloud data:', error);
  }
}

// ============================================
// ⚙️ 实验设置同步（跨设备）
// ============================================

async function saveSettingsToFirestore(settings) {
  localStorage.setItem('experiment_settings', JSON.stringify(settings));
  if (!useFirebase) return false;
  try {
    const existingSettings = await loadSettingsFromFirestore();
    const payload = {
      settings_key: 'main',
      response_time: settings.responseTime ?? existingSettings?.responseTime ?? null,
      language: settings.language ?? existingSettings?.language ?? null,
      updated_at: new Date().toISOString()
    };

    const response = await withTimeout(fetch(`${SUPABASE_URL}/rest/v1/${SETTINGS_TABLE}?on_conflict=settings_key`, {
      method: 'POST',
      headers: getSupabaseHeaders('resolution=merge-duplicates,return=representation'),
      body: JSON.stringify(payload)
    }), 9000, 'Supabase settings save');

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    console.log('✅ Settings saved to cloud:', settings);
    return true;
  } catch (error) {
    console.error('❌ Error saving settings:', error);
    return false;
  }
}

async function loadSettingsFromFirestore() {
  const localSettings = JSON.parse(localStorage.getItem('experiment_settings') || 'null');
  if (!useFirebase) {
    return localSettings;
  }
  try {
    const response = await withTimeout(fetch(`${SUPABASE_URL}/rest/v1/${SETTINGS_TABLE}?select=*&settings_key=eq.main&limit=1`, {
      headers: getSupabaseHeaders()
    }), 9000, 'Supabase settings load');

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    const rows = await response.json();
    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0];
      const settings = {
        responseTime: row.response_time,
        language: row.language
      };
      console.log('✅ Settings loaded from cloud:', settings);
      return settings;
    }
  } catch (error) {
    console.error('❌ Error loading settings:', error);
  }
  return localSettings;
}

function listenToSettingsChanges(callback) {
  let lastSerialized = null;
  const sync = async () => {
    const settings = await loadSettingsFromFirestore();
    const serialized = JSON.stringify(settings || {});
    if (serialized !== lastSerialized) {
      lastSerialized = serialized;
      callback(settings || {});
    }
  };

  sync();
  const intervalId = setInterval(sync, 3000);
  return () => clearInterval(intervalId);
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
    const survey = this.sessionData.surveyAnswers;
    const data = {
      user_id: this.sessionData.sessionId,
      loading_time: this.sessionData.responseTime,
      insurance_choice: this.sessionData.userChoices.insurance || '',
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
    
    return data;
  }

  getAnswerByVariable(variable) {
    const value = this.sessionData.surveyAnswers[variable];
    return value === undefined ? null : value;
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
    
    if (filters.loading_time) {
      data = data.filter(d => d.loading_time === filters.loading_time);
    }
    
    return data;
  }

  filterData(filters) {
    let data = this.getAllData();
    
    if (filters.loading_time) {
      data = data.filter(d => d.loading_time === filters.loading_time);
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
      'user_id', 'loading_time', 'insurance_choice', 'gender', 'age', 'edu', 'travel_exp',
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

// 全局数据管理器实例
let dataManager = new DataManager();
