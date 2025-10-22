const axios = require('axios/dist/node/axios.cjs'); //写死node路径，否则pkg打包容易出问题
const MySQLFunctionService = require('./MySQLFunctionService');
const ConnectionManager = require('./ConnectionManager');

class GeminiService {
  constructor() {
    this.mySQLFunctionService = new MySQLFunctionService();
  }

  async generateContent(conversationHistory, llmConfig, connectionId, database, sendEvent) {
    if (!llmConfig || !llmConfig.apiAddress || !llmConfig.apiKey) {
      throw new Error('LLM API address or API key is not configured.');
    }

    // Use the API address from llmConfig, or fallback to the documented default if not provided
    const apiAddress = llmConfig.apiAddress || 'https://api.zhizengzeng.com/v1/chat/completions';

    const messages = [
      {
        role: "system",
        content: `
        你是一个 MySQL 专家，可以使用以下工具：
- get_table_schema(tableName): 获取指定表的结构；
- get_all_table_schemas(): 获取所有表的结构；
- query(sql): 执行 SQL 并返回结果。

执行规则：
1.当用户询问或要求执行 SQL 时：
  - 如果表名未知，请先调用 get_all_table_schemas() 获取所有表名，然后向用户询问。一旦获取到表名列表，请记住它，不要重复调用此工具。
  - 如果表结构未知，请调用 get_table_schema(tableName) 获取。一旦获取到表结构，请记住它，不要重复调用此工具。
2.当你拿到表结构后，再生成高性能、稳定可靠的 SQL。
3.当用户只要求“生成 SQL”时，只返回 SQL 语句，不要附加解释。
4.如果某一步出错（例如表名不存在或工具调用异常），请说明原因并提示用户如何继续。
5.如果用户提供中文表名，你应调用 get_all_table_schemas() 查找最接近的表名。
6.如果 SQL 可以执行，请使用 query(sql) 执行并返回结果。
7.如果你生成SELECT语句,必须指定limit 10,除非用户指定limit
`
      },
      ...conversationHistory // conversationHistory should already contain user and assistant messages
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "get_table_schema",
          description: "获取指定数据库中表的结构信息",
          parameters: {
            type: "object",
            properties: {
              tableName: {
                type: "string",
                description: "要获取结构信息的表名"
              }
            },
            required: ["tableName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_all_table_schemas",
          description: "获取指定数据库中所有表的结构信息",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },
      {
        type: "function",
        function: {
          name: "query",
          description: "在指定数据库中执行SQL查询并返回结果",
          parameters: {
            type: "object",
            properties: {
              sql: {
                type: "string",
                description: "要执行的SQL语句"
              }
            },
            required: ["sql"]
          }
        }
      }
    ];

    const MAX_TOOL_CALL_TURNS = 5; // Safety mechanism to prevent infinite loops
    let toolCallTurns = 0;

    try {
      let currentMessages = [...messages]; // Create a mutable copy of messages

      while (toolCallTurns < MAX_TOOL_CALL_TURNS) {
        sendEvent({ type: 'status', message: 'Thinking...' });
        let response = await axios.post(apiAddress, {
          model: "gpt-4o-mini",
          messages: currentMessages,
          tools: tools,
          tool_choice: "auto"
        }, {
          headers: {
            'Authorization': `Bearer ${llmConfig.apiKey}`
          }
        });

        let firstChoice = response.data.choices[0];

        if (firstChoice.message && firstChoice.message.content) {
          // AI provided a text response, send it and exit loop
          currentMessages.push({ role: "assistant", content: firstChoice.message.content });
          sendEvent({ type: 'message', message: { role: "assistant", content: firstChoice.message.content } });
          sendEvent({ type: 'history', history: currentMessages.filter(msg => msg.role !== 'system') });
          break; 
        } else if (firstChoice.message && firstChoice.message.tool_calls && firstChoice.message.tool_calls.length > 0) {
          // AI wants to call a tool
          sendEvent({ type: 'status', message: 'AI requested tool call.' });
          const { success, error } = await ConnectionManager.getActiveConnection(connectionId);
          if (!success) {
            throw new Error(`Failed to activate connection ${connectionId}: ${error}`);
          }

          const toolCall = firstChoice.message.tool_calls[0];
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          // Send the AI's tool call request to the frontend
          currentMessages.push(firstChoice.message);
          sendEvent({ type: 'message', message: firstChoice.message });

          // Execute the function
          let argsArray = [connectionId, database];
          if (functionName === 'get_table_schema') {
            argsArray.push(functionArgs.tableName);
          } else if (functionName === 'query') {
            argsArray.push(functionArgs.sql);
          } else if (functionName === 'get_all_table_schemas') {
            // No additional args needed beyond connectionId, database
          }

          console.log("开始执行tool function:", functionName);
          sendEvent({ type: 'status', message: `Executing tool: ${functionName}` });
          const functionOutput = await this.mySQLFunctionService.executeFunction(
            functionName,
            argsArray
          );
          console.log("Tool function output:", functionOutput); // Log the output

          // Add the tool's output to the messages history and send to frontend
          const toolOutputMessage = {
            role: "tool",
            tool_call_id: toolCall.id,
            name: functionName,
            content: JSON.stringify(functionOutput)
          };
          currentMessages.push(toolOutputMessage);
          sendEvent({ type: 'message', message: toolOutputMessage });
          
          toolCallTurns++;
        } else {
          throw new Error('Invalid response from AI proxy: No content or tool call found in AI message.');
        }
      }

      if (toolCallTurns >= MAX_TOOL_CALL_TURNS) {
        throw new Error('AI reached maximum tool call turns without providing a final text response.');
      }

    } catch (error) {
      console.error('Error calling AI proxy:', error.message);
      if (error.response) {
        console.error('Proxy response data:', error.response.data);
        console.error('Proxy response status:', error.response.status);
        console.error('Proxy response headers:', error.response.headers);
      } else if (error.request) {
        console.error('No response received from proxy:', error.request);
      }
      throw new Error('Failed to generate content from AI');
    }
  }
}

module.exports = new GeminiService();