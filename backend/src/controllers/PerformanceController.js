const PerformanceService = require('../services/PerformanceService');

class PerformanceController {
  async getPerformanceMetrics(req, res) {
    try {
      const metrics = await PerformanceService.getPerformanceMetrics(req.params.connectionId);
      res.json(metrics);
    } catch (error) {
      console.error('Error in getPerformanceMetrics:', error);
      res.status(500).json({ message: error.message });
    }
  }

  async getLockInfo(req, res) {
    try {
      const lockInfo = await PerformanceService.getLockInfo(req.params.connectionId);
      res.json(lockInfo);
    } catch (error) {
      console.error('Error in getLockInfo:', error);
      res.status(500).json({ message: error.message });
    }
  }

  async getHotSql(req, res) {
    try {
      const hotSql = await PerformanceService.getHotSql(req.params.connectionId);
      res.json(hotSql);
    } catch (error) {
      console.error('Error in getHotSql:', error);
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = new PerformanceController();
