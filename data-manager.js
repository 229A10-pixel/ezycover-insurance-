/**
 * CLT研究数据管理系统
 * 负责采集、存储、管理和导出实验数据
 */

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
  completeSession() {
    this.sessionData.timestamp = new Date().toISOString();
    this.sessionData.endTime = new Date().toISOString();
    
    // 转换为ANOVA分析格式
    const analysisData = this.convertToAnalysisFormat();
    
    // 保存到本地存储
    this.saveToLocalStorage(analysisData);
    
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
  loadAllData() {
    return JSON.parse(localStorage.getItem('clt_research_data') || '[]');
  }

  // 获取所有数据
  getAllData() {
    return this.loadAllData();
  }

  // 按条件筛选数据
  filterData(filters) {
    let data = this.loadAllData();
    
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

  // 导出为CSV格式
  exportToCSV() {
    const data = this.loadAllData();
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
      d.sessionId,
      d.responseTime,
      d.language,
      d.decisionTime,
      d.temporal_distance,
      d.spatial_distance,
      d.hypothetical_distance,
      d.social_distance,
      d.insurance_choice,
      d.wtp_amount,
      d.wtp_acceptance,
      d.construal_level,
      d.risk_perception,
      d.age_group,
      d.manipulation_check_temporal,
      d.manipulation_check_spatial,
      d.manipulation_check_speed,
      d.departure,
      d.destination,
      d.date,
      d.timestamp
    ]);

    // 生成CSV内容
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell || ''}"`).join(',') + '\n';
    });

    // 下载
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
    this.exportToCSV(); // 暂时使用CSV，可后续集成xlsx库
  }

  // 清空所有数据
  clearAllData() {
    if (confirm('确定要清空所有数据吗？此操作不可撤销。')) {
      localStorage.removeItem('clt_research_data');
      alert('数据已清空');
    }
  }

  // 获取数据统计
  getStatistics() {
    const data = this.loadAllData();
    
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
