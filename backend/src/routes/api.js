// API路由配置
const express = require('express');
const multer = require('multer');
const path = require('path');
const ConnectionController = require('../controllers/ConnectionController');
const QueryController = require('../controllers/QueryController');
const PerformanceController = require('../controllers/PerformanceController');
const ImportExportController = require('../controllers/ImportExportController');

const router = express.Router();

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../temp/'))
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now()
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
    cb(null, `${timestamp}-${originalname}`)
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.sql', '.csv', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// 连接相关路由
router.post('/connections/test', ConnectionController.testConnection);
router.post('/connections', ConnectionController.createConnection);
router.get('/connections', ConnectionController.getConnections);
router.put('/connections/:connectionId', ConnectionController.updateConnection);
router.post('/connections/:connectionId/connect', ConnectionController.connect);
router.delete('/connections/:connectionId', ConnectionController.closeConnection);

// 数据库和表相关路由
router.get('/connections/:connectionId/databases', ConnectionController.getDatabases);
router.get('/connections/:connectionId/databases/:database/tables', ConnectionController.getTables);
router.get('/connections/:connectionId/databases/:database/views', ConnectionController.getViews);
router.get('/connections/:connectionId/databases/:database/functions', ConnectionController.getFunctions);
router.get('/connections/:connectionId/databases/:database/procedures', ConnectionController.getProcedures);

// 查询相关路由
router.post('/connections/:connectionId/query', QueryController.executeQuery);
router.get('/connections/:connectionId/databases/:database/tables/:table/structure', QueryController.getTableStructure);
router.get('/connections/:connectionId/databases/:database/tables/:table/data', QueryController.getTableData);

// 数据操作路由
router.post('/connections/:connectionId/databases/:database/tables/:table/data', QueryController.insertData);
router.put('/connections/:connectionId/databases/:database/tables/:table/data', QueryController.updateData);
router.delete('/connections/:connectionId/databases/:database/tables/:table/data', QueryController.deleteData);

// 性能监控路由
router.get('/connections/:connectionId/performance', PerformanceController.getPerformanceMetrics);
router.get('/connections/:connectionId/locks', PerformanceController.getLockInfo);
router.get('/connections/:connectionId/hot-sql', PerformanceController.getHotSql);

// 导入导出路由
router.get('/connections/:connectionId/databases/:database/tables/:table/export/csv', ImportExportController.exportToCSV);
router.get('/connections/:connectionId/databases/:database/export/structure', ImportExportController.exportStructure);
router.post('/connections/:connectionId/databases/:database/tables/:table/import/csv', ImportExportController.importFromCSV);
router.post('/connections/:connectionId/execute-sql-file', ImportExportController.executeSQLFile);

// 文件上传下载路由
router.post('/upload', upload.single('file'), ImportExportController.uploadFile);
router.get('/download/:filename', ImportExportController.downloadFile);

module.exports = router;