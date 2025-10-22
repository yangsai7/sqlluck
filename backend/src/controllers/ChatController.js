const geminiService = require('../services/geminiService');

class ChatController {
  async handleChatMessage(req, res, next) {
    const {connectionId, database } = req.query;
    const conversationHistory = JSON.parse(req.query.conversationHistory || '[]');
    const llmConfig = JSON.parse(req.query.llmConfig || '{}');

    if (!conversationHistory || conversationHistory.length === 0) {
      return res.status(400).json({ success: false, error: 'Conversation history is required' });
    }

    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Function to send events to the client
    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (res.flush) res.flush();
    };

    // Handle client disconnect
    req.on('close', () => {
      console.log('Client disconnected from SSE stream.');
      // Optionally, clean up any ongoing processes related to this request
    });

    try {
      await geminiService.generateContent(
        conversationHistory,
        llmConfig,
        connectionId,
        database,
        sendEvent // Pass the sendEvent callback
      );
      sendEvent({ type: 'end' }); // Signal the end of the stream
      res.end(); // End the response after sending all events
    } catch (error) {
      console.error('SSE stream error:', error);
      sendEvent({ type: 'error', error: error.message });
      res.end(); // End the response on error
    }
  }
}

module.exports = new ChatController();
