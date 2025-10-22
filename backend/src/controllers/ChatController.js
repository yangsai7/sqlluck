const geminiService = require('../services/geminiService');

class ChatController {
  async handleChatMessage(req, res, next) {
    try {
      const { conversationHistory, llmConfig, connectionId, database } = req.body;
      if (!conversationHistory || conversationHistory.length === 0) {
        return res.status(400).json({ success: false, error: 'Conversation history is required' });
      }

      const response = await geminiService.generateContent(conversationHistory, llmConfig, connectionId, database);
      res.json({ success: true, ...response });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ChatController();
