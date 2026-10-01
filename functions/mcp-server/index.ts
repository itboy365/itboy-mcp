// ============================================
// itboy 工具箱 · EdgeOne MCP Server (兼容綦桐网关终极版)
// ============================================

// 处理初始化请求（动态回传客户端请求的版本号，防止因版本不一致被拒绝）
const handleInitialize = (id: string, params: any) => {
  const clientVersion = params?.protocolVersion || "2024-11-05";
  return {
    jsonrpc: "2.0",
    id,
    result: {
      protocolVersion: clientVersion,
      serverInfo: {
        name: "itboy-tools-mcp",
        version: "1.0.0",
      },
      capabilities: {
        tools: {},
      },
    },
  };
};

// 定义工具列表（给 AI 看的菜单）
const handleToolsList = (id: string) => {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      tools: [
        {
          name: "get_weather",
          description: "查询指定城市的天气",
          inputSchema: {
            type: "object",
            properties: {
              city: { type: "string", description: "城市名称，如：北京" },
            },
            required: ["city"],
          },
        },
        {
          name: "get_news60",
          description: "获取每日60秒读懂世界新闻",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "get_it_news",
          description: "获取IT之家科技热榜新闻",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "get_gold_price",
          description: "获取今日黄金价格和品牌金店报价",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "get_oil_price",
          description: "查询指定地区的油价",
          inputSchema: {
            type: "object",
            properties: {
              region: { type: "string", description: "地区名称，如：北京" },
            },
            required: ["region"],
          },
        },
      ],
    },
  };
};

// 处理工具调用的核心逻辑（去请求你的 SCF）
const handleToolCall = async (id: string, name: string, args: any) => {
  let url = '';
  
  if (name === 'get_weather') {
    url = `https://api.itboy.pw/?action=weather&city=${encodeURIComponent(args.city)}&format=text`;
  } else if (name === 'get_news60') {
    url = `https://api.itboy.pw/?action=news60&format=text`;
  } else if (name === 'get_it_news') {
    url = `https://api.itboy.pw/?action=itnews&format=text`;
  } else if (name === 'get_gold_price') {
    url = `https://api.itboy.pw/?action=gold&format=text`;
  } else if (name === 'get_oil_price') {
    url = `https://api.itboy.pw/?action=oil&region=${encodeURIComponent(args.region)}&format=text`;
  } else {
    return {
      jsonrpc: "2.0", id,
      error: { code: -32601, message: "工具不存在" }
    };
  }

  try {
    const r = await fetch(url);
    const text = await r.text();
    
    return {
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text }] },
    };
  } catch (e: any) {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: `请求失败：${e.message}` }],
        isError: true,
      },
    };
  }
};

const handleResourcesOrPromptsList = (id: string, method: string) => {
  const resultKey = method.split("/")[0];
  return {
    jsonrpc: "2.0",
    id,
    result: { [resultKey]: [] },
  };
};

const handleUnknownMethod = (id: string) => {
  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: "Method not found" },
  };
};

// 解析并路由 JSON-RPC 请求
const processJsonRpcRequest = async (body: any) => {
  if (body.method === "initialize") return handleInitialize(body.id, body.params);
  if (body.method === "tools/list") return handleToolsList(body.id);
  
  if (body.method === "tools/call") {
    return await handleToolCall(
      body.id,
      body.params?.name,
      body.params?.arguments || {}
    );
  }

  if (body.method === "resources/list" || body.method === "prompts/list") {
    return handleResourcesOrPromptsList(body.id, body.method);
  }

  return handleUnknownMethod(body.id);
};

// ============================================
// EdgeOne Pages 入口函数
// ============================================
export const onRequest = async ({ request }: { request: Request }) => {
  const method = request.method.toUpperCase();

  // 统一的响应头（把网关可能检查的所有东西都加上）
  const commonHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Protocol-Version, Accept",
    "Access-Control-Max-Age": "86400",
    "MCP-Protocol-Version": "2024-11-05",
  };

  try {
    // 1. 处理跨域预检
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: commonHeaders });
    }

    // 2. 处理 GET 请求（迎合网关的探活机制，不再拒绝，而是返回友好的 SSE）
    if (method === "GET") {
      return new Response("event: endpoint\ndata: /mcp-server\n\n", {
        headers: {
          ...commonHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // 3. 处理 POST 请求（AI 发来的 JSON-RPC）
    if (method === "POST") {
      const contentType = request.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        return new Response("Unsupported Media Type", { status: 415 });
      }

      const body = await request.json();
      const responseData = await processJsonRpcRequest(body);
      const jsonString = JSON.stringify(responseData);

      // 如果网关要求的是 SSE 流（Accept: text/event-stream），就把它包成流返回
      if (request.headers.get("accept")?.includes("text/event-stream")) {
        return new Response(`event: message\ndata: ${jsonString}\n\n`, {
          headers: {
            ...commonHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }

      // 否则返回标准 JSON
      return new Response(jsonString, {
        headers: {
          ...commonHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    return new Response("Method Not Allowed", { status: 405, headers: commonHeaders });
  } catch (error: any) {
    console.error("MCP 处理错误:", error);
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32000, message: "内部服务器错误" },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...commonHeaders },
      }
    );
  }
};
