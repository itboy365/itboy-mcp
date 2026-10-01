// ============================================
// itboy 工具箱 · EdgeOne MCP Server (针对标准客户端修复版)
// ============================================

// 处理初始化请求
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

// 处理工具调用
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
    return { jsonrpc: "2.0", id, error: { code: -32601, message: "工具不存在" } };
  }

  try {
    const r = await fetch(url);
    const text = await r.text();
    return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } };
  } catch (e: any) {
    return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `请求失败：${e.message}` }], isError: true } };
  }
};

const handleUnknownMethod = (id: string) => {
  return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
};

// 解析并路由 JSON-RPC 请求
const processJsonRpcRequest = async (body: any) => {
  if (body.method === "initialize") return handleInitialize(body.id, body.params);
  if (body.method === "tools/list") return handleToolsList(body.id);
  if (body.method === "tools/call") return await handleToolCall(body.id, body.params?.name, body.params?.arguments || {});
  // 处理初始化完成通知（这个非常关键）
  if (body.method === "notifications/initialized") return { jsonrpc: "2.0", result: {} };
  return handleUnknownMethod(body.id);
};

// ============================================
// EdgeOne Pages 入口函数
// ============================================
export const onRequest = async ({ request }: { request: Request }) => {
  const method = request.method.toUpperCase();
  const commonHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Protocol-Version, Accept",
    "Access-Control-Max-Age": "86400",
    "MCP-Protocol-Version": "2024-11-05",
  };

  try {
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: commonHeaders });
    }

    // 修复点：GET 请求直接告诉它这里是什么，不要去猜模板
    if (method === "GET") {
      return new Response(JSON.stringify({ 
        name: "itboy-tools-mcp", 
        status: "running", 
        message: "MCP Server is running. Please use POST method for JSON-RPC.",
        tools: ["get_weather", "get_news60", "get_it_news", "get_gold_price", "get_oil_price"]
      }), {
        headers: { ...commonHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST") {
      const contentType = request.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        return new Response("Unsupported Media Type", { status: 415 });
      }
      const body = await request.json();
      const responseData = await processJsonRpcRequest(body);
      return new Response(JSON.stringify(responseData), {
        headers: { ...commonHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method Not Allowed", { status: 405, headers: commonHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32000, message: error.message } }), {
      status: 500, headers: { ...commonHeaders, "Content-Type": "application/json" },
    });
  }
};
